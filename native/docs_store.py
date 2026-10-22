"""The companion file beside a document, and everything that keeps it safe.

A document `plan.md` keeps its comments (and later, other bfb-only data) in
`plan.md.bfb.json` beside it. This module finds that file, including sync
conflict copies and the main checkout's copy for a linked worktree; reads it
merged with the last copy bfb saw, so a stale whole-file write cannot drop
or roll back anything; applies changes under a lock with an atomic replace;
keeps companions out of git unless the repo opted in; works out who is
writing; and records every companion in an index for the Docs lens.
The document itself is only ever read. Spec: .claude/specs/bfb-docs.md.

Environment, all optional: BFB_DOCS_HOME overrides where bfb keeps its
state (tests point it at a scratch folder). CLAUDE_CODE_SESSION_ID,
CLAUDE_IPC_ALIAS and CLAUDE_IPC_HOME are read only to tell who is writing.
BFB_CLAUDE_IPC overrides where the claude-ipc binary is found.
"""
import datetime
import fcntl
import glob
import hashlib
import json
import os
import re
import secrets
import shutil
import subprocess
import urllib.parse

import comments as C

FORMAT = 'bfb-doc/1'
COMMENTS_V = 1
SUFFIX = '.bfb.json'
EXCLUDE_PATTERN = '*.bfb*.json'
EXCLUDE_MARK = '# bfb-docs: comment companions stay out of git here (bfb-docs config commit on shares them)'
TEXT_MAX = 10_000


class DocsError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def home():
    """Where bfb keeps its own state: last known copies, base texts, locks, the index."""
    return os.environ.get('BFB_DOCS_HOME') or os.path.expanduser('~/Library/Application Support/BetterFileBrowser')


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'


def new_id(prefix):
    return prefix + secrets.token_hex(16)


def companion_of(doc):
    return doc + SUFFIX


def _state(*parts):
    p = os.path.join(home(), *parts)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def _atomic_write(path, text):
    d, name = os.path.split(path)
    tmp = os.path.join(d, f'.{name}.tmp-{os.getpid()}')
    with open(tmp, 'w', encoding='utf-8') as fh:
        fh.write(text)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, path)


def canonical(data):
    """The companion as written: fixed key order, threads and comments by id, two-space indent."""
    order = ['format', 'doc', 'rev', 'comments']
    out = {k: data[k] for k in order if k in data}
    out.update({k: v for k, v in data.items() if k not in out})
    cm = out.get('comments')
    if isinstance(cm, dict):
        cm['threads'] = sorted(cm.get('threads', []), key=lambda t: t.get('id', ''))
        for t in cm['threads']:
            t['comments'] = sorted(t.get('comments', []), key=lambda c: (c.get('created', ''), c.get('id', '')))
    return json.dumps(out, indent=2, ensure_ascii=False) + '\n'


# ── Who is writing ──────────────────────────────────────────────────────

def whoami(as_=None, role=None):
    """The author for a write, and which rule picked it.

    A person at a terminal (no Claude session) is the owner. A Claude session
    is its claude-ipc alias, read the way claude-ipc reads it: CLAUDE_IPC_ALIAS,
    else the alias stored for the session id, else the raw session id."""
    if as_:
        a = {'kind': 'human', 'ipc': 'user', 'name': _owner_name()} if as_ == 'user' else {'kind': 'agent', 'alias': as_}
        why = 'given with --as'
    else:
        sid = os.environ.get('CLAUDE_CODE_SESSION_ID', '')
        if not sid:
            return {'kind': 'human', 'ipc': 'user', 'name': _owner_name()}, 'no Claude session, so the owner'
        alias = os.environ.get('CLAUDE_IPC_ALIAS', '')
        why = 'CLAUDE_IPC_ALIAS'
        if not alias:
            ipc_home = os.environ.get('CLAUDE_IPC_HOME') or os.path.expanduser('~/.claude-ipc')
            try:
                with open(os.path.join(ipc_home, 'alias-by-sid', urllib.parse.quote(sid, safe='')), encoding='utf-8') as fh:
                    alias = fh.read().strip()
                why = 'the claude-ipc alias registered for this session'
            except OSError:
                alias, why = sid, 'no claude-ipc alias, so the session id'
        a = {'kind': 'agent', 'alias': alias, 'session': sid}
    if role and a['kind'] == 'agent':
        a['role'] = role
    return a, why


