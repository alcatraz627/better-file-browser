// How the items of a doc view stand, drawn three ways that share one tone per
// state: a pill naming one item's state, a meter of how a group of items
// stands, and a bar of filter chips that narrows the view to one state.
// Tones come from `[data-state]` in the stylesheet, so a view picks state
// names and gets their colours.
import { esc } from './utils';

export interface Tally { state: string; n: number; label: string }

/** A small pill naming one item's state, dot first. */
export const pillHtml = (state: string, label: string): string =>
  `<span class="chip fe-dv-pill" data-size="sm" data-fill data-state="${esc(state)}"><i></i><span>${esc(label)}</span></span>`;

/**
 * A meter of a group: one equal segment per item, grouped by state in the
 * order given, then a short caption. Empty when there are no items.
 */
export function meterHtml(parts: Tally[], caption: string, title = caption): string {
  if (!parts.some(p => p.n)) return '';
  const segs = parts.filter(p => p.n).map(p => `<i data-state="${esc(p.state)}" title="${p.n} ${esc(p.label)}"></i>`.repeat(p.n)).join('');
  return `<span class="fe-dv-meter" title="${esc(title)}"><span class="fe-dv-bar">${segs}</span><span class="fe-dv-meter-n">${esc(caption)}</span></span>`;
}

/** A bar of chips, one per state with items, each counting them; `extra` follows the chips. */
export function chipBarHtml(parts: Tally[], extra = ''): string {
  return parts.filter(p => p.n).map(p =>
    `<button type="button" class="chip fe-dv-chip" data-state="${esc(p.state)}" aria-pressed="false" title="Show only ${esc(p.label)}"><i></i><span>${esc(p.label)}</span><b>${p.n}</b></button>`).join('') + extra;
}

/** Make a chip bar a single-choice filter: a press picks its state, a second press clears it. */
export function wireChipBar(bar: HTMLElement, pick: (state: string) => void): void {
  bar.addEventListener('click', e => {
    const chip = (e.target as Element).closest<HTMLElement>('.fe-dv-chip');
    if (!chip) return;
    const on = chip.getAttribute('aria-pressed') !== 'true';
    bar.querySelectorAll('.fe-dv-chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', String(on));
    pick(on ? chip.dataset.state! : '');
  });
}
