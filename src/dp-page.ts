// A decision page: a folder whose config.json lists decisions or sections
// shows as the page an agent asked the owner to answer, in bfb's own shell,
// instead of as a file listing. It is one of the doc views (docview.ts):
// pictures, folding prose, the meter and the rail of items come from the
// shared kit. gcc owns the answer itself; this module only draws the page
// (docs: ~/.claude/features/decision-pages.md).
import { esc, whenText } from './utils';
import { copyWithCheck } from './copy-done';
import { UI_ICON, GLYPH } from './control-icons';
import { renderMarkdown } from './renderers';
import { jsonPref, flagPref } from './storage';
import { dpIo } from './dp-io';
import { bind, runCommand } from './commands';
import { bodyHtml, sectionGroup } from './dp-cards';
import { restoreState, draftedState, flagOf, progress, stateKey, type DpState } from './dp-form';
import { ago } from './dp-lens';
import type { DocView, DocViewCtx } from './docview';
import type { ImageEntry } from './docview-media';
import { wireMedia, unzoomAll, showMarks } from './docview-media';
import { clampHtml, wireClamps } from './docview-clamp';
import { meterHtml } from './docview-status';
import { outlineHtml, updateOutline, followOutline, type OutlineItem } from './docview-outline';
import { answerBarHtml, answerPanelHtml, sentHtml, wireAnswer } from './dp-answer';

export interface DpOption { code: string; label: string; rec?: boolean; why?: string; images?: ImageEntry[] }
export interface DpDecision { id: string; question: string; context?: string; note?: string; group?: string; images?: ImageEntry[]; none?: boolean; noneLabel?: string; noneCode?: string; options: DpOption[] }
export interface DpSection { id: string; group?: string; title?: string; prio?: string; read?: string; pre?: string; images?: ImageEntry[]; note?: string; slots?: Record<string, string> }
export interface DpOrigin { session?: string; project?: string; topic?: string; created?: string; board?: string; card?: string; goal?: string; milestone?: string }
export interface DpConfig {
  title?: string; storageKey?: string; copyHeader?: string; intro?: string; notes?: boolean; accent?: string;
  origin?: DpOrigin; groups?: Record<string, { context?: string; color?: string }>;
  decisions?: DpDecision[]; sections?: DpSection[];
}

/** The config when the text is a decision page's, or null for any other config.json. */
export function parseDpConfig(text: string): DpConfig | null {
  let c: unknown;
  try { c = JSON.parse(text); } catch { return null; }
  if (!c || typeof c !== 'object') return null;
  const cfg = c as DpConfig;
  return Array.isArray(cfg.decisions) || Array.isArray(cfg.sections) ? cfg : null;
}

/**
 * Where a page came from, as the short facts of one line under its title:
 * project, session, goal, milestone, card, then how long ago it was asked.
 * The topic and a board are drawn apart, as a badge and a link; a card on a
 * board rides in that link, so it is only a fact here when there is no board.
 */
export function originFacts(o: DpOrigin | undefined, now = Date.now()): { label: string; value: string; copy: string; title?: string; copyName?: string }[] {
  if (!o) return [];
  const rows: [string, string | undefined, string][] = [['Project', o.project, ''], ['Session', o.session, ''], ['Goal', o.goal, 'goal '], ['Milestone', o.milestone, ''], ['Card', o.board ? undefined : o.card, 'card ']];
  const out: { label: string; value: string; copy: string; title?: string; copyName?: string }[] = rows.filter((r): r is [string, string, string] => !!r[1]).map(([label, v, lead]) => ({ label, value: lead + v, copy: v }));
  if (o.created) {
    const at = Date.parse(o.created);
    if (Number.isNaN(at)) out.push({ label: 'Asked', value: `asked ${o.created}`, copy: o.created });
    else {
      const a = ago(at / 1000, now / 1000);
      out.push({ label: 'Asked', value: a === 'just now' ? 'asked just now' : `asked ${a} ago`, copy: o.created, title: `Asked ${whenText(at)}`, copyName: 'the exact time' });
    }
  }
  return out;
}

/** The board, or the card on it, that the page rules on, as a link into gcc's board view. */
function boardLinkHtml(o: DpOrigin | undefined): string {
  const server = dpIo().server;
  if (!o?.board || server === null) return '';
  const href = `${server}/b/${encodeURIComponent(o.board)}${o.card ? `?card=${encodeURIComponent(o.card)}` : ''}`;
  return `<a class="chip fe-dp-olink" data-size="sm" data-fill href="${esc(href)}" target="_blank" rel="noopener" title="${o.card ? 'The card this page rules on' : 'The board this page belongs to'}">${GLYPH.column}<span>${esc(o.card || o.board)}</span></a>`;
}

