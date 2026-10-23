#!/usr/bin/env python3
"""Protocol test for notes_host.py: spawns the host per request the way Chrome
does, over a temp folder. Run: python3 native/test_notes_host.py"""
import json, os, struct, subprocess, sys, tempfile, time

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

r = call({'op': 'home'})
check(r == {'t': 'home', 'home': os.path.expanduser('~')}, f'home reports the account folder and needs no root: {r}')

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

# A large file comes back in slices that each fit Chrome's 1 MB reply limit,
# and the slices join back into the exact text, emoji and all.
def read_all(name):
    parts, offset, frames = [], 0, []
    while offset is not None:
        r = nh.handle({'op': 'fileRead', 'root': ed, 'rel': name, 'offset': offset})
        frames.append(len(json.dumps(r).encode('utf-8')))
        parts.append(r['text']); offset = r['next']
    return ''.join(parts), frames
for name, text in [('big-ascii.txt', 'const value = compute(1, "row");\n' * 100_000),
                   ('big-emoji.md', ('note 😀 ü ' * 40 + '\n') * 8_000)]:
    put(name, text.encode('utf-8'))
    got, frames = read_all(name)
    check(got == text and len(frames) > 1 and max(frames) < 1024 * 1024,
          f'{name} ({len(text.encode())} bytes) reads back exactly in {len(frames)} slices, largest {max(frames)} bytes')
put('small.txt', b'tiny\n')
r = nh.handle({'op': 'fileRead', 'root': ed, 'rel': 'small.txt', 'offset': 0})
check(r['text'] == 'tiny\n' and r['next'] is None, 'a small file comes back whole with no next slice')
old = nh.handle({'op': 'fileRead', 'root': ed, 'rel': 'big-ascii.txt'})
check(len(old['text']) == 3_300_000 and 'next' not in old, 'a read with no offset (an older client) gets the whole file, never a slice')
s = nh.handle({'op': 'fileStat', 'root': ed, 'rel': 'small.txt'})
check(s['t'] == 'fstat' and s['size'] == 5 and s['mtime'] == r['mtime'], f'fileStat reports size and the same mtime as a read: {s}')
with mock.patch.object(nh, 'FILE_MAX', 100):
    try: nh.handle({'op': 'fileRead', 'root': ed, 'rel': 'big-ascii.txt'}); check(False, 'a file over the cap is refused')
    except nh.NotesError as e: check('20 MB' in str(e), f'a file over the cap is refused: {e}')

# Comments through the host: read and write as the owner, the document never
# written, paths kept inside the allowed folder, and rename and delete carry
# a note's comments along.
os.environ['BFB_DOCS_HOME'] = tempfile.mkdtemp(prefix='bfb-docs-state-')
cd = tempfile.mkdtemp(prefix='bfb-comments-')
doc = os.path.join(cd, 'plan.md')
with open(doc, 'w') as fh: fh.write('# Plan\n\nShip on Friday after the smoke run.\n')
before = (open(doc, 'rb').read(), os.stat(doc).st_mtime_ns)
r = call({'op': 'commentsRead', 'root': cd, 'rel': 'plan.md'})
check(r['t'] == 'comments' and r['threads'] == [], f'commentsRead on a file with no comments is an empty list: {r.get("threads")}')
at = open(doc).read().index('Friday')
r = call({'op': 'commentsWrite', 'root': cd, 'rel': 'plan.md', 'ops': [{'op': 'new', 'start': at, 'end': at + 6, 'text': 'Thursday? #schedule'}]})
check(r['t'] == 'comments' and len(r['threads']) == 1 and r['threads'][0]['comments'][0]['author']['kind'] == 'human' and r['threads'][0]['tags'] == ['schedule'],
      f'commentsWrite makes a thread as the owner: {r.get("threads", [{}])[0].get("comments") if r.get("threads") else r}')
