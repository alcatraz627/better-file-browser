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
check([n['title'] for n in r['notes']] == ['today', 'old'], f'list carries each note\'s title from its heading: {[n.get("title") for n in r["notes"]]}')
with open(os.path.join(root, 'fm.md'), 'w') as fh: fh.write('---\ntitle: "Groceries: milk"\ncreated: 2026-10-10T21:40:23Z\n---\n- milk\n')
r = call({'op': 'list', 'root': root})
check(next(n['title'] for n in r['notes'] if n['rel'] == 'fm.md') == 'Groceries: milk', 'a frontmatter title names the note, unquoted')

with open(os.path.join(root, 'tinted.md'), 'w') as fh: fh.write('---\ntitle: "Tinted"\ntags: "ops, later"\npinned: true\ncolor: purple\n---\nbody\n')
r = call({'op': 'list', 'root': root})
t = next(n for n in r['notes'] if n['rel'] == 'tinted.md')
check(t['color'] == 'purple' and t['pinned'] is True and t['tags'] == ['ops', 'later'], f'list carries colour, pin and tags: {t}')
p = next(n for n in r['notes'] if n['rel'] == 'fm.md')
check(p['color'] == '' and p['pinned'] is False and p['tags'] == [], f'a plain note has no colour, pin or tags: {p}')

# The contract's own examples: a YAML flow list of tags, and '' inside a single-quoted title.
yroot = tempfile.mkdtemp(prefix='bfb-notes-yaml-')
with open(os.path.join(yroot, 'y.md'), 'w') as fh: fh.write("---\ntitle: 'it''s mine'\ntags: [work, \"planning\"]\n---\nbody\n")
y = call({'op': 'list', 'root': yroot})['notes'][0]
check(y['title'] == "it's mine" and y['tags'] == ['work', 'planning'], f'flow-list tags and a quoted title read as the editor reads them: {y}')

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
r = call({'op': 'write', 'root': root, 'rel': 'sub/old.md', 'text': 'recreated', 'expectMtime': mt})
check(r['code'] == 'notes_missing' and not os.path.exists(os.path.join(root, 'sub', 'old.md')),
      'saving a note removed outside the editor does not recreate it')

for bad in ['../escape.md', '/etc/passwd', 'sub/../../x.md']:
    r = call({'op': 'write', 'root': root, 'rel': bad, 'text': 'x'})
    check(r['t'] == 'error' and r['code'] == 'notes_bad_path', f'refuses {bad}: {r["code"]}')
r = call({'op': 'write', 'root': root, 'rel': 'notes.txt', 'text': 'x'})
check(r['code'] == 'notes_bad_path', 'refuses a non-.md write')
r = call({'op': 'read', 'root': root, 'rel': 'nope.md'})
check(r['code'] == 'notes_missing', 'missing note is notes_missing')
r = call({'op': 'list', 'root': os.path.join(root, 'nope')})
check(r['code'] == 'notes_bad_root', 'missing root is notes_bad_root')
r = call({'op': 'stat', 'root': 'file://' + root + '/'})
check(r['t'] == 'stat' and r['root'] == os.path.realpath(root), f'a file:// address names the same folder: {r}')
r = call({'op': 'stat', 'root': '~/' + os.path.relpath(root, os.path.expanduser('~')) if root.startswith(os.path.expanduser('~')) else root})
check(r['t'] == 'stat', f'~ means home: {r}')
import base64
png = base64.b64encode(b'\x89PNG\r\n\x1a\n' + b'\x00' * 16).decode()
r = call({'op': 'writeBinary', 'root': root, 'rel': 'attachments/pic.png', 'base64': png})
check(r['t'] == 'written' and os.path.getsize(os.path.join(root, 'attachments', 'pic.png')) == 24, f'writeBinary stores an attachment: {r}')
r = call({'op': 'writeBinary', 'root': root, 'rel': 'attachments/pic.png', 'base64': png})
check(r['code'] == 'notes_exists', 'writeBinary never overwrites')
r = call({'op': 'writeBinary', 'root': root, 'rel': 'attachments/x.png', 'base64': '!!'})
check(r['code'] == 'notes_bad_path', 'writeBinary rejects non-base64')