function headHtml(cfg: DpConfig, base: string): string {
  const d = cfg.decisions?.length ?? 0, s = cfg.sections?.length ?? 0;
  const count = [d ? `${d} decision${d === 1 ? '' : 's'}` : '', s ? `${s} to review` : ''].filter(Boolean).join(', ');
  const topic = cfg.origin?.topic;
  return `<header class="fe-dp-head">
      <div class="fe-dp-titlebar">
        <h1 class="fe-dp-title">${esc(cfg.title || 'Decisions')}</h1>
        <button type="button" id="fe-dp-files" class="btn" data-variant="outline" data-size="sm" data-tone="accent" data-docview-files title="Show the files in this folder">${UI_ICON.list}Files</button>
      </div>
      ${topic ? `<p class="fe-dp-topicline"><span class="fe-dp-topic" title="Topic">${esc(topic)}</span></p>` : ''}
      <p class="fe-dp-origin">${boardLinkHtml(cfg.origin)}${originFacts(cfg.origin).map(f => `<button type="button" class="fe-dp-fact" data-fact="${esc(f.label.toLowerCase())}" data-copy="${esc(f.copy)}"${f.copyName ? ` data-copy-name="${esc(f.copyName)}"` : ''} title="${esc(`${f.title ?? f.label}. Click to copy ${f.copyName ?? f.copy}`)}">${esc(f.value)}</button>`).join('')}<span class="fe-dp-count">${esc(count)}</span></p>
      ${cfg.intro ? `<div class="fe-dp-intro">${clampHtml(renderMarkdown(cfg.intro, base), 2)}</div>` : ''}
    </header>
    ${sentHtml()}
    <div class="fe-dp-bar" id="fe-dp-bar">
      <span id="fe-dp-meter"></span>
      <span class="fe-dp-progress" id="fe-dp-progress" aria-live="polite"></span>
      ${cfg.notes !== false ? '<button type="button" class="btn" data-variant="ghost" data-size="sm" id="fe-dp-notes" aria-pressed="false" title="Show a note field on every card (m)">Notes</button>' : ''}
      <button type="button" class="btn" data-variant="ghost" data-size="sm" id="fe-dp-marks" aria-pressed="true" title="Show or hide the marks on every picture" hidden>Marks</button>
      <button type="button" class="btn" data-variant="ghost" data-size="sm" id="fe-dp-flagged" aria-pressed="false" title="Show only the cards you changed or noted (f)">Flagged only</button>
      <button type="button" class="btn" data-variant="ghost" data-size="sm" id="fe-dp-reset" title="Put every answer back as drafted">Reset</button>
      <span class="fe-dp-bar-gap"></span>${answerBarHtml()}
    </div>
    ${answerPanelHtml()}`;
}

/** The rail's rows: every decision and item under its group, before any answer is drawn. */
function outlineItems(cfg: DpConfig): OutlineItem[] {
  return [
    ...(cfg.decisions ?? []).map(d => ({ id: d.id, label: d.question, group: 'Decisions' })),
    ...(cfg.sections ?? []).map(x => ({ id: x.id, label: x.title || x.id, group: sectionGroup(x) })),
  ];
}

/** slug: the page's name in gcc's registry when the caller knows it; otherwise read from a registry path. */
export interface DpCtx extends DocViewCtx { slug?: string }

