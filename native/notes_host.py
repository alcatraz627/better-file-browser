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
Errors: {t:"error", code, message} with code in notes_bad_root, notes_bad_path,
notes_missing, notes_exists, notes_conflict, notes_io. mtime is epoch ms.
Delete moves the file into <root>/.trash/ rather than unlinking it.
"""
import sys, os, json, struct, time, shutil, subprocess
from datetime import datetime

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

def note_props(full):
    """The colour, pin and tags a note's frontmatter holds, read the way Switchboard reads them."""
    props = {'color': '', 'pinned': False, 'tags': [], 'pos': '', 'created': None}
    try:
        with open(full, 'r', encoding='utf-8', errors='replace') as fh:
            lines = fh.read(4096).split('\n')
    except OSError:
        return props
    if not lines or lines[0].strip() != '---':
        return props
    for line in lines[1:]:
        if line.strip() == '---':
            break
        key, sep, value = line.partition(':')
        if not sep:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in '"\'':
            try:
                value = json.loads(value) if value[0] == '"' else value[1:-1].replace("''", "'")
            except ValueError:
                value = value[1:-1]
        key = key.strip()
        if key == 'color':
            props['color'] = value
        elif key == 'pinned':
            props['pinned'] = value == 'true'
        elif key == 'tags':
            # `a, b` and the YAML flow list `[a, b]` read the same
            if value.startswith('[') and value.endswith(']'):
                value = value[1:-1]
            tags = [t.strip() for t in value.split(',')]
            props['tags'] = [t[1:-1] if len(t) >= 2 and t[0] == t[-1] and t[0] in '"\'' else t for t in tags if t]
        elif key == 'pos':
            props['pos'] = value   # raw text: `no`, `1e5` and `null` stay strings
        elif key == 'created':
            try:
                props['created'] = int(datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp() * 1000)
            except ValueError:
                pass
    return props

def note_title(full):
    """What the sidebar calls a note: its frontmatter title, else its first heading, else its first line; empty when none."""
    try:
        with open(full, 'r', encoding='utf-8', errors='replace') as fh:
            head = fh.read(4096)
    except OSError:
        return ''
    lines = head.split('\n')
    body_start = 0
    if lines and lines[0].strip() == '---':
        for i in range(1, len(lines)):
            if lines[i].strip() == '---':
                body_start = i + 1
                break
            if lines[i].startswith('title:'):
                value = lines[i][6:].strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in '"\'':
                    try:
                        value = json.loads(value) if value[0] == '"' else value[1:-1].replace("''", "'")
                    except ValueError:
                        value = value[1:-1]
                # a quoted title keeps its padding in YAML; no app shows it padded
                value = value.strip()
                if value:
                    return value
    for line in lines[body_start:]:
        s = line.strip()
        if s and not s.startswith('>'):
            return s.lstrip('#').strip()
    return ''

def op_read(root, rel):
    full = resolve_rel(root, rel)
    if not os.path.isfile(full):
        raise NotesError('notes_missing', f'no such note: {rel}')
    with open(full, 'r', encoding='utf-8', errors='replace') as fh:
        text = fh.read()
    return {'t': 'note', 'rel': rel, 'text': text, 'mtime': mtime_ms(full)}

def atomic_write(full, text):
    """Replace a file's text in one step, keeping its permission bits (an
    executable script stays executable)."""
    os.makedirs(os.path.dirname(full), exist_ok=True)
    tmp = full + '.tmp-' + str(os.getpid())
    with open(tmp, 'w', encoding='utf-8', newline='') as fh:
        fh.write(text)
    if os.path.exists(full):
        os.chmod(tmp, os.stat(full).st_mode & 0o7777)
    os.replace(tmp, full)

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
BACKUP_DIR = os.path.expanduser('~/Library/Application Support/BetterFileBrowser/backups')
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
    if len(data) > 25 * 1024 * 1024:
        raise NotesError('notes_io', 'attachment over 25 MB')
    os.makedirs(os.path.dirname(full), exist_ok=True)
    tmp = full + '.tmp-' + str(os.getpid())
    with open(tmp, 'wb') as fh:
        fh.write(data)
    os.replace(tmp, full)
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
    dst = os.path.join(trash, f'{stamp}-{os.path.basename(full)}')
    shutil.move(full, dst)
    if os.path.exists(full + COMPANION):
        shutil.move(full + COMPANION, dst + COMPANION)
    return {'t': 'deleted', 'rel': rel, 'trashed': os.path.relpath(dst, root)}

def git_out(root, args):
    """git's output in the notes folder, or None when the folder is not a repository or git says no."""
    import subprocess
    if not os.path.isdir(os.path.join(root, '.git')):
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
    return {'t': 'history', 'rel': rel, 'versions': versions, 'repo': os.path.isdir(os.path.join(root, '.git'))}

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
        # A version from before a rename lives under the note's older file name.
        for old in renamed_paths(root, rel, sha):
            text = git_out(root, ['show', f'{sha}:{old}'])
            if text is not None:
                break
    if text is None:
        raise NotesError('notes_missing', f'no version {sha} of {rel}')
    return {'t': 'version', 'rel': rel, 'sha': sha, 'text': text}

def run_picker(start):
    """Ask macOS for a folder and return its path; empty text when the person cancels."""
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

def _comments_reply(rel, v):
    out = {'t': 'comments', 'rel': rel, 'threads': v['threads'], 'where': v['where'],
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
        return _comments_reply(rel, S.view(full))
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
        results, _, _, notes = S.write(full, ops, S.whoami('user')[0])
        out = _comments_reply(rel, S.view(full))
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

def handle(msg):
    op = msg.get('op')
    if op == 'people': return {'t': 'people', 'peers': _docs().ipc_peers()}
    if op == 'pick': return {'t': 'picked', 'root': run_picker(msg.get('start'))}
    if op == 'home': return {'t': 'home', 'home': os.path.expanduser('~')}
    if op == 'docsIndex': return op_docs_index()
    root = resolve_root(msg.get('root'))
    if op == 'stat':   return op_stat(root)
    if op == 'list':   return {'t': 'list', 'notes': list_notes(root)}
    if op == 'read':   return op_read(root, msg.get('rel'))
    if op == 'write':  return op_write(root, msg.get('rel'), msg.get('text'), msg.get('expectMtime'))
    if op == 'create': return op_create(root, msg.get('rel'), msg.get('text') or '')
    if op == 'rename': return op_rename(root, msg.get('rel'), msg.get('to'))
    if op == 'delete': return op_delete(root, msg.get('rel'))
    if op == 'writeBinary': return op_write_binary(root, msg.get('rel'), msg.get('base64'))
    if op == 'history': return op_history(root, msg.get('rel'))
    if op == 'version': return op_version(root, msg.get('rel'), msg.get('sha'))
    if op == 'search':    return op_search(root, msg.get('query'))
    if op == 'fileRead':  return op_file_read(root, msg.get('rel'), msg.get('offset'))
    if op == 'fileStat':  return op_file_stat(root, msg.get('rel'))
    if op == 'commentsRead':  return op_comments_read(root, msg.get('rel'))
    if op == 'commentsWrite': return op_comments_write(root, msg.get('rel'), msg.get('ops'))
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