tid = r['threads'][0]['id']
r = call({'op': 'commentsWrite', 'root': cd, 'rel': 'plan.md', 'ops': [{'op': 'reply', 'thread': tid, 'text': 'ok'}, {'op': 'done', 'thread': tid}]})
check(len(r['threads'][0]['comments']) == 2 and r['threads'][0]['status'] == 'done' and r['threads'][0]['place']['state'] == 'anchored', 'several operations apply in one write, and each thread says where it sits')
check((open(doc, 'rb').read(), os.stat(doc).st_mtime_ns) == before, 'the document is untouched by comment writes')
r = call({'op': 'commentsWrite', 'root': cd, 'rel': 'plan.md', 'ops': [{'op': 'reply', 'thread': 't-nope', 'text': 'x'}]})
check(r['t'] == 'error' and r['code'] == 'docs_missing_thread', f'a reply to a thread that is not there says so: {r}')
r = call({'op': 'commentsWrite', 'root': cd, 'rel': 'plan.md', 'ops': [{'op': 'new', 'start': 0, 'end': 99999, 'text': 'x'}]})
check(r['t'] == 'error' and r['code'] == 'notes_bad_op', f'a span outside the document is refused: {r}')
check(call({'op': 'commentsRead', 'root': cd, 'rel': '../plan.md'})['code'] == 'notes_bad_path', 'a path out of the allowed folder is refused')
r = call({'op': 'docsIndex'})
check(r['t'] == 'docsIndex' and any(d['doc'] == os.path.realpath(doc) and d['done'] == 1 for d in r['docs']), 'docsIndex lists the document with its counts')
nh.handle({'op': 'rename', 'root': cd, 'rel': 'plan.md', 'to': 'later.md'})
check(os.path.exists(os.path.join(cd, 'later.md.bfb.json')) and not os.path.exists(doc + '.bfb.json'), 'renaming a note moves its comments with it')
r = nh.handle({'op': 'delete', 'root': cd, 'rel': 'later.md'})
check(os.path.exists(os.path.join(cd, r['trashed'] + '.bfb.json')), 'deleting a note moves its comments into .trash beside it')

# The page counts an emoji as two units and Python as one. A comment after
# emoji lands on the words selected, and the page gets back offsets it can
# slice its own string with.
emo = os.path.join(cd, 'emoji.md')
text = '| id | state | default |\n| `A` | 🔴 🗣 🧪 | stays open |\n| `B` | 🟢 💭 | not sent |\n'
with open(emo, 'w') as fh: fh.write(text)
def u16(i): return len(text[:i].encode('utf-16-le')) // 2
at = text.index('not sent')
r = call({'op': 'commentsWrite', 'root': cd, 'rel': 'emoji.md', 'ops': [{'op': 'new', 'start': u16(at), 'end': u16(at) + 8, 'text': 'x'}]})
st = json.load(open(emo + '.bfb.json'))['comments']['threads'][0]['anchor']
check(st['exact'] == 'not sent', f'a comment after emoji anchors to the selected words: {st["exact"]!r}')
pl = r['threads'][0]['place']
page = text.encode('utf-16-le')
check(page[pl['offset'] * 2:(pl['offset'] + pl['length']) * 2].decode('utf-16-le') == 'not sent', f'the page gets UTF-16 offsets back: {pl}')
r = call({'op': 'commentsRead', 'root': cd, 'rel': 'emoji.md'})
pl = r['threads'][0]['place']
check(page[pl['offset'] * 2:(pl['offset'] + pl['length']) * 2].decode('utf-16-le') == 'not sent', f'reading back gives the same UTF-16 place: {pl}')