/** The decision-page view: claims a folder holding a config.json and mounts when that config lists decisions or sections. */
export const decisionPageView: DocView<DpCtx> = {
  id: 'decision-page',
  on: 'folder',
  claims: (_p, names) => names.includes('config.json'),
  async mount({ root: box, base, path, toast, slug: given }) {
    let cfg: DpConfig | null = null;
    try { cfg = parseDpConfig(await dpIo().text(base + 'config.json')); } catch { cfg = null; }
    if (!cfg) return false;
    // Opening a page that lives in gcc's registry tells gcc it was seen (gcc
    // keeps the first time); a failure leaves the lens's "not opened yet" dot.
    const slug = given ?? path.match(/\/decision-pages\/([^/]+)\/$/)?.[1];
    if (slug) dpIo().dp('seen', slug).catch(() => {});

    box.innerHTML = `<div class="fe-dp-layout">
        <div class="fe-dp-col">${headHtml(cfg, base)}<div id="fe-dp-body">${bodyHtml(cfg, base)}</div></div>
        <aside class="fe-dp-side">${outlineHtml(outlineItems(cfg), 'On this page')}</aside>
      </div>`;
    if (cfg.accent) box.style.setProperty('--ac', cfg.accent);
    wireAnswers(cfg, box, slug, base, toast);
    wireMedia(box, toast);
    wireClamps(box);
    // A fact under the title copies its bare value: the project path, the session, the goal id.
    box.querySelector('.fe-dp-origin')?.addEventListener('click', e => {
      const f = (e.target as HTMLElement).closest<HTMLElement>('.fe-dp-fact');
      if (f) void copyWithCheck(f, f.dataset.copy!).then(ok => toast(ok ? `Copied ${f.dataset.copyName ?? f.dataset.copy}` : 'Copy failed'));
    });
    // Marks on every picture show or hide together, remembered across pages.
    const marksBtn = box.querySelector<HTMLElement>('#fe-dp-marks')!;
    if (box.querySelector('.fe-dv-media[data-marks]')) {
      const off = flagPref('bfb-dp-marks-off', false);
      const set = (on: boolean) => { showMarks(box, on); marksBtn.setAttribute('aria-pressed', String(on)); off.set(!on); };
      marksBtn.hidden = false;
      marksBtn.addEventListener('click', () => set(box.classList.contains('marks-off')));
      set(!off.get());
    }
    return true;
  },
};

/**
 * Make the cards answerable: picks, agrees and notes start as drafted or as
 * last saved, every change is saved at once and marks its card and its rail
 * row, and the page's keys act on the focused card. The answer panel, Copy and
 * Submit hear about every change (dp-answer.ts).
 */
