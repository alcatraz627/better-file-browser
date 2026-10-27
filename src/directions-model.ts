// What a rendered directions doc says, read once into plain records: its
// sections (directions, goals, the Waiting-on-you table) and its task rows
// with their state, when, and the owner's ask. The head, the views and the
// outline all read this, so they agree on what each row is. Docs drift from
// the standard shape, so a state can come from a mark, from a word in a state
// column, or from sitting under "Waiting on you"; a row with none is kept as
// unmarked rather than dropped.
import { rowState, type DirState } from './directions';

export type DirWhen = 'now' | 'next' | 'later';
export type SectionKind = 'direction' | 'goal' | 'waiting' | 'plain';

export interface DirSection {
  el: HTMLElement;
  level: number;
  title: string;
  kind: SectionKind;
  /** The "accepted when" or "done when" line under it, if the doc has one. */
  accepted: string;
  parent: DirSection | null;
}

export interface DirRow {
  el: HTMLTableRowElement;
  /** A short id from the first cell ("B5", "#12", "H3"), or empty. */
  id: string;
  state: DirState | null;
  when: DirWhen | null;
  /** What the row is about: its ask, task or item cell. */
  text: string;
  /** From a Waiting-on-you table: what the owner must do or give, and what happens if they say nothing. */
  need: string;
  silent: string;
  section: DirSection | null;
  /** The row sits in the doc's Waiting-on-you table. */
  asks: boolean;
  /** The row only names a section of the doc (an overview line), rather than being a task. */
  summary: boolean;
}

export interface DirModel {
  sections: DirSection[];
  rows: DirRow[];
  lastUpdated: Date | null;
}

const WHEN_MARKS: [string, DirWhen][] = [['⏩', 'now'], ['⏭', 'next'], ['⏸', 'later']];
const STATE_WORDS: [RegExp, DirState][] = [
  [/\b(needs you|blocked on you|on you)\b/i, 'needs'],
  [/\b(waiting|running|in progress|in review|blocked)\b/i, 'waiting'],
  [/\b(ready)\b/i, 'ready'],
  [/\b(parked|paused|deferred)\b/i, 'parked'],
  [/\b(done|shipped|merged|closed)\b/i, 'done'],
];
// A row naming three marks of one set is the doc's key to them, not a task.
const KEY_SETS = [['🔴', '🟠', '🟢', '💤', '✅'], ['⏩', '⏭', '⏸'], ['🗣', '📏', '💭'], ['🧭', '🎯', '✅', '🕳']];
const isAskHeading = (t: string) => /\b(waiting on you|needs you|for you)\b/i.test(t);
const clean = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim();

/** A row's when, from a mark or a when-column word. */
export function whenOf(text: string): DirWhen | null {
  for (const [m, w] of WHEN_MARKS) if (text.includes(m)) return w;
  return null;
}

/** A state written as a word, for docs whose state cells carry no mark. */
export function stateWord(text: string): DirState | null {
  for (const [re, s] of STATE_WORDS) if (re.test(text)) return s;
  return null;
}

/** A section's kind, from its heading's mark or words. */
export function sectionKind(title: string): SectionKind {
  if (isAskHeading(title)) return 'waiting';
  if (title.includes('🧭')) return 'direction';
  if (title.includes('🎯')) return 'goal';
  // A numbered section ("1. Hotfixes") is a bucket, the older docs' word for a direction.
  if (/^\d+[.)]\s+\S/.test(title)) return 'direction';
  return 'plain';
}

