#!/usr/bin/env python3
"""Native messaging host that reads and writes markdown notes in one folder.

The extension cannot touch the disk, so every Notes action is one request to
this host, answered with one frame, then the process exits. Every request
names the notes root; a path that resolves outside it is refused.

Ops (request -> reply):
  {op:"stat",   root}                        -> {t:"stat", root, count}
  {op:"list",   root}                        -> {t:"list", notes:[{rel,size,mtime}]}
  {op:"read",   root, rel}                   -> {t:"note", rel, text, mtime}
  {op:"write",  root, rel, text, expectMtime?} -> {t:"written", rel, mtime}
  {op:"create", root, rel, text?}            -> {t:"written", rel, mtime}
  {op:"rename", root, rel, to}               -> {t:"renamed", rel, to}
  {op:"delete", root, rel}                   -> {t:"deleted", rel, trashed}
  {op:"trashList", root}                     -> {t:"trash", notes:[{trashed, name, title, size, mtime, deleted}]}   (what .trash holds, newest first)
  {op:"restore", root, trashed, to?}         -> {t:"restored", rel, trashed}   (back to `to`, or the note's own name; never overwrites)
  {op:"writeBinary", root, rel, base64}      -> {t:"written", rel, mtime}   (attachments, never overwrites)
  {op:"history", root, rel}                  -> {t:"history", rel, versions:[{sha,when,reason}], repo}  (git log; none outside a repo)
  {op:"version", root, rel, sha}             -> {t:"version", rel, sha, text}
  {op:"pick", start?}                        -> {t:"picked", root}   (the system folder chooser; root is "" when cancelled)
  {op:"search", root, query}                 -> {t:"search", hits:[{rel, line}]}   (every word, any case; first matching line)
  {op:"fileRead",  root, rel, offset?}       -> {t:"file", rel, text, mtime, next}   (any text file; root is a folder allowed for editing; read in slices until next is null)
  {op:"fileStat",  root, rel}                -> {t:"fstat", rel, mtime, size}
  {op:"commentsRead",  root, rel}            -> {t:"comments", rel, threads, where, companion, notes, doc}   (bfb-docs comments; spec .claude/specs/bfb-docs.md)
  {op:"commentsWrite", root, rel, ops}       -> the same, plus results   (writes the companion only, as the owner)
  {op:"docsIndex"}                           -> {t:"docsIndex", docs}   (every document with comments)
  {op:"people"}                              -> {t:"people", peers}   (live and idle claude-ipc agents, for @claude:<alias>)
  {op:"fileWrite", root, rel, text, expectMtime} -> {t:"written", rel, mtime, backup}   (existing text files under 20 MB; old text backed up 14 days)
  {op:"sendThread", root, rel, thread, to}   -> {t:"sent", to, thread}   (one comment thread to an agent, through claude-ipc)
  {op:"phone", action:"status"|"on"|"off"}   -> {t:"phone", on, server, served, url, why}   (bfb on the tailnet: web_server.py under pm2, tailscale serve)
  {op:"phoneSeed", kv}                       -> {t:"seeded"}   (the Mac's settings, for the phone to start from)
  {op:"svc_seen", port}                      -> {t:"svc_seen"}   (bfb is running, and this local port's tab is in front; BFB_SVC_TOUCH_DIR overrides where svc reads it)
Errors: {t:"error", code, message} with code in notes_bad_root, notes_bad_path,
notes_missing, notes_exists, notes_conflict, notes_io. mtime is epoch ms.
Delete moves the file into <root>/.trash/ rather than unlinking it; restore moves it back out.
"""
import bisect
import contextlib
import sys, os, re, json, struct, time, shutil, subprocess
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import notefmt
import notes_lock

def read_msg():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4: return None
    length = struct.unpack('=I', raw)[0]
    return json.loads(sys.stdin.buffer.read(length).decode('utf-8'))

def write_msg(obj):
    enc = json.dumps(obj).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('=I', len(enc)))
    sys.stdout.buffer.write(enc)
    sys.stdout.buffer.flush()

class NotesError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code

def resolve_root(root):
    """The notes folder as typed in Settings: a path, a file:// address, or ~ for home all mean the folder."""
    if isinstance(root, str):
        root = root.strip()
        if root.startswith('file://'):
            from urllib.parse import unquote, urlparse
            root = unquote(urlparse(root).path)
        root = os.path.expanduser(root)
    if not isinstance(root, str) or not root.startswith('/'):
        raise NotesError('notes_bad_root', 'root must be an absolute folder path, like /Users/you/Notes')
    real = os.path.realpath(root)
    if not os.path.isdir(real):
        raise NotesError('notes_bad_root', f'not a folder: {root}')
    return real

def resolve_rel(root, rel):
    if not isinstance(rel, str) or not rel or rel.startswith('/') or '\0' in rel:
        raise NotesError('notes_bad_path', 'path must be relative to the notes folder')
    full = os.path.realpath(os.path.join(root, rel))
    if full != root and not full.startswith(root + os.sep):
        raise NotesError('notes_bad_path', 'path escapes the notes folder')
    return full

def mtime_ms(p):
    return int(os.stat(p).st_mtime * 1000)

def op_stat(root):
    return {'t': 'stat', 'root': root, 'count': len(list_notes(root))}

def list_notes(root):
    out = []
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if not d.startswith('.'))
        for f in files:
            if not f.lower().endswith('.md') or f.startswith('.'):
                continue
            full = os.path.join(dirpath, f)
            st = os.stat(full)
            out.append({'rel': os.path.relpath(full, root), 'size': st.st_size,
                        'mtime': int(st.st_mtime * 1000), 'title': note_title(full), **note_props(full)})
    out.sort(key=lambda n: -n['mtime'])
    return out

def parsed_note(full):
    """One note read by the shared spec rules (notefmt.py), or None when it cannot be opened.
    A clash file is not parsed for a header, so its title is its file name."""
    try:
        with open(full, 'r', encoding='utf-8', errors='replace', newline='') as fh:
            text = fh.read(2 * 1024 * 1024)
    except OSError:
        return None
    name = os.path.basename(full)
    if name.lower().endswith('.md'):
        name = name[:-3]
    return notefmt.parse(text, name)

def note_props(full):
    """The colour, pin, tags and place a note's header holds, read by the spec rules."""
    props = {'color': '', 'pinned': False, 'tags': [], 'pos': '', 'created': None}
    n = parsed_note(full)
    if n is None:
        return props
    props.update(color=n['color'] or '', pinned=n['pinned'], tags=n['tags'], pos=n['pos'] or '')
    props.update(conflicted=n['conflicted'])
    for key in ('agent', 'source', 'url', 'device', 'expires', 'remindAt', 'remindRepeat', 'remindOn', 'remindPersist'):
        if n[key]:
            props[key] = n[key]
    if n['created']:
        try:
            props['created'] = int(datetime.fromisoformat(n['created'].replace('Z', '+00:00')).timestamp() * 1000)
        except ValueError:
            pass
    return props

