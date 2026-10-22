#!/usr/bin/env python3
"""Checks for bfb-docs: anchoring, parsing, identity, git, merging and the CLI.

Everything runs in scratch folders with BFB_DOCS_HOME pointed at a scratch
state folder; the CLI runs as a real subprocess. Usage: python3 test_bfb_docs.py
"""
import datetime, json, os, shutil, subprocess, sys, tempfile, threading

HERE = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, HERE)
import comments as C  # noqa: E402

fails = 0
def check(ok, msg):
    global fails
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: fails += 1

SCRATCH = tempfile.mkdtemp(prefix='bfb-docs-test-')
STATE = os.path.join(SCRATCH, 'state')
IPC = os.path.join(SCRATCH, 'ipc')
os.makedirs(os.path.join(IPC, 'alias-by-sid'))
BASE_ENV = {k: v for k, v in os.environ.items() if not k.startswith(('CLAUDE_', 'BFB_'))}
BASE_ENV.update(BFB_DOCS_HOME=STATE, CLAUDE_IPC_HOME=IPC, GIT_CONFIG_NOSYSTEM='1')

def cli(*args, sid=None, cwd=None, ok=True):
    env = dict(BASE_ENV)
    if sid: env['CLAUDE_CODE_SESSION_ID'] = sid
    r = subprocess.run([sys.executable, os.path.join(HERE, 'bfb_docs.py'), *args], capture_output=True, text=True, env=env, cwd=cwd or SCRATCH)
    if ok and r.returncode != 0:
        print('   cli failed:', args, r.stderr.strip())
    return r

def jcli(*args, **kw):
    r = cli('--json', *args, **kw)
    return json.loads(r.stdout) if r.returncode == 0 else None

def git(cwd, *args):
    return subprocess.run(['git', '-c', 'user.email=t@t', '-c', 'user.name=T', '-c', 'protocol.file.allow=always', *args],
                          cwd=cwd, capture_output=True, text=True, env=BASE_ENV)

