#!/usr/bin/env python3
"""bfb-docs: comments on markdown files, for people and agents in a terminal.

The same comments bfb shows beside a document in the browser. Every command
prints plain text, or JSON with --json. Writes say who wrote them on their
own (an agent by its claude-ipc alias, a person at a terminal as the owner);
--as and --role override that. Comment text understands #tags, @mentions,
@due YYYY-MM-DD, @today, @tomorrow, and /done or /reopen on a line of its own.

Spec: ~/Code/better-file-browser/.claude/specs/bfb-docs.md
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
import comments as C       # noqa: E402
import docs_store as S     # noqa: E402


def _out(args, data, text):
    print(json.dumps(data, indent=2, ensure_ascii=False) if args.json else text)


def _who(args):
    return S.whoami(getattr(args, 'as_', None), getattr(args, 'role', None))[0]


def _name(a):
    return 'You' if a.get('kind') == 'human' and not a.get('name') else (a.get('name') if a.get('kind') == 'human' else a.get('alias', '?'))


def _short(s, n=60):
    s = ' '.join(s.split())
    return s if len(s) <= n else s[:n - 1] + '…'


def _thread_line(rel, t):
    p = t['place']
    where = f"{rel}:{p['line']}" if p['line'] else f'{rel}:-'
    state = '' if p['state'] == 'anchored' else f" [{p['state']}]"
    first = t['comments'][0] if t['comments'] else {}
    extra = ''.join(f' #{g}' for g in t.get('tags', [])) + (f" due {t['due']}" if t.get('due') else '')
    status = 'done ' if t.get('status') == 'done' else ''
    return f"{where}  {t['id'][:10]}  {status}{_name(first.get('author', {}))}  \"{_short(t['anchor']['exact'], 40)}\"  {_short(first.get('text', ''))}{extra}{state}"


def _docs_under(target):
    if os.path.isfile(target):
        return [target]
    out = []
    for dirpath, dirs, files in os.walk(target):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != 'node_modules']
        for f in files:
            if f.endswith(S.SUFFIX):
                out.append(os.path.join(dirpath, f[:-len(S.SUFFIX)]))
    return sorted(out)


def _for(t, who):
    """Whether an open thread waits on `who` (an alias, or 'user' for the owner):
    someone mentioned them after their own last comment, or they took part and
    the other side spoke last (for the owner: an agent spoke last)."""
    if t.get('status') == 'done':
        return False
    names = {who.lower()} | ({'user', 'owner'} if who == 'user' else set())
    mine = [i for i, c in enumerate(t['comments']) if S.author_key(c.get('author', {})) == who]
    after = t['comments'][(mine[-1] + 1) if mine else 0:]
    if any(names & {m.lower() for m in C.parse(c.get('text') or '')['mentions']} for c in after):
        return True
    last = t['comments'][-1].get('author', {}) if t['comments'] else {}
    if who == 'user':
        return last.get('kind') == 'agent'
    return bool(mine) and S.author_key(last) != who and last.get('kind') == 'human'


def cmd_list(args):
    rows, out = [], []
    me = S.author_key(_who(args)) if args.for_ == 'me' else args.for_
    for doc in _docs_under(args.target):
        if not os.path.exists(doc):
            continue
        v = S.view(doc)
        rel = os.path.relpath(doc)
        for t in v['threads']:
            if args.state == 'open' and t.get('status') == 'done': continue
            if args.state == 'done' and t.get('status') != 'done': continue
            if args.tag and args.tag.lstrip('#').lower() not in t.get('tags', []): continue
            if me and not _for(t, me): continue
            rows.append({'file': doc, **t})
            out.append(_thread_line(rel, t))
        for n in v['notes']:
            out.append(f'  note: {n}')
    folder = args.target if os.path.isdir(args.target) else os.path.dirname(os.path.abspath(args.target))
    for s in S.stranded(folder):
        hint = 'not on this branch' if s['branch'] else (f"seems to be {os.path.relpath(s['guess'])}; run: bfb-docs comments relink {s['companion']} {s['guess']}" if s['guess'] else 'its document is gone')
        out.append(f"  stranded: {os.path.relpath(s['companion'])} ({hint})")
    _out(args, rows, '\n'.join(out) if out else 'No comments.')


def cmd_inbox(args):
    me = S.author_key(_who(args))
    rows, out = [], []
    for comp, row in sorted(S.read_index().get('docs', {}).items()):
        doc = row.get('doc')
        if not doc or not os.path.exists(doc):
            continue
        for t in S.view(doc)['threads']:
            if _for(t, me):
                rows.append({'file': doc, **t})
                out.append(_thread_line(os.path.relpath(doc), t))
    _out(args, rows, '\n'.join(out) if out else f'Nothing waiting on {me}.')


def cmd_show(args):
    v = S.view(args.file)
    t = next((t for t in v['threads'] if t['id'].startswith(args.thread)), None)
    if not t:
        raise S.DocsError('docs_missing_thread', f'no thread {args.thread}')
    lines = [_thread_line(os.path.relpath(args.file), t).split('  ')[0] + f"  {t['id']}  {t.get('status')}",
             f"  on: \"{t['anchor']['exact']}\""]
    for c in t['comments']:
        tag = ' (deleted)' if c.get('deleted') else (' (edited)' if c.get('edited') else '')
        lines.append(f"  {_name(c.get('author', {}))} · {c.get('created', '')[:16].replace('T', ' ')}{tag}")
        for l in (c.get('text') or '').split('\n'):
            lines.append('    ' + l)
        if c.get('suggestion'):
            lines.append(f"    suggests: \"{c['suggestion']['replace']}\" ({c['suggestion']['state']})")
    _out(args, t, '\n'.join(lines))


def _span(text, quote, nth):
    hits = C.occurrences(text, quote)
    if not hits:
        raise S.DocsError('docs_no_quote', 'that text is not in the file; quote the source exactly')
    if len(hits) > 1 and not nth:
        lines = ', '.join(str(C.line_of(text, h)) for h in hits)
        raise S.DocsError('docs_ambiguous_quote', f'that text appears {len(hits)} times (lines {lines}); quote more of it or pass --nth')
    i = hits[(nth or 1) - 1] if (nth or 1) <= len(hits) else None
    if i is None:
        raise S.DocsError('docs_no_quote', f'there is no occurrence {nth}')
    return i, i + len(quote)


def _write(args, ops, say):
    results, data, path, notes = S.write(args.file, ops, _who(args))
    text = say(results) + ''.join(f'\n  note: {n}' for n in notes)
    _out(args, {'results': results, 'companion': path, 'notes': notes}, text)


def cmd_new(args):
    s, e = _span(S.read_doc(args.file), args.quote, args.nth)
    _write(args, [{'op': 'new', 'start': s, 'end': e, 'text': args.text}], lambda r: f"new thread {r[0]['thread'][:10]}")


def cmd_reply(args):
    _write(args, [{'op': 'reply', 'thread': args.thread, 'text': args.text}], lambda r: f"replied on {r[0]['thread'][:10]}")


def cmd_done(args):
    _write(args, [{'op': 'done', 'thread': args.thread, 'text': args.text}], lambda r: f"done: {r[0]['thread'][:10]}")


def cmd_reopen(args):
    _write(args, [{'op': 'reopen', 'thread': args.thread, 'text': args.text}], lambda r: f"reopened {r[0]['thread'][:10]}")


def cmd_tag(args):
    _write(args, [{'op': args.cmd, 'thread': args.thread, 'tags': args.tags}], lambda r: f"{args.cmd}ged {r[0]['thread'][:10]}")


def cmd_due(args):
    d = None if args.date == 'none' else args.date
    _write(args, [{'op': 'due', 'thread': args.thread, 'due': d}], lambda r: f"due {args.date} on {r[0]['thread'][:10]}")


def cmd_attach(args):
    s, e = _span(S.read_doc(args.file), args.quote, args.nth)
    _write(args, [{'op': 'attach', 'thread': args.thread, 'start': s, 'end': e}], lambda r: f"attached {r[0]['thread'][:10]} at line {C.line_of(S.read_doc(args.file), s)}")


def cmd_suggest(args):
    if not args.quote and not args.thread:
        raise S.DocsError('docs_bad_args', 'name a thread, or --quote the text to replace')
    ops = []
    if args.quote:
        s, e = _span(S.read_doc(args.file), args.quote, args.nth)
        ops.append({'op': 'new', 'start': s, 'end': e, 'text': args.text or 'Suggested change'})
    ops.append({'op': 'suggest', 'thread': args.thread or '$new', 'replace': args.replace, 'text': '' if args.quote else args.text})
    _write(args, ops, lambda r: f"suggestion on {r[-1]['thread'][:10]}")


def cmd_reanchor(args):
    v = S.view(args.file)
    out = [_thread_line(os.path.relpath(args.file), t) for t in v['threads']]
    if args.write and v['doc']:
        S.write(args.file, [], _who(args))
        out.append('anchors confirmed and saved')
    _out(args, v['threads'], '\n'.join(out) or 'No comments.')


def cmd_doctor(args):
    rows = S.stranded(args.folder)
    out = []
    for s in rows:
        if s['branch']: out.append(f"{s['companion']}: its document is not on this branch")
        elif s['guess']: out.append(f"{s['companion']}: seems to be {s['guess']}\n  bfb-docs comments relink {s['companion']} {s['guess']}")
        else: out.append(f"{s['companion']}: its document is gone and nothing nearby matches")
    _out(args, rows, '\n'.join(out) or 'Every companion has its document.')


def cmd_relink(args):
    target = S.relink(args.companion, args.file)
    _out(args, {'companion': target}, f'comments now beside {args.file}')


def cmd_index(args):
    if args.rebuild:
        roots = args.roots or [os.getcwd()]
        n = 0
        for r in roots:
            for doc in _docs_under(r):
                data, path, _, _ = S.load(doc)
                if data and os.path.exists(doc):
                    S.index_put(path, S.summarize(data, doc)); n += 1
        print(f'indexed {n} documents')
        return
    idx = S.read_index().get('docs', {})
    lines = [f"{row['doc']}  {row['open']} open, {row['done']} done" + (f"  due {row['due'][0]}" if row.get('due') else '') for row in idx.values()]
    _out(args, idx, '\n'.join(sorted(lines)) or 'The index is empty.')


def cmd_config(args):
    print(S.set_commit(os.path.abspath(args.repo or os.getcwd()), args.value == 'on'))


def cmd_whoami(args):
    a, why = S.whoami(getattr(args, 'as_', None), getattr(args, 'role', None))
    _out(args, {'author': a, 'why': why}, f"{_name(a)} ({a['kind']}, {why})" + (f"\n  session {a['session']}" if a.get('session') else ''))


def main(argv=None):
    p = argparse.ArgumentParser(prog='bfb-docs', description=__doc__.split('\n\n')[0])
    p.add_argument('--json', action='store_true', help='print JSON')
    p.add_argument('--as', dest='as_', help='write as this author (an agent alias, or user)')
    p.add_argument('--role', help='a label shown beside the author, for sub-agents')
    top = p.add_subparsers(dest='group', required=True)

    cm = top.add_parser('comments', help='comments on markdown files').add_subparsers(dest='cmd', required=True)
    x = cm.add_parser('list', help='threads in a file or folder'); x.add_argument('target', nargs='?', default='.')
    g = x.add_mutually_exclusive_group()
    g.add_argument('--open', dest='state', action='store_const', const='open')
    g.add_argument('--done', dest='state', action='store_const', const='done')
    g.add_argument('--all', dest='state', action='store_const', const='all')
    x.add_argument('--for', dest='for_', help='me, or an alias'); x.add_argument('--tag')
    x.set_defaults(func=cmd_list, state='open')
    cm.add_parser('inbox', help='threads waiting on me, everywhere').set_defaults(func=cmd_inbox)
    x = cm.add_parser('show'); x.add_argument('file'); x.add_argument('thread'); x.set_defaults(func=cmd_show)
    x = cm.add_parser('new'); x.add_argument('file'); x.add_argument('--quote', required=True); x.add_argument('--nth', type=int); x.add_argument('text'); x.set_defaults(func=cmd_new)
    x = cm.add_parser('reply'); x.add_argument('file'); x.add_argument('thread'); x.add_argument('text'); x.set_defaults(func=cmd_reply)
    for name, fn in (('done', cmd_done), ('reopen', cmd_reopen)):
        x = cm.add_parser(name); x.add_argument('file'); x.add_argument('thread'); x.add_argument('text', nargs='?', default=''); x.set_defaults(func=fn)
    for name in ('tag', 'untag'):
        x = cm.add_parser(name); x.add_argument('file'); x.add_argument('thread'); x.add_argument('tags', nargs='+'); x.set_defaults(func=cmd_tag)
    x = cm.add_parser('due', help='set a due date (YYYY-MM-DD) or clear it (none)'); x.add_argument('file'); x.add_argument('thread'); x.add_argument('date'); x.set_defaults(func=cmd_due)
    x = cm.add_parser('attach'); x.add_argument('file'); x.add_argument('thread'); x.add_argument('--quote', required=True); x.add_argument('--nth', type=int); x.set_defaults(func=cmd_attach)
    x = cm.add_parser('suggest'); x.add_argument('file'); x.add_argument('--thread'); x.add_argument('--quote'); x.add_argument('--nth', type=int)
    x.add_argument('--replace', required=True); x.add_argument('text', nargs='?', default=''); x.set_defaults(func=cmd_suggest)
    x = cm.add_parser('reanchor'); x.add_argument('file'); x.add_argument('--write', action='store_true'); x.set_defaults(func=cmd_reanchor)
    x = cm.add_parser('doctor'); x.add_argument('folder', nargs='?', default='.'); x.set_defaults(func=cmd_doctor)
    x = cm.add_parser('relink'); x.add_argument('companion'); x.add_argument('file'); x.set_defaults(func=cmd_relink)

    x = top.add_parser('index', help='the list of every document with comments'); x.add_argument('--rebuild', action='store_true'); x.add_argument('roots', nargs='*'); x.set_defaults(func=cmd_index)
    x = top.add_parser('config', help='repo settings'); x.add_argument('key', choices=['commit']); x.add_argument('value', choices=['on', 'off']); x.add_argument('repo', nargs='?'); x.set_defaults(func=cmd_config)
    top.add_parser('whoami', help='who writes from here').set_defaults(func=cmd_whoami)

    args = p.parse_args(argv)
    try:
        args.func(args)
    except S.DocsError as e:
        print(f'bfb-docs: {e}', file=sys.stderr)
        return 1
    except FileNotFoundError as e:
        print(f'bfb-docs: no such file: {e.filename}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