def note_title(full):
    """What the sidebar calls a note, by the spec: its title key, else its first body line, else its file name."""
    n = parsed_note(full)
    return n['title'] if n else ''

def op_read(root, rel):
    full = resolve_rel(root, rel)
    if not os.path.isfile(full):
        raise NotesError('notes_missing', f'no such note: {rel}')
    with open(full, 'r', encoding='utf-8', errors='replace') as fh:
        text = fh.read()
    return {'t': 'note', 'rel': rel, 'text': text, 'mtime': mtime_ms(full)}

def atomic_write(full, text):
    """Replace a file's text in one step, keeping its permission bits (an
    executable script stays executable). The new text is written to a hidden
    temp file beside it and synced, so a crash leaves the old file or the new
    one, never half of either."""
    write_bytes_atomic(full, text.encode('utf-8'), newline_ok=True)

def write_bytes_atomic(full, data, newline_ok=False):
    os.makedirs(os.path.dirname(full), exist_ok=True)
    tmp = os.path.join(os.path.dirname(full), '.' + os.path.basename(full) + '.tmp-' + str(os.getpid()))
    try:
        with open(tmp, 'wb') as fh:
            fh.write(data)
            fh.flush()
            os.fsync(fh.fileno())
        if os.path.exists(full):
            os.chmod(tmp, os.stat(full).st_mode & 0o7777)
        os.replace(tmp, full)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)

def check_editable(full, raw):
    """Refuse files an edit would damage: read-only ones, and ones that are not
    valid UTF-8 (saving would replace the bad bytes for good)."""
    if not os.access(full, os.W_OK):
        raise NotesError('notes_bad_path', 'this file is read-only, so it is not edited here')
    try:
        raw.decode('utf-8')
    except UnicodeDecodeError:
        raise NotesError('notes_bad_path', 'this file is not UTF-8 text, so it is not edited here')

def op_write(root, rel, text, expect_mtime=None):
    full = resolve_rel(root, rel)
    if not full.lower().endswith('.md'):
        raise NotesError('notes_bad_path', 'notes are .md files')
    if expect_mtime is not None:
        if not os.path.exists(full):
            raise NotesError('notes_missing', 'the note was removed from disk')
        if mtime_ms(full) != int(expect_mtime):
            raise NotesError('notes_conflict', 'the note changed on disk since it was read')
    atomic_write(full, text if isinstance(text, str) else '')
    return {'t': 'written', 'rel': rel, 'mtime': mtime_ms(full)}

FILE_MAX = 20 * 1024 * 1024
# Chrome refuses any reply from a native host over 1 MB, so a file is read in
# slices whose JSON form stays under this many bytes.
READ_BYTES = 900_000
# BFB_BACKUP_DIR overrides where backups go (the e2e harness points it into its throwaway profile).
BACKUP_DIR = os.environ.get('BFB_BACKUP_DIR') or os.path.expanduser('~/Library/Application Support/BetterFileBrowser/backups')
BACKUP_DAYS = 14

def op_file_write(root, rel, text, expect_mtime):
    """Save a text file inside a folder the person allowed for editing.

    The previous text is copied to a dated backup folder first (kept 14 days),
    so an edit outside git can still be undone. Unlike notes, any text file
    type is fine, but the file must already exist and stay under 20 MB."""
    full = resolve_rel(root, rel)
    if not os.path.isfile(full):
        raise NotesError('notes_missing', f'no such file: {rel}')
    if expect_mtime is None or mtime_ms(full) != int(expect_mtime):
        raise NotesError('notes_conflict', 'the file changed on disk since it was read')
    text = text if isinstance(text, str) else ''
    if len(text.encode('utf-8')) > FILE_MAX:
        raise NotesError('notes_bad_path', 'files over 20 MB are not edited here')
    with open(full, 'rb') as fh:
        old = fh.read()
    if b'\0' in old[:8192]:
        raise NotesError('notes_bad_path', 'binary files are not edited here')
    check_editable(full, old)
    # The editor works in \n; a file that used CRLF is written back with CRLF.
    if b'\r\n' in old:
        text = text.replace('\r\n', '\n').replace('\n', '\r\n')
    day = time.strftime('%Y%m%d')
    dst = os.path.join(BACKUP_DIR, day, full.lstrip('/') + time.strftime('.%H%M%S'))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'wb') as fh:
        fh.write(old)
    prune_backups()
    atomic_write(full, text)
    return {'t': 'written', 'rel': rel, 'mtime': mtime_ms(full), 'backup': dst}

def prune_backups():
    """Drop backup days older than the keep window."""
    cutoff = time.strftime('%Y%m%d', time.localtime(time.time() - BACKUP_DAYS * 86400))
    try:
        for day in os.listdir(BACKUP_DIR):
            if day.isdigit() and day < cutoff:
                shutil.rmtree(os.path.join(BACKUP_DIR, day), ignore_errors=True)
    except OSError:
        pass

def op_file_read(root, rel, offset=0):
    """One slice of a text file, from character `offset`; `next` is where the
    following slice starts, or None at the end. The caller checks that every
    slice carries the same mtime, so a file changed mid-read is read again."""
    full = resolve_rel(root, rel)
    if not os.path.isfile(full):
        raise NotesError('notes_missing', f'no such file: {rel}')
    if os.path.getsize(full) > FILE_MAX:
        raise NotesError('notes_bad_path', 'files over 20 MB are not edited here')
    mtime = mtime_ms(full)
    with open(full, 'rb') as fh:
        raw = fh.read()
    check_editable(full, raw)
    text = raw.decode('utf-8').replace('\r\n', '\n')
    if offset is None:
        # A client from before slicing reads the whole file in one reply; a
        # slice would look like the full text to it and be saved truncated.
        return {'t': 'file', 'rel': rel, 'text': text, 'mtime': mtime}
    start = max(0, int(offset))
    # Plain ASCII escapes to one byte a character; anything else to more, so
    # shrink the slice until its escaped form fits.
    end = start + READ_BYTES
    while end > start + 1 and len(json.dumps(text[start:end])) > READ_BYTES:
        end = start + (end - start) * 3 // 4
    return {'t': 'file', 'rel': rel, 'text': text[start:end], 'mtime': mtime,
            'next': end if end < len(text) else None}

def op_file_stat(root, rel):
    """A file's modified time and size, so a watcher can skip re-reading an unchanged file."""
    full = resolve_rel(root, rel)
    if not os.path.isfile(full):
        raise NotesError('notes_missing', f'no such file: {rel}')
    return {'t': 'fstat', 'rel': rel, 'mtime': mtime_ms(full), 'size': os.path.getsize(full)}

def op_search(root, query):
    """Notes whose text holds every word of the query (any case), newest first, each with its first matching line."""
    words = [w for w in (query or '').lower().split() if w]
    hits = []
    if not words:
        return {'t': 'search', 'hits': hits}
    for n in list_notes(root):
        try:
            with open(os.path.join(root, n['rel']), 'r', encoding='utf-8', errors='replace') as fh:
                text = fh.read(512 * 1024)
        except OSError:
            continue
        low = text.lower()
        if all(w in low for w in words):
            line = next((l.strip() for l in text.splitlines() if any(w in l.lower() for w in words)), '')
            hits.append({'rel': n['rel'], 'line': line[:160]})
        if len(hits) >= 200:
            break
    return {'t': 'search', 'hits': hits}

