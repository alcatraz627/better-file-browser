// What the owner has answered on a decision page, as plain data: every pick,
// agree and note, the drafted answers they started from, and which items
// they changed. The page draws from this and saves it; gcc turns it into the
// answer string. No DOM here, so it is unit-tested on its own.
import type { DpConfig, DpDecision } from './dp-page';

export interface DpState {
  picks: Record<string, string>;     // decision id → option code
  agree: Record<string, boolean>;    // section id → agreed as drafted
  notes: Record<string, string>;     // item id → note text
  endNotes: string;                  // the "Notes for Claude" card
}

/** The code a decision's built-in "None of these" option answers with. */
export const noneCode = (d: DpDecision): string => d.noneCode || 'z';

/** The answers as drafted: each decision on its recommended option, every section agreed, seeded notes in place. */
export function draftedState(cfg: DpConfig): DpState {
  const s: DpState = { picks: {}, agree: {}, notes: {}, endNotes: '' };
  for (const d of cfg.decisions ?? []) {
    const rec = d.options.find(o => o.rec) ?? d.options[0];
    if (rec) s.picks[d.id] = rec.code;
    if (d.note) s.notes[d.id] = d.note;
  }
  for (const x of cfg.sections ?? []) {
    s.agree[x.id] = true;
    if (x.note) s.notes[x.id] = x.note;
  }
  return s;
}

/** A saved state laid over the drafted one, keeping only answers this config still has. */
export function restoreState(cfg: DpConfig, saved: Partial<DpState> | null | undefined): DpState {
  const s = draftedState(cfg);
  if (!saved) return s;
  for (const d of cfg.decisions ?? []) {
    const code = saved.picks?.[d.id];
    if (code && (d.options.some(o => o.code === code) || (d.none && code === noneCode(d)))) s.picks[d.id] = code;
  }
  for (const x of cfg.sections ?? []) if (typeof saved.agree?.[x.id] === 'boolean') s.agree[x.id] = saved.agree[x.id];
  for (const [id, text] of Object.entries(saved.notes ?? {})) if (typeof text === 'string' && (s.picks[id] !== undefined || s.agree[id] !== undefined)) s.notes[id] = text;
  if (typeof saved.endNotes === 'string') s.endNotes = saved.endNotes;
  return s;
}

/** How an item differs from its draft: a changed answer, an added or edited note, or neither. */
export function flagOf(cfg: DpConfig, s: DpState, id: string): 'changed' | 'noted' | null {
  const draft = draftedState(cfg);
  const changed = (id in s.picks && s.picks[id] !== draft.picks[id]) || (id in s.agree && s.agree[id] !== draft.agree[id]);
  if (changed) return 'changed';
  const note = (s.notes[id] ?? '').trim();
  return note && note !== (draft.notes[id] ?? '').trim() ? 'noted' : null;
}

/** The progress read: how many items, how many flagged, and whether everything stands as drafted. */
export function progress(cfg: DpConfig, s: DpState): { items: number; flagged: number; asDrafted: boolean } {
  const ids = [...(cfg.decisions ?? []).map(d => d.id), ...(cfg.sections ?? []).map(x => x.id)];
  const flagged = ids.filter(id => flagOf(cfg, s, id)).length;
  return { items: ids.length, flagged, asDrafted: flagged === 0 && !s.endNotes.trim() };
}

/** Where a page's answers are kept: by its storage key, else its title, as the old page did. The store keeps only bfb- keys. */
export const stateKey = (cfg: DpConfig): string => 'bfb-dp-answers:' + (cfg.storageKey || cfg.title || 'untitled');