# Editing any text file inside an allowed folder.
eroot = tempfile.mkdtemp(prefix='bfb-edit-')
with open(os.path.join(eroot, 'conf.yaml'), 'w') as fh: fh.write('a: 1\n')
r = call({'op': 'fileRead', 'root': eroot, 'rel': 'conf.yaml'})
check(r['t'] == 'file' and r['text'] == 'a: 1\n', f'fileRead reads any text file: {r}')
w = call({'op': 'fileWrite', 'root': eroot, 'rel': 'conf.yaml', 'text': 'a: 2\n', 'expectMtime': r['mtime']})
check(w['t'] == 'written' and open(os.path.join(eroot, 'conf.yaml')).read() == 'a: 2\n', f'fileWrite saves a .yaml: {w}')
check(open(w['backup']).read() == 'a: 1\n', 'fileWrite keeps the previous text as a backup')
os.remove(w['backup'])
w2 = call({'op': 'fileWrite', 'root': eroot, 'rel': 'conf.yaml', 'text': 'a: 3\n', 'expectMtime': r['mtime'] - 5000})
check(w2['code'] == 'notes_conflict' and open(os.path.join(eroot, 'conf.yaml')).read() == 'a: 2\n', 'fileWrite refuses a stale mtime')
outside = tempfile.mkdtemp(prefix='bfb-out-')
with open(os.path.join(outside, 'x.txt'), 'w') as fh: fh.write('x')
os.symlink(os.path.join(outside, 'x.txt'), os.path.join(eroot, 'link.txt'))
check(call({'op': 'fileRead', 'root': eroot, 'rel': 'link.txt'})['code'] == 'notes_bad_path', 'a symlink out of the allowed folder is refused')
check(call({'op': 'fileRead', 'root': eroot, 'rel': '../x.txt'})['code'] == 'notes_bad_path', 'a path out of the allowed folder is refused')
with open(os.path.join(eroot, 'b.bin'), 'wb') as fh: fh.write(b'\0\1\2')
rb = call({'op': 'fileRead', 'root': eroot, 'rel': 'b.bin'})
check(call({'op': 'fileWrite', 'root': eroot, 'rel': 'b.bin', 'text': 'x', 'expectMtime': rb['mtime']})['code'] == 'notes_bad_path', 'a binary file is not overwritten')

s = call({'op': 'search', 'root': yroot, 'query': 'BODY'})
check(s['t'] == 'search' and [h['rel'] for h in s['hits']] == ['y.md'] and s['hits'][0]['line'] == 'body', f'search finds a word in a note body, any case: {s}')
check(call({'op': 'search', 'root': yroot, 'query': 'body nowhere'})['hits'] == [], 'search needs every word')

r = call({'op': 'zap', 'root': root})
check(r['code'] == 'notes_bad_op', 'unknown op')

# Versions come from git when the folder is a repository; a plain folder has none.
r = call({'op': 'history', 'root': root, 'rel': 'today.md'})
check(r['t'] == 'history' and r['versions'] == [] and r['repo'] is False, f'a plain folder has no versions: {r}')
repo = tempfile.mkdtemp(prefix='bfb-notes-git-')
def git(*a): subprocess.run(['git', '-C', repo] + list(a), check=True, capture_output=True)
git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't')
with open(os.path.join(repo, 'plan.md'), 'w') as fh: fh.write('first\n')
git('add', '-A'); git('commit', '-q', '-m', 'save')
with open(os.path.join(repo, 'plan.md'), 'w') as fh: fh.write('second\n')
git('add', '-A'); git('commit', '-q', '-m', 'merge: both sides kept')
r = call({'op': 'history', 'root': repo, 'rel': 'plan.md'})
check(r['t'] == 'history' and [v['reason'] for v in r['versions']] == ['merge: both sides kept', 'save'],
      f'history lists versions newest first: {r}')
r2 = call({'op': 'version', 'root': repo, 'rel': 'plan.md', 'sha': r['versions'][1]['sha']})
check(r2['t'] == 'version' and r2['text'] == 'first\n', f'an old version reads back: {r2}')
r2 = call({'op': 'version', 'root': repo, 'rel': 'plan.md', 'sha': 'nope'})
check(r2['code'] == 'notes_missing', 'a version that is not there is notes_missing')
r2 = call({'op': 'version', 'root': repo, 'rel': 'plan.md', 'sha': 'HEAD; rm -rf x'})
check(r2['code'] == 'notes_bad_path', 'a version name that is not a hash is refused')
check(r.get('repo') is True, f'history says the folder is a repository: {r}')
git('mv', 'plan.md', 'renamed-plan.md')
git('commit', '-q', '-m', 'rename')
r3 = call({'op': 'history', 'root': repo, 'rel': 'renamed-plan.md'})
check([v['reason'] for v in r3['versions']][-2:] == ['merge: both sides kept', 'save'], f'history follows a rename: {r3}')
r4 = call({'op': 'version', 'root': repo, 'rel': 'renamed-plan.md', 'sha': r3['versions'][-1]['sha']})
check(r4['t'] == 'version' and r4['text'] == 'first\n', f'a version from before a rename reads back: {r4}')

