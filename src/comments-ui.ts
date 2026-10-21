// The comments panel on a markdown file page: every thread on the file in
// the rail beside the text, with the commented words highlighted in place
// (the CSS Custom Highlight API adds no elements, so find and copy still
// work). Select words and press `c` to start a thread. The native host owns
// all anchoring; this file only maps spans between source and page.
// Spec: .claude/specs/bfb-docs.md.
import { notes, type DocThread, type CommentAuthor, type CommentOp, type CommentsReply } from './notes';
import { esc, copyToClipboard } from './utils';
import { mdInline } from './renderers';
import { UI_ICON } from './control-icons';
import { kvGet, kvSet } from './kv';
import { fetchFileText } from './file-fetch';
import { visibleOf, rangeFor, sourceSpan, type SourceSpan } from './comment-anchor';

export { visibleOf };

const FILTER_KEY = 'bfb-comments-filter-v1';
const POLL_MS = 2000;
type Filter = 'open' | 'me' | 'done' | 'all';
const FILTERS: { id: Filter; label: string; icon: string; hint: string }[] = [
  { id: 'open', label: 'Open', icon: UI_ICON.circle, hint: 'Threads still open' },
  { id: 'me', label: 'For me', icon: UI_ICON.at, hint: 'Threads waiting on you' },
  { id: 'done', label: 'Done', icon: UI_ICON.check, hint: 'Closed threads' },
  { id: 'all', label: 'All', icon: UI_ICON.stack, hint: 'Every thread' },
];
// Typed after @, these set the due date rather than mention someone.
const DATE_WORDS = ['due', 'today', 'tomorrow'];

const who = (a: CommentAuthor) => a.kind === 'human' ? 'You' : (a.alias || 'agent') + (a.role ? ` · ${a.role}` : '');
function ago(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function dueLabel(d: string): string {
  const t = new Date(d + 'T00:00:00');
  return isNaN(t.getTime()) ? d : t.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
/** Whether an open thread waits on the owner: an agent spoke last, or someone mentioned them since they last spoke. */
export function forOwner(t: DocThread): boolean {
  if (t.status === 'done' || !t.comments.length) return false;
  const last = t.comments[t.comments.length - 1].author;
  if (last.kind === 'agent') return true;
  let mine = -1;
  t.comments.forEach((c, i) => { if (c.author.kind === 'human') mine = i; });
  return t.comments.slice(mine + 1).some(c => /(^|\s)@(user|owner)\b/i.test(c.text || ''));
}

/** A comment's text as the reader sees it: its own line breaks kept, and
 *  lines starting with "- " or "* " drawn as a list. */
export function commentHtml(text: string): string {
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.map(l => `<li>${l}</li>`).join('')}</ul>`); list = []; } };
  let para: string[] = [];
  const end = () => { if (para.length) { out.push(`<p>${para.join('<br>')}</p>`); para = []; } };
  for (const line of text.split('\n')) {
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (item) { end(); list.push(mdInline(item[1])); continue; }
    flush();
    if (!line.trim()) { end(); continue; }
    para.push(mdInline(line));
  }
  flush(); end();
  return out.join('');
}

/** What to offer while typing a mention or tag: where the word being typed
 *  before the caret starts, its sigil, and the names that complete it. */
export function completions(value: string, caret: number, people: string[], tags: string[]): { from: number; sigil: string; items: string[] } | null {
  const m = /(^|\s)([@#])([\w:.-]*)$/.exec(value.slice(0, caret));
  if (!m) return null;
  const q = m[3].toLowerCase();
  const pool = m[2] === '@' ? [...people, ...DATE_WORDS] : tags;
  const items = [...new Set(pool)].filter(x => x.toLowerCase().startsWith(q) && x.toLowerCase() !== q).slice(0, 8);
  return items.length ? { from: caret - m[3].length - 1, sigil: m[2], items } : null;
}

/** Threads written up for an agent that has none of this page's context: what
 *  each one says, where it sits, and the bfb-docs commands that answer it. */
export function agentBrief(path: string, href: string, threads: DocThread[]): string {
  const name = (a: CommentAuthor) => a.kind === 'human' ? (a.name || 'the owner') : (a.alias || 'agent');
  const when = (iso: string) => iso.slice(0, 16).replace('T', ' ');
  const one = threads.length === 1;
  const head = [
    `# ${one ? 'A comment' : `${threads.length} comments`} on ${path}`,
    '',
    'Each thread is anchored to the quoted words of the file. Answer with bfb-docs, which signs you in as your claude-ipc alias:',
    `  bfb-docs comments reply ${path} <thread> "your reply"`,
    `  bfb-docs comments done ${path} <thread> "what you changed"`,
    `  bfb-docs comments show ${path} <thread>    (the full thread)`,
    'Edit the file itself with your usual tools; the comments follow the text.',
  ];
  const body = threads.map(t => {
    const meta = [t.status, t.place.line !== null ? `line ${t.place.line}` : 'no longer found in the file', ...(t.tags ?? []).map(g => '#' + g), t.due ? `due ${t.due}` : ''].filter(Boolean).join(', ');
    const quote = t.anchor.exact.length > 400 ? t.anchor.exact.slice(0, 399) + '…' : t.anchor.exact;
    return [
      '', `## Thread ${t.id} (${meta})`,
      ...quote.split('\n').map(l => '> ' + l), '',
      ...t.comments.filter(c => !c.deleted).map(c => `- ${name(c.author)}, ${when(c.created)}:\n${(c.text || '').split('\n').map(l => '    ' + l).join('\n')}`),
      '', `Link: ${href.split('#')[0]}#c=${t.id}`,
    ].join('\n');
  });
  return [...head, ...body].join('\n') + '\n';
}

