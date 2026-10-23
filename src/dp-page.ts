// A decision page: a folder whose config.json lists decisions or sections
// shows as the page an agent asked the owner to answer, in bfb's own shell,
// instead of as a file listing. A Files button switches to the listing and
// back, remembered for this tab. gcc owns the answer itself; this module
// only draws the page (docs: ~/.claude/features/decision-pages.md).
import type { App } from './app';
import { esc } from './utils';
import { renderMarkdown } from './renderers';
import { fetchFileText } from './file-fetch';
import { textPref, jsonPref, flagPref } from './storage';
import { bind, runCommand } from './commands';
import { bodyHtml } from './dp-cards';
import { wireGallery, unzoomAll, viewerOpen, viewerStep } from './dp-gallery';
import { restoreState, draftedState, flagOf, progress, stateKey, type DpState } from './dp-form';

export interface DpOption { code: string; label: string; rec?: boolean; why?: string; images?: string[] }
export interface DpDecision { id: string; question: string; context?: string; note?: string; group?: string; images?: string[]; none?: boolean; noneLabel?: string; noneCode?: string; options: DpOption[] }
export interface DpSection { id: string; group?: string; title?: string; prio?: string; read?: string; pre?: string; images?: string[]; note?: string; slots?: Record<string, string> }
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

/** The origin facts worth a chip, in reading order. */
export function originChips(o: DpOrigin | undefined): { label: string; value: string }[] {
  if (!o) return [];
  const rows: [string, string | undefined][] = [['Topic', o.topic], ['Project', o.project], ['Session', o.session], ['Goal', o.goal], ['Milestone', o.milestone], ['Card', o.card], ['Asked', o.created]];
  return rows.filter((r): r is [string, string] => !!r[1]).map(([label, value]) => ({ label, value }));
}

function headHtml(cfg: DpConfig, base: string): string {
  const d = cfg.decisions?.length ?? 0, s = cfg.sections?.length ?? 0;
  const count = [d ? `${d} decision${d === 1 ? '' : 's'}` : '', s ? `${s} item${s === 1 ? '' : 's'} to review` : ''].filter(Boolean).join(' · ');
  return `<header class="fe-dp-head">
      <div class="fe-dp-titlebar">
        <h1 class="fe-dp-title">${esc(cfg.title || 'Decisions')}</h1>
        <button type="button" id="fe-dp-files" class="btn" data-variant="outline" title="Show the files in this folder">Files</button>
      </div>
      ${originChips(cfg.origin).length ? `<div class="fe-dp-origin">${originChips(cfg.origin).map(c => `<span class="chip" title="${esc(c.label)}"><b>${esc(c.label)}</b>${esc(c.value)}</span>`).join('')}</div>` : ''}
      ${cfg.intro ? `<div class="fe-dp-intro">${renderMarkdown(cfg.intro, base)}</div>` : ''}
      <p class="fe-dp-count">${esc(count)}</p>
    </header>
    <div class="fe-dp-bar" id="fe-dp-bar">
      <span class="fe-dp-progress" id="fe-dp-progress" aria-live="polite"></span>
      ${cfg.notes !== false ? '<button type="button" class="btn" data-variant="ghost" data-size="sm" id="fe-dp-notes" aria-pressed="false" title="Show a note field on every card (m)">Notes</button>' : ''}
      <button type="button" class="btn" data-variant="ghost" data-size="sm" id="fe-dp-flagged" aria-pressed="false" title="Show only the cards you changed or noted (f)">Flagged only</button>
      <button type="button" class="btn" data-variant="ghost" data-size="sm" id="fe-dp-reset" title="Put every answer back as drafted">Reset</button>
    </div>`;
}

/**
 * Show this folder as a decision page when its config.json is one. Until the
 * config is read the listing stays out of sight, so a decision page never
 * flashes its file list first; any other folder gets the listing back at once.
 */
