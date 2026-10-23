// What we know about an open file, gathered once and shown the same way in
// the preview header, the file bar and the status bar: generic facts for any
// file (kind, size, lines, words, path) plus a few that only make sense for
// its type (headings in markdown, rows and columns in a table, keys in JSON).
import { esc, fmtSize, kindName } from './utils';
import { parseDSV } from './renderers';
import { factIcon } from './control-icons';

export { kindName };
export interface MetaItem { key: string; label: string; value: string }
export interface FileMeta { kind: string; path: string; items: MetaItem[] }

const plural = (n: number, one: string, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export function fileMeta(text: string, ext: string, path: string, bytes = new Blob([text]).size): FileMeta {
  const e = ext.toLowerCase();
  const lines = text ? text.split('\n').length - (text.endsWith('\n') ? 1 : 0) : 0;
  const words = (text.match(/\S+/g) || []).length;
  const items: MetaItem[] = [
    { key: 'size', label: 'Size', value: fmtSize(bytes) },
    { key: 'lines', label: 'Lines', value: plural(lines, 'line') },
  ];
  if (e === 'md' || e === 'mdx' || e === 'txt') items.push({ key: 'words', label: 'Words', value: plural(words, 'word') });
  if (e === 'md' || e === 'mdx') {
    // Headings outside fenced code only.
    let fenced = false, heads = 0;
    for (const l of text.split('\n')) {
      if (/^\s*(```|~~~)/.test(l)) fenced = !fenced;
      else if (!fenced && /^#{1,6}\s/.test(l)) heads++;
    }
    items.push({ key: 'headings', label: 'Headings', value: plural(heads, 'heading') });
  }
  if (e === 'csv' || e === 'tsv') {
    // The table's own parse, so a quoted comma or line break counts as the table shows it.
    const rows = parseDSV(text, e === 'tsv' ? '\t' : ',').filter(r => r.some(c => c.trim()));
    const cols = rows.reduce((w, r) => Math.max(w, r.length), 0);
    items.push({ key: 'rows', label: 'Rows', value: plural(Math.max(0, rows.length - 1), 'row') }, { key: 'cols', label: 'Columns', value: plural(cols, 'column') });
  }
  if (e === 'json' || e === 'jsonc') {
    try {
      const v = JSON.parse(text);
      if (Array.isArray(v)) items.push({ key: 'items', label: 'Items', value: plural(v.length, 'item') });
      else if (v && typeof v === 'object') items.push({ key: 'keys', label: 'Keys', value: plural(Object.keys(v).length, 'top-level key') });
    } catch { /* lax JSON: no count */ }
  }
  return { kind: kindName(e), path, items };
}

// The short form for headers: kind, size, lines.
export function metaSummary(m: FileMeta): string {
  const pick = (k: string) => m.items.find(i => i.key === k)?.value;
  return [m.kind, pick('size'), pick('lines')].filter(Boolean).join(' · ');
}

const ICONS: Record<string, string> = {
  size: '<path d="M2.5 4.5 7 2l4.5 2.5v5L7 12l-4.5-2.5z"/><path d="M2.5 4.5 7 7l4.5-2.5M7 7v5"/>',
  lines: '<path d="M2 3.5h10M2 7h10M2 10.5h6"/>',
  words: '<path d="M2 4h4M2 7h7M2 10h5M10 9.5l1.5 1.5 2-3"/>',
  headings: '<path d="M3 2.5v9M9 2.5v9M3 7h6M11.5 6.5l1.5-1v6"/>',
  rows: '<rect x="1.5" y="2.5" width="11" height="9" rx="1"/><path d="M1.5 5.5h11M1.5 8.5h11"/>',
  cols: '<rect x="1.5" y="2.5" width="11" height="9" rx="1"/><path d="M5.2 2.5v9M8.8 2.5v9"/>',
  items: '<path d="M4 2.5H2.5v9H4M10 2.5h1.5v9H10"/>',
  keys: '<path d="M4.5 2.5c-1.5 0-1.5 1-1.5 2s-1 2-1.5 2.5c.5.5 1.5 1 1.5 2.5s0 2 1.5 2M9.5 2.5c1.5 0 1.5 1 1.5 2s1 2 1.5 2.5c-.5.5-1.5 1-1.5 2.5s0 2-1.5 2"/>',
};
const icon = (k: string) => factIcon(ICONS[k] ?? '');

// The status bar row: one icon and value per fact, the label in its tooltip.
export function metaChips(m: FileMeta): string {
  return m.items.map(i => `<span class="fe-meta-item" title="${esc(i.label)}">${icon(i.key)}${esc(i.value)}</span>`).join('');
}
