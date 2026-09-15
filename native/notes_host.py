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
    if not isinstance(root, str) or not root.startswith('/'):
        raise NotesError('notes_bad_root', 'root must be an absolute folder path')
    real = os.path.realpath(os.path.expanduser(root))
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
                        'mtime': int(st.st_mtime * 1000)})
    out.sort(key=lambda n: -n['mtime'])
    return out

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
    if expect_mtime is not None and os.path.exists(full) and mtime_ms(full) != int(expect_mtime):
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
