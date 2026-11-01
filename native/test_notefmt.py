#!/usr/bin/env python3
"""Holds native/notefmt.py and the host's readers to the notes spec's fixture files.

The fixtures are a vendored copy under tests/fixtures/notes-spec with a recorded
hash; when the spec folder is on this machine, the copy must match it too.
Run: python3 native/test_notefmt.py"""
import hashlib, json, os, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import notefmt  # noqa: E402
import notes_host  # noqa: E402

DIR = os.path.join(HERE, '..', 'tests', 'fixtures', 'notes-spec')
SPEC_DIR = '/Users/alcatraz627/Code/mnt-sync/specs/notes/fixtures'
RECORDED = os.path.join(HERE, '..', 'tests', 'fixtures', 'notes-spec.sha256')

fails = 0
def check(cond, label):
    global fails
    if not cond:
        print('FAIL ' + label)
        fails += 1

def rd(*p):
    with open(os.path.join(DIR, *p), 'rb') as fh:
        return fh.read().decode('utf-8')

def folder_hash(d):
    """Same value as tests/notes-spec-hash.ts: sha256 over 'path NUL sha256(bytes) LF' in path order."""
    rels = []
    for base, dirs, files in os.walk(d):
        for f in files:
            rels.append(os.path.relpath(os.path.join(base, f), d).replace(os.sep, '/'))
    h = hashlib.sha256()
    for rel in sorted(rels):
        with open(os.path.join(d, rel), 'rb') as fh:
            h.update(f'{rel}\0{hashlib.sha256(fh.read()).hexdigest()}\n'.encode('utf-8'))
    return h.hexdigest()

with open(RECORDED) as fh:
    check(folder_hash(DIR) == fh.read().strip(), 'vendored fixtures match the recorded hash')
if os.path.isdir(SPEC_DIR):
    check(folder_hash(DIR) == folder_hash(SPEC_DIR), 'vendored fixtures match the spec folder')

NOT_CASES = {'order', 'pos', 'ids', 'savekey'}
cases = sorted(f[:-5] for f in os.listdir(DIR) if f.endswith('.json') and f[:-5] not in NOT_CASES)
check(len(cases) > 40, 'found the reading cases')
for name in cases:
    want = json.loads(rd(name + '.json'))
    got = notefmt.parse(rd(name + '.md'), name)
    check(got == want, f'reading {name}')

# the host's own title and props come from the same parser
tmp = tempfile.mkdtemp(prefix='bfb-fixt-')
for name in cases:
    path = os.path.join(tmp, name + '.md')
    with open(path, 'wb') as fh:
        fh.write(rd(name + '.md').encode('utf-8'))
    want = json.loads(rd(name + '.json'))
    # An empty `title:` stays empty in the parse; the list shows the note's first line instead (display only).
    shown = want['title'] or (name if want['conflicted'] else notefmt._derive_title(want['body'], name))
    check(notes_host.note_title(path) == shown, f'host title of {name}: {notes_host.note_title(path)!r}')
    props = notes_host.note_props(path)
    check(props['pinned'] == want['pinned'] and props['tags'] == want['tags'] and props['color'] == (want['color'] or '')
          and props['pos'] == (want['pos'] or '') and props['conflicted'] == want['conflicted'], f'host props of {name}')

for name in sorted(f[:-3] for f in os.listdir(os.path.join(DIR, 'settle')) if f.count('.') == 1 and f.endswith('.md')):
    src = rd('settle', name + '.md')
    for keep in ('first', 'second', 'both'):
        check(notefmt.settle(src, keep) == rd('settle', f'{name}.{keep}.md'), f'settle {name} {keep}')
for row in json.loads(rd('settle', 'auto.json')):
    check(notefmt.auto_settles(rd('settle', row['file']), row['path']) == row['auto'], f"auto {row['file']} at {row['path']}")

for name in sorted(f[:-5] for f in os.listdir(os.path.join(DIR, 'render')) if f.endswith('.json')):
    check(notefmt.render(json.loads(rd('render', name + '.json'))) == rd('render', name + '.md'), f'render {name}')

for c in json.loads(rd('order.json')):
    check([n['id'] for n in notefmt.sort_notes(c['notes'])] == c['expected'], f"order {c['name']}")
pos, ids = json.loads(rd('pos.json')), json.loads(rd('ids.json'))
for s in pos['valid']: check(notefmt.valid_pos(s), f'pos {s!r} valid')
for s in pos['invalid']: check(not notefmt.valid_pos(s), f'pos {s!r} invalid')
for s in ids['valid']: check(notefmt.valid_id(s), f'id {s!r} valid')
for s in ids['invalid']: check(not notefmt.valid_id(s), f'id {s!r} invalid')
for c in json.loads(rd('savekey.json')):
    check(notefmt.normalise_url(c['url']) == c['normalised'] and notefmt.save_key(c['url']) == c['key'], f"save key {c['url']!r}")

if fails:
    print(f'{fails} failed')
    sys.exit(1)
print(f'all fixtures pass ({len(cases)} reading cases)')