export interface CommentsPanel {
  /** The page re-rendered: draw the highlights and markers again. */
  redraw(): void;
  /** How many open threads the file has. */
  open(): number;
  /** Show the panel and the given thread. */
  show(threadId?: string): void;
  /** Open threads with a place in the text, in document order, for the editor's gutter. */
  marks(): { id: string; offset: number; length: number }[];
  /** A key on the file page: comment on the selection, show the panel, move between threads. */
  key(e: KeyboardEvent): boolean;
}

interface Draft extends SourceSpan { quote: string; attach?: string }

export function mountComments(o: {
  page: HTMLElement; box: HTMLElement; href: string; path: string;
  root: () => string | null; rel: () => string; text: () => string;
  allow: () => Promise<boolean>; status: (t: string) => void; changed: () => void;
  /** Show the rail on the Comments tab; show or hide it. */
  reveal: () => void; toggle: () => void;
  /** A thread was opened from the panel (the editor selects its words). */
  picked?: (span: { offset: number; length: number }) => void;
}): CommentsPanel {
  let threads: DocThread[] = [];
  let notesLine: string[] = [];
  let filter = (kvGet(FILTER_KEY) as Filter) || 'open';
  let active = '';
  let loaded = false, failed = '';
  let lastCompanion: string | null = null, lastText = '';
  let draft: Draft | null = null;
  let editing = '';   // the id of the comment being edited
  let busy = false;
  let dueOpen = '';
  const seen = new Set<string>();
  const ranges = new Map<string, Range>();
  // Unsent text per box ('new' for the composer, 'edit:<id>' for an edit), kept across repaints.
  const typed = new Map<string, string>();
  let linked = location.hash.startsWith('#c=') ? decodeURIComponent(location.hash.slice(3)) : '';
  // Opened from the Comments lens: show the panel straight away.
  if (location.hash === '#comments') setTimeout(() => o.reveal(), 0);
  // Agents claude-ipc sees, asked for once the first time someone types @.
  let peers: { alias: string; cwd: string; status: string }[] | null = null;
  const loadPeers = () => { if (peers === null) { peers = []; notes.people().then(p => { peers = p; }).catch(() => {}); } };

  const readCompanion = () => fetchFileText(o.href + '.bfb.json').catch(() => '');
  const take = (r: CommentsReply) => {
    const fresh = r.threads.flatMap(t => t.comments.filter(c => !seen.has(c.id) && c.author.kind === 'agent').map(c => c.author));
    if (loaded && fresh.length) o.status(`New reply from ${fresh[fresh.length - 1].alias}`);
    r.threads.forEach(t => t.comments.forEach(c => seen.add(c.id)));
    threads = r.threads; failed = ''; loaded = true;
  };
  const load = async () => {
    const root = o.root();
    if (!root) { loaded = true; paint(); return; }
    // What the poll compares against, read just before asking the host, so a
    // change landing between the two is seen on the next tick.
    lastCompanion = await readCompanion();
    lastText = o.text();
    try {
      const r = await notes.commentsRead(root, o.rel());
      take(r); notesLine = r.notes;
    } catch (e) { failed = (e as Error).message; loaded = true; }
    paint(); redraw(); o.changed();
    // A #c= link opens its thread once the threads are in.
    const hit = linked && threads.find(t => t.id.startsWith(linked));
    if (hit) { linked = ''; o.reveal(); focusThread(hit.id); }
  };

  // Every change goes through the host as the owner; the reply carries the threads after it.
  const write = async (ops: CommentOp[], what: string): Promise<CommentsReply | null> => {
    const root = o.root();
    if (!root || busy) return null;
    busy = true;
    try {
      const r = await notes.commentsWrite(root, o.rel(), ops);
      take(r);
      const said = r.notes.filter(n => !notesLine.includes(n));
      if (said.length) o.status(said.join('; '));
      lastCompanion = await readCompanion(); lastText = o.text();
      return r;
    } catch (e) {
      o.status(`${what} not saved: ${(e as Error).message}`);
      return null;
    } finally {
      busy = false;
      paint(); redraw(); o.changed();
    }
  };

  // Who can be mentioned: the owner, any agent (`claude`), each live agent by
  // `claude:<alias>`, and whoever already took part here.
  const people = () => ['user', 'claude', ...(peers ?? []).map(p => 'claude:' + p.alias),
    ...threads.flatMap(t => [...(t.mentions ?? []), ...t.comments.map(c => c.author.kind === 'agent' ? c.author.alias ?? '' : '')])].filter(Boolean);
  const hintFor = (x: string) => {
    if (x === 'user') return 'you';
    if (x === 'claude') return 'any agent';
    if (DATE_WORDS.includes(x)) return 'due date';
    const p = x.startsWith('claude:') && peers?.find(q => q.alias === x.slice(7));
    return p ? `${p.cwd.split('/').pop() || p.cwd} · ${p.status}` : '';
  };
  const allTags = () => threads.flatMap(t => t.tags ?? []);

  const visible = () => threads.filter(t =>
    filter === 'all' ? true : filter === 'done' ? t.status === 'done' : filter === 'me' ? forOwner(t) : t.status !== 'done');

  const box = (id: string, label: string, place: string, start = '') => `
    <div class="fe-cm-box">
      <textarea data-for="${esc(id)}" rows="2" aria-label="${esc(label)}" placeholder="${esc(place)}">${esc(typed.get(id) ?? start)}</textarea>
    </div>`;
  const notice = (text: string, why = '') => `<div class="fe-cm-state"${why ? ` title="${esc(why)}"` : ''}>${UI_ICON.info}<span>${esc(text)}</span></div>`;
  const iconBtn = (a: string, icon: string, title: string, v = '') => `<button type="button" class="fe-cm-ib" data-a="${a}"${v ? ` data-v="${esc(v)}"` : ''} title="${esc(title)}" aria-label="${esc(title)}">${icon}</button>`;

  const threadHtml = (t: DocThread) => {
    const on = t.id === active;
    const quote = visibleOf(t.place.state === 'moved' && t.place.offset !== null ? o.text().slice(t.place.offset, t.place.offset + t.place.length) : t.anchor.exact);
    const x = (a: string, v: string, label: string) => on ? `<button type="button" class="fe-cm-x" data-a="${a}" data-v="${esc(v)}" aria-label="${esc(label)}" title="${esc(label)}">${UI_ICON.close}</button>` : '';
    const chips = [
      ...(t.tags ?? []).map(g => `<span class="fe-cm-chip">#${esc(g)}${x('untag', g, `Remove tag ${g}`)}</span>`),
      t.due ? `<span class="fe-cm-chip due">${UI_ICON.clock}${esc(dueLabel(t.due))}${x('undue', '', 'Clear the due date')}</span>` : '',
      t.status === 'done' ? `<span class="fe-cm-chip done">Done</span>` : '',
    ].join('');
    const cs = t.comments.map(c => {
      const mine = on && c.author.kind === 'human' && !c.deleted;
      const body = editing === c.id
        ? `${box('edit:' + c.id, 'Edit comment', '', c.text || '')}<div class="fe-cm-tools"><span class="fe-cm-grow"></span>
            <button type="button" class="btn" data-size="sm" data-hover-shade data-a="edit-cancel" title="Cancel (Esc)">Cancel</button>
            <button type="button" class="btn" data-size="sm" data-variant="solid" data-a="edit-save" data-v="${esc(c.id)}" title="Save (⌘↵)">Save</button></div>`
        : `<div class="fe-cm-tx">${c.deleted ? '<i>Deleted</i>' : commentHtml(c.text || '')}</div>`;
      return `
      <div class="fe-cm-c${c.deleted ? ' gone' : ''}">
        <div class="fe-cm-who"><b class="${c.author.kind}">${c.author.kind === 'agent' ? UI_ICON.ai : ''}${esc(who(c.author))}</b><time title="${esc(c.created)}">${esc(ago(c.created))}${c.edited ? ' · edited' : ''}</time>
          ${mine && editing !== c.id ? `<span class="fe-cm-own">${iconBtn('edit', UI_ICON.rename, 'Edit this comment', c.id)}${iconBtn('del', UI_ICON.trash, 'Delete this comment', c.id)}</span>` : ''}</div>
        ${body}
        ${c.suggestion ? `<div class="fe-cm-sug">Suggests <ins>${esc(c.suggestion.replace)}</ins> <span>${esc(c.suggestion.state)}</span></div>` : ''}
      </div>`;
    }).join('');
    const where = t.place.state === 'moved' ? notice('Moved: the words changed', 'The quoted words were edited; this is where they seem to be now.')
      : t.place.state === 'ambiguous' ? notice('These words appear more than once')
      : t.place.state === 'detached' ? notice('No longer in the file', 'The quoted words were removed. Select new words and press Attach to selection to move the thread.') : '';
    const done = t.status === 'done';
    const tools = on ? `
      ${box(t.id, 'Reply', done ? 'Reply to reopen…' : 'Reply… @ to mention, # to tag')}
      <div class="fe-cm-tools">
        <button type="button" class="btn" data-size="sm" data-hover-shade data-a="${done ? 'reopen' : 'done'}" title="${done ? 'Reopen this thread' : 'Mark done'} (⌘⇧↵)">${done ? UI_ICON.reset + 'Reopen' : UI_ICON.check + 'Done'}</button>
        ${dueOpen === t.id ? `<input type="date" class="fe-cm-date" data-a="due-in" aria-label="Due date" value="${esc(t.due ?? '')}">`
          : iconBtn('due', UI_ICON.clock, 'Set a due date')}
        ${iconBtn('link', UI_ICON.link, 'Copy a link that opens this thread')}
        ${iconBtn('brief', UI_ICON.bot, 'Copy this thread as a brief for an agent')}
        ${t.place.state !== 'anchored' ? `<button type="button" class="btn" data-size="sm" data-hover-shade data-a="attach" title="Select words on the page first">Attach to selection</button>` : ''}
        <span class="fe-cm-grow"></span>
        <button type="button" class="btn" data-size="sm" data-variant="solid" data-a="reply" title="Reply (⌘↵)">Reply</button>
      </div>` : '';
    return `<article class="fe-cm-th${on ? ' on' : ''}" data-id="${esc(t.id)}" tabindex="0" aria-label="Comment on: ${esc(t.anchor.exact.slice(0, 80))}">
      <blockquote class="fe-cm-q">${esc(quote.length > 140 ? quote.slice(0, 139) + '…' : quote)}</blockquote>${where}${cs}
      ${chips ? `<div class="fe-cm-chips">${chips}</div>` : ''}${tools}</article>`;
  };

  const draftHtml = () => draft ? `<form class="fe-cm-th fe-cm-new on" data-new aria-label="${draft.attach ? 'Attach the thread here' : 'New comment'}">
      <blockquote class="fe-cm-q">${esc(draft.quote.length > 140 ? draft.quote.slice(0, 139) + '…' : draft.quote)}</blockquote>
      ${draft.block ? notice('On the whole block', 'These words could not be placed exactly, so the comment covers the whole block.') : ''}
      ${draft.attach ? '<p class="fe-cm-hint">The thread moves to these words.</p>' : box('new', 'New comment', 'Comment… @ to mention, # to tag')}
      <div class="fe-cm-tools"><span class="fe-cm-grow"></span>
        <button type="button" class="btn" data-size="sm" data-hover-shade data-a="cancel" title="Cancel (Esc)">Cancel</button>
        <button type="submit" class="btn" data-size="sm" data-variant="solid" data-a="post" title="${draft.attach ? 'Attach' : 'Comment'} (⌘↵)">${draft.attach ? 'Attach here' : 'Comment'}</button></div>
    </form>` : '';

  const emptyHtml = () => `<div class="fe-cm-empty">
      <span class="fe-cm-empty-ico">${UI_ICON.comment}</span>
      <p>${threads.length ? 'Nothing here' : 'No comments yet'}</p>
      <p class="fe-cm-hint">Select some text,<br>then press <kbd>c</kbd></p>
    </div>`;

  // Which boxes are on screen now; text typed in a box that is going away is not kept.
  const wanted = (id: string) => id === 'new' ? !!draft && !draft.attach : id.startsWith('edit:') ? editing === id.slice(5) : id === active;

  const paint = () => {
    // Keep what was being typed, and where, across the repaint.
    const ae = document.activeElement as HTMLTextAreaElement | null;
    const focus = ae && o.box.contains(ae) && ae.dataset.for ? { id: ae.dataset.for, s: ae.selectionStart, e: ae.selectionEnd } : null;
    o.box.querySelectorAll<HTMLTextAreaElement>('textarea[data-for]').forEach(ta => {
      const id = ta.dataset.for!;
      if (ta.value && wanted(id)) typed.set(id, ta.value); else typed.delete(id);
    });
    const listTop = o.box.querySelector('.fe-cm-list')?.scrollTop ?? 0;
    const root = o.root();
    if (!root) {
      o.box.innerHTML = `<div class="fe-cm-empty"><span class="fe-cm-empty-ico">${UI_ICON.lock}</span><p>Comments are saved beside this file.</p>
        <button type="button" class="btn" data-variant="outline" data-a="allow">Allow this folder</button></div>`;
      return;
    }
    if (!loaded) { o.box.innerHTML = '<div class="fe-cm-empty"><p>Loading comments…</p></div>'; return; }
    if (failed) { o.box.innerHTML = `<div class="fe-cm-empty"><span class="fe-cm-empty-ico">${UI_ICON.info}</span><p>Comments could not be read</p><p class="fe-cm-hint">${esc(failed)}</p></div>`; return; }
    const list = visible();
    const groups: [string, DocThread[]][] = filter === 'done' || filter === 'all'
      ? [['', list]]
      : [['', list.filter(t => t.place.state === 'anchored' || t.place.state === 'ambiguous')],
         ['Moved', list.filter(t => t.place.state === 'moved')],
         ['Detached', list.filter(t => t.place.state === 'detached')]];
    const done = filter === 'open' ? threads.filter(t => t.status === 'done') : [];
    const count = (f: Filter) => threads.filter(t => f === 'all' ? true : f === 'done' ? t.status === 'done' : f === 'me' ? forOwner(t) : t.status !== 'done').length;
    o.box.innerHTML = `
      <div class="fe-cm-top">
        <div class="fe-cm-filters" role="tablist">${FILTERS.map(f => `<button type="button" role="tab" data-f="${f.id}" class="${f.id === filter ? 'on' : ''}" aria-selected="${f.id === filter}" title="${f.hint}">${f.icon}<span class="fe-cm-fl">${f.label}</span><span class="fe-cm-fn">${count(f.id) || ''}</span></button>`).join('')}</div>
        ${list.length ? iconBtn('brief-all', UI_ICON.bot, 'Copy the threads shown as a brief for an agent, with links') : ''}
      </div>
      <div class="fe-cm-list">
        ${draftHtml()}
        ${notesLine.map(n => `<p class="fe-cm-note">${esc(n)}</p>`).join('')}
        ${list.length || draft ? '' : emptyHtml()}
        ${groups.filter(([, ts]) => ts.length).map(([name, ts]) => `${name ? `<h4 class="fe-cm-group">${name} <span>${ts.length}</span></h4>` : ''}${ts.map(threadHtml).join('')}`).join('')}
        ${done.length ? `<details class="fe-cm-done"${done.some(t => t.id === active) ? ' open' : ''}><summary class="fe-cm-group">Done <span>${done.length}</span></summary>${done.map(threadHtml).join('')}</details>` : ''}
      </div>
      <div class="fe-cm-ac" role="listbox" hidden></div>`;
    o.box.querySelector('.fe-cm-list')!.scrollTop = listTop;
    acFor = null;
    if (focus) {
      const ta = o.box.querySelector<HTMLTextAreaElement>(`textarea[data-for="${CSS.escape(focus.id)}"]`);
      if (ta) { ta.focus({ preventScroll: true }); ta.setSelectionRange(focus.s, focus.e); }
    }
  };

  const lineOf = (text: string, off: number) => { let n = 1; for (let p = text.indexOf('\n'); p !== -1 && p < off; p = text.indexOf('\n', p + 1)) n++; return n; };
  const rangeOfSpan = (offset: number, length: number) => {
    const text = o.text();
    const src = text.slice(offset, offset + length);
    const line = lineOf(text, offset);
    return rangeFor(o.page, line, line + (src.match(/\n/g)?.length ?? 0), visibleOf(src));
  };

  const reg = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
  const H = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
  // Highlights and the per-block counts follow the rendered page.
  const redraw = () => {
    ranges.clear();
    o.page.querySelectorAll('[data-cm]').forEach(b => b.removeAttribute('data-cm'));
    const all: Range[] = [];
    for (const t of threads) {
      if (t.status === 'done' || t.place.offset === null || t.place.line === null) continue;
      const r = rangeOfSpan(t.place.offset, t.place.length);
      if (!r) continue;
      ranges.set(t.id, r); all.push(r);
      const block = (r.startContainer.nodeType === 1 ? r.startContainer as Element : r.startContainer.parentElement)?.closest<HTMLElement>('[data-sl]');
      if (block) block.dataset.cm = String(Number(block.dataset.cm || 0) + 1);
    }
    if (reg && H) {
      reg.set('bfb-cm', new H(...all));
      const on = draft ? rangeOfSpan(draft.start, draft.end - draft.start) : ranges.get(active);
      if (on) reg.set('bfb-cm-on', new H(on)); else reg.delete('bfb-cm-on');
      reg.delete('bfb-cm-hover'); hovered = '';
    }
  };

  const focusThread = (id: string, scroll = true) => {
    active = id; dueOpen = ''; editing = '';
    paint(); redraw();
    const card = o.box.querySelector<HTMLElement>(`.fe-cm-th[data-id="${CSS.escape(id)}"]`);
    if (!card) {   // filtered out: show everything so the thread is there
      filter = 'all'; paint(); redraw();
    }
    o.box.querySelector<HTMLElement>(`.fe-cm-th[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' });
    const r = ranges.get(id);
    if (scroll && r) {
      const box = r.getBoundingClientRect(), pg = o.page.getBoundingClientRect();
      if (box.top < pg.top + 40 || box.bottom > pg.bottom - 40) o.page.scrollTop += box.top - pg.top - pg.height / 3;
    }
    const t = threads.find(x => x.id === id);
    if (t && t.place.offset !== null) o.picked?.({ offset: t.place.offset, length: t.place.length });
  };

  // ── Starting a thread from a selection on the page ───────────────────────
  const selected = (): { span: SourceSpan; range: Range } | null => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed || o.page.style.display === 'none') return null;
    const range = sel.getRangeAt(0);
    if (!o.page.contains(range.commonAncestorContainer)) return null;
    const span = sourceSpan(o.page, o.text(), range);
    return span ? { span, range } : null;
  };
  // A selection seen just before a click in the panel, which may clear it.
  let held: SourceSpan | null = null;

  const startDraft = async (span: SourceSpan, attach?: string) => {
    if (!o.root()) {
      if (!(await o.allow())) return;
      loaded = false; void load();
    }
    const src = o.text().slice(span.start, span.end);
    // A new selection is a new comment: nothing typed for an earlier one carries over.
    if (!draft || draft.start !== span.start || draft.end !== span.end) typed.delete('new');
    draft = { ...span, quote: visibleOf(src) || src, attach };
    if (!attach) active = '';
    window.getSelection()?.removeAllRanges();
    addBtn.hidden = true;
    o.reveal();
    paint(); redraw();
    o.box.querySelector<HTMLElement>('.fe-cm-new')?.scrollIntoView({ block: 'nearest' });
    (o.box.querySelector<HTMLElement>('textarea[data-for="new"]') ?? o.box.querySelector<HTMLElement>('[data-a="post"]'))?.focus();
  };
  const cancelDraft = () => { draft = null; typed.delete('new'); paint(); redraw(); };
  const post = async () => {
    if (!draft) return;
    const d = draft;
    if (d.attach) {
      if (await write([{ op: 'attach', thread: d.attach, start: d.start, end: d.end }], 'Attach')) { draft = null; focusThread(d.attach); }
      return;
    }
    const ta = o.box.querySelector<HTMLTextAreaElement>('textarea[data-for="new"]');
    const text = (ta?.value ?? '').trim();
    if (!text) { ta?.focus(); return; }
    const r = await write([{ op: 'new', start: d.start, end: d.end, text }], 'Comment');
    if (!r) return;
    draft = null; typed.delete('new');
    const id = r.results?.[0]?.thread;
    if (id) { if (filter === 'done') filter = 'open'; focusThread(id); } else paint();
  };
  // A reply; with `close`, also mark the thread done (or reopen it).
  const reply = async (id: string, close = false) => {
    const t = threads.find(x => x.id === id);
    if (!t) return;
    const ta = o.box.querySelector<HTMLTextAreaElement>(`textarea[data-for="${CSS.escape(id)}"]`);
    const text = (ta?.value ?? '').trim();
    const ops: CommentOp[] = [];
    if (close) ops.push({ op: t.status === 'done' ? 'reopen' : 'done', thread: id, text });
    else if (text) ops.push({ op: t.status === 'done' ? 'reopen' : 'reply', thread: id, text });
    if (!ops.length) { ta?.focus(); return; }
    if (ta) ta.value = '';   // the repaint after the write keeps no stale draft
    typed.delete(id);
    if (!(await write(ops, 'Reply'))) { typed.set(id, text); paint(); return; }
    o.box.querySelector<HTMLElement>(`.fe-cm-th[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  };
  const startEdit = (cid: string) => {
    editing = cid; paint();
    const ta = o.box.querySelector<HTMLTextAreaElement>(`textarea[data-for="edit:${CSS.escape(cid)}"]`);
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  };
  const cancelEdit = () => { typed.delete('edit:' + editing); editing = ''; paint(); };
  const saveEdit = async (cid: string) => {
    const ta = o.box.querySelector<HTMLTextAreaElement>(`textarea[data-for="edit:${CSS.escape(cid)}"]`);
    const text = (ta?.value ?? '').trim();
    if (!text) { ta?.focus(); return; }
    if (await write([{ op: 'edit', thread: active, comment: cid, text }], 'Edit')) { typed.delete('edit:' + cid); editing = ''; paint(); }
  };
  const copy = (text: string, said: string) => copyToClipboard(text).then(ok => o.status(ok ? said : 'copy failed'));

  // The floating Comment button sits just above the end of a selection.
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.id = 'fe-cm-add';
  addBtn.className = 'btn';
  addBtn.hidden = true;
  addBtn.title = 'Comment on the selection (c)';
  addBtn.innerHTML = `${UI_ICON.comment}Comment`;
  (document.getElementById('fe') ?? document.body).appendChild(addBtn);
  addBtn.addEventListener('pointerdown', e => e.preventDefault());   // keep the selection
  addBtn.addEventListener('click', () => { const s = selected(); if (s) void startDraft(s.span); });
  let selTimer = 0;
  document.addEventListener('selectionchange', () => {
    clearTimeout(selTimer);
    selTimer = window.setTimeout(() => {
      const s = selected();
      if (!s) { addBtn.hidden = true; return; }
      const rects = s.range.getClientRects();
      const r = rects[rects.length - 1] ?? s.range.getBoundingClientRect();
      addBtn.hidden = false;
      addBtn.style.top = `${Math.max(8, r.top - addBtn.offsetHeight - 6)}px`;
      addBtn.style.left = `${Math.min(innerWidth - addBtn.offsetWidth - 8, Math.max(8, r.right - addBtn.offsetWidth / 2))}px`;
    }, 120);
  });
  o.page.addEventListener('scroll', () => { addBtn.hidden = true; }, { passive: true });

  // ── Mention and tag completion in every box ──────────────────────────────
  // One list for the panel, placed under (or over) the box being typed in,
  // so the panel's own scrolling never cuts it off.
  let acFor: HTMLTextAreaElement | null = null, acAt = 0;
  const acList = () => o.box.querySelector<HTMLElement>('.fe-cm-ac');
  const acClose = () => { const l = acList(); if (l) { l.hidden = true; l.innerHTML = ''; } acFor = null; };
  const acShow = (ta: HTMLTextAreaElement) => {
    const list = acList();
    const c = completions(ta.value, ta.selectionStart, people(), allTags());
    if (!list || !c) { acClose(); return; }
    acFor = ta; acAt = Math.min(acAt, c.items.length - 1);
    list.hidden = false;
    list.innerHTML = c.items.map((x, i) => {
      const hint = hintFor(x);
      return `<div role="option" data-v="${esc(x)}" class="${i === acAt ? 'on' : ''}" aria-selected="${i === acAt}">${esc(c.sigil + x)}${hint ? ` <span>${esc(hint)}</span>` : ''}</div>`;
    }).join('');
    const t = ta.getBoundingClientRect(), b = o.box.getBoundingClientRect();
    list.style.left = `${t.left - b.left}px`;
    list.style.width = `${t.width}px`;
    const below = t.bottom + list.offsetHeight + 8 < innerHeight;
    list.style.top = `${below ? t.bottom - b.top + 4 : t.top - b.top - list.offsetHeight - 4}px`;
  };
  const acPick = (ta: HTMLTextAreaElement, v: string) => {
    const c = completions(ta.value, ta.selectionStart, people(), allTags());
    if (!c) return;
    ta.setRangeText(c.sigil + v + ' ', c.from, ta.selectionStart, 'end');
    acClose();
    ta.focus();
  };
  o.box.addEventListener('input', e => {
    const ta = e.target as HTMLTextAreaElement;
    if (!ta.dataset?.for) return;
    if (ta.value.includes('@')) loadPeers();
    acAt = 0; acShow(ta);
  });
  o.box.addEventListener('scroll', acClose, true);
  o.box.addEventListener('pointerdown', e => {
    // Opening a card clears the page selection, so the one before it is kept for Attach.
    const s = selected();
    if (s) held = s.span;
    const opt = (e.target as Element).closest<HTMLElement>('.fe-cm-ac [data-v]');
    if (opt && acFor) { e.preventDefault(); acPick(acFor, opt.dataset.v!); }
  });

  o.box.addEventListener('keydown', e => {
    const el = e.target as HTMLElement;
    const ta = el.closest<HTMLTextAreaElement>('textarea[data-for]');
    if (ta) {
      const list = acList();
      if (list && !list.hidden && acFor === ta) {
        const n = list.children.length;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); acAt = (acAt + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; acShow(ta); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); acPick(ta, (list.children[acAt] as HTMLElement).dataset.v!); return; }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); acClose(); return; }
      }
      const id = ta.dataset.for!;
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (id === 'new') void post();
        else if (id.startsWith('edit:')) void saveEdit(id.slice(5));
        else void reply(id, e.shiftKey);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        if (id === 'new') cancelDraft();
        else if (id.startsWith('edit:')) cancelEdit();
        else { ta.blur(); o.box.querySelector<HTMLElement>(`.fe-cm-th[data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }); }
      }
      return;
    }
    if (el.closest('.fe-cm-new')) {
      if (e.key === 'Escape') { e.preventDefault(); cancelDraft(); }
      else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void post(); }
      return;
    }
    const th = el.closest<HTMLElement>('.fe-cm-th[data-id]');
    if (!th) return;
    if (el === th && (e.key === 'Enter' || e.key === ' ') && !e.metaKey) { e.preventDefault(); focusThread(th.dataset.id!); return; }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.shiftKey) { e.preventDefault(); void reply(th.dataset.id!, true); return; }
    if (e.key === 'Escape' && active) {
      e.preventDefault(); e.stopPropagation();
      active = ''; paint(); redraw();
      o.page.focus({ preventScroll: true });
    }
  });

  o.box.addEventListener('submit', e => { e.preventDefault(); void post(); });
  o.box.addEventListener('change', e => {
    const inp = e.target as HTMLInputElement;
    if (inp.dataset.a === 'due-in' && active) { dueOpen = ''; void write([{ op: 'due', thread: active, due: inp.value || undefined }], 'Due date'); }
  });

  o.box.addEventListener('click', async e => {
    const el = e.target as HTMLElement;
    const f = el.closest<HTMLElement>('[data-f]')?.dataset.f as Filter | undefined;
    if (f) { filter = f; kvSet(FILTER_KEY, f); paint(); redraw(); return; }
    const act = el.closest<HTMLElement>('[data-a]');
    const a = act?.dataset.a;
    if (a === 'allow') { if (await o.allow()) { loaded = false; paint(); void load(); } return; }
    if (a === 'cancel') { cancelDraft(); return; }
    if (a === 'post') { e.preventDefault(); void post(); return; }
    if (a === 'brief-all') { const ts = visible(); void copy(agentBrief(o.path, o.href, ts), `${ts.length} thread${ts.length === 1 ? '' : 's'} copied as a brief for an agent`); return; }
    if (a && active) {
      const v = act!.dataset.v ?? '';
      const t = threads.find(x => x.id === active);
      if (a === 'reply') { void reply(active); return; }
      if (a === 'done' || a === 'reopen') { void reply(active, true); return; }
      if (a === 'untag') { void write([{ op: 'untag', thread: active, tags: [v] }], 'Tag'); return; }
      if (a === 'undue') { void write([{ op: 'due', thread: active }], 'Due date'); return; }
      if (a === 'del') { void write([{ op: 'delete', thread: active, comment: v }], 'Delete'); return; }
      if (a === 'edit') { startEdit(v); return; }
      if (a === 'edit-cancel') { cancelEdit(); return; }
      if (a === 'edit-save') { void saveEdit(v); return; }
      if (a === 'due') {
        dueOpen = active; paint();
        const inp = o.box.querySelector<HTMLInputElement>('.fe-cm-date');
        inp?.focus();
        try { inp?.showPicker(); } catch { /* not allowed here; the field still takes typing */ }
        return;
      }
      if (a === 'link') { void copy(location.href.split('#')[0] + '#c=' + encodeURIComponent(active), 'Link to this thread copied'); return; }
      if (a === 'brief' && t) { void copy(agentBrief(o.path, o.href, [t]), 'Thread copied as a brief for an agent'); return; }
      if (a === 'attach') {
        const span = held ?? selected()?.span;
        if (!span) { o.status('Select the words on the page first, then press Attach to selection'); return; }
        held = null;
        void startDraft(span, active);
        return;
      }
    }
    if (el.closest('a, textarea, input, .fe-cm-tools, .fe-cm-ac, .fe-cm-new, button')) return;
    const th = el.closest<HTMLElement>('.fe-cm-th[data-id]');
    if (th && th.dataset.id !== active) focusThread(th.dataset.id!);
  });

  // The thread under the pointer: commented words darken a little on hover.
  const threadAt = (x: number, y: number) => {
    const pos = (document as unknown as { caretRangeFromPoint?: (x: number, y: number) => Range | null }).caretRangeFromPoint?.(x, y);
    if (!pos) return '';
    for (const [id, r] of ranges) {
      try { if (r.isPointInRange(pos.startContainer, pos.startOffset)) return id; } catch { /* other document part */ }
    }
    return '';
  };
  let hovered = '', hoverFrame = 0;
  o.page.addEventListener('mousemove', e => {
    if (hoverFrame || !ranges.size) return;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0;
      const id = threadAt(e.clientX, e.clientY);
      if (id === hovered || !reg || !H) return;
      hovered = id;
      const r = id && id !== active ? ranges.get(id) : undefined;
      if (r) reg.set('bfb-cm-hover', new H(r)); else reg.delete('bfb-cm-hover');
      o.page.classList.toggle('fe-cm-pointing', !!id);
    });
  });
  o.page.addEventListener('mouseleave', () => { hovered = ''; reg?.delete('bfb-cm-hover'); o.page.classList.remove('fe-cm-pointing'); });

  // A click on highlighted words, or on a block's count, opens that thread.
  o.page.addEventListener('click', e => {
    const me = e as MouseEvent;
    const block = (me.target as Element).closest<HTMLElement>('[data-cm]');
    if (block && me.clientX > block.getBoundingClientRect().right - 4) {
      const id = [...ranges].find(([, r]) => block.contains(r.startContainer))?.[0];
      if (id) { o.reveal(); focusThread(id, false); o.changed(); return; }
    }
    if (window.getSelection()?.toString()) return;
    const id = threadAt(me.clientX, me.clientY);
    if (id) { o.reveal(); focusThread(id, false); o.changed(); }
  });

  // Watch the companion by its file URL (no host process) and ask the host
  // to re-anchor only when it or the document changed; runs while editing too.
  setInterval(async () => {
    if (document.visibilityState !== 'visible' || !o.root() || lastCompanion === null || busy) return;
    const comp = await readCompanion();
    if (comp === lastCompanion && o.text() === lastText) return;
    void load();
  }, POLL_MS);

  // Open threads with a place, in document order (the host sorts them so).
  const placed = () => threads.filter(t => t.status !== 'done' && t.place.offset !== null);
  const step = (dir: 1 | -1) => {
    const list = placed();
    if (!list.length) return;
    const i = list.findIndex(t => t.id === active);
    const next = list[i === -1 ? (dir === 1 ? 0 : list.length - 1) : (i + dir + list.length) % list.length];
    o.reveal();
    focusThread(next.id);
    o.box.querySelector<HTMLElement>(`.fe-cm-th[data-id="${CSS.escape(next.id)}"]`)?.focus({ preventScroll: true });
  };

  paint();
  void load();
  return {
    redraw,
    open: () => threads.filter(t => t.status !== 'done').length,
    show: (id?: string) => { if (id) focusThread(id); else paint(); },
    marks: () => placed().map(t => ({ id: t.id, offset: t.place.offset!, length: t.place.length })),
    key: e => {
      if (e.metaKey || e.ctrlKey) return false;
      if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { step(e.key === 'ArrowDown' ? 1 : -1); return true; }
      if (e.altKey) return false;
      if (e.key === 'c') { const s = selected(); if (!s) return false; void startDraft(s.span); return true; }
      if (e.key === 'C') { o.toggle(); return true; }
      if (e.key === 'Escape' && (active || draft)) { draft = null; active = ''; paint(); redraw(); return true; }
      return false;
    },
  };
}