def op_create(root, rel, text):
    full = resolve_rel(root, rel)
    if os.path.exists(full):
        raise NotesError('notes_exists', f'already exists: {rel}')
    return op_write(root, rel, text)

def op_write_binary(root, rel, b64):
    import base64
    full = resolve_rel(root, rel)
    if os.path.exists(full):
        raise NotesError('notes_exists', f'already exists: {rel}')
    try:
        data = base64.b64decode(b64 or '', validate=True)
    except Exception:
        raise NotesError('notes_bad_path', 'attachment payload is not base64')
    if len(data) > 20 * 1024 * 1024:
        raise NotesError('notes_io', 'attachment over 20 MB')
    write_bytes_atomic(full, data)
    return {'t': 'written', 'rel': rel, 'mtime': mtime_ms(full)}

def op_rename(root, rel, to):
    src = resolve_rel(root, rel)
    dst = resolve_rel(root, to)
    if not os.path.isfile(src):
        raise NotesError('notes_missing', f'no such note: {rel}')
    if os.path.exists(dst):
        raise NotesError('notes_exists', f'already exists: {to}')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    os.replace(src, dst)
    # The note's comments go with it.
    if os.path.exists(src + COMPANION) and not os.path.exists(dst + COMPANION):
        os.replace(src + COMPANION, dst + COMPANION)
    return {'t': 'renamed', 'rel': rel, 'to': to}

def op_delete(root, rel):
    full = resolve_rel(root, rel)
    if not os.path.isfile(full):
        raise NotesError('notes_missing', f'no such note: {rel}')
    trash = os.path.join(root, '.trash')
    os.makedirs(trash, exist_ok=True)
    stamp = time.strftime('%Y%m%d-%H%M%S')
    # The name in .trash carries the note's folder, so a restore can put it back there.
    name = trash_name(os.path.relpath(full, root))
    dst = os.path.join(trash, f'{stamp}-{name}')
    n = 1
    while os.path.exists(dst):
        n += 1
        dst = os.path.join(trash, f'{stamp}.{n}-{name}')
    shutil.move(full, dst)
    if os.path.exists(full + COMPANION):
        shutil.move(full + COMPANION, dst + COMPANION)
    return {'t': 'deleted', 'rel': rel, 'trashed': os.path.relpath(dst, root)}

TRASH_STAMP = re.compile(r'^(\d{8}-\d{6})(?:\.\d+)?-(.+)$')

def trash_name(rel):
    """A note's path folded into one file name: `sub/old.md` becomes `sub%2Fold.md`."""
    return rel.replace('%', '%25').replace(os.sep, '%2F')

def trash_rel(name):
    """The note path a .trash file name stands for; names from before folders were kept are bare."""
    return name.replace('%2F', '/').replace('%25', '%')

def op_trash_list(root):
    """The notes in <root>/.trash, newest first, each with the name it had before it was deleted."""
    trash = os.path.join(root, '.trash')
    out = []
    if os.path.isdir(trash):
        for f in os.listdir(trash):
            full = os.path.join(trash, f)
            if not f.lower().endswith('.md') or f.startswith('.') or not os.path.isfile(full):
                continue
            m = TRASH_STAMP.match(f)
            st = os.stat(full)
            when = int(st.st_mtime * 1000)
            if m:
                try: when = int(time.mktime(time.strptime(m.group(1), '%Y%m%d-%H%M%S')) * 1000)
                except ValueError: pass
            out.append({'trashed': '.trash/' + f, 'name': trash_rel(m.group(2)) if m else f, 'title': note_title(full),
                        'size': st.st_size, 'mtime': int(st.st_mtime * 1000), 'deleted': when})
    out.sort(key=lambda n: -n['deleted'])
    return {'t': 'trash', 'notes': out}

def op_restore(root, trashed, to):
    """Move a deleted note back out of .trash, with its comments. It goes to `to` when that is free,
    otherwise under a numbered name beside it, so a restore never overwrites a note."""
    src = resolve_rel(root, trashed)
    trash = os.path.join(root, '.trash')
    if os.path.dirname(src) != trash or not os.path.isfile(src):
        raise NotesError('notes_missing', f'no such note in .trash: {trashed}')
    m = TRASH_STAMP.match(os.path.basename(src))
    want = to if isinstance(to, str) and to else (trash_rel(m.group(2)) if m else os.path.basename(src))
    dst = resolve_rel(root, want)
    if dst == trash or dst.startswith(trash + os.sep):
        raise NotesError('notes_bad_path', 'a note is not restored into .trash')
    stem, ext = os.path.splitext(dst)
    n = 1
    while os.path.exists(dst):
        n += 1
        dst = f'{stem} ({n}){ext}'
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    os.replace(src, dst)
    if os.path.exists(src + COMPANION) and not os.path.exists(dst + COMPANION):
        os.replace(src + COMPANION, dst + COMPANION)
    return {'t': 'restored', 'rel': os.path.relpath(dst, root), 'trashed': trashed}

def in_repo(root):
    """Whether the notes folder is a git repository or sits inside one, as mnt-sync's notes/ does."""
    here = os.path.realpath(root)   # ~/Notes is a link into the clone, and the repository is found from where it points
    while True:
        if os.path.exists(os.path.join(here, '.git')):
            return True
        parent = os.path.dirname(here)
        if parent == here:
            return False
        here = parent

