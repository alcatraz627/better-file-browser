#!/usr/bin/env python3
"""Protocol test for notes_host.py: spawns the host per request the way Chrome
does, over a temp folder. Run: python3 native/test_notes_host.py"""
import json, os, struct, subprocess, sys, tempfile

HOST = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'notes_host.py')

def call(msg):
    enc = json.dumps(msg).encode('utf-8')
    out = subprocess.run([sys.executable, HOST], input=struct.pack('=I', len(enc)) + enc,
                         capture_output=True, timeout=10).stdout
    length = struct.unpack('=I', out[:4])[0]
    return json.loads(out[4:4 + length].decode('utf-8'))

fails = 0
def check(cond, label):
    global fails
    print(('ok   ' if cond else 'FAIL ') + label)
    if not cond: fails += 1

root = tempfile.mkdtemp(prefix='bfb-notes-')
os.makedirs(os.path.join(root, 'sub'))
with open(os.path.join(root, 'sub', 'old.md'), 'w') as fh: fh.write('# old\n')
with open(os.path.join(root, 'ignore.txt'), 'w') as fh: fh.write('x')

r = call({'op': 'stat', 'root': root})
check(r['t'] == 'stat' and r['count'] == 1, f'stat counts .md only: {r}')

r = call({'op': 'create', 'root': root, 'rel': 'today.md', 'text': '# today\n'})
check(r['t'] == 'written' and r['rel'] == 'today.md', f'create: {r}')
mt = r['mtime']

r = call({'op': 'create', 'root': root, 'rel': 'today.md', 'text': ''})
check(r['t'] == 'error' and r['code'] == 'notes_exists', f'create refuses an existing note: {r}')

r = call({'op': 'list', 'root': root})
rels = [n['rel'] for n in r['notes']]
check(r['t'] == 'list' and rels == ['today.md', 'sub/old.md'], f'list newest first, recursive, md only: {rels}')

r = call({'op': 'read', 'root': root, 'rel': 'sub/old.md'})
check(r['t'] == 'note' and r['text'] == '# old\n', f'read: {r}')

r = call({'op': 'write', 'root': root, 'rel': 'today.md', 'text': '# today\nmore\n', 'expectMtime': mt})
check(r['t'] == 'written', f'write with matching mtime: {r}')
r = call({'op': 'write', 'root': root, 'rel': 'today.md', 'text': 'clobber', 'expectMtime': mt})
check(r['t'] == 'error' and r['code'] == 'notes_conflict', f'write with stale mtime is a conflict: {r}')
with open(os.path.join(root, 'today.md')) as fh:
    check(fh.read() == '# today\nmore\n', 'conflicting write did not touch the file')

r = call({'op': 'write', 'root': root, 'rel': 'new/deep/note.md', 'text': 'nested'})
check(r['t'] == 'written' and os.path.isfile(os.path.join(root, 'new', 'deep', 'note.md')), f'write creates parent folders: {r}')

r = call({'op': 'rename', 'root': root, 'rel': 'today.md', 'to': 'sub/renamed.md'})
check(r['t'] == 'renamed' and os.path.isfile(os.path.join(root, 'sub', 'renamed.md')), f'rename: {r}')

r = call({'op': 'delete', 'root': root, 'rel': 'sub/old.md'})
check(r['t'] == 'deleted' and r['trashed'].startswith('.trash/') and os.path.isfile(os.path.join(root, r['trashed'])),
      f'delete moves into .trash: {r}')
r = call({'op': 'list', 'root': root})
check('.trash' not in ''.join(n['rel'] for n in r['notes']), 'list skips .trash')

for bad in ['../escape.md', '/etc/passwd', 'sub/../../x.md']:
    r = call({'op': 'write', 'root': root, 'rel': bad, 'text': 'x'})
    check(r['t'] == 'error' and r['code'] == 'notes_bad_path', f'refuses {bad}: {r["code"]}')
r = call({'op': 'write', 'root': root, 'rel': 'notes.txt', 'text': 'x'})
check(r['code'] == 'notes_bad_path', 'refuses a non-.md write')
r = call({'op': 'read', 'root': root, 'rel': 'nope.md'})
check(r['code'] == 'notes_missing', 'missing note is notes_missing')
r = call({'op': 'list', 'root': os.path.join(root, 'nope')})
check(r['code'] == 'notes_bad_root', 'missing root is notes_bad_root')
import base64
png = base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'\x00' * 16).decode()
r = call({'op': 'writeBinary', 'root': root, 'rel': 'attachments/pic.png', 'base64': png})
check(r['t'] == 'written' and os.path.getsize(os.path.join(root, 'attachments', 'pic.png')) == 24, f'writeBinary stores an attachment: {r}')
r = call({'op': 'writeBinary', 'root': root, 'rel': 'attachments/pic.png', 'base64': png})
check(r['code'] == 'notes_exists', 'writeBinary never overwrites')
r = call({'op': 'writeBinary', 'root': root, 'rel': 'attachments/x.png', 'base64': '!!'})
check(r['code'] == 'notes_bad_path', 'writeBinary rejects non-base64')

r = call({'op': 'zap', 'root': root})
check(r['code'] == 'notes_bad_op', 'unknown op')

print(f'\n{"all checks passed" if not fails else str(fails) + " check(s) failed"}')
sys.exit(1 if fails else 0)
