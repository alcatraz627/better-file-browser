// The comments panel on a markdown file page: every thread on the file, in
// the Contents rail's slot as a second tab, with Open, For me, Done and All
// filters and groups for threads that moved or lost their text. Anchored
// spans are drawn in the page with the CSS Custom Highlight API (no elements
// added, so find, Contents and copy are unaffected), and a count beside each
// block opens its first thread. Threads come from the native host, which owns
// all anchoring (spec: .claude/specs/bfb-docs.md); this file only maps source
// spans onto the rendered page.
import { notes, type DocThread, type CommentAuthor } from './notes';
import { esc } from './utils';
import { mdInline } from './renderers';
import { UI_ICON } from './control-icons';
import { kvGet, kvSet } from './kv';
import { fetchFileText } from './file-fetch';

const FILTER_KEY = 'bfb-comments-filter-v1';
const POLL_MS = 2000;
type Filter = 'open' | 'me' | 'done' | 'all';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'open', label: 'Open' }, { id: 'me', label: 'For me' }, { id: 'done', label: 'Done' }, { id: 'all', label: 'All' },
];

/** What a reader sees of a span of markdown source: markers, link targets and HTML gone, whitespace collapsed. */
export function visibleOf(src: string): string {
  const lines = src.split('\n').map(l => l
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*>\s?/, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, '')
    .replace(/\|/g, ' '));
  return lines.join(' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/`+/g, '')
    .replace(/\*\*|__|~~/g, '')
    .replace(/(^|[^\w*])[*_](?=\S)/g, '$1')
    .replace(/(\S)[*_](?=[^\w*]|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

const SKIP = 'script,style,svg,textarea,.fe-md-anchor,.fe-md-code-bar,[hidden]';

/** A DOM Range over the rendered text of source lines first..last that reads `needle`, or null. */
export function rangeFor(page: HTMLElement, first: number, last: number, needle: string): Range | null {
  const blocks = [...page.querySelectorAll<HTMLElement>('[data-sl]')].filter(b => {
    const [a, z] = b.dataset.sl!.split('-').map(Number);
    return z >= first && a <= last;
  });
  if (!blocks.length) return null;
  // The blocks' text, whitespace collapsed, with each kept character's text node and offset.
  let flat = '';
  const at: [Text, number][] = [];
  let ws = true;
  for (const b of blocks) {
    const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    while (walker.nextNode()) {
      const t = walker.currentNode as Text;
      for (let i = 0; i < t.data.length; i++) {
        const sp = /\s/.test(t.data[i]);
        if (sp && ws) continue;
        flat += sp ? ' ' : t.data[i];
        at.push([t, i]);
        ws = sp;
      }
    }
    if (!ws) { flat += ' '; at.push(at[at.length - 1]); ws = true; }
  }
  const range = document.createRange();
  let s = needle ? flat.indexOf(needle) : -1;
  if (s === -1 && needle) s = flat.toLowerCase().indexOf(needle.toLowerCase());
  if (s === -1) {
    range.selectNodeContents(blocks[0]);   // the words are not on the page as typed: mark the block
    return range;
  }
  const [sn, so] = at[s], [en, eo] = at[s + needle.length - 1];
  range.setStart(sn, so);
  range.setEnd(en, eo + 1);
  return range;
}

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

export interface CommentsPanel {
  /** The page re-rendered: draw the highlights and markers again. */
  redraw(): void;
  /** How many open threads the file has. */
  open(): number;
  /** Show the panel and the given thread. */
  show(threadId?: string): void;
}

export function mountComments(o: {
  page: HTMLElement; box: HTMLElement; href: string;
  root: () => string | null; rel: () => string; text: () => string;
  allow: () => Promise<boolean>; status: (t: string) => void; changed: () => void;
}): CommentsPanel {
  let threads: DocThread[] = [];
  let notesLine: string[] = [];
  let filter = (kvGet(FILTER_KEY) as Filter) || 'open';
  let active = '';
  let loaded = false, failed = '';
  let lastCompanion: string | null = null, lastText = '';
  const seen = new Set<string>();
  const ranges = new Map<string, Range>();

  const readCompanion = () => fetchFileText(o.href + '.bfb.json').catch(() => '');
  const load = async () => {
    const root = o.root();
    if (!root) { loaded = true; paint(); return; }
    // What the poll compares against, read just before asking the host, so a
    // change landing between the two is seen on the next tick.
    lastCompanion = await readCompanion();
    lastText = o.text();
    try {
      const r = await notes.commentsRead(root, o.rel());
      const fresh = r.threads.flatMap(t => t.comments.filter(c => !seen.has(c.id) && c.author.kind === 'agent').map(c => c.author));
      if (loaded && fresh.length) o.status(`New reply from ${fresh[fresh.length - 1].alias}`);
      r.threads.forEach(t => t.comments.forEach(c => seen.add(c.id)));
      threads = r.threads; notesLine = r.notes; failed = ''; loaded = true;
    } catch (e) { failed = (e as Error).message; loaded = true; }
    paint(); redraw(); o.changed();
  };

  const visible = () => threads.filter(t =>
    filter === 'all' ? true : filter === 'done' ? t.status === 'done' : filter === 'me' ? forOwner(t) : t.status !== 'done');

  const threadHtml = (t: DocThread) => {
    const quote = visibleOf(t.place.state === 'moved' && t.place.offset !== null ? o.text().slice(t.place.offset, t.place.offset + t.place.length) : t.anchor.exact);
    const chips = [
      ...(t.tags ?? []).map(g => `<span class="fe-cm-chip">#${esc(g)}</span>`),
      t.due ? `<span class="fe-cm-chip due">${UI_ICON.clock}${esc(dueLabel(t.due))}</span>` : '',
      t.status === 'done' ? `<span class="fe-cm-chip done">Done</span>` : '',
    ].join('');
    const cs = t.comments.map(c => `
      <div class="fe-cm-c${c.deleted ? ' gone' : ''}">
        <div class="fe-cm-who"><b class="${c.author.kind}">${c.author.kind === 'agent' ? UI_ICON.ai : ''}${esc(who(c.author))}</b><time title="${esc(c.created)}">${esc(ago(c.created))}</time></div>
        <div class="fe-cm-tx">${c.deleted ? '<i>Deleted</i>' : mdInline(c.text || '')}</div>
        ${c.suggestion ? `<div class="fe-cm-sug">Suggests <ins>${esc(c.suggestion.replace)}</ins> <span>${esc(c.suggestion.state)}</span></div>` : ''}
      </div>`).join('');
    const where = t.place.state === 'moved' ? '<div class="fe-cm-state">Moved: the quoted words changed</div>'
      : t.place.state === 'ambiguous' ? '<div class="fe-cm-state">The quoted words appear more than once</div>'
      : t.place.state === 'detached' ? '<div class="fe-cm-state">The quoted text is no longer in the file</div>' : '';
    return `<article class="fe-cm-th${t.id === active ? ' on' : ''}" data-id="${esc(t.id)}" tabindex="0" aria-label="Comment on: ${esc(t.anchor.exact.slice(0, 80))}">
      <blockquote class="fe-cm-q">${esc(quote.length > 140 ? quote.slice(0, 139) + '…' : quote)}</blockquote>${where}${cs}
      ${chips ? `<div class="fe-cm-chips">${chips}</div>` : ''}</article>`;
  };

  const paint = () => {
    const root = o.root();
    if (!root) {
      o.box.innerHTML = `<div class="fe-cm-empty"><p>Comments are saved beside this file, so this folder needs to be allowed first.</p>
        <button type="button" class="btn" data-variant="outline" data-a="allow">${UI_ICON.lock}Allow this folder</button></div>`;
      return;
    }
    if (!loaded) { o.box.innerHTML = '<div class="fe-cm-empty"><p>Loading comments…</p></div>'; return; }
    if (failed) { o.box.innerHTML = `<div class="fe-cm-empty"><p>Comments could not be read: ${esc(failed)}</p></div>`; return; }
    const list = visible();
    const groups: [string, DocThread[]][] = filter === 'done' || filter === 'all'
      ? [['', list]]
      : [['', list.filter(t => t.place.state === 'anchored' || t.place.state === 'ambiguous')],
         ['Moved', list.filter(t => t.place.state === 'moved')],
         ['Detached', list.filter(t => t.place.state === 'detached')]];
    const done = filter === 'open' ? threads.filter(t => t.status === 'done') : [];
    const count = (f: Filter) => threads.filter(t => f === 'all' ? true : f === 'done' ? t.status === 'done' : f === 'me' ? forOwner(t) : t.status !== 'done').length;
    o.box.innerHTML = `
      <div class="fe-cm-filters" role="tablist">${FILTERS.map(f => `<button type="button" role="tab" data-f="${f.id}" class="${f.id === filter ? 'on' : ''}" aria-selected="${f.id === filter}">${f.label}<span>${count(f.id) || ''}</span></button>`).join('')}</div>
      ${notesLine.map(n => `<p class="fe-cm-note">${esc(n)}</p>`).join('')}
      ${list.length ? '' : `<div class="fe-cm-empty"><p>${threads.length ? 'Nothing here.' : 'No comments yet.'}</p><p class="fe-cm-hint">Agents and the terminal add them with <code>bfb-docs comments new</code>.</p></div>`}
      ${groups.filter(([, ts]) => ts.length).map(([name, ts]) => `${name ? `<h4 class="fe-cm-group">${name} <span>${ts.length}</span></h4>` : ''}${ts.map(threadHtml).join('')}`).join('')}
      ${done.length ? `<details class="fe-cm-done"><summary class="fe-cm-group">Done <span>${done.length}</span></summary>${done.map(threadHtml).join('')}</details>` : ''}`;
  };

  // Highlights and the per-block counts follow the rendered page.
  const redraw = () => {
    ranges.clear();
    o.page.querySelectorAll('[data-cm]').forEach(b => b.removeAttribute('data-cm'));
    const all: Range[] = [];
    const text = o.text();
    for (const t of threads) {
      if (t.status === 'done' || t.place.offset === null || t.place.line === null) continue;
      const src = text.slice(t.place.offset, t.place.offset + t.place.length);
      const last = t.place.line + (src.match(/\n/g)?.length ?? 0);
      const r = rangeFor(o.page, t.place.line, last, visibleOf(src));
      if (!r) continue;
      ranges.set(t.id, r); all.push(r);
      const block = (r.startContainer.nodeType === 1 ? r.startContainer as Element : r.startContainer.parentElement)?.closest<HTMLElement>('[data-sl]');
      if (block) block.dataset.cm = String(Number(block.dataset.cm || 0) + 1);
    }
    const reg = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    const H = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    if (reg && H) {
      reg.set('bfb-cm', new H(...all));
      const on = ranges.get(active);
      if (on) reg.set('bfb-cm-on', new H(on)); else reg.delete('bfb-cm-on');
    }
  };

  const focusThread = (id: string, scroll = true) => {
    active = id;
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
  };

  o.box.addEventListener('click', async e => {
    const el = e.target as HTMLElement;
    const f = el.closest<HTMLElement>('[data-f]')?.dataset.f as Filter | undefined;
    if (f) { filter = f; kvSet(FILTER_KEY, f); paint(); return; }
    if (el.closest('[data-a="allow"]')) { if (await o.allow()) { loaded = false; paint(); void load(); } return; }
    if (el.closest('a')) return;
    const th = el.closest<HTMLElement>('.fe-cm-th');
    if (th) focusThread(th.dataset.id!);
  });
  o.box.addEventListener('keydown', e => {
    const th = (e.target as HTMLElement).closest<HTMLElement>('.fe-cm-th');
    if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); focusThread(th.dataset.id!); }
  });
  // A click on highlighted words, or on a block's count, opens that thread.
  o.page.addEventListener('click', e => {
    const me = e as MouseEvent;
    const block = (me.target as Element).closest<HTMLElement>('[data-cm]');
    if (block && me.clientX > block.getBoundingClientRect().right - 4) {
      const id = [...ranges].find(([, r]) => block.contains(r.startContainer))?.[0];
      if (id) { focusThread(id, false); o.changed(); return; }
    }
    const pos = (document as unknown as { caretRangeFromPoint?: (x: number, y: number) => Range | null }).caretRangeFromPoint?.(me.clientX, me.clientY);
    if (!pos || window.getSelection()?.toString()) return;
    for (const [id, r] of ranges) {
      try { if (r.isPointInRange(pos.startContainer, pos.startOffset)) { focusThread(id, false); o.changed(); return; } } catch { /* other document part */ }
    }
  });

  // Watch the companion by its file URL (no host process) and ask the host
  // to re-anchor only when it or the document changed; runs while editing too.
  setInterval(async () => {
    if (document.visibilityState !== 'visible' || !o.root() || lastCompanion === null) return;
    const comp = await readCompanion();
    if (comp === lastCompanion && o.text() === lastText) return;
    void load();
  }, POLL_MS);

  paint();
  void load();
  return {
    redraw,
    open: () => threads.filter(t => t.status !== 'done').length,
    show: (id?: string) => { if (id) focusThread(id); else paint(); },
  };
}