/** The date in a "Last updated" line, if the doc has one. */
export function lastUpdatedOf(text: string): Date | null {
  const m = text.match(/last updated:?\s*\**\s*(\d{4}-\d\d-\d\d)/i);
  if (!m) return null;
  const d = new Date(m[1] + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

/** Read a rendered directions doc. Pure over the DOM: it changes nothing. */
export function readDirections(root: HTMLElement): DirModel {
  const sections: DirSection[] = [];
  const rows: DirRow[] = [];
  const stack: DirSection[] = [];
  let lastUpdated: Date | null = null;

  for (const p of root.querySelectorAll<HTMLElement>('p, li')) {
    lastUpdated = lastUpdatedOf(p.textContent ?? '');
    if (lastUpdated) break;
  }

  // Walk the doc in order so each table knows the heading above it.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: n => /^(H[23]|TABLE|P|LI)$/.test((n as Element).tagName) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
  });
  for (let n = walker.nextNode() as HTMLElement | null; n; n = walker.nextNode() as HTMLElement | null) {
    if (/^H[23]$/.test(n.tagName)) {
      const level = Number(n.tagName[1]);
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      const title = clean(n.firstChild?.textContent ?? n.textContent);
      const s: DirSection = { el: n, level, title, kind: sectionKind(title), accepted: '', parent: stack[stack.length - 1] ?? null };
      sections.push(s);
      stack.push(s);
      continue;
    }
    const section = stack[stack.length - 1] ?? null;
    if (n.tagName === 'P' || n.tagName === 'LI') {
      const t = clean(n.textContent);
      if (section && !section.accepted && /^(✅|accepted when|done when)/i.test(t)) section.accepted = t.replace(/^✅\s*/, '').replace(/^(accepted|done) when\s*:?\s*/i, '');
      continue;
    }
    readTable(n as HTMLTableElement, section, rows);
  }
  // Overview rows name a section ("🧭 Seeds", "1 | Hotfixes"); they summarise it rather than add a task.
  const bare = (t: string) => t.replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u23E9-\u23FA\uFE0F]/gu, '').replace(/^\s*\d+[.)]?\s*/, '').trim().toLowerCase();
  const titles = new Set(sections.map(s => bare(s.title)).filter(Boolean));
  for (const r of rows) {
    const cells = [...r.el.cells].slice(0, 2).map(td => bare(td.textContent ?? ''));
    r.summary = cells.some(c => c && titles.has(c));
  }
  return { sections, rows, lastUpdated };
}

function readTable(table: HTMLTableElement, section: DirSection | null, out: DirRow[]): void {
  const heads = [...table.querySelectorAll('thead th')].map(th => clean(th.textContent).toLowerCase());
  const col = (re: RegExp) => heads.findIndex(h => re.test(h));
  const cText = col(/^(ask|task|item|what|finding|bucket|direction|goal)\b/);
  const cNeed = col(/what i need|need from you/);
  const cSilent = col(/say nothing|silent/);
  const cState = col(/^(state|status)\b/);
  const cWhen = col(/^when\b/);
  // An ask table also counts when the heading two levels up names it.
  const asks = !!section && (section.kind === 'waiting' || (section.parent?.kind === 'waiting'));
  for (const tr of table.querySelectorAll<HTMLTableRowElement>('tbody tr')) {
    const cells = [...tr.cells].map(td => clean(td.textContent));
    const all = cells.join(' | ');
    // The doc's own key to its marks is not a task.
    if (KEY_SETS.some(set => set.filter(m => all.includes(m)).length >= 3)) continue;
    const first = cells[0] ?? '';
    const id = first.length <= 12 && /^[`#]?[A-Za-z]{0,3}\d{1,4}[a-z]?`?$/.test(first) ? first.replace(/`/g, '') : '';
    const state = rowState(all)
      ?? (cState >= 0 ? stateWord(cells[cState] ?? '') : null)
      ?? (asks ? 'needs' : null);
    const when = whenOf(all) ?? (cWhen >= 0 ? (/\bnow\b/i.test(cells[cWhen]) ? 'now' : /\bnext\b/i.test(cells[cWhen]) ? 'next' : /\blater\b/i.test(cells[cWhen]) ? 'later' : null) : null);
    const longest = cells.reduce((a, b) => (b.length > a.length ? b : a), '');
    // A text column holding only the id ("Item: H1") hands over to the next cell.
    const textCol = cText >= 0 && id && cells[cText] === first ? cText + 1 : cText;
    const text = textCol >= 0 ? cells[textCol] : (cells.length > 1 && id ? cells.slice(1).reduce((a, b) => (b.length > a.length ? b : a), '') : longest);
    out.push({
      el: tr, id, state, when, text: text ?? '',
      need: cNeed >= 0 ? cells[cNeed] ?? '' : '',
      silent: cSilent >= 0 ? cells[cSilent] ?? '' : '',
      section, asks, summary: false,
    });
  }
}