def ipc_peers():
    """Agent sessions claude-ipc sees as live or idle, as {alias, cwd, status},
    for offering `@claude:<alias>`. Empty when claude-ipc is missing or slow."""
    exe = os.environ.get('BFB_CLAUDE_IPC') or shutil.which('claude-ipc') or os.path.expanduser('~/.local/bin/claude-ipc')
    try:
        r = subprocess.run([exe, 'peers'], capture_output=True, text=True, timeout=4)
        peers = json.loads(r.stdout).get('peers', [])
    except (OSError, subprocess.SubprocessError, ValueError, AttributeError):
        return []
    return [{'alias': p['alias'], 'cwd': p.get('cwd') or '', 'status': p['status']}
            for p in peers if p.get('alias') and not p.get('service') and p.get('status') in ('live', 'idle')]


def _owner_name():
    try:
        with open(_state('owner.json'), encoding='utf-8') as fh:
            name = json.load(fh).get('name')
            if name: return name
    except (OSError, ValueError):
        pass
    try:
        name = subprocess.run(['git', 'config', '--global', 'user.name'], capture_output=True, text=True, timeout=5).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        name = ''
    return name or 'Owner'


def author_key(a):
    return 'user' if a.get('kind') == 'human' else a.get('alias', '')


# ── Git ─────────────────────────────────────────────────────────────────

