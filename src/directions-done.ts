// What "done" means for a goal, said tersely: the goal's accepted-when line
// becomes a short row of the bars it names (code complete, exercised by the
// agent, reviewed, tested, deployed), each ticked once a finished row of that
// goal says so. A goal whose line names none of them keeps its own words.
// Nothing is invented for a goal without an accepted-when line.
import { esc } from './utils';
import type { DirModel, DirSection } from './directions-model';

export interface DoneLevel { id: string; label: string; re: RegExp }
export const DONE_LEVELS: DoneLevel[] = [
  { id: 'code', label: 'code complete', re: /\b(code complete|implemented|built)\b/i },
  { id: 'exercised', label: 'exercised', re: /\b(exercised|smoke[- ]?tested|ran it|run by the agent)\b/i },
  { id: 'reviewed', label: 'reviewed', re: /\breview(ed)?\b/i },
  { id: 'tested', label: 'tested', re: /\b(tested|tests? pass(es)?|suites? pass(es)?)\b/i },
  { id: 'deployed', label: 'deployed', re: /\b(deploy(ed)?|in production|shipped|live)\b/i },
];

/** The bars an accepted-when line names, in the order work reaches them. */
export function doneLevels(text: string): DoneLevel[] {
  return DONE_LEVELS.filter(l => l.re.test(text));
}

const inGoal = (s: DirSection | null, g: DirSection) => { for (let x = s; x; x = x.parent) if (x === g) return true; return false; };

/** Add the done-when line under every goal that has one. Safe to call again. */
export function markDone(m: DirModel): void {
  for (const g of m.sections) {
    if (!g.accepted || g.el.nextElementSibling?.classList.contains('fe-dir-done')) continue;
    const levels = doneLevels(g.accepted);
    const finished = m.rows.filter(r => r.state === 'done' && inGoal(r.section, g)).map(r => r.text + ' ' + (r.el.textContent ?? ''));
    const body = levels.length
      ? levels.map(l => {
        const met = finished.some(t => l.re.test(t));
        return `<span class="chip fe-dir-done-l" data-size="sm"${met ? ' data-met' : ''} title="${met ? 'A finished row says so' : 'Not yet'}">${met ? '✓ ' : ''}${esc(l.label)}</span>`;
      }).join('')
      : `<span class="fe-dir-done-t">${esc(g.accepted.length > 140 ? g.accepted.slice(0, 139) + '…' : g.accepted)}</span>`;
    const line = document.createElement('div');
    line.className = 'fe-dir-done';
    line.title = g.accepted;
    line.innerHTML = `<span class="fe-dir-done-k">Done when</span>${body}`;
    g.el.after(line);
    // The doc's own line says the same at length; it stays in the doc, folded behind the terse one.
    for (let n = line.nextElementSibling; n && !/^H[1-6]$/.test(n.tagName); n = n.nextElementSibling) {
      if (/^\s*(✅|accepted when|done when)/i.test(n.textContent ?? '')) { n.classList.add('fe-dir-done-src'); break; }
    }
  }
}