def git_out(root, args):
    """git's output in the notes folder, or None when the folder is not in a repository or git says no."""
    import subprocess
    if not in_repo(root):
        return None
    try:
        r = subprocess.run(['git', '-C', root] + args, capture_output=True, text=True, timeout=10,
                           env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'})
    except (OSError, subprocess.TimeoutExpired):
        return None
    return r.stdout if r.returncode == 0 else None

def op_history(root, rel):
    """Every saved version of a note, newest first. A folder that is not a repository has none."""
    resolve_rel(root, rel)
    versions = []
    # --follow keeps the versions a note had under its earlier file name.
    for line in (git_out(root, ['log', '--follow', '--format=%h%x09%ct%x09%s', '--', rel]) or '').splitlines():
        parts = line.split('\t', 2)
        if len(parts) == 3 and parts[1].isdigit():
            versions.append({'sha': parts[0], 'when': int(parts[1]) * 1000, 'reason': parts[2]})
    return {'t': 'history', 'rel': rel, 'versions': versions, 'repo': in_repo(root)}

def renamed_paths(root, rel, sha):
    """The file names a note had at one commit, found by following its renames."""
    out = git_out(root, ['log', '--follow', '--format=%x00%h', '--name-only', '--', rel]) or ''
    for block in out.split('\0'):
        lines = [l for l in block.splitlines() if l.strip()]
        if lines and sha.startswith(lines[0]) or (lines and lines[0].startswith(sha)):
            return lines[1:]
    return []

def op_version(root, rel, sha):
    resolve_rel(root, rel)
    if not isinstance(sha, str) or not sha.isalnum():
        raise NotesError('notes_bad_path', 'a version is named by its commit hash')
    text = git_out(root, ['show', f'{sha}:{rel}'])
    if text is None:
        # A version from before a rename lives under the note's older file name, and git
        # names that from the top of the repository, which also finds a folder inside one.
        for old in renamed_paths(root, rel, sha):
            text = git_out(root, ['show', f'{sha}:{old}'])
            if text is not None:
                break
    if text is None:
        raise NotesError('notes_missing', f'no version {sha} of {rel}')
    return {'t': 'version', 'rel': rel, 'sha': sha, 'text': text}

# A file or a folder from one chooser. AppleScript's own choosers take one or
# the other, so this asks AppKit through JavaScript for Automation.
PICK_ANY = """
ObjC.import('AppKit');
var p = $.NSOpenPanel.openPanel;
p.canChooseFiles = true; p.canChooseDirectories = true; p.allowsMultipleSelection = false;
p.message = 'Open a file or folder';
if (START) p.directoryURL = $.NSURL.fileURLWithPath(START);
$.NSApplication.sharedApplication.activateIgnoringOtherApps(true);
p.runModal == $.NSModalResponseOK ? ObjC.unwrap(p.URLs.objectAtIndex(0).path) : '';
"""

def run_picker(start, kind=None):
    """Ask macOS for a folder (or, with kind 'any', a file or a folder) and
    return its path, a folder ending in /; empty text when the person cancels."""
    if kind == 'any':
        here = os.path.realpath(os.path.expanduser(start)) if isinstance(start, str) and start else ''
        if here and not os.path.isdir(here): here = os.path.dirname(here)
        r = subprocess.run(['osascript', '-l', 'JavaScript', '-e', PICK_ANY.replace('START', json.dumps(here))], capture_output=True, text=True)
        if r.returncode != 0:
            raise NotesError('notes_io', r.stderr.strip() or 'the chooser failed')
        p = r.stdout.strip()
        return (p.rstrip('/') + '/') if p and os.path.isdir(p) else p
    where = ''
    if isinstance(start, str) and os.path.isdir(os.path.expanduser(start)) and not any(c in start for c in '"\\'):
        where = f' default location (POSIX file "{os.path.realpath(os.path.expanduser(start))}")'
    script = ['tell application "System Events"', 'activate',
              f'set p to POSIX path of (choose folder with prompt "Choose your notes folder"{where})',
              'end tell', 'return p']
    args = ['osascript']
    for line in script: args += ['-e', line]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        if 'User canceled' in r.stderr: return ''
        raise NotesError('notes_io', r.stderr.strip() or 'the folder chooser failed')
    return r.stdout.strip().rstrip('/') or '/'

COMPANION = '.bfb.json'
REPLY_MAX = 900_000   # Chrome refuses a native reply over 1 MB

def _docs():
    """The bfb-docs store, imported on first use so notes never pay for it."""
    sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
    import docs_store
    return docs_store

# The page counts text in UTF-16 units, where an emoji or other character
# outside the basic plane is two; Python counts it as one. Comment positions
# cross that line here, both ways, so stored anchors stay in characters and
# the page gets numbers it can slice its own string with. Without this, every
# comment after an emoji landed that many characters early.
class _Units:
    def __init__(self, text):
        self.wide = [i for i, ch in enumerate(text) if ord(ch) > 0xFFFF]
    def to_py(self, n):
        """A page (UTF-16) offset as a character offset."""
        lo, hi = 0, len(self.wide)
        while lo < hi:   # astral characters wholly before the offset, each one unit too many
            mid = (lo + hi) // 2
            if self.wide[mid] + mid + 2 <= n: lo = mid + 1
            else: hi = mid
        return n - lo
    def to_page(self, i):
        """A character offset as a page (UTF-16) offset."""
        return i + bisect.bisect_left(self.wide, i)

def _page_ops(full, ops):
    """Spans in operations from the page, turned into character offsets."""
    u = _Units(_read_text(full))
    out = []
    for o in ops:
        o = dict(o)
        for k in ('start', 'end'):
            if isinstance(o.get(k), int): o[k] = u.to_py(o[k])
        out.append(o)
    return out

def _page_places(full, threads):
    """Thread positions in a reply, turned into page (UTF-16) offsets."""
    u = _Units(_read_text(full))
    if not u.wide:
        return threads
    def fix(d):
        if isinstance(d, dict) and isinstance(d.get('offset'), int):
            end = d['offset'] + (d.get('length') or 0)
            d['offset'] = u.to_page(d['offset'])
            if isinstance(d.get('length'), int): d['length'] = u.to_page(end) - d['offset']
    for t in threads:
        fix(t.get('place'))
        a = t.get('anchor') or {}
        if isinstance(a.get('offset'), int):
            a['offset'] = u.to_page(a['offset'])
        fix(a.get('lastSeen'))
    return threads

def _read_text(full):
    with open(full, encoding='utf-8', errors='replace', newline='') as f:
        return f.read()

def _comments_reply(rel, v, full=None):
    threads = _page_places(full, v['threads']) if full else v['threads']
    out = {'t': 'comments', 'rel': rel, 'threads': threads, 'where': v['where'],
           'companion': v['path'], 'notes': v['notes'], 'doc': v['doc']}
    if len(json.dumps(out)) > REPLY_MAX:
        raise NotesError('notes_too_big', 'this file has too many comments to send at once')
    return out

def op_comments_read(root, rel):
    """Every thread on a document, each with where it sits in the text now."""
    full = resolve_rel(root, rel)
    if not os.path.isfile(full):
        raise NotesError('notes_missing', f'no such file: {rel}')
    S = _docs()
    try:
        return _comments_reply(rel, S.view(full), full)
    except S.DocsError as e:
        raise NotesError(e.code, str(e))

def op_comments_write(root, rel, ops):
    """Apply comment operations as the owner and return the threads after them.
    The document itself is never written here."""
    full = resolve_rel(root, rel)
    if not os.path.isfile(full):
        raise NotesError('notes_missing', f'no such file: {rel}')
    if not isinstance(ops, list) or not all(isinstance(o, dict) and o.get('op') for o in ops):
        raise NotesError('notes_bad_op', 'ops must be a list of operations')
    S = _docs()
    try:
        results, _, _, notes = S.write(full, _page_ops(full, ops), S.whoami('user')[0])
        out = _comments_reply(rel, S.view(full), full)
    except S.DocsError as e:
        raise NotesError(e.code, str(e))
    except ValueError as e:
        raise NotesError('notes_bad_op', str(e))
    out['results'] = results
    out['notes'] = notes + out['notes']
    return out

def op_docs_index():
    """Every document with comments that bfb or the CLI has written, for the Docs lens."""
    rows = []
    for comp, row in _docs().read_index().get('docs', {}).items():
        rows.append({**row, 'companion': comp, 'exists': os.path.exists(row.get('doc', ''))})
    return {'t': 'docsIndex', 'docs': rows}

def op_comments_search(query):
    """Comment threads, in every document the comment index knows, whose text holds every word of the query.
    Each hit names the document, the words commented on, and the matching line; newest document first, at most 100."""
    words = [w for w in (query or '').lower().split() if w]
    hits = []
    if not words:
        return {'t': 'commentsSearch', 'hits': hits}
    store = _docs()
    rows = sorted(store.read_index().get('docs', {}).values(), key=lambda r: r.get('updated') or '', reverse=True)
    for row in rows:
        doc = row.get('doc', '')
        if not doc or not os.path.exists(doc):
            continue
        try:
            data = store.load(doc)[0]
        except Exception:
            continue
        block = (data or {}).get('comments')
        for th in (block.get('threads', []) if isinstance(block, dict) else []):
            texts = [c.get('text', '') for c in th.get('comments', []) if not c.get('deleted')]
            hay = ' '.join(texts + [(th.get('anchor') or {}).get('exact', '')]).lower()
            if all(w in hay for w in words):
                line = next((t for t in texts if any(w in t.lower() for w in words)), texts[0] if texts else '')
                hits.append({'doc': doc, 'thread': th.get('id'), 'anchor': (th.get('anchor') or {}).get('exact', '')[:120],
                             'line': line.replace('\n', ' ')[:160], 'status': th.get('status', 'open')})
                if len(hits) >= 100:
                    return {'t': 'commentsSearch', 'hits': hits}
    return {'t': 'commentsSearch', 'hits': hits}

DP_VERBS = ('compose', 'submit', 'seen', 'parse')
# BFB_DP_BIN overrides gcc's command (the tests point it at a stub).
DP_BIN = os.environ.get('BFB_DP_BIN') or os.path.expanduser('~/.claude/scripts/decision-page/decision-page.sh')

# gcc's exit codes: 3 the page is already answered, 4 its page server is down
# and nothing was written.
DP_EXIT_CODES = {3: 'dp_conflict', 4: 'dp_unavailable'}

def op_dp(verb, slug, payload):
    """Hand a decision page's answer work to gcc's own command and relay its reply.

    bfb never composes, parses or writes an answer itself. compose sends the
    picks as JSON and gets the answer text back as {answer}; parse sends
    {answer} and gets the picks back; submit sends {answer, replace} and gets
    the server's reply with how the asker was told; seen sends nothing.
    A refusal comes back as a stable code read from gcc's exit status."""
    if verb not in DP_VERBS:
        raise NotesError('notes_bad_op', f'unknown decision-page verb {verb!r}')
    if not isinstance(slug, str) or not re.fullmatch(r'[a-z0-9][a-z0-9._-]{0,80}', slug):
        raise NotesError('notes_bad_path', 'not a decision page name')
    if not os.path.isfile(DP_BIN) or not os.access(DP_BIN, os.X_OK):
        raise NotesError('dp_unavailable', 'the decision-page command is not installed')
    payload = payload if isinstance(payload, dict) else {}
    args, stdin = [DP_BIN, verb, slug], ''
    if verb == 'compose':
        stdin = json.dumps(payload)
    elif verb in ('parse', 'submit'):
        stdin = payload.get('answer') if isinstance(payload.get('answer'), str) else ''
        if verb == 'submit':
            args += ['--via', 'page'] + (['--replace'] if payload.get('replace') is True else [])
    try:
        run = subprocess.run(args, input=stdin, capture_output=True, text=True, timeout=30)
    except subprocess.TimeoutExpired:
        raise NotesError('dp_unavailable', 'the decision-page command did not answer in 30 seconds')
    if verb == 'compose' and run.returncode == 0:
        return {'t': 'dp', 'verb': verb, 'slug': slug, 'result': {'answer': run.stdout.rstrip('\n')}}
    try:
        out = json.loads(run.stdout) if run.stdout.strip() else {}
    except ValueError:
        out = {'text': run.stdout}
    if run.returncode != 0:
        code = DP_EXIT_CODES.get(run.returncode) or (out.get('code') if isinstance(out, dict) else None) or 'dp_failed'
        msg = run.stderr.strip() or (out.get('message') or out.get('error') if isinstance(out, dict) else None) or f'exit {run.returncode}'
        raise NotesError(code, msg)
    return {'t': 'dp', 'verb': verb, 'slug': slug, 'result': out}

# BFB_DP_REGISTRY overrides where gcc keeps decision pages (the walks use a copy).
DP_REGISTRY = os.environ.get('BFB_DP_REGISTRY') or os.path.expanduser('~/.claude/assets/decision-pages')
DP_FRESH_S = 7 * 24 * 3600
DP_REACH = ('hot', 'cold', 'absent')

def _dp_reach():
    """Whether the agent behind each pending page can still be woken, from
    gcc's `decision-page.sh reach` in one call: {slug: hot|cold|absent}.
    None when the command is missing or fails, which the lens shows as unknown."""
    if not os.path.isfile(DP_BIN) or not os.access(DP_BIN, os.X_OK):
        return None
    try:
        run = subprocess.run([DP_BIN, 'reach'], capture_output=True, text=True, timeout=10)
        out = json.loads(run.stdout) if run.returncode == 0 else None
    except (subprocess.TimeoutExpired, ValueError):
        return None
    return out if isinstance(out, dict) else None

DP_TOLD = ('requested', 'queued', 'undelivered', 'no-origin')

def _dp_told(d):
    """Whether the agent that asked was told of the answer, from the page server's .notify.json; None when not recorded."""
    try:
        with open(os.path.join(d, '.notify.json'), encoding='utf-8') as f:
            st = (json.load(f) or {}).get('state')
    except (OSError, ValueError, AttributeError):
        return None
    return st if st in DP_TOLD else None

def op_dp_pages():
    """Every decision page in gcc's registry with whether it waits on the owner,
    for the Decisions lens. Read only: the lens never writes the registry.

    A page waits when gcc listed it as pending, or when it is under a week old
    and unanswered, since agents forget to mark a page pending. A waiting page
    gcc lists as pending also says whether its agent can be reached."""
    pending = set()
    try:
        with open(os.path.join(DP_REGISTRY, '.pending.txt'), encoding='utf-8') as f:
            pending = {ln.strip() for ln in f if ln.strip()}
    except OSError:
        pass
    now = time.time()
    rows = []
    try:
        slugs = sorted(os.listdir(DP_REGISTRY))
    except OSError:
        raise NotesError('dp_unavailable', f'no decision pages at {DP_REGISTRY}')
    for slug in slugs:
        d = os.path.join(DP_REGISTRY, slug)
        cfg_path = os.path.join(d, 'config.json')
        if slug.startswith('.') or not os.path.isfile(cfg_path):
            continue
        try:
            with open(cfg_path, encoding='utf-8') as f:
                cfg = json.load(f)
        except (OSError, ValueError):
            rows.append({'slug': slug, 'path': d, 'broken': True, 'state': 'broken', 'mtime': os.path.getmtime(cfg_path)})
            continue
        mtime = os.path.getmtime(cfg_path)
        ans = os.path.join(d, '.answer.json')
        answered = os.path.getmtime(ans) if os.path.isfile(ans) else None
        if answered:
            state = 'answered'
        elif slug not in pending and os.path.isfile(os.path.join(d, '.cleared')):
            # The agent took it off the pending list (decision-page.sh pending clear): handled elsewhere.
            state = 'cleared'
        elif slug in pending or now - mtime < DP_FRESH_S:
            state = 'waiting'
        else:
            state = 'never'
        rows.append({
            'slug': slug, 'path': d, 'title': cfg.get('title') or slug, 'origin': cfg.get('origin') or {},
            'items': len(cfg.get('decisions') or []) + len(cfg.get('sections') or []),
            'mtime': mtime, 'answered': answered, 'state': state,
            'seen': os.path.isfile(os.path.join(d, '.seen.json')),
            'told': _dp_told(d) if answered else None,
        })
    reach = _dp_reach() if any(r['state'] == 'waiting' for r in rows) else {}
    for r in rows:
        if r['state'] != 'waiting':
            continue
        if reach is None:
            r['reach'] = 'unknown'
        elif r['slug'] in reach:
            r['reach'] = reach[r['slug']] if reach[r['slug']] in DP_REACH else 'unknown'
    rows.sort(key=lambda r: -r['mtime'])
    return {'t': 'dpPages', 'registry': DP_REGISTRY, 'pages': rows}

# BFB_DIRECTIONS_ROOTS overrides where repos are looked for (colon-separated;
# the walks point it at a copy). Each root holds repos, or folders of repos.
DIR_ROOTS = [r for r in (os.environ.get('BFB_DIRECTIONS_ROOTS') or os.path.expanduser('~/Code')).split(':') if r]
DIR_TEXT_MAX = 400_000

def op_directions_docs():
    """Each repo's directions doc, for the Home lens: its path, repo name, when
    it changed and its text. Repos sit one or two folders under a root; a linked
    worktree (whose .git is a file) repeats its main repo's doc, so it is left out."""
    docs, seen = [], set()
    def repo_doc(repo):
        if not os.path.isdir(os.path.join(repo, '.git')):
            return None
        for rel in ('docs/plan/DIRECTIONS.md', 'DIRECTIONS.md'):
            p = os.path.join(repo, rel)
            if os.path.isfile(p):
                return p
        return None
    for root in DIR_ROOTS:
        try:
            tops = sorted(os.scandir(root), key=lambda e: e.name)
        except OSError:
            continue
        for top in tops:
            if top.name.startswith('.') or not top.is_dir(follow_symlinks=False):
                continue
            kids = [top.path]
            if not os.path.exists(os.path.join(top.path, '.git')):
                try:
                    kids = [e.path for e in sorted(os.scandir(top.path), key=lambda e: e.name)
                            if not e.name.startswith('.') and e.is_dir(follow_symlinks=False)]
                except OSError:
                    kids = []
            for repo in kids:
                p = repo_doc(repo)
                if not p or p in seen:
                    continue
                seen.add(p)
                try:
                    with open(p, encoding='utf-8', errors='replace') as f:
                        text = f.read(DIR_TEXT_MAX)
                except OSError:
                    continue
                docs.append({'path': p, 'repo': os.path.basename(repo), 'mtime': os.path.getmtime(p), 'text': text})
    docs.sort(key=lambda d: -d['mtime'])
    return {'t': 'directionsDocs', 'docs': docs}

# ---- Phone access: bfb as web pages on the tailnet (native/web_server.py).
# The server runs under pm2 as bfb-phone on its tier-2 port, and also answers
# on this Mac's tailnet IP, which only tailnet devices can reach. The phone
# opens it by that IP over plain http, so it needs no Tailscale DNS and no
# certificate. The bfb setting "Open on my phone" turns it on or off;
# phoneSeed hands the phone the Mac's settings.
PHONE_PORT = 5123
PHONE_TS_PORT = 8446
PHONE_NAME = 'bfb-phone'
PHONE_SEED = os.environ.get('BFB_PHONE_SEED') or os.path.expanduser('~/Library/Application Support/better-file-browser/phone-seed.json')


def _exe(name, extra=()):
    for p in (*extra, f'/opt/homebrew/bin/{name}', f'/usr/local/bin/{name}', os.path.expanduser(f'~/.local/bin/{name}'), shutil.which(name)):
        if p and os.path.exists(p):
            return p
    return None


def _run(args, timeout=20):
    # Chrome starts this host with a bare PATH; pm2 needs node on it.
    env = dict(os.environ)
    env['PATH'] = ':'.join(filter(None, [os.path.dirname(_exe('node') or ''), '/opt/homebrew/bin', '/usr/local/bin', env.get('PATH', '')]))
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout, env=env)