export async function mountDecisionPage(app: App): Promise<DpConfig | null> {
  const fe = app.fe;
  const box = document.getElementById('fe-dp');
  if (app.fileMode || !box || !app.entryNames.includes('config.json')) return null;
  fe.classList.add('fe-dp-pending');
  const base = 'file://' + app.rawPath.split('/').map(encodeURIComponent).join('/');
  let cfg: DpConfig | null = null;
  try { cfg = parseDpConfig(await fetchFileText(base + 'config.json')); } catch { cfg = null; }
  fe.classList.remove('fe-dp-pending');
  if (!cfg) return null;

  const filesPref = textPref('bfb-dp-files:' + app.rawPath, '', 'tab');
  box.innerHTML = headHtml(cfg, base) + `<div id="fe-dp-body">${bodyHtml(cfg, base)}</div>`;
  if (cfg.accent) box.style.setProperty('--ac', cfg.accent);
  wireAnswers(cfg, box);
  wireGallery(box, m => app.toast(m));
  // Back from the listing: one button at the end of the listing's toolbar.
  const back = document.createElement('button');
  back.type = 'button'; back.id = 'fe-dp-back'; back.className = 'btn'; back.dataset.variant = 'outline';
  back.title = 'Show this folder as its decision page'; back.textContent = 'Decision page';
  document.getElementById('fe-toolbar')?.append(back);
  const show = (page: boolean) => {
    fe.classList.toggle('fe-dp-page', page);
    box.hidden = !page;
    back.hidden = page;
    filesPref.set(page ? '' : '1');
  };
  document.getElementById('fe-dp-files')!.addEventListener('click', () => show(false));
  back.addEventListener('click', () => show(true));
  show(filesPref.get() !== '1');
  return cfg;
}

/**
 * Make the cards answerable: picks, agrees and notes start as drafted or as
 * last saved, every change is saved at once and marks its card, and the
 * page's keys act on the focused card.
 */
function wireAnswers(cfg: DpConfig, box: HTMLElement): void {
  const key = stateKey(cfg);
  const saved = jsonPref<Partial<DpState> | null>(key, null, v => v === null || typeof v === 'object');
  const folded = jsonPref<string[]>(key.replace('bfb-dp-answers:', 'bfb-dp-folded:'), [], Array.isArray);
  const notesOn = flagPref('bfb-dp-notes-on', false);
  const notesAllowed = cfg.notes !== false;
  let state = restoreState(cfg, saved.get());
  const cards = () => [...box.querySelectorAll<HTMLElement>('.fe-dp-card')];
  const card = (id: string) => cards().find(c => c.dataset.id === id);

  const showNote = (c: HTMLElement, on: boolean) => {
    const wrap = c.querySelector<HTMLElement>('.fe-dp-note'), add = c.querySelector<HTMLElement>('.fe-dp-addnote');
    if (!wrap || !add) return;
    wrap.hidden = !on; add.hidden = on;
  };
  const mark = (c: HTMLElement) => {
    const id = c.dataset.id!;
    const flag = flagOf(cfg, state, id);
    if (flag) c.dataset.flag = flag; else delete c.dataset.flag;
    const ta = c.querySelector<HTMLTextAreaElement>('textarea[data-note]');
    if (ta) c.classList.toggle('has-note', !!ta.value.trim());
  };
  const tally = () => {
    const p = progress(cfg, state);
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
  };
  const save = () => { saved.set(state); tally(); };

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
    if (add && c) { openNote(c); return; }
    // Clicking a card makes it the one the keys act on; a field keeps its own focus.
    if (c && !t.closest('input, textarea, a, button, label')) focusCard(c, false);
    else if (c) setCurrent(c);
  });

  let current: HTMLElement | null = null;
  const setCurrent = (c: HTMLElement) => {
    if (current === c) return;
    current?.classList.remove('current');
    current = c; c.classList.add('current');
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
    paint();
  });

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
  // Esc shrinks grown pictures first, then leaves a note for its card.
  const typingNote = () => !!(document.activeElement as HTMLElement | null)?.closest('#fe-dp textarea');
  bind('dp-esc', () => {
    if (unzoomAll(box)) return;
    const c = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.fe-dp-card');
    (document.activeElement as HTMLElement | null)?.blur();
    if (c) focusCard(c, false);
  }, () => live() && (typingNote() || !!box.querySelector('.zoomed')));
  bind('dp-view-step', k => viewerStep(k === '←' ? -1 : 1), viewerOpen);

  paint();
}