function wireAnswers(cfg: DpConfig, box: HTMLElement, slug: string | undefined, base: string, toast: (m: string) => void): void {
  const key = stateKey(cfg);
  const saved = jsonPref<Partial<DpState> | null>(key, null, v => v === null || typeof v === 'object');
  const editedAt = jsonPref<number>(key.replace('bfb-dp-answers:', 'bfb-dp-edited:'), 0, v => typeof v === 'number');
  const folded = jsonPref<string[]>(key.replace('bfb-dp-answers:', 'bfb-dp-folded:'), [], Array.isArray);
  const notesOn = flagPref('bfb-dp-notes-on', false);
  const notesAllowed = cfg.notes !== false;
  let state = restoreState(cfg, saved.get());
  const rail = box.querySelector<HTMLElement>('.fe-dv-outline')!;
  const cards = () => [...box.querySelectorAll<HTMLElement>('.fe-dp-card')];
  const card = (id: string) => cards().find(c => c.dataset.id === id);

  const showNote = (c: HTMLElement, on: boolean) => {
    const wrap = c.querySelector<HTMLElement>('.fe-dp-note'), add = c.querySelector<HTMLElement>('.fe-dp-addnote');
    if (!wrap || !add) return;
    wrap.hidden = !on;
    add.setAttribute('aria-pressed', String(on));
  };
  const mark = (c: HTMLElement) => {
    const id = c.dataset.id!;
    const flag = flagOf(cfg, state, id);
    if (flag) c.dataset.flag = flag; else delete c.dataset.flag;
    const ta = c.querySelector<HTMLTextAreaElement>('textarea[data-note]');
    if (ta) c.classList.toggle('has-note', !!ta.value.trim());
    const value = c.dataset.kind === 'decision' ? state.picks[id] ?? '' : state.agree[id] === false ? 'no' : '';
    updateOutline(rail, id, { state: flag ?? 'drafted', value });
  };
  const tally = () => {
    const p = progress(cfg, state);
    const ids = cards().map(c => c.dataset.id!);
    const n = (f: string | null) => ids.filter(id => flagOf(cfg, state, id) === f).length;
    box.querySelector('#fe-dp-meter')!.innerHTML = meterHtml([
      { state: 'changed', n: n('changed'), label: 'changed' },
      { state: 'noted', n: n('noted'), label: 'noted' },
      { state: 'drafted', n: n(null), label: 'as drafted' },
    ], '', `${p.items} items`);
    box.querySelector('#fe-dp-progress')!.textContent = p.asDrafted ? `${p.items} items · all as drafted` : `${p.items} items · ${p.flagged} flagged`;
  };
  // Draw the whole state onto the cards: used on load and after Reset.
  const paint = () => {
    for (const c of cards()) {
      const id = c.dataset.id!;
      if (c.dataset.kind === 'decision') for (const r of c.querySelectorAll<HTMLInputElement>('input[type="radio"]')) r.checked = r.value === state.picks[id];
      const sw = c.querySelector<HTMLInputElement>('.fe-dp-agree-sw');
      if (sw) { sw.checked = state.agree[id] !== false; c.classList.toggle('disagree', !sw.checked); }
      const ta = c.querySelector<HTMLTextAreaElement>('textarea[data-note]');
      if (ta) { ta.value = state.notes[id] ?? ''; showNote(c, notesOn.get() || !!ta.value.trim()); }
      mark(c);
    }
    const end = box.querySelector<HTMLTextAreaElement>('#fe-dp-endnotes');
    if (end) end.value = state.endNotes;
    box.querySelector('#fe-dp-notes')?.setAttribute('aria-pressed', String(notesOn.get()));
    tally();
    answer?.changed();
  };
  const save = () => { saved.set(state); editedAt.set(Date.now()); tally(); answer?.changed(); };
  let answer: ReturnType<typeof wireAnswer> | null = null;

  // Folded groups stay folded across visits.
  const shut = new Set(folded.get());
  for (const g of box.querySelectorAll<HTMLDetailsElement>('.fe-dp-grp')) {
    if (shut.has(g.dataset.grp!)) g.open = false;
    g.addEventListener('toggle', () => {
      if (g.open) shut.delete(g.dataset.grp!); else shut.add(g.dataset.grp!);
      folded.set([...shut]);
    });
  }

  box.addEventListener('change', e => {
    const t = e.target as HTMLInputElement;
    const c = t.closest<HTMLElement>('.fe-dp-card');
    if (!c) return;
    if (t.type === 'radio') state.picks[c.dataset.id!] = t.value;
    else if (t.classList.contains('fe-dp-agree-sw')) { state.agree[c.dataset.id!] = t.checked; c.classList.toggle('disagree', !t.checked); }
    else return;
    focusCard(c, false);
    mark(c); save();
  });
  box.addEventListener('input', e => {
    const t = e.target as HTMLTextAreaElement;
    if (t.id === 'fe-dp-endnotes') { state.endNotes = t.value; save(); return; }
    const c = t.closest<HTMLElement>('.fe-dp-card');
    if (!c || !t.dataset.note) return;
    state.notes[t.dataset.note] = t.value;
    mark(c); save();
  });
  box.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const add = t.closest<HTMLElement>('.fe-dp-addnote');
    const c = t.closest<HTMLElement>('.fe-dp-card');
    if (add && c) { toggleNote(c); return; }
    const raw = t.closest<HTMLElement>('.fe-dp-rawbtn');
    if (raw) {
      const box = raw.closest<HTMLElement>('.fe-dp-preview')!;
      box.dataset.view = box.dataset.view === 'raw' ? 'md' : 'raw';
      raw.setAttribute('aria-pressed', String(box.dataset.view === 'raw'));
    }
    // Clicking a card makes it the one the keys act on; a field keeps its own focus.
    if (c && !t.closest('input, textarea, a, button, label')) focusCard(c, false);
    else if (c) setCurrent(c);
  });

  let current: HTMLElement | null = null;
  let markRail = () => {};
  const setCurrent = (c: HTMLElement) => {
    if (current === c) return;
    current?.classList.remove('current');
    current = c; c.classList.add('current');
    markRail();
  };
  const focusCard = (c: HTMLElement, scroll = true) => {
    setCurrent(c);
    c.focus({ preventScroll: true });
    if (scroll) c.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  const openNote = (c: HTMLElement) => {
    if (!notesAllowed) return;
    showNote(c, true);
    setCurrent(c);
    c.querySelector<HTMLTextAreaElement>('textarea[data-note]')?.focus();
  };
  // The note button opens the note; pressed again on an empty note, it closes it.
  const toggleNote = (c: HTMLElement) => {
    const wrap = c.querySelector<HTMLElement>('.fe-dp-note');
    if (wrap && !wrap.hidden && !notesOn.get() && !c.querySelector<HTMLTextAreaElement>('textarea[data-note]')?.value.trim()) showNote(c, false);
    else openNote(c);
  };
  // A rail row opens the card's group if it was folded, then goes to the card.
  markRail = followOutline(rail, box, cards(), id => {
    const c = card(id);
    if (!c) return;
    const g = c.closest<HTMLDetailsElement>('details');
    if (g && !g.open) g.open = true;
    focusCard(c);
  }, () => current);
  // The cards the keys move through: the visible ones, skipping folded groups and, in Flagged only, unflagged cards.
  const reachable = () => cards().filter(c => c.offsetParent !== null);
  const step = (by: number) => {
    const list = reachable();
    if (!list.length) return;
    const at = current ? list.indexOf(current) : -1;
    focusCard(list[Math.max(0, Math.min(list.length - 1, at < 0 ? (by > 0 ? 0 : list.length - 1) : at + by))]);
  };
  const flaggedOnly = (on: boolean) => {
    box.classList.toggle('flagged-only', on);
    box.querySelector('#fe-dp-flagged')!.setAttribute('aria-pressed', String(on));
  };
  const allNotes = (on: boolean) => {
    if (!notesAllowed) return;
    notesOn.set(on);
    for (const c of cards()) showNote(c, on || !!c.querySelector<HTMLTextAreaElement>('textarea[data-note]')?.value.trim());
    box.querySelector('#fe-dp-notes')?.setAttribute('aria-pressed', String(on));
  };
  box.querySelector('#fe-dp-notes')?.addEventListener('click', () => allNotes(!notesOn.get()));
  box.querySelector('#fe-dp-flagged')!.addEventListener('click', () => flaggedOnly(!box.classList.contains('flagged-only')));
  box.querySelector('#fe-dp-reset')!.addEventListener('click', () => {
    if (!confirm('Put every answer back as drafted? Your picks and notes on this page are cleared.')) return;
    state = draftedState(cfg);
    saved.set(null);
    editedAt.set(Date.now());
    paint();
  });
  answer = wireAnswer(cfg, box, slug, base, {
    state: () => state,
    // The sent answer refills the form; it is not an edit, so the edit time stays.
    replace: s => { state = s; saved.set(state); paint(); },
    editedAt: () => editedAt.get(),
  }, toast);

  const live = () => !box.hidden;
  bind('dp-next', () => step(1), live);
  bind('dp-prev', () => step(-1), live);
  bind('dp-first', () => { const l = reachable(); if (l[0]) focusCard(l[0]); }, live);
  bind('dp-last', () => { const l = reachable(); if (l.length) focusCard(l[l.length - 1]); }, live);
  bind('dp-pick', k => {
    const n = Number(k?.slice(-1));
    const r = current?.dataset.kind === 'decision' ? current.querySelectorAll<HTMLInputElement>('input[type="radio"]')[n - 1] : undefined;
    if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
  }, () => live() && current?.dataset.kind === 'decision');
  bind('dp-agree', () => {
    const sw = current?.querySelector<HTMLInputElement>('.fe-dp-agree-sw');
    if (sw) { sw.checked = !sw.checked; sw.dispatchEvent(new Event('change', { bubbles: true })); }
  }, () => live() && current?.dataset.kind === 'section');
  bind('dp-note', () => current && openNote(current), () => live() && notesAllowed && !!current);
  bind('dp-notes-all', () => allNotes(!notesOn.get()), () => live() && notesAllowed);
  bind('dp-end-notes', () => { const end = box.querySelector<HTMLTextAreaElement>('#fe-dp-endnotes'); end?.scrollIntoView({ block: 'center' }); end?.focus(); }, () => live() && notesAllowed);
  bind('dp-flagged', () => flaggedOnly(!box.classList.contains('flagged-only')), live);
  bind('dp-theme', () => runCommand('theme'), live);
  bind('dp-panel', () => answer?.togglePanel(), live);
  bind('dp-copy', () => void answer?.copy(), live);
  bind('dp-submit', () => void answer?.submit(), live);
  // Esc shrinks grown pictures first, then leaves a note for its card.
  const typingNote = () => !!(document.activeElement as HTMLElement | null)?.closest('#fe-dp textarea');
  bind('dp-esc', () => {
    if (unzoomAll(box)) return;
    const c = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.fe-dp-card');
    (document.activeElement as HTMLElement | null)?.blur();
    if (c) focusCard(c, false);
  }, () => live() && (typingNote() || !!box.querySelector('.zoomed')));

  paint();
}