def _tailscale():
    return _exe('tailscale', ('/Applications/Tailscale.app/Contents/MacOS/Tailscale',))


def _tailnet_ip(ts):
    """This Mac's IPv4 address on the tailnet, and why there is none."""
    if not ts:
        return '', 'Tailscale is not installed'
    try:
        st = json.loads(_run([ts, 'status', '--json', '--peers=false'], 5).stdout)
    except (OSError, ValueError, subprocess.SubprocessError):
        return '', 'Tailscale is not answering'
    if st.get('BackendState') != 'Running':
        return '', f"Tailscale is {str(st.get('BackendState') or 'off').lower()}"
    return next((a for a in (st.get('Self') or {}).get('TailscaleIPs') or [] if '.' in a), ''), ''


def _listening(host, port):
    import socket
    with socket.socket() as s:
        s.settimeout(0.5)
        return bool(host) and s.connect_ex((host, port)) == 0


def _phone_status():
    ip, why = _tailnet_ip(_tailscale())
    up, served = _listening('127.0.0.1', PHONE_PORT), _listening(ip, PHONE_TS_PORT)
    return {'t': 'phone', 'on': up and served, 'server': up, 'served': served,
            'url': f'http://{ip}:{PHONE_TS_PORT}' if ip else '', 'why': why}