def put(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as fh: fh.write(text)
    return path

def stamp(path):
    with open(path, 'rb') as fh: return fh.read(), os.stat(path).st_mtime_ns

# ── Anchoring ───────────────────────────────────────────────────────────
DOC = """# Release plan

## Timing

We agreed to ship on Friday after the smoke run, unless the e2e suite is red.

## Risks

The lens rail could slip. The smoke run takes ten minutes.

## Notes

Nothing else.
"""
def anchor_for(text, quote, nth=0):
    s = C.occurrences(text, quote)[nth]
    return C.make_anchor(text, s, s + len(quote))

a = anchor_for(DOC, 'ship on Friday after the smoke run')
check(a['headings'] == ['Release plan', 'Timing'] and a['line'] == 5, f'an anchor records its heading path and line: {a["headings"]} {a["line"]}')

# (a) the paragraph moves to another section: carried exactly through the diff
moved = DOC.replace('We agreed to ship on Friday after the smoke run, unless the e2e suite is red.\n\n', '').replace('Nothing else.\n', 'Nothing else.\n\nWe agreed to ship on Friday after the smoke run, unless the e2e suite is red.\n')
r = C.resolve(a, moved, DOC)
check(r['state'] == 'anchored' and moved[r['offset']:r['offset'] + r['length']] == a['exact'], f'(a) a paragraph moved to another section stays anchored: {r}')

# (b) a word inside the quote changes: moved, found by fuzzy matching
edited = DOC.replace('ship on Friday after the smoke run', 'ship on Thursday after the smoke run')
r = C.resolve(a, edited, DOC)
check(r['state'] == 'moved' and 'Thursday' in edited[r['offset']:r['offset'] + r['length']], f'(b) a changed word inside the quote is found as moved: {r}')

# (c) the paragraph is reflowed
reflowed = DOC.replace('ship on Friday after the smoke run', 'ship on Friday\nafter the  smoke run')
r = C.resolve(a, reflowed, DOC)
check(r['state'] in ('anchored', 'moved') and r['offset'] is not None and 'smoke run' in reflowed[r['offset']:r['offset'] + r['length']], f'(c) a reflowed quote is still found: {r}')

# (d) the quoted sentence also appears elsewhere: context picks the right one
dup = DOC.replace('Nothing else.', 'We agreed to ship on Friday after the smoke run, for the record.')
b = anchor_for(DOC, 'ship on Friday after the smoke run')
r = C.locate(dup, b)
check(r[0] == 'anchored' and r[1] == DOC.index('ship on Friday'), f'(d) with a duplicate sentence, context picks the original: {r}')

# (e) the quoted sentence is deleted
gone = DOC.replace('We agreed to ship on Friday after the smoke run, unless the e2e suite is red.\n\n', '')
r = C.resolve(a, gone, DOC)
check(r['state'] == 'detached' and r['offset'] is None, f'(e) a deleted quote is detached, not guessed: {r}')

# Two far-apart edits in one save: the anchor between them is carried exactly.
risk = anchor_for(DOC, 'The lens rail could slip.')
two = DOC.replace('# Release plan', '# Release plan (draft)').replace('Nothing else.', 'Nothing else at all.')
r = C.resolve(risk, two, DOC)
check(r['state'] == 'anchored' and two[r['offset']:r['offset'] + r['length']] == 'The lens rail could slip.', f'two edits far apart in one save leave the anchor between them exact: {r}')
# Lots of text added above: carried, not searched.
above = '\n'.join(f'Line {i} of an intro.' for i in range(400)) + '\n' + DOC
r = C.resolve(risk, above, DOC)
check(r['state'] == 'anchored' and r['line'] == risk['line'] + 400, f'text added above shifts the anchor exactly: line {risk["line"]} to {r["line"]}')

# ── Parsing ─────────────────────────────────────────────────────────────
today = datetime.date(2026, 10, 21)
cases = [
    ('Looks off #schedule #Risk', {'tags': ['schedule', 'risk']}),
    ('Issue #42 and colour #fff and #e0e0e0', {'tags': []}),
    ('# Heading\nbody', {'tags': []}),
    ('see https://x.dev/page#frag and `#code`', {'tags': []}),
    ('```\n#notatag @nobody\n```\n#real', {'tags': ['real'], 'mentions': []}),
    ('mail me at me@example.com', {'mentions': []}),
    ('@bfb can you check? cc @user', {'mentions': ['bfb', 'user']}),
    ('@claude look, and @claude:bfb too.', {'mentions': ['claude', 'claude:bfb']}),
    ('@due 2026-10-25 please', {'due': '2026-10-25', 'mentions': []}),
    ('@tomorrow works', {'due': '2026-10-22', 'mentions': []}),
    ('Fixed it.\n/done', {'done': True}),
    ('one more thing\n/reopen', {'reopen': True}),
    ('/done is mentioned inline', {'done': False}),
]
for text, want in cases:
    got = C.parse(text, today)
    sub = {k: got[k] for k in want}
    check(sub == want, f'parse {text!r} gives {sub}')

# ── CLI: identity ───────────────────────────────────────────────────────
r = jcli('whoami')
check(r and r['author'] == {'kind': 'human', 'ipc': 'user', 'name': r['author'].get('name')} and 'owner' in r['why'], f'a plain terminal writes as the owner: {r}')
SID = '11111111-2222-3333-4444-555555555555'
with open(os.path.join(IPC, 'alias-by-sid', SID), 'w') as fh: fh.write('bfb\n')
r = jcli('whoami', sid=SID)
check(r and r['author'] == {'kind': 'agent', 'alias': 'bfb', 'session': SID}, f'a Claude session writes as its ipc alias with its session id: {r}')
r = jcli('whoami', sid='99999999-0000-0000-0000-000000000000')
check(r and r['author']['alias'] == '99999999-0000-0000-0000-000000000000', f'a session with no alias writes as its session id: {r and r["author"]}')
r = jcli('--role', 'reviewer', 'whoami', sid=SID)
check(r and r['author'].get('role') == 'reviewer', '--role adds a label to an agent')

# ── CLI: a full round trip in a git repo ────────────────────────────────
repo = os.path.join(SCRATCH, 'repo')
os.makedirs(repo)
git(repo, 'init', '-q')
plan = put(os.path.join(repo, 'plan.md'), DOC)
git(repo, 'add', 'plan.md'); git(repo, 'commit', '-qm', 'init')
before = stamp(plan)
r = jcli('comments', 'new', plan, '--quote', 'ship on Friday after the smoke run', 'Is Friday realistic? @bfb #schedule')
check(r and r['results'][0]['thread'].startswith('t-') and any('git: excluded' in n for n in r['notes']), f'new makes a thread and keeps the companion out of git: {r and r["notes"]}')
tid = r['results'][0]['thread']
comp = plan + '.bfb.json'
status = git(repo, 'status', '--porcelain').stdout
check(os.path.exists(comp) and 'bfb.json' not in status, f'git status does not show the companion: {status!r}')
excl = open(os.path.join(repo, '.git', 'info', 'exclude')).read()
check(excl.count('*.bfb*.json') == 1, 'the exclude file gets one line')
jcli('comments', 'reply', plan, tid[:10], 'Thursday is safer. @due 2026-10-23', sid=SID)
r = jcli('comments', 'list', plan)
t = r[0] if r else {}
check(len(t.get('comments', [])) == 2 and t['comments'][1]['author']['alias'] == 'bfb' and t.get('due') == '2026-10-23' and t.get('mentions') == ['bfb'] and t.get('tags') == ['schedule'],
      f'reply by an agent adds its author, due date; tags and mentions carry: {t.get("tags")} {t.get("mentions")} {t.get("due")}')
r = jcli('comments', 'list', repo, '--for', 'bfb')
check(r == [], f'a thread whose last word is the agent\'s is not waiting on it: {len(r or [])}')
r = jcli('comments', 'list', repo, '--for', 'user')
check(r and len(r) == 1, 'it is waiting on the owner')
jcli('comments', 'reply', plan, tid[:10], '@bfb one more question')
r = jcli('comments', 'list', repo, '--for', 'bfb')
check(r and len(r) == 1, 'mentioned again after its reply, the thread waits on the agent again')
jcli('comments', 'reply', plan, tid[:10], 'answered', sid=SID)
jcli('comments', 'reply', plan, tid[:10], '@claude:bfb and one for you')
r = jcli('comments', 'list', repo, '--for', 'bfb')
check(r and len(r) == 1, '@claude:bfb puts the thread in bfb\'s inbox')
jcli('comments', 'reply', plan, tid[:10], 'answered again', sid=SID)
jcli('comments', 'reply', plan, tid[:10], '@claude anyone?')
r1 = jcli('comments', 'list', repo, '--for', 'bfb')
r2 = jcli('comments', 'list', repo, '--for', 'other-agent')
check(r1 and len(r1) == 1 and r2 and len(r2) == 1, 'a bare @claude reaches every agent\'s inbox')
jcli('comments', 'reply', plan, tid[:10], 'answered once more', sid=SID)
jcli('comments', 'done', plan, tid[:10], 'Moved to Thursday.')
r = jcli('comments', 'list', plan, '--all')
check(r and r[0]['status'] == 'done' and r[0]['doneBy']['kind'] == 'human', 'done closes the thread and records who')
check(jcli('comments', 'list', plan) == [], 'list hides done threads by default')
jcli('comments', 'reopen', plan, tid[:10])
jcli('comments', 'tag', plan, tid[:10], 'release', '#later')
jcli('comments', 'untag', plan, tid[:10], 'later')
r = jcli('comments', 'list', plan)
check(r and r[0]['status'] == 'open' and r[0]['tags'] == ['schedule', 'release'], f'reopen, tag and untag: {r and r[0]["tags"]}')
jcli('comments', 'due', plan, tid[:10], '2026-11-02')
r = jcli('comments', 'list', plan)
had = r and r[0].get('due')
jcli('comments', 'due', plan, tid[:10], 'none')
r = jcli('comments', 'list', plan)
bad = cli('comments', 'due', plan, tid[:10], 'friday', ok=False)
check(had == '2026-11-02' and r and 'due' not in r[0] and bad.returncode == 1, f'due sets and clears a date and refuses anything else: {had} {r and r[0].get("due")} {bad.stderr.strip()}')
r = cli('comments', 'new', plan, '--quote', 'smoke run', 'which one?', ok=False)
check(r.returncode == 1 and 'lines 5, 9' in r.stderr, f'an ambiguous quote is refused with its lines: {r.stderr.strip()}')
r = jcli('comments', 'suggest', plan, '--quote', 'could slip', '--replace', 'might slip', 'softer')
v = jcli('comments', 'list', plan)
sug = [c for t in (v or []) for c in t['comments'] if c.get('suggestion')]
check(len(sug) == 1 and sug[0]['suggestion'] == {'replace': 'might slip', 'state': 'pending'}, 'suggest makes a thread with a pending suggestion')
check(stamp(plan) == before, 'the document is byte-for-byte and mtime unchanged after every command')
# Deciding a suggestion is the page's job (the owner's); the store records it and never touches the document.
os.environ['BFB_DOCS_HOME'] = STATE
import docs_store as S  # noqa: E402
sug_t = next(t for t in v if any(c.get('suggestion') for c in t['comments']))
sug_c = next(c for c in sug_t['comments'] if c.get('suggestion'))
owner = {'kind': 'human', 'id': 'owner'}
try:
    S.write(plan, [{'op': 'decide', 'thread': sug_t['id'], 'comment': sug_c['id'], 'state': 'maybe'}], owner); bad_state = None
except S.DocsError as e: bad_state = e.code
S.write(plan, [{'op': 'decide', 'thread': sug_t['id'], 'comment': sug_c['id'], 'state': 'rejected'}], owner)
got = next(c for t in jcli('comments', 'list', plan, '--all') for c in t['comments'] if c['id'] == sug_c['id'])['suggestion']
try:
    S.write(plan, [{'op': 'decide', 'thread': sug_t['id'], 'comment': sug_c['id'], 'state': 'accepted'}], owner); again = None
except S.DocsError as e: again = e.code
check(bad_state == 'docs_bad_args' and got['state'] == 'rejected' and got.get('decidedAt') and again == 'docs_bad_args' and stamp(plan) == before,
      f'decide records a rejection once, refuses a second decision and an unknown state, and leaves the document alone: {got}')
second = put(os.path.join(repo, 'other.md'), 'Another doc with words.\n')
jcli('comments', 'new', second, '--quote', 'Another doc', 'hi')
check(open(os.path.join(repo, '.git', 'info', 'exclude')).read().count('*.bfb*.json') == 1, 'a second companion does not add the line again')
r = cli('comments', 'list', os.path.join(repo, 'no-such.md'), ok=False)
check(r.returncode == 1 and 'no such file' in r.stderr, f'list on a missing file says so instead of "No comments": {r.stderr.strip()}')
r = jcli('comments', 'show', plan, tid[:10])
check(r and r['id'] == tid, 'show finds a thread by a short id')

# ── Anchors after edits through the CLI ────────────────────────────────
put(plan, '# Release plan\n\nA new intro paragraph.\n\n' + DOC.split('\n', 1)[1])
r = jcli('comments', 'list', plan)
t = next(t for t in r if t['id'] == tid)
check(t['place']['state'] == 'anchored' and t['place']['line'] == 8, f'after an edit above, the thread is carried to its new line: {t["place"]}')
put(plan, open(plan).read().replace('ship on Friday after the smoke run', 'ship on Thursday after the smoke run'))
r = jcli('comments', 'list', plan)
t = next(t for t in r if t['id'] == tid)
jcli('comments', 'reply', plan, tid[:10], 'noted')
saved = json.load(open(comp))
st = next(x for x in saved['comments']['threads'] if x['id'] == tid)
check(t['place']['state'] == 'moved' and st['anchor']['exact'] == 'ship on Friday after the smoke run' and 'lastSeen' in st['anchor'],
      f'a fuzzy find shows as moved and never rewrites the stored quote: {t["place"]["state"]}, {st["anchor"]["exact"]!r}')

# ── Opt in and out of sharing companions ───────────────────────────────
print(cli('config', 'commit', 'on', repo).stdout.strip())
gi = open(os.path.join(repo, '.gitignore')).read()
status = git(repo, 'status', '--porcelain').stdout
check('!*.bfb*.json' in gi and '*.bfb*.json' not in open(os.path.join(repo, '.git', 'info', 'exclude')).read().split('\n') and 'plan.md.bfb.json' in status,
      f'commit on shares companions through the repo .gitignore: {status.split()}')
cli('config', 'commit', 'off', repo)
status = git(repo, 'status', '--porcelain').stdout
check('bfb.json' not in status and '!*.bfb*.json' not in open(os.path.join(repo, '.gitignore')).read(), 'commit off makes them local again')
# A repo that already tracks a companion gets no exclude line.
repo2 = os.path.join(SCRATCH, 'repo2'); os.makedirs(repo2); git(repo2, 'init', '-q')
d2 = put(os.path.join(repo2, 'a.md'), 'alpha beta gamma\n')
put(d2 + '.bfb.json', json.dumps({'format': 'bfb-doc/1', 'doc': {'id': 'd-' + '0' * 32, 'name': 'a.md', 'fingerprint': ''}, 'rev': 1, 'comments': {'v': 1, 'threads': []}}))
git(repo2, 'add', '-A'); git(repo2, 'commit', '-qm', 'x')
d3 = put(os.path.join(repo2, 'b.md'), 'delta epsilon\n')
r = jcli('comments', 'new', d3, '--quote', 'epsilon', 'hello')
check(r and any('repo shares companions' in n for n in r['notes']) and '*.bfb*.json' not in (open(os.path.join(repo2, '.git', 'info', 'exclude')).read() if os.path.exists(os.path.join(repo2, '.git', 'info', 'exclude')) else ''),
      f'a repo that tracks companions is left alone: {r and r["notes"]}')

# ── Linked worktree and submodule ──────────────────────────────────────
wt = os.path.join(SCRATCH, 'repo-wt')
git(repo, 'worktree', 'add', '-q', wt)
r = jcli('comments', 'list', os.path.join(wt, 'plan.md'))
check(r and any(t['id'] == tid for t in r), f'a linked worktree sees the main checkout\'s comments: {len(r or [])} threads')
r = cli('comments', 'list', os.path.join(wt, 'plan.md'))
check('comments from the main checkout' in r.stdout, 'and says where they come from')
sub_src = os.path.join(SCRATCH, 'subsrc'); os.makedirs(sub_src); git(sub_src, 'init', '-q')
put(os.path.join(sub_src, 's.md'), 'inside the submodule text\n'); git(sub_src, 'add', '-A'); git(sub_src, 'commit', '-qm', 's')
git(repo, 'submodule', 'add', '-q', sub_src, 'sub')
sdoc = os.path.join(repo, 'sub', 's.md')
r = jcli('comments', 'new', sdoc, '--quote', 'submodule text', 'in a submodule')
sub_status = git(os.path.join(repo, 'sub'), 'status', '--porcelain').stdout
check(r and 'bfb.json' not in sub_status, f'a companion inside a submodule is excluded in the submodule\'s own repo: {sub_status!r}')

# ── Sync conflict copies ───────────────────────────────────────────────
saved = json.load(open(comp))
copy = json.loads(json.dumps(saved))
copy['comments']['threads'][0]['comments'].append({'id': 'c-' + 'a' * 32, 'author': {'kind': 'human', 'ipc': 'user'}, 'created': '2026-10-21T10:00:00.000Z', 'updated': '2026-10-21T10:00:00.000Z', 'text': 'from the other Mac'})
cpath = plan + '.bfb 2.json'
put(cpath, json.dumps(copy))
r = jcli('comments', 'list', plan, '--all')
check(r and any(c['text'] == 'from the other Mac' for t in r for c in t['comments']), 'a conflict copy named plan.md.bfb 2.json is found and merged on read')
check('bfb 2.json' not in git(repo, 'status', '--porcelain').stdout, 'and the exclude pattern covers its name')
jcli('comments', 'reply', plan, tid[:10], 'after the merge')
check(not os.path.exists(cpath) and any(c['text'] == 'from the other Mac' for t in json.load(open(comp))['comments']['threads'] for c in t['comments']),
      'the next write folds it into the companion and moves the copy to backups')

# ── A stale whole-file write cannot drop or roll back anything ──────────
stale = open(comp).read()
jcli('comments', 'reply', plan, tid[:10], 'a reply the stale copy lacks')
jcli('comments', 'done', plan, tid[:10])
put(comp, stale)   # an agent writes back what it read earlier
r = jcli('comments', 'list', plan, '--all')
t = next(t for t in r if t['id'] == tid)
check(any(c['text'] == 'a reply the stale copy lacks' for c in t['comments']) and t['status'] == 'done', f'after a stale whole-file write the reply and the done are still there: {t["status"]}')
check('restored from the last known copy' in cli('comments', 'list', plan).stdout, 'and the list says what it restored')
jcli('comments', 'tag', plan, tid[:10], 'after-stale')
check(any(c['text'] == 'a reply the stale copy lacks' for x in json.load(open(comp))['comments']['threads'] if x['id'] == tid for c in x['comments']), 'the next write saves the restored version')
put(comp, '{ not json')
r = cli('comments', 'reply', plan, tid[:10], 'x', ok=False)
check(r.returncode == 1 and 'not valid JSON' in r.stderr and open(comp).read() == '{ not json', 'a broken companion is refused and left untouched')
put(comp, stale)

# ── A copied folder is a fork, not a duplicate ─────────────────────────
proj = os.path.join(SCRATCH, 'proj'); os.makedirs(proj)
pd = put(os.path.join(proj, 'notes.md'), DOC)
jcli('comments', 'new', pd, '--quote', 'The lens rail could slip.', 'original thread')
proj2 = os.path.join(SCRATCH, 'proj-copy')
shutil.copytree(proj, proj2)
pd2 = os.path.join(proj2, 'notes.md')
jcli('comments', 'new', pd2, '--quote', 'Nothing else.', 'only in the copy')
id1 = json.load(open(pd + '.bfb.json'))['doc']['id']; id2 = json.load(open(pd2 + '.bfb.json'))['doc']['id']
n1 = len(json.load(open(pd + '.bfb.json'))['comments']['threads']); n2 = len(json.load(open(pd2 + '.bfb.json'))['comments']['threads'])
check(id1 != id2 and n1 == 1 and n2 == 2, f'the copy gets its own id on its first write and nothing is merged back: ids differ={id1 != id2}, threads {n1} and {n2}')

# ── Relocation ─────────────────────────────────────────────────────────
mv = os.path.join(SCRATCH, 'mv'); os.makedirs(mv)
old = put(os.path.join(mv, 'old.md'), DOC)
jcli('comments', 'new', old, '--quote', 'The smoke run takes ten minutes.', 'slow')
new = os.path.join(mv, 'new-name.md'); os.rename(old, new)
r = jcli('comments', 'doctor', mv)
check(r and r[0]['guess'] == new, f'doctor finds where a renamed document went: {r and r[0]["guess"]}')
check('stranded' in cli('comments', 'list', mv).stdout, 'list on the folder mentions the stranded companion')
cli('comments', 'relink', old + '.bfb.json', new)
r = jcli('comments', 'list', new)
check(r and len(r) == 1 and r[0]['place']['state'] == 'anchored' and not os.path.exists(old + '.bfb.json'), 'relink moves the comments beside the renamed document')
same = put(os.path.join(mv, 'swap.md'), DOC)
jcli('comments', 'new', same, '--quote', 'The lens rail could slip.', 'one')
jcli('comments', 'new', same, '--quote', 'Nothing else.', 'two')
put(same, 'A completely different document that happens to have the same name.\n')
check('may be a different document' in cli('comments', 'list', same).stdout, 'a same-named but different file is called out, not silently detached')

# ── Two writers at once ─────────────────────────────────────────────────
race = put(os.path.join(SCRATCH, 'race', 'r.md'), DOC)
jcli('comments', 'new', race, '--quote', 'The lens rail could slip.', 'start')
rt = jcli('comments', 'list', race)[0]['id']
def writer(name, n):
    for i in range(n): cli('comments', 'reply', race, rt[:10], f'{name} {i}')
ths = [threading.Thread(target=writer, args=(w, 15)) for w in ('a', 'b')]
for th in ths: th.start()
for th in ths: th.join()
got = len(json.load(open(race + '.bfb.json'))['comments']['threads'][0]['comments'])
check(got == 31, f'two writers sending 15 replies each all land: {got} comments')

# ── The index ──────────────────────────────────────────────────────────
r = jcli('index')
check(r and os.path.realpath(comp) in r and os.path.realpath(race + '.bfb.json') in r, 'every companion written lands in the index')
r = jcli('comments', 'inbox')
check(r is not None and all(t['file'] for t in r), f'inbox reads across the index: {len(r or [])} threads waiting on the owner')

# ── Text that moves: within a file, and to another file ────────────────
src = os.path.join(SCRATCH, 'moves-a.md'); dst = os.path.join(SCRATCH, 'moves-b.md')
open(src, 'w').write('# A\n\nThe retry budget is three attempts.\n\nOther words.\n')
open(dst, 'w').write('# B\n\nNothing yet.\n')
mt = jcli('comments', 'new', src, '--quote', 'retry budget is three', 'why three? #risk')['results'][0]['thread']
jcli('comments', 'reply', src, mt[:10], 'measured on the slow link')
# Within the file: the words change, the thread is re-placed by hand.
open(src, 'w').write('# A\n\nRetries: up to five attempts.\n\nOther words.\n')
r = jcli('comments', 'attach', src, mt[:10], '--quote', 'up to five attempts')
shown = jcli('comments', 'show', src, mt[:10])
check(r is not None and shown and shown['anchor']['exact'] == 'up to five attempts', f'attach puts a thread on new words: {shown and shown["anchor"]["exact"]!r}')
# To another file: the paragraph moves, the thread follows with its replies.
open(dst, 'w').write('# B\n\nRetries: up to five attempts.\n')
open(src, 'w').write('# A\n\nOther words.\n')
r = cli('comments', 'move', src, mt[:10], dst, '--quote', 'not there', ok=False)
check(r.returncode != 0 and 'not in the file' in r.stderr and jcli('comments', 'show', src, mt[:10]) is not None and not os.path.exists(dst + '.bfb.json'),
      'a move to words that are not there changes nothing')
r = jcli('comments', 'move', src, mt[:10], dst, '--quote', 'up to five attempts')
left = jcli('comments', 'list', src, '--all') or []
moved = jcli('comments', 'show', dst, mt[:10])
check(r is not None and not any(t['id'] == mt for t in left), f'move takes the thread out of the old file: {[t["id"][:8] for t in left]}')
check(moved and len(moved['comments']) == 2 and 'risk' in moved['tags'] and moved['anchor']['exact'] == 'up to five attempts',
      f'and into the new one with its replies and tags: {moved and (len(moved["comments"]), moved["tags"], moved["anchor"]["exact"])}')
help_text = cli('comments', '--help').stdout
check(all(w in help_text for w in ('move a thread to words in another file', 'find every thread again')), 'the repair commands say what they do in --help')

shutil.rmtree(SCRATCH, ignore_errors=True)
print(f'\n{"all checks passed" if not fails else str(fails) + " check(s) failed"}')
sys.exit(1 if fails else 0)