with open(os.path.join(root, 'ordered.md'), 'w') as fh: fh.write('---\ntitle: "Ordered"\ncreated: 2026-10-11T08:00:00Z\npos: i\n---\nbody\n')
for raw in ('no', '1e5', 'null'):
    with open(os.path.join(root, 'raw.md'), 'w') as fh: fh.write(f'---\ntitle: "Raw"\npos: {raw}\n---\nbody\n')
    r = call({'op': 'list', 'root': root})
    check(next(n for n in r['notes'] if n['rel'] == 'raw.md')['pos'] == raw, f'pos: {raw} reads back as that exact string')
o = next(n for n in r['notes'] if n['rel'] == 'ordered.md')
check(o['pos'] == 'i' and o['created'] == 1791705600000, f'list carries pos and created in epoch ms: {o}')
p = next(n for n in r['notes'] if n['rel'] == 'fm.md')
check(p['pos'] == '' and p['created'] is not None, 'a note with no pos reports an empty one and still its created time')

# The folder chooser: the system dialog is faked, the framing and the cancel path are real.
import importlib.util
from unittest import mock
spec = importlib.util.spec_from_file_location('notes_host', HOST)
nh = importlib.util.module_from_spec(spec); spec.loader.exec_module(nh)
with mock.patch.object(nh, 'run_picker', return_value='/Users/me/Notes'):
    check(nh.handle({'op': 'pick'}) == {'t': 'picked', 'root': '/Users/me/Notes'}, 'pick answers with the chosen folder and needs no root')
with mock.patch.object(nh.subprocess, 'run', return_value=mock.Mock(returncode=1, stdout='', stderr='execution error: User canceled. (-128)')) as run:
    check(nh.run_picker(None) == '', 'cancelling the chooser gives an empty root, not an error')
with mock.patch.object(nh.subprocess, 'run', return_value=mock.Mock(returncode=0, stdout='/Users/me/Notes/\n', stderr='')) as run:
    check(nh.run_picker(root) == '/Users/me/Notes' and any(root in a for a in run.call_args[0][0]), 'a picked folder loses its trailing slash and the chooser opens on the current folder')
with mock.patch.object(nh.subprocess, 'run', return_value=mock.Mock(returncode=1, stdout='', stderr='boom')):
    try: nh.run_picker(None); check(False, 'a failed chooser raises')
    except nh.NotesError as e: check(e.code == 'notes_io', 'a failed chooser is notes_io')

# Saving an edited file keeps what the editor cannot see: line endings, the
# executable bit. Files a save would damage are refused before editing starts.
ed = tempfile.mkdtemp(prefix='bfb-edit-')
def put(name, data, mode=0o644):
    p = os.path.join(ed, name)
    with open(p, 'wb') as fh: fh.write(data)
    os.chmod(p, mode)
    return p
def save(name, text):
    r = nh.handle({'op': 'fileRead', 'root': ed, 'rel': name})
    return nh.handle({'op': 'fileWrite', 'root': ed, 'rel': name, 'text': text, 'expectMtime': r['mtime']})
with mock.patch.object(nh, 'BACKUP_DIR', os.path.join(ed, '.backups')):
    p = put('crlf.txt', b'one\r\ntwo\r\n')
    r = nh.handle({'op': 'fileRead', 'root': ed, 'rel': 'crlf.txt'})
    check(r['text'] == 'one\ntwo\n', f'a CRLF file reaches the editor with plain newlines: {r["text"]!r}')
    save('crlf.txt', 'one\ntwo\nthree\n')
    check(open(p, 'rb').read() == b'one\r\ntwo\r\nthree\r\n', f'a CRLF file is saved with CRLF: {open(p, "rb").read()!r}')
    p = put('lf.txt', b'a\nb\n')
    save('lf.txt', 'a\nb\nc\n')
    check(open(p, 'rb').read() == b'a\nb\nc\n', 'an LF file stays LF')
    p = put('run.sh', b'echo hi\n', 0o755)
    save('run.sh', 'echo bye\n')
    check(os.stat(p).st_mode & 0o777 == 0o755, f'an executable script stays executable: {oct(os.stat(p).st_mode & 0o777)}')
    put('bad.txt', b'hi\xff\xfe (\n')
    r = call({'op': 'fileRead', 'root': ed, 'rel': 'bad.txt'})
    check(r['t'] == 'error' and 'UTF-8' in r['message'], f'a file that is not UTF-8 is refused before editing: {r}')
    p = put('ro.md', b'# ro\n', 0o444)
    r = call({'op': 'fileRead', 'root': ed, 'rel': 'ro.md'})
    check(r['t'] == 'error' and 'read-only' in r['message'] and os.stat(p).st_mode & 0o777 == 0o444, f'a read-only file is refused and keeps its mode: {r}')

print(f'\n{"all checks passed" if not fails else str(fails) + " check(s) failed"}')
sys.exit(1 if fails else 0)