def op_phone(action):
    """Turn phone access on or off, or say whether it is on and where."""
    if action in ('on', 'off'):
        pm2, ts = _exe('pm2'), _tailscale()
        if not pm2:
            raise NotesError('notes_io', 'pm2 is not installed, so the phone server cannot run')
        # An older setup published the port through `tailscale serve`, which
        # holds it; clear that either way so the server can answer there itself.
        if ts:
            _run([ts, 'serve', f'--http={PHONE_TS_PORT}', 'off'])
            _run([ts, 'serve', f'--https={PHONE_TS_PORT}', 'off'])
        if action == 'on':
            ip, why = _tailnet_ip(ts)
            if not ip:
                raise NotesError('notes_io', why or 'This Mac has no tailnet address')
            server = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web_server.py')
            # Start fresh so the tailnet address is current (pm2 restart keeps old arguments).
            _run([pm2, 'delete', PHONE_NAME])
            _run([pm2, 'start', server, '--name', PHONE_NAME, '--interpreter', sys.executable, '--',
                  '--port', str(PHONE_PORT), '--also', f'{ip}:{PHONE_TS_PORT}'])
            _run([pm2, 'save'])
        else:
            _run([pm2, 'stop', PHONE_NAME])
            _run([pm2, 'save'])
        time.sleep(0.6)
    return _phone_status()