# Decision pages: the host only relays to gcc's command, here a stub that
# echoes what it was given and plays a conflict and a failed wake.
stub_dir = tempfile.mkdtemp(prefix='bfb-dp-')
stub = os.path.join(stub_dir, 'decision-page.sh')
with open(stub, 'w') as fh:
    fh.write('''#!/usr/bin/env python3
import json, sys
verb, slug = sys.argv[1], sys.argv[2]
picks = json.load(sys.stdin)
if verb == 'submit' and slug == 'taken':
    print(json.dumps({'code': 'dp_conflict', 'message': 'answered somewhere else'})); sys.exit(1)
if verb == 'submit' and slug == 'nowake':
    print(json.dumps({'written': True, 'woke': False})); sys.exit(0)
print(json.dumps({'verb': verb, 'slug': slug, 'got': picks}))
''')
os.chmod(stub, 0o755)
os.environ['BFB_DP_BIN'] = stub
r = call({'op': 'dp', 'verb': 'compose', 'slug': 'my-page', 'payload': {'D1': 'a'}})
check(r.get('t') == 'dp' and r['result'] == {'verb': 'compose', 'slug': 'my-page', 'got': {'D1': 'a'}}, f'dp compose relays the picks and the reply: {r}')
r = call({'op': 'dp', 'verb': 'submit', 'slug': 'taken', 'payload': {}})
check(r.get('t') == 'error' and r['code'] == 'dp_conflict', f'a conflict comes back as its own code: {r}')
r = call({'op': 'dp', 'verb': 'submit', 'slug': 'nowake', 'payload': {}})
check(r.get('result') == {'written': True, 'woke': False}, f'a written answer whose wake failed says so: {r}')
r = call({'op': 'dp', 'verb': 'seen', 'slug': 'my-page'})
check(r.get('t') == 'dp' and r['result']['verb'] == 'seen', f'dp seen relays: {r}')
r = call({'op': 'dp', 'verb': 'rm', 'slug': 'my-page'})
check(r.get('code') == 'notes_bad_op', f'a verb outside the four is refused: {r}')
r = call({'op': 'dp', 'verb': 'parse', 'slug': '../etc'})
check(r.get('code') == 'notes_bad_path', f'a slug that is not a page name is refused: {r}')
os.environ['BFB_DP_BIN'] = os.path.join(stub_dir, 'missing.sh')
r = call({'op': 'dp', 'verb': 'compose', 'slug': 'my-page'})
check(r.get('code') == 'dp_unavailable', f'no command installed gives a stable code: {r}')
del os.environ['BFB_DP_BIN']

# The Decisions lens reads gcc's registry: waiting, answered, never answered, seen.
reg = tempfile.mkdtemp(prefix='bfb-dpreg-')
def page(slug, age_days, *dots, cfg=None):
    d = os.path.join(reg, slug); os.makedirs(d)
    with open(os.path.join(d, 'config.json'), 'w') as fh: fh.write(cfg if cfg is not None else json.dumps({'title': slug.upper(), 'origin': {'project': 'p'}, 'decisions': [{'id': 'D1'}], 'sections': [{'id': 's1'}, {'id': 's2'}]}))
    t = time.time() - age_days * 86400
    os.utime(os.path.join(d, 'config.json'), (t, t))
    for dot in dots:
        with open(os.path.join(d, dot), 'w') as fh: fh.write('{}')
page('old-listed', 30)
page('old-quiet', 30)
page('fresh', 1)
page('done', 2, '.answer.json', '.seen.json')
page('broken', 3, cfg='{not json')
os.makedirs(os.path.join(reg, 'not-a-page'))
with open(os.path.join(reg, '.pending.txt'), 'w') as fh: fh.write('old-listed\n')
os.environ['BFB_DP_REGISTRY'] = reg
r = call({'op': 'dpPages'})
states = {p['slug']: p['state'] for p in r.get('pages', [])}
check(states == {'old-listed': 'waiting', 'old-quiet': 'never', 'fresh': 'waiting', 'done': 'answered', 'broken': 'broken'},
      f'pages are waiting when listed or fresh, answered with an answer, never otherwise: {states}')
check([p['slug'] for p in r['pages']][:3] == ['fresh', 'done', 'broken'], f'newest first: {[p["slug"] for p in r["pages"]]}')
fresh = next(p for p in r['pages'] if p['slug'] == 'fresh')
check(fresh['title'] == 'FRESH' and fresh['items'] == 3 and fresh['origin'] == {'project': 'p'} and fresh['seen'] is False, f'a row carries title, item count, origin and seen: {fresh}')
check(next(p for p in r['pages'] if p['slug'] == 'done')['seen'] is True, 'a page with .seen.json reads as seen')
os.environ['BFB_DP_REGISTRY'] = os.path.join(reg, 'nowhere')
r = call({'op': 'dpPages'})
check(r.get('code') == 'dp_unavailable', f'a missing registry gives a stable code: {r}')
del os.environ['BFB_DP_REGISTRY']

print(f'\n{"all checks passed" if not fails else str(fails) + " check(s) failed"}')
sys.exit(1 if fails else 0)
