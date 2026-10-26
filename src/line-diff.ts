// A line-by-line comparison of two texts, for showing what differs between the
// copy on disk and the copy being edited.

export interface DiffRow { kind: 'same' | 'gone' | 'new'; text: string }

// Past this many cells the full comparison costs too much; only the shared
// head and tail are trimmed and everything between is shown as changed.
const MAX_CELLS = 4_000_000;

/**
 * The rows that turn `disk` into `mine`: lines only on disk are `gone`, lines
 * only in the edited copy are `new`.
 */
export function lineDiff(disk: string, mine: string): DiffRow[] {
  const a = disk.split('\n'), b = mine.split('\n');
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const ma = a.slice(head, a.length - tail), mb = b.slice(head, b.length - tail);
  const out: DiffRow[] = [];
  for (let i = 0; i < head; i++) out.push({ kind: 'same', text: a[i] });
  let i = 0, j = 0;
  const emit = (kind: DiffRow['kind'], text: string) => out.push({ kind, text });
  if (ma.length * mb.length > MAX_CELLS) {
    for (; i < ma.length; i++) emit('gone', ma[i]);
    for (; j < mb.length; j++) emit('new', mb[j]);
  } else {
    // lcs[x][y]: the longest run of shared lines in ma[x..] and mb[y..].
    const w = mb.length + 1;
    const lcs = new Uint32Array((ma.length + 1) * w);
    for (let x = ma.length - 1; x >= 0; x--) for (let y = mb.length - 1; y >= 0; y--)
      lcs[x * w + y] = ma[x] === mb[y] ? lcs[(x + 1) * w + y + 1] + 1 : Math.max(lcs[(x + 1) * w + y], lcs[x * w + y + 1]);
    while (i < ma.length && j < mb.length) {
      if (ma[i] === mb[j]) { emit('same', mb[j]); i++; j++; }
      else if (lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) { emit('gone', ma[i]); i++; }
      else { emit('new', mb[j]); j++; }
    }
    for (; i < ma.length; i++) emit('gone', ma[i]);
    for (; j < mb.length; j++) emit('new', mb[j]);
  }
  for (let k = 0; k < tail; k++) out.push({ kind: 'same', text: a[a.length - tail + k] });
  return out;
}