# ---- Local tools: small local web apps that run only while you use them.
# Each is a pm2 process on its tier-2 port that stops itself when idle, so Home
# shows whether it is up and starts or stops it. Only names listed here can be
# touched, so a page cannot ask the host to start anything else.
SERVICES = {
    'ghostty-settings': {'label': 'Ghostty settings', 'port': 5124,
                         'about': 'Edit the Ghostty config with a preview and a backup. Stops after 5 idle minutes.'},
}


def _service_state(name):
    s = SERVICES[name]
    return {'name': name, 'label': s['label'], 'about': s['about'],
            'up': _listening('127.0.0.1', s['port']), 'url': f"http://127.0.0.1:{s['port']}/"}


def op_services():
    return {'t': 'services', 'services': [_service_state(n) for n in SERVICES]}


def op_service(name, action):
    """Start or stop one local tool, then say whether it is up."""
    if name not in SERVICES:
        raise NotesError('notes_bad_path', f'{name or "that"} is not a local tool bfb can start')
    if action in ('start', 'stop'):
        pm2 = _exe('pm2')
        if not pm2:
            raise NotesError('notes_io', 'pm2 is not installed, so local tools cannot run')
        r = _run([pm2, action, name])
        if r.returncode:
            raise NotesError('notes_io', (r.stderr or r.stdout).strip()[-300:] or f'pm2 could not {action} {name}')
        # pm2 says "online" as soon as it spawns the process; wait for the port.
        want_up = action == 'start'
        for _ in range(40):
            if _listening('127.0.0.1', SERVICES[name]['port']) == want_up:
                break
            time.sleep(0.25)
    return {'t': 'service', **_service_state(name)}


# Where svc looks for signs of a person. See ~/.claude/features/dev-servers.md.
SVC_TOUCH_DIR = os.environ.get('BFB_SVC_TOUCH_DIR') or os.path.expanduser('~/.claude/dev-servers/svc-touch')


def op_svc_seen(port):
    """Note that bfb is running and, when given, that this port's tab is in front."""
    names = ['.browser']
    if port is not None:
        if not str(port).isdigit() or not 0 < int(port) < 65536:
            raise NotesError('notes_bad_path', 'that is not a port')
        names.append(str(int(port)))
    os.makedirs(SVC_TOUCH_DIR, exist_ok=True)
    for name in names:
        with open(os.path.join(SVC_TOUCH_DIR, name), 'a'):
            os.utime(os.path.join(SVC_TOUCH_DIR, name))
    return {'t': 'svc_seen'}


def op_phone_seed(kv):
    """Keep the Mac's bfb settings where the phone server hands them to the phone."""
    if not isinstance(kv, dict):
        raise NotesError('notes_bad_path', 'phoneSeed needs the settings as an object')
    os.makedirs(os.path.dirname(PHONE_SEED), exist_ok=True)
    atomic_write(PHONE_SEED, json.dumps({'at': int(time.time() * 1000), 'kv': kv}))
    return {'t': 'seeded'}


def op_send_thread(root, rel, thread_id, to):
    """Hand one comment thread to an agent through claude-ipc, with how to answer it."""
    if not to or not re.fullmatch(r'[A-Za-z][\w.-]{0,63}', to):
        raise NotesError('notes_bad_path', 'pick an agent to send to')
    reply = op_comments_read(root, rel)
    t = next((x for x in reply.get('threads', []) if x.get('id') == thread_id), None)
    if not t:
        raise NotesError('notes_missing', 'that thread is gone')
    full = resolve_rel(root, rel)
    line = (t.get('place') or {}).get('line') or (t.get('anchor') or {}).get('line')
    quote = ((t.get('anchor') or {}).get('exact') or '').strip()
    said = '\n'.join(f"- {c.get('author', {}).get('alias') or c.get('author', {}).get('name') or 'owner'}: {c.get('text', '').strip()}"
                     for c in t.get('comments', []) if not c.get('deleted'))
    msg = (f"The owner sent you a comment thread from bfb.\n"
           f"Doc: {full}{f' (line {line})' if line else ''}\n"
           f"On: \"{quote[:300]}\"\n{said}\n\n"
           f"Read it with: bfb-docs comments show {full} {thread_id}\n"
           f"Answer in the thread with: bfb-docs comments reply {full} {thread_id} \"<your reply>\"")
    exe = os.environ.get('BFB_CLAUDE_IPC') or _exe('claude-ipc')
    if not exe:
        raise NotesError('notes_io', 'claude-ipc is not installed')
    # Chrome starts this host outside any session, so claude-ipc cannot tell
    # who is sending: it goes as `user`, claude-ipc's name for the owner.
    # A request, not an inform: claude-ipc wakes an idle session only for
    # query, request or response mail, and an inform waits until the owner
    # types there. No reply is owed to bfb, so nothing is chased either.
    r = _run([exe, 'send', '--from', 'user', '--to', to, '--kind', 'request', '--no-reply-expected', msg], 15)
    if r.returncode:
        raise NotesError('notes_io', (r.stderr or r.stdout).strip()[-300:] or f'could not send to {to}')
    return {'t': 'sent', 'to': to, 'thread': thread_id}



STATE_FILE = 'mnt-sync-state.json'

def op_sync_state(root):
    """What Switchboard last reported about syncing this notes folder, read from <repo>/.git/mnt-sync-state.json
    so any app can show it without running sync. `repo` is false when the folder sits in no repository."""
    repo = repo_root_of(root)
    now = int(time.time())
    if repo is None:
        return {'t': 'syncState', 'repo': False, 'state': None, 'now': now}
    path = os.path.join(repo, '.git', STATE_FILE)
    state = None
    if os.path.isfile(path):
        try:
            with open(path, 'r', encoding='utf-8') as fh:
                got = json.load(fh)
            if isinstance(got, dict):
                state = got
        except (OSError, ValueError):
            state = {'unreadable': True}
    return {'t': 'syncState', 'repo': True, 'state': state, 'now': now}


SAVED_DIR = '.saved'
META_TAGS = os.path.join('.meta', 'tags.json')

def saved_key_ok(key):
    return isinstance(key, str) and notefmt.valid_id(key)

def op_saved_list(root):
    """Every save in <root>/.saved with its file text, plus the tag colours in .meta/tags.json.
    `exists` is false when the folder has never been made, which is how an app knows to migrate."""
    d = os.path.join(root, SAVED_DIR)
    items = []
    exists = os.path.isdir(d)
    if exists:
        for f in sorted(os.listdir(d)):
            if not f.endswith('.md') or f.startswith('.'):
                continue
            full = os.path.join(d, f)
            if not os.path.isfile(full):
                continue
            try:
                with open(full, 'r', encoding='utf-8', errors='replace', newline='') as fh:
                    text = fh.read(1024 * 1024)
            except OSError:
                continue
            items.append({'key': f[:-3], 'text': text, 'mtime': mtime_ms(full)})
    tags = None
    tp = os.path.join(root, META_TAGS)
    if os.path.isfile(tp):
        try:
            with open(tp, 'r', encoding='utf-8') as fh:
                got = json.load(fh)
            if isinstance(got, dict):
                tags = {str(k): str(v) for k, v in got.items() if isinstance(v, str)}
        except (OSError, ValueError):
            tags = None
    return {'t': 'saved', 'exists': exists, 'items': items, 'tags': tags}

