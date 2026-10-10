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
  {op:"history", root, rel}                  -> {t:"history", rel, versions:[{sha,when,reason}]}  (git log; none outside a repo)
  {op:"version", root, rel, sha}             -> {t:"version", rel, sha, text}
Errors: {t:"error", code, message} with code in notes_bad_root, notes_bad_path,
notes_missing, notes_exists, notes_conflict, notes_io. mtime is epoch ms.
Delete moves the file into <root>/.trash/ rather than unlinking it.
"""
import sys, os, json, struct, time, shutil

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
                        'mtime': int(st.st_mtime * 1000), 'title': note_title(full)})
    out.sort(key=lambda n: -n['mtime'])
    return out

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
                        value = json.loads(value) if value[0] == '"' else value[1:-1]
                    except ValueError:
                        value = value[1:-1]
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
    os.makedirs(os.path.dirname(full), exist_ok=True)
    tmp = full + '.tmp-' + str(os.getpid())
    with open(tmp, 'w', encoding='utf-8') as fh:
        fh.write(text)
    os.replace(tmp, full)

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
    for line in (git_out(root, ['log', '--format=%h%x09%ct%x09%s', '--', rel]) or '').splitlines():
        parts = line.split('\t', 2)
        if len(parts) == 3 and parts[1].isdigit():
            versions.append({'sha': parts[0], 'when': int(parts[1]) * 1000, 'reason': parts[2]})
    return {'t': 'history', 'rel': rel, 'versions': versions}

def op_version(root, rel, sha):
    resolve_rel(root, rel)
    if not isinstance(sha, str) or not sha.isalnum():
        raise NotesError('notes_bad_path', 'a version is named by its commit hash')
    text = git_out(root, ['show', f'{sha}:{rel}'])
    if text is None:
        raise NotesError('notes_missing', f'no version {sha} of {rel}')
    return {'t': 'version', 'rel': rel, 'sha': sha, 'text': text}

def handle(msg):
    op = msg.get('op')
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
