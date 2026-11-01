// Saved rows as files: the pure half of keeping Saved in the notes folder.
// A save is a note-format file in `.saved/`, named by the SHA-1 of its url
// (spec: one file per link, so two devices saving one link make one file).
// Nothing here touches the disk or the DOM; saved-sync.ts does that.
import type { Place } from './types';
import { parseNote, renderNote, saveKey, normaliseUrl, isoNow, sortNotes, settle, validPos, hasClash, type ParsedNote } from './notefmt';
import { keyBetween } from './notes';
import { isWebPath } from './places';

/** The address a saved path is kept under: a web link as it is, a Mac path as `file://` (a saved view keeps its `#...` part). */
export function placeUrl(path: string): string {
  if (isWebPath(path)) return path;
  const at = path.indexOf('#');
  const base = at < 0 ? path : path.slice(0, at), hash = at < 0 ? '' : path.slice(at);
  return 'file://' + encodeURI(base).replace(/\?/g, '%3F').replace(/#/g, '%23') + hash;
}

/** The saved path an address stands for: a Mac path for `file://`, the link itself for the web, null for anything else. */
export function urlPlace(url: string): string | null {
  const u = url.trim();
  if (isWebPath(u)) return u;
  const m = /^file:\/\/(\/[^#]*)(#.*)?$/i.exec(u);
  if (!m) return null;
  let base: string;
  try { base = decodeURIComponent(m[1]); } catch { base = m[1]; }
  return base + (m[2] ?? '');
}

/** The file name stem (no `.md`) a place is saved under. */
export const placeKey = (path: string): Promise<string> => saveKey(placeUrl(path));

/** Give every row a `pos` that makes the list read in its own order. A row whose `pos` already
 *  sorts after the one before it keeps it, so reordering one row rewrites only the rows around it. */
export function assignPositions(list: { pos?: string }[]): string[] {
  // The most rows that already read in order keep their pos (longest increasing run), so a drag rewrites as little as possible.
  const n = list.length;
  const ok = list.map(p => !!p.pos && validPos(p.pos));
  const len = new Array<number>(n).fill(0), prevAt = new Array<number>(n).fill(-1);
  let best = -1;
  for (let i = 0; i < n; i++) {
    if (!ok[i]) continue;
    len[i] = 1;
    for (let j = 0; j < i; j++) if (ok[j] && list[j].pos! < list[i].pos! && len[j] + 1 > len[i]) { len[i] = len[j] + 1; prevAt[i] = j; }
    if (best < 0 || len[i] > len[best]) best = i;
  }
  const keep: boolean[] = new Array(n).fill(false);
  for (let i = best; i >= 0; i = prevAt[i]) keep[i] = true;
  const out: string[] = [];
  let lower: string | null = null;
  for (let i = 0; i < list.length; i++) {
    if (keep[i]) { out.push(list[i].pos!); lower = list[i].pos!; continue; }
    let upper: string | null = null;
    for (let j = i + 1; j < list.length; j++) if (keep[j]) { upper = list[j].pos!; break; }
    const pos = keyBetween(lower, upper);
    out.push(pos); lower = pos;
  }
  return out;
}

/** The file text for one save: an existing file's other lines and body are kept as they were. */
export function placeText(place: Place, pos: string, existing: string | null, now = isoNow()): string {
  const base = existing ? parseNote(existing, 'x') : null;
  const note: Partial<ParsedNote> = base && !base.conflicted ? { ...base } : {};
  note.title = place.label;
  note.tags = place.tags ?? [];
  note.url = placeUrl(place.path);
  // `device` says which device a file:// link opens on; a web link opens anywhere.
  note.device = isWebPath(place.path) ? (note.device ?? undefined) : 'mac';
  note.pos = pos;
  note.created = note.created ?? place.created ?? now;
  note.body = note.body ?? '';
  return renderNote(note);
}

/** A Saved row from a save file, or null when the file is not a save this Mac shows: no url, or a `file://`
 *  link made for the phone. A web link shows on every device. A file holding a clash is read from
 *  whichever side still has a url, and the row carries `clash` (the file's name) until it is settled. */
export function textPlace(text: string, key: string): Place | null {
  const clash = hasClash(text);
  const src = clash ? [settle(text, 'first'), settle(text, 'second')].find(t => parseNote(t, key).url) ?? '' : text;
  const n = parseNote(src, key);
  if (!n.url) return null;
  const path = urlPlace(n.url);
  if (path === null || (!isWebPath(path) && n.device && n.device !== 'mac')) return null;
  return { path, label: n.title || path.replace(/\/$/, '').split('/').pop() || path, key, ...(n.tags.length ? { tags: n.tags } : {}),
           ...(n.pos ? { pos: n.pos } : {}), ...(n.created ? { created: n.created } : {}), ...(clash ? { clash: key } : {}) };
}

/** The saved list as the folder says it, in the shared order. */
export function placesFromFiles(files: { key: string; text: string }[]): Place[] {
  const rows: { id: string; pos: string | null; created: string | null; place: Place }[] = [];
  for (const f of files) {
    const place = textPlace(f.text, f.key);
    if (place) rows.push({ id: f.key, pos: place.pos ?? null, created: place.created ?? null, place });
  }
  return sortNotes(rows).map(r => r.place);
}

/** Whether two texts hold the same save, ignoring how they are laid out (key order, line endings). */
function sameSave(a: string, b: string, key: string): boolean {
  const x = parseNote(a, key), y = parseNote(b, key);
  return !x.conflicted && x.title === y.title && x.url === y.url && x.device === y.device && x.pos === y.pos
    && x.tags.join('\n') === y.tags.join('\n') && x.body === y.body;
}

export interface SavedPlan {
  writes: { key: string; text: string }[];
  /** Files to remove: only keys this browser knew and the person has since taken out. */
  removes: string[];
  /** The list with positions and dates filled in. */
  placed: Place[];
  /** The keys the list stands for: what this browser now knows to be in the folder. */
  keys: string[];
}

/**
 * What to write so the folder holds what `list` says. `known` is the set of files this browser had seen when
 * it last read or wrote the folder; only a known file that has left the list is removed, so a save another
 * device added since is never taken for a removal. Pass null to remove nothing. A row holding a clash is
 * never rewritten or removed.
 */
export async function planSaved(list: Place[], files: { key: string; text: string }[], known: Set<string> | null = null, now = isoNow()): Promise<SavedPlan> {
  const byKey = new Map(files.map(f => [f.key, f.text]));
  // A file that holds a link under another name (an older app) is kept under that name, not rewritten.
  const keyOfUrl = new Map<string, string>();
  for (const f of files) { const u = parseNote(f.text, f.key).url; if (u) keyOfUrl.set(normaliseUrl(u), f.key); }
  const poss = assignPositions(list);
  const writes: { key: string; text: string }[] = [];
  const wanted = new Set<string>();
  const placed: Place[] = [];
  for (let i = 0; i < list.length; i++) {
    const key = list[i].clash ?? keyOfUrl.get(normaliseUrl(placeUrl(list[i].path))) ?? await placeKey(list[i].path);
    if (wanted.has(key)) continue;
    wanted.add(key);
    if (list[i].clash) { placed.push({ ...list[i], key }); continue; }
    const text = placeText(list[i], poss[i], byKey.get(key) ?? null, now);
    const was = byKey.get(key);
    if (was === undefined || !sameSave(was, text, key)) writes.push({ key, text });
    placed.push({ ...list[i], key, pos: poss[i], created: parseNote(text, key).created ?? undefined });
  }
  const removes = known ? [...known].filter(k => !wanted.has(k) && byKey.has(k)) : [];
  return { writes, removes, placed, keys: [...wanted] };
}