def _git(folder, *args):
    try:
        r = subprocess.run(['git', '-C', folder, *args], capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        return None
    return r


def repo_info(folder):
    """The repo holding `folder`, or None: its top, git dir, common dir and exclude file."""
    r = _git(folder, 'rev-parse', '--show-toplevel', '--git-dir', '--git-common-dir', '--git-path', 'info/exclude')
    if not r or r.returncode != 0:
        return None
    top, gdir, common, exclude = r.stdout.strip().split('\n')[:4]
    rel = lambda p: p if os.path.isabs(p) else os.path.normpath(os.path.join(folder, p))
    gdir, common, exclude = rel(gdir), rel(common), rel(exclude)
    return {'top': top, 'git_dir': gdir, 'common': common, 'exclude': exclude,
            'linked': os.path.realpath(gdir) != os.path.realpath(common)}


def _opted_in(info):
    gi = os.path.join(info['top'], '.gitignore')
    try:
        with open(gi, encoding='utf-8') as fh:
            if any(l.strip() == '!' + EXCLUDE_PATTERN for l in fh): return True
    except OSError:
        pass
    r = _git(info['top'], 'ls-files', '--', EXCLUDE_PATTERN)
    return bool(r and r.returncode == 0 and r.stdout.strip())


def keep_out_of_git(companion):
    """Before a companion's first write: add the local exclude line unless the
    repo shares companions or already ignores this one. Returns what it did."""
    folder = os.path.dirname(os.path.abspath(companion))
    info = repo_info(folder)
    if not info:
        return 'not a repo'
    if _opted_in(info):
        return 'repo shares companions'
    r = _git(folder, 'check-ignore', '-q', companion)
    if r and r.returncode == 0:
        return 'already ignored'
    os.makedirs(os.path.dirname(info['exclude']), exist_ok=True)
    try:
        with open(info['exclude'], encoding='utf-8') as fh:
            have = fh.read()
    except OSError:
        have = ''
    if EXCLUDE_PATTERN in have.split('\n'):
        return 'already ignored'
    with open(info['exclude'], 'a', encoding='utf-8') as fh:
        fh.write(('' if not have or have.endswith('\n') else '\n') + EXCLUDE_MARK + '\n' + EXCLUDE_PATTERN + '\n')
    return 'excluded'


def set_commit(folder, on):
    """Share companions in this repo (on: the repo's .gitignore un-ignores
    them, so the choice travels with the repo) or keep them local (off)."""
    info = repo_info(folder)
    if not info:
        raise DocsError('docs_not_repo', f'{folder} is not inside a git repository')
    gi = os.path.join(info['top'], '.gitignore')
    neg = '!' + EXCLUDE_PATTERN
    read = lambda p: open(p, encoding='utf-8').read().split('\n') if os.path.exists(p) else []
    lines = read(gi)
    if on:
        ex = read(info['exclude'])
        kept = [l for l in ex if l not in (EXCLUDE_MARK, EXCLUDE_PATTERN)]
        if kept != ex:
            _atomic_write(info['exclude'], '\n'.join(kept).rstrip('\n') + '\n')
        if neg not in lines:
            body = '\n'.join(lines).rstrip('\n')
            _atomic_write(gi, (body + '\n' if body else '') + neg + '\n')
        return 'shared'
    if neg in lines:
        _atomic_write(gi, '\n'.join(l for l in lines if l != neg).rstrip('\n') + '\n')
    keep_out_of_git(os.path.join(info['top'], 'x' + SUFFIX))
    return 'local'


# ── Finding the companion ───────────────────────────────────────────────

def conflict_copies(doc):
    """Sync conflict copies beside the document: plan.md.bfb 2.json, plan.md (conflicted copy).bfb.json and the like."""
    folder, name = os.path.split(os.path.abspath(doc))
    canon = companion_of(os.path.abspath(doc))
    out = []
    for p in glob.glob(os.path.join(glob.escape(folder), glob.escape(name) + '*.json')):
        if p == canon: continue
        rest = os.path.basename(p)[len(name):]
        if re.fullmatch(r'\.bfb.+\.json', rest) or re.fullmatch(r' .+\.bfb\.json', rest):
            out.append(p)
    return sorted(out)


def locate(doc):
    """Which companion a document uses: (path, where) with where 'beside',
    'main checkout' or 'none' (path is then where a new one would go)."""
    doc = os.path.abspath(doc)
    canon = companion_of(doc)
    if os.path.exists(canon) or conflict_copies(doc):
        return canon, 'beside'
    info = repo_info(os.path.dirname(doc))
    if info and info['linked'] and not _opted_in(info):
        main_top = os.path.dirname(os.path.realpath(info['common']))
        rel = os.path.relpath(os.path.realpath(doc), os.path.realpath(info['top']))
        main = companion_of(os.path.join(main_top, rel))
        if os.path.exists(main):
            return main, 'main checkout'
    return canon, 'none'


# ── Merging and the invariants ──────────────────────────────────────────

def _newer(a, b):
    return a if (a.get('updated') or a.get('created') or '') >= (b.get('updated') or b.get('created') or '') else b


def merge(a, b):
    """Two versions of one companion as one: every thread and comment either
    holds, by id, the newer version of each. Nothing is ever dropped."""
    if not a: return b
    if not b: return a
    threads = {}
    for src in (a, b):
        for t in src.get('comments', {}).get('threads', []):
            tid = t.get('id')
            if not tid: continue
            if tid not in threads:
                threads[tid] = json.loads(json.dumps(t))
                continue
            old = threads[tid]
            keep = json.loads(json.dumps(_newer(old, t)))
            cs = {}
            for c in old.get('comments', []) + t.get('comments', []):
                cid = c.get('id')
                if cid: cs[cid] = _newer(cs[cid], c) if cid in cs else c
            keep['comments'] = list(cs.values())
            threads[tid] = keep
    out = json.loads(json.dumps(_newer_doc(a, b)))
    out.setdefault('comments', {})['threads'] = list(threads.values())
    out['comments'].setdefault('v', COMMENTS_V)
    out['rev'] = max(a.get('rev', 0), b.get('rev', 0))
    return out


def _newer_doc(a, b):
    return a if a.get('rev', 0) >= b.get('rev', 0) else b


def _read_json(path):
    try:
        with open(path, encoding='utf-8') as fh:
            text = fh.read()
    except FileNotFoundError:
        return None
    try:
        data = json.loads(text)
    except ValueError as e:
        raise DocsError('docs_bad_file', f'{path} is not valid JSON ({e}); it was left as it is')
    if not isinstance(data, dict) or not str(data.get('format', '')).startswith('bfb-doc/'):
        raise DocsError('docs_bad_file', f'{path} is not a bfb companion file')
    if data['format'].split('/')[1].split('.')[0] != FORMAT.split('/')[1]:
        raise DocsError('docs_bad_format', f'{path} uses {data["format"]}, which this version cannot read')
    return data


def _known_path(doc_id):
    return _state('docs', doc_id + '.json')


def _base_path(doc_id):
    return _state('docs', doc_id + '.base')


def _known(doc_id, companion):
    """The last copy bfb wrote for this companion, if it was for this same path."""
    try:
        with open(_known_path(doc_id), encoding='utf-8') as fh:
            k = json.load(fh)
    except (OSError, ValueError):
        return None
    return k['data'] if k.get('path') == os.path.realpath(companion) else None


def _base(doc_id):
    try:
        with open(_base_path(doc_id), encoding='utf-8') as fh:
            return fh.read()
    except OSError:
        return None


def read_doc(doc):
    """The document's text (read only)."""
    with open(doc, 'rb') as fh:
        raw = fh.read()
    return raw.decode('utf-8').replace('\r\n', '\n')


def load(doc):
    """The companion for a document as one merged view, without writing
    anything: (data or None, companion path, where, notes)."""
    path, where = locate(doc)
    notes = []
    data = _read_json(path)
    for cp in conflict_copies(doc) if where != 'main checkout' else []:
        try:
            other = _read_json(cp)
        except DocsError as e:
            notes.append(str(e)); continue
        if other:
            data = merge(data, other) if data else other
            notes.append(f'merged a conflict copy: {os.path.basename(cp)}')
    if data:
        k = _known(data['doc']['id'], path)
        if k:
            merged = merge(data, k)
            if _ids(merged) != _ids(data):
                notes.append('threads or replies missing from the file were restored from the last known copy')
            data = merged
        fork = _fork_of(data['doc']['id'], path)
        if fork:
            notes.append(f'this is a copy of {fork}; it gets its own id on the next change')
    if where == 'main checkout':
        notes.append('comments from the main checkout')
    return data, path, where, notes


def _ids(data):
    return sorted((t['id'], c['id']) for t in data.get('comments', {}).get('threads', []) for c in t.get('comments', []))


# ── The index ───────────────────────────────────────────────────────────

def _index_path():
    return _state('docs-index.json')


def read_index():
    try:
        with open(_index_path(), encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {'docs': {}}


def _fork_of(doc_id, companion):
    """The other companion this one was copied from, if both still exist."""
    for path, row in read_index().get('docs', {}).items():
        if row.get('id') == doc_id and path != os.path.realpath(companion) and os.path.exists(path) and os.path.exists(row.get('doc', '')):
            return path
    return None


def summarize(data, doc):
    threads = [t for t in data.get('comments', {}).get('threads', []) if not t.get('deleted')]
    open_ = [t for t in threads if t.get('status') != 'done']
    return {
        'id': data['doc']['id'], 'doc': os.path.realpath(doc), 'name': os.path.basename(doc),
        'open': len(open_), 'done': len(threads) - len(open_),
        'tags': sorted({g for t in threads for g in t.get('tags', [])}),
        'mentions': sorted({m for t in open_ for m in t.get('mentions', [])}),
        'due': sorted({t['due'] for t in open_ if t.get('due')}),
        'authors': sorted({author_key(c.get('author', {})) for t in threads for c in t.get('comments', [])} - {''}),
        'updated': now(),
    }


def index_put(companion, row):
    with _lock('docs-index'):
        idx = read_index()
        idx.setdefault('docs', {})[os.path.realpath(companion)] = row
        _atomic_write(_index_path(), json.dumps(idx, indent=2, ensure_ascii=False) + '\n')


def index_drop(companion):
    with _lock('docs-index'):
        idx = read_index()
        idx.get('docs', {}).pop(os.path.realpath(companion), None)
        _atomic_write(_index_path(), json.dumps(idx, indent=2, ensure_ascii=False) + '\n')


# ── Writing ─────────────────────────────────────────────────────────────

class _lock:
    def __init__(self, key):
        self.path = _state('locks', hashlib.sha256(key.encode()).hexdigest()[:24] + '.lock')
    def __enter__(self):
        self.fh = open(self.path, 'w')
        fcntl.flock(self.fh, fcntl.LOCK_EX)
        return self
    def __exit__(self, *a):
        fcntl.flock(self.fh, fcntl.LOCK_UN)
        self.fh.close()


def _thread(data, tid):
    for t in data['comments']['threads']:
        if t['id'] == tid or (len(tid) >= 6 and t['id'].startswith(tid)):
            if t.get('deleted'):
                raise DocsError('docs_missing_thread', f'thread {tid} was removed')
            return t
    raise DocsError('docs_missing_thread', f'no thread {tid}')


def _apply_text(t, text, today=None):
    p = C.parse(text, today)
    for g in p['tags']:
        if g not in t.setdefault('tags', []): t['tags'].append(g)
    for m in p['mentions']:
        if m not in t.setdefault('mentions', []): t['mentions'].append(m)
    if p['due']: t['due'] = p['due']
    return p


def _comment(author, text):
    if len(text) > TEXT_MAX:
        raise DocsError('docs_too_long', f'a comment is at most {TEXT_MAX} characters')
    ts = now()
    return {'id': new_id('c-'), 'author': author, 'created': ts, 'updated': ts, 'text': text}


def apply_adopt(data, op, text, author, base_text):
    """Take in a thread moved here from another document, replies and all, on
    the words it now belongs to."""
    ts = now()
    t = json.loads(json.dumps(op['data']))
    t['anchor'] = {**C.make_anchor(text, op['start'], op['end']), 'confirmedAt': ts}
    t['movedFrom'] = op.get('from', '')
    t['updated'] = ts
    data['comments']['threads'].append(t)
    return {'thread': t['id']}


def apply(data, op, text, author, base_text):
    """Apply one operation to the companion data in place. Returns what it made."""
    kind = op['op']
    ts = now()
    threads = data['comments']['threads']
    if kind == 'new':
        start, end = op['start'], op['end']
        t = {'id': new_id('t-'), 'anchor': {**C.make_anchor(text, start, end), 'confirmedAt': ts},
             'status': 'open', 'tags': [], 'mentions': [], 'created': ts, 'updated': ts,
             'comments': [_comment(author, op['text'])]}
        p = _apply_text(t, op['text'])
        if p['done']: t.update(status='done', doneBy=author, doneAt=ts)
        threads.append(t)
        return {'thread': t['id'], 'comment': t['comments'][0]['id']}
    if kind == 'adopt':
        return apply_adopt(data, op, text, author, base_text)
    t = _thread(data, op['thread'])
    if kind == 'movedOut':
        t['deleted'] = True
        t['movedTo'] = op.get('to', '')
        t['updated'] = ts
        return {'thread': t['id']}
    if kind == 'reply':
        c = _comment(author, op['text'])
        t['comments'].append(c)
        p = _apply_text(t, op['text'])
        if p['done']: t.update(status='done', doneBy=author, doneAt=ts)
        if p['reopen']: t['status'] = 'open'; t.pop('doneBy', None); t.pop('doneAt', None)
        t['updated'] = ts
        return {'thread': t['id'], 'comment': c['id']}
    if kind in ('done', 'reopen'):
        if op.get('text'):
            c = _comment(author, op['text'])
            t['comments'].append(c)
            _apply_text(t, op['text'])
        if kind == 'done': t.update(status='done', doneBy=author, doneAt=ts)
        else: t['status'] = 'open'; t.pop('doneBy', None); t.pop('doneAt', None)
        t['updated'] = ts
        return {'thread': t['id']}
    if kind == 'tag':
        for g in op['tags']:
            g = g.lstrip('#').lower()
            if g not in t.setdefault('tags', []): t['tags'].append(g)
        t['updated'] = ts
        return {'thread': t['id']}
    if kind == 'untag':
        drop = {g.lstrip('#').lower() for g in op['tags']}
        t['tags'] = [g for g in t.get('tags', []) if g not in drop]
        t['updated'] = ts
        return {'thread': t['id']}
    if kind == 'due':
        d = op.get('due') or None
        if d is not None and not (isinstance(d, str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', d)):
            raise DocsError('docs_bad_args', 'a due date is YYYY-MM-DD, or none to clear it')
        if d: t['due'] = d
        else: t.pop('due', None)
        t['updated'] = ts
        return {'thread': t['id']}
    if kind == 'attach':
        t['anchor'] = {**C.make_anchor(text, op['start'], op['end']), 'confirmedAt': ts}
        t['updated'] = ts
        return {'thread': t['id']}
    if kind == 'suggest':
        # A suggestion with no words of its own rides on the comment its author
        # just opened the thread with, so it reads as one comment, not two.
        last = t['comments'][-1] if t['comments'] else None
        if not op.get('text') and last and last['author'] == author and not last.get('suggestion') and len(t['comments']) == 1:
            c = last
        else:
            c = _comment(author, op.get('text') or '')
            t['comments'].append(c)
        c['suggestion'] = {'replace': op['replace'], 'state': 'pending'}
        c['updated'] = ts
        t['updated'] = ts
        return {'thread': t['id'], 'comment': c['id']}
    if kind == 'decide':
        # Accept or reject a suggested edit. Accepting is decided after the
        # document was written, so the thread moves onto the new words and is
        # done: the edit was what it asked for.
        c = next((c for c in t['comments'] if c['id'] == op['comment'] or c['id'].startswith(op['comment'])), None)
        if not c or not c.get('suggestion'):
            raise DocsError('docs_missing_comment', f'no suggestion {op["comment"]}')
        state = op.get('state')
        if state not in ('accepted', 'rejected'):
            raise DocsError('docs_bad_args', 'a suggestion is accepted or rejected')
        if c['suggestion'].get('state') != 'pending':
            raise DocsError('docs_bad_args', f'that suggestion was already {c["suggestion"].get("state")}')
        c['suggestion'].update(state=state, decidedBy=author, decidedAt=ts)
        if state == 'accepted':
            if isinstance(op.get('was'), str): c['suggestion']['was'] = op['was']
            if op.get('end', 0) > op.get('start', 0):
                t['anchor'] = {**C.make_anchor(text, op['start'], op['end']), 'confirmedAt': ts}
            t.update(status='done', doneBy=author, doneAt=ts)
        c['updated'] = t['updated'] = ts
        return {'thread': t['id'], 'comment': c['id']}
    if kind in ('edit', 'delete'):
        c = next((c for c in t['comments'] if c['id'] == op['comment'] or c['id'].startswith(op['comment'])), None)
        if not c:
            raise DocsError('docs_missing_comment', f'no comment {op["comment"]}')
        if kind == 'edit':
            c['text'] = op['text']; c['edited'] = ts
            _apply_text(t, op['text'])
        else:
            c['text'] = ''; c['deleted'] = True
        c['updated'] = t['updated'] = ts
        return {'thread': t['id'], 'comment': c['id']}
    if kind == 'deleteThread':
        t['deleted'] = True
        t['updated'] = ts
        return {'thread': t['id']}
    raise DocsError('docs_bad_op', f'unknown operation {kind!r}')


def write(doc, ops, author):
    """Apply operations to a document's companion under a lock and save it.
    Returns (results, data, companion path, notes)."""
    doc = os.path.abspath(doc)
    text = read_doc(doc)
    path, where = locate(doc)
    with _lock(os.path.realpath(path)):
        data, path, where, notes = load(doc)
        fresh = data is None
        if fresh:
            data = {'format': FORMAT, 'doc': {'id': new_id('d-'), 'name': os.path.basename(doc), 'fingerprint': ''},
                    'rev': 0, 'comments': {'v': COMMENTS_V, 'threads': []}}
        elif _fork_of(data['doc']['id'], path):
            data['doc']['id'] = new_id('d-')
            notes.append('given its own id as a copy of another document')
        base = _base(data['doc']['id'])
        confirm(data, text, base)
        results = []
        for op in ops:
            if op.get('thread') == '$new':   # the thread an earlier op in this write made
                op = {**op, 'thread': next(r['thread'] for r in reversed(results) if 'thread' in r)}
            results.append(apply(data, op, text, author, base))
        data['doc']['name'] = os.path.basename(doc)
        data['doc']['fingerprint'] = C.fingerprint(text)
        data['rev'] = data.get('rev', 0) + 1
        if fresh:
            notes.append('git: ' + keep_out_of_git(path))
        _atomic_write(path, canonical(data))
        for cp in conflict_copies(doc) if where == 'beside' else []:
            dst = _state('backups', 'companions', datetime.date.today().strftime('%Y%m%d'), os.path.basename(cp) + '.' + secrets.token_hex(3))
            shutil.move(cp, dst)
            notes.append(f'moved the merged conflict copy to {dst}')
        with open(_known_path(data['doc']['id']), 'w', encoding='utf-8') as fh:
            json.dump({'path': os.path.realpath(path), 'data': data}, fh, ensure_ascii=False)
        _atomic_write(_base_path(data['doc']['id']), text)
    index_put(path, summarize(data, doc))
    return results, data, path, notes


def confirm(data, text, base):
    """Refresh anchors that are exactly where they were (carried through the
    diff or found word for word once); record fuzzy finds as lastSeen only."""
    segs = C._segments(base, text) if base is not None and base != text else None
    for t in data.get('comments', {}).get('threads', []):
        a = t.get('anchor')
        if not a or t.get('deleted'): continue
        r = C.resolve(a, text, base, segs)
        if r['state'] == 'anchored':
            fresh = C.make_anchor(text, r['offset'], r['offset'] + r['length'])
            if fresh['exact'] == a['exact']:
                a.update(fresh); a.pop('lastSeen', None)
        elif r['state'] in ('moved', 'ambiguous') and r['offset'] is not None:
            a['lastSeen'] = {'offset': r['offset'], 'length': r['length'], 'line': r['line']}


def view(doc):
    """Threads with where each one is now, for listing. Writes nothing."""
    data, path, where, notes = load(doc)
    text = read_doc(doc)
    if not data:
        return {'path': path, 'where': where, 'threads': [], 'notes': notes, 'doc': None}
    base = _base(data['doc']['id'])
    if base is None and data['doc'].get('fingerprint') == C.fingerprint(text):
        base = text
    segs = C._segments(base, text) if base is not None and base != text else None
    out = []
    for t in data['comments']['threads']:
        if t.get('deleted'): continue
        r = C.resolve(t['anchor'], text, base, segs) if t.get('anchor') else {'state': 'detached', 'offset': None, 'length': 0, 'line': None}
        out.append({**t, 'place': r})
    out.sort(key=lambda t: (t['place']['offset'] is None, t['place']['offset'] or 0, t.get('created', '')))
    lost = sum(1 for t in out if t['place']['state'] == 'detached')
    if len(out) >= 2 and lost * 2 > len(out) and data['doc'].get('fingerprint') != C.fingerprint(text):
        notes.append(f'{lost} of {len(out)} threads no longer match this file; it may be a different document '
                     f'than the comments were made on (bfb-docs comments doctor looks for the original)')
    return {'path': path, 'where': where, 'threads': out, 'notes': notes, 'doc': data['doc']}


# ── Relocation ──────────────────────────────────────────────────────────

def stranded(folder):
    """Companions under `folder` whose document is gone, each with the best
    guess for where it went (same folder first, then below)."""
    out = []
    for comp in glob.glob(os.path.join(glob.escape(folder), '**', '*' + SUFFIX), recursive=True):
        doc = comp[:-len(SUFFIX)]
        if os.path.exists(doc) or '/.claude/worktrees/' in comp or '/.git/' in comp:
            continue
        try:
            data = _read_json(comp)
        except DocsError:
            continue
        out.append({'companion': comp, 'missing': doc, 'guess': guess_home(data, os.path.dirname(comp), folder),
                    'branch': _on_another_branch(doc)})
    return out


def _on_another_branch(doc):
    info = repo_info(os.path.dirname(doc)) if os.path.isdir(os.path.dirname(doc)) else None
    if not info:
        return False
    r = _git(info['top'], 'log', '--all', '-1', '--format=%h', '--', os.path.relpath(doc, info['top']))
    return bool(r and r.returncode == 0 and r.stdout.strip())


def guess_home(data, near, root):
    """The document a stranded companion most likely belongs to: the text
    that matches its fingerprint, else the one holding most of its quotes."""
    quotes = [t['anchor']['exact'] for t in data.get('comments', {}).get('threads', []) if t.get('anchor') and not t.get('deleted')]
    fp = data.get('doc', {}).get('fingerprint')
    best, best_n = None, 0
    seen = set()
    for pat in (os.path.join(glob.escape(near), '*'), os.path.join(glob.escape(root), '**', '*')):
        for cand in glob.glob(pat, recursive=True):
            if cand in seen or cand.endswith('.json') or not os.path.isfile(cand) or os.path.getsize(cand) > 20 * 1024 * 1024:
                continue
            seen.add(cand)
            try:
                text = read_doc(cand)
            except (OSError, UnicodeDecodeError):
                continue
            if fp and C.fingerprint(text) == fp:
                return cand
            n = sum(1 for q in quotes if q in text)
            if n > best_n:
                best, best_n = cand, n
        if best and best_n * 2 >= max(1, len(quotes)):
            return best
    return best if best and best_n * 2 >= max(1, len(quotes)) else None


def relink(companion, doc):
    """Move a stranded companion to sit beside `doc`, merging into an existing one by id."""
    doc = os.path.abspath(doc)
    src = _read_json(companion)
    if not src:
        raise DocsError('docs_missing', f'no companion at {companion}')
    target = companion_of(doc)
    with _lock(os.path.realpath(target)):
        have = _read_json(target)
        data = merge(have, src) if have else src
        if have:
            data['doc'] = have['doc']
        data['doc']['name'] = os.path.basename(doc)
        data['rev'] = data.get('rev', 0) + 1
        _atomic_write(target, canonical(data))
        os.remove(companion)
        with open(_known_path(data['doc']['id']), 'w', encoding='utf-8') as fh:
            json.dump({'path': os.path.realpath(target), 'data': data}, fh, ensure_ascii=False)
    index_drop(companion)
    index_put(target, summarize(data, doc))
    return target