def op_saved_sync(root, writes, removes, tags, create_only):
    """Apply a batch to <root>/.saved: write or replace files, move removed ones into .trash, and merge
    tag colours into .meta/tags.json. With create_only a file that already exists is left alone, which is
    what makes the one-time migration safe to run twice."""
    d = os.path.join(root, SAVED_DIR)
    os.makedirs(d, exist_ok=True)
    written, skipped, removed = [], [], []
    for w in (writes or []):
        key, text = w.get('key'), w.get('text')
        if not saved_key_ok(key) or not isinstance(text, str):
            raise NotesError('notes_bad_path', f'not a save name: {key!r}')
        full = os.path.join(d, key + '.md')
        if create_only and os.path.exists(full):
            skipped.append(key)
            continue
        atomic_write(full, text)
        written.append(key)
    for key in (removes or []):
        if not saved_key_ok(key):
            raise NotesError('notes_bad_path', f'not a save name: {key!r}')
        full = os.path.join(d, key + '.md')
        if os.path.isfile(full):
            op_delete(root, os.path.join(SAVED_DIR, key + '.md'))
            removed.append(key)
    if isinstance(tags, dict) and tags:
        tp = os.path.join(root, META_TAGS)
        cur = {}
        if os.path.isfile(tp):
            try:
                with open(tp, 'r', encoding='utf-8') as fh:
                    got = json.load(fh)
                if isinstance(got, dict):
                    cur = got
            except (OSError, ValueError):
                cur = {}
        merged = {**cur, **{str(k): str(v) for k, v in tags.items()}}
        if merged != cur:
            atomic_write(tp, json.dumps(merged, indent=2, ensure_ascii=False, sort_keys=True) + '\n')
    return {'t': 'savedSynced', 'written': written, 'skipped': skipped, 'removed': removed}
WRITE_OPS = {'savedSync', 'write', 'create', 'rename', 'delete', 'restore', 'writeBinary', 'fileWrite', 'commentsWrite'}

def repo_root_of(root):
    """The git repository (with a .git folder) a notes folder sits in, or None."""
    here = os.path.abspath(root)
    while True:
        if os.path.isdir(os.path.join(here, '.git')):
            return here
        parent = os.path.dirname(here)
        if parent == here:
            return None
        here = parent

@contextlib.contextmanager
def writer_lock(root):
    """The one-writer-at-a-time lock the notes spec asks every writer on the Mac to hold
    (<repo>/.git/mnt-sync.lock, waiting up to 5 seconds). A folder outside a repo has none.
    BFB_LOCK_WAIT shortens the wait for tests."""
    repo = repo_root_of(root)
    if repo is None:
        yield
        return
    try:
        wait = float(os.environ.get('BFB_LOCK_WAIT') or notes_lock.WAIT_SECONDS)
        with notes_lock.repo_lock(repo, wait):
            yield
    except notes_lock.LockTimeout:
        raise NotesError('notes_busy', 'another app is writing the notes folder; try again in a moment')

def handle(msg):
    op = msg.get('op')
    if op in WRITE_OPS and isinstance(msg.get('root'), str):
        with writer_lock(resolve_root(msg.get('root'))):
            return handle_unlocked(msg)
    return handle_unlocked(msg)

def handle_unlocked(msg):
    op = msg.get('op')
    if op == 'phone': return op_phone(msg.get('action') or 'status')
    if op == 'svc_seen': return op_svc_seen(msg.get('port'))
    if op == 'services': return op_services()
    if op == 'service': return op_service(msg.get('name'), msg.get('action') or 'status')
    if op == 'phoneSeed': return op_phone_seed(msg.get('kv'))
    if op == 'directionsDocs': return op_directions_docs()
    if op == 'dp': return op_dp(msg.get('verb'), msg.get('slug'), msg.get('payload'))
    if op == 'people': return {'t': 'people', 'peers': _docs().ipc_peers()}
    if op == 'pick': return {'t': 'picked', 'root': run_picker(msg.get('start'), msg.get('kind'))}
    if op == 'home': return {'t': 'home', 'home': os.path.expanduser('~')}
    if op == 'docsIndex': return op_docs_index()
    if op == 'commentsSearch': return op_comments_search(msg.get('query'))
    if op == 'dpPages': return op_dp_pages()
    root = resolve_root(msg.get('root'))
    if op == 'stat':   return op_stat(root)
    if op == 'list':   return {'t': 'list', 'notes': list_notes(root)}
    if op == 'read':   return op_read(root, msg.get('rel'))
    if op == 'write':  return op_write(root, msg.get('rel'), msg.get('text'), msg.get('expectMtime'))
    if op == 'create': return op_create(root, msg.get('rel'), msg.get('text') or '')
    if op == 'rename': return op_rename(root, msg.get('rel'), msg.get('to'))
    if op == 'delete': return op_delete(root, msg.get('rel'))
    if op == 'trashList': return op_trash_list(root)
    if op == 'restore': return op_restore(root, msg.get('trashed'), msg.get('to'))
    if op == 'writeBinary': return op_write_binary(root, msg.get('rel'), msg.get('base64'))
    if op == 'history': return op_history(root, msg.get('rel'))
    if op == 'version': return op_version(root, msg.get('rel'), msg.get('sha'))
    if op == 'syncState': return op_sync_state(root)
    if op == 'savedList': return op_saved_list(root)
    if op == 'savedSync': return op_saved_sync(root, msg.get('writes'), msg.get('removes'), msg.get('tags'), bool(msg.get('createOnly')))
    if op == 'search':    return op_search(root, msg.get('query'))
    if op == 'fileRead':  return op_file_read(root, msg.get('rel'), msg.get('offset'))
    if op == 'fileStat':  return op_file_stat(root, msg.get('rel'))
    if op == 'commentsRead':  return op_comments_read(root, msg.get('rel'))
    if op == 'commentsWrite': return op_comments_write(root, msg.get('rel'), msg.get('ops'))
    if op == 'sendThread': return op_send_thread(root, msg.get('rel'), msg.get('thread'), msg.get('to'))
    if op == 'fileWrite': return op_file_write(root, msg.get('rel'), msg.get('text'), msg.get('expectMtime'))
    raise NotesError('notes_bad_op', f'unknown op {op!r}')

def main():
    msg = read_msg()
    if msg is None:
        return
    try:
        write_msg(handle(msg))
    except NotesError as e:
        write_msg({'t': 'error', 'code': e.code, 'message': str(e)})
    except OSError as e:
        write_msg({'t': 'error', 'code': 'notes_io', 'message': str(e)})

if __name__ == '__main__':
    main()
