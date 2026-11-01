// Keeps Saved in the notes folder. Each save is a file in `.saved/` and tag colours live in
// `.meta/tags.json`, so Saved survives outside Chrome and syncs with the rest of the folder.
// Reads stay synchronous: chrome.storage holds a cache (getSaved), the folder overrides it
// once this browser has moved, and with no host or no notes folder Saved works from the cache alone.
//
// Three rules keep a person's list safe:
//  - "Moved" is a mark this browser keeps for a folder, not a fact about the folder. Until it is set the
//    cache is never replaced: the first move only creates files, then sets the mark, so a folder that
//    already holds saves, an empty one, or a move cut short all end with nothing lost.
//  - A push removes only files this browser had seen and the person has since taken out. Anything that
//    arrived from another device since the last read stays.
//  - A save whose file holds a merge clash stays in the list, marked, until it is settled.
import type { Place } from './types';
import { notes, NotesError } from './notes';
import { getSaved, getTags, setSavedFromFolder, setSavedQuiet, onSavedChanged, savedUnsent, markSavedSent, getSettings, SAVED_KEY, TAGS_KEY, SAVED_DIRTY_KEY } from './storage';
import { kvGet, kvSet, kvRemove } from './kv';
import { planSaved, placesFromFiles } from './saved-files';
import { samePlace } from './places';
import { settle, type Keep } from './notefmt';
import { onPhone } from './phone';

const BACKUP_SAVED = 'bfb-saved-premigration-v1';
const BACKUP_TAGS = 'bfb-tags-premigration-v1';
// Set by Undo: Saved stays in this browser until the person moves it back to the folder.
const OFF_KEY = 'bfb-saved-folder-off-v1';
// The notes folder this browser has moved Saved into.
const MOVED_KEY = 'bfb-saved-moved-v1';
// The files this browser saw in that folder at its last read or write.
const KNOWN_KEY = 'bfb-saved-known-v1';
// The tag colours the folder held at that time, so a push writes only colours changed here.
const COLOURS_KEY = 'bfb-saved-colours-v1';

/** Where Saved stands, for the Saved lens to say plainly. */
export type SavedWhere = 'folder' | 'browser' | 'unreachable' | 'unknown';
let where: SavedWhere = 'unknown';
let whereWhy = '';
const watchers: (() => void)[] = [];
export const savedWhere = (): { where: SavedWhere; why: string; clashes: number; backup: boolean } =>
  ({ where, why: whereWhy, clashes: getSaved().filter(p => p.clash).length, backup: kvGet(BACKUP_SAVED) !== null && kvGet(OFF_KEY) !== '1' });
export const onSavedWhere = (fn: () => void): void => { watchers.push(fn); };
function setWhere(w: SavedWhere, why = ''): void { if (w !== where || why !== whereWhy) { where = w; whereWhy = why; } watchers.forEach(f => f()); }

export interface SavedHooks { refresh(): void; toast(msg: string, ms?: number, action?: { label: string; run: () => void }): void }
let hooks: SavedHooks | null = null;

const root = (): string => (getSettings().notesRoot || '').replace(/\/$/, '');
const json = <T,>(key: string, fallback: T): T => { try { return JSON.parse(kvGet(key) ?? 'null') ?? fallback; } catch { return fallback; } };

const isMoved = (r: string): boolean => json<{ root?: string }>(MOVED_KEY, {}).root === r;
const markMoved = (r: string): void => kvSet(MOVED_KEY, JSON.stringify({ root: r, at: Date.now() }));
const knownKeys = (r: string): Set<string> => { const k = json<{ root?: string; keys?: string[] }>(KNOWN_KEY, {}); return new Set(k.root === r ? k.keys ?? [] : []); };
const setKnown = (r: string, keys: string[]): void => kvSet(KNOWN_KEY, JSON.stringify({ root: r, keys }));
const knownColours = (r: string): Record<string, string> => { const k = json<{ root?: string; colours?: Record<string, string> }>(COLOURS_KEY, {}); return k.root === r ? k.colours ?? {} : {}; };
const setColours = (r: string, colours: Record<string, string>): void => kvSet(COLOURS_KEY, JSON.stringify({ root: r, colours }));

/** Write the cache to the folder. Never removes a file this browser had not seen, and writes only the tag
 *  colours changed here. `createOnly` leaves existing files alone and removes nothing. */
export async function pushSaved(r = root(), createOnly = false): Promise<{ written: number; removed: number }> {
  const cur = await notes.savedList(r);
  const list = getSaved();
  const snapshot = JSON.stringify(list);
  const plan = await planSaved(list, cur.items, createOnly ? null : knownKeys(r));
  const was = knownColours(r), folderTags = cur.tags ?? {};
  const tags = Object.fromEntries(getTags().filter(t => was[t.name] === undefined ? folderTags[t.name] === undefined : t.color !== was[t.name]).map(t => [t.name, t.color]));
  const batch = await notes.savedSync(r, { writes: plan.writes, removes: plan.removes, tags, createOnly });
  setKnown(r, plan.keys);
  setColours(r, { ...folderTags, ...tags });
  // The folder assigned positions and dates; keep them in the cache so the next push rewrites nothing.
  // Only if nothing changed while the write ran; otherwise the change's own push follows.
  if (JSON.stringify(getSaved()) === snapshot) { setSavedQuiet(plan.placed); markSavedSent(); }
  setWhere('folder');
  return { written: batch.written.length, removed: batch.removed.length };
}

/** Make the cache what the folder says, and remember what the folder held. */
function adopt(r: string, got: { items: { key: string; text: string }[]; tags: Record<string, string> | null }): void {
  const next = placesFromFiles(got.items);
  const before = JSON.stringify(getSaved()), regBefore = kvGet(TAGS_KEY);
  setSavedFromFolder(next, got.tags ?? undefined);
  setKnown(r, next.map(p => p.key!));
  setColours(r, got.tags ?? {});
  setWhere('folder');
  if (JSON.stringify(getSaved()) !== before || kvGet(TAGS_KEY) !== regBefore) hooks?.refresh();
}

/** Read the folder into the cache; on a browser that has not moved Saved yet, make the first move instead. */
export async function pullSaved(): Promise<'migrated' | 'pulled' | 'pushed' | 'none'> {
  const r = root();
  if (!r) { setWhere('browser', 'There is no notes folder set in Settings.'); return 'none'; }
  if (kvGet(OFF_KEY) === '1') { setWhere('browser', 'Saved was moved back to this browser.'); return 'none'; }
  let got;
  try { got = await notes.savedList(r); }
  catch (e) { setWhere('unreachable', e instanceof NotesError ? e.message : String(e)); return 'none'; }
  if (!isMoved(r)) {
    // The phone does not move Saved on its own: it adopts a folder that exists and waits for one that does not.
    // A save made on the phone is never dropped, though: it is written first, create-only, beside what is there.
    if (onPhone()) {
      if (!got.exists && !savedUnsent()) { setWhere('folder'); return 'none'; }
      if (savedUnsent()) await pushSaved(r, true);
      markMoved(r);
      adopt(r, await notes.savedList(r));
      return 'pulled';
    }
    return firstMove(r, got);
  }
  if (savedUnsent()) { await pushSaved(r); adopt(r, await notes.savedList(r)); return 'pushed'; }
  adopt(r, got);
  return 'pulled';
}

/** The first move of Saved into a folder: keep a copy of the old rows and colours, create the files that are missing
 *  (never touching one that is there), set the mark, and only then read the folder, which now holds both lists. */
async function firstMove(r: string, got: { exists: boolean; items: { key: string; text: string }[]; tags: Record<string, string> | null }): Promise<'migrated' | 'pulled' | 'none'> {
  const rows = getSaved();
  if (!rows.length) { markMoved(r); adopt(r, got); return 'pulled'; }
  if (kvGet(BACKUP_SAVED) === null) { kvSet(BACKUP_SAVED, kvGet(SAVED_KEY) ?? '[]'); kvSet(BACKUP_TAGS, kvGet(TAGS_KEY) ?? '[]'); }
  const done = await pushSaved(r, true);
  markMoved(r);
  const after = await notes.savedList(r);
  adopt(r, after);
  hooks?.refresh();
  const joined = after.items.length - done.written > 0 ? `, beside ${after.items.length - done.written} already there` : '';
  hooks?.toast(`Saved now lives in your notes folder: ${done.written} ${done.written === 1 ? 'save' : 'saves'} written to .saved/${joined}`, 12000, { label: 'undo', run: () => void undoMigration(r) });
  return 'migrated';
}

/** Take the move back: remove the files it made and restore the rows and colours it kept. */
export async function undoMigration(r = root()): Promise<void> {
  const savedBackup = kvGet(BACKUP_SAVED), tagsBackup = kvGet(BACKUP_TAGS);
  if (savedBackup === null || !r) return;
  const cur = await notes.savedList(r);
  const mine = (await planSaved(JSON.parse(savedBackup) as Place[], cur.items)).keys;
  await notes.savedSync(r, { removes: cur.items.map(i => i.key).filter(k => mine.includes(k)) });
  kvSet(SAVED_KEY, savedBackup);
  if (tagsBackup !== null) kvSet(TAGS_KEY, tagsBackup);
  markSavedSent();
  kvRemove(BACKUP_SAVED); kvRemove(BACKUP_TAGS); kvRemove(MOVED_KEY); kvRemove(KNOWN_KEY); kvRemove(COLOURS_KEY);
  kvSet(OFF_KEY, '1');
  setWhere('browser', 'Saved was moved back to this browser.');
  hooks?.refresh();
  hooks?.toast('Saved is back where it was');
}

/** A lasting way back to the rows this browser had before the move: they are put back beside what is there now. */
export async function restoreBackup(): Promise<void> {
  const savedBackup = kvGet(BACKUP_SAVED);
  if (savedBackup === null) return;
  const old = JSON.parse(savedBackup) as Place[], now = getSaved();
  const back = old.filter(o => !now.some(n => samePlace(n.path, o.path)));
  const tagsBackup = json<{ name: string; color: string }[]>(BACKUP_TAGS, []), reg = json<{ name: string; color: string }[]>(TAGS_KEY, []);
  kvSet(TAGS_KEY, JSON.stringify([...reg, ...tagsBackup.filter(t => !reg.some(x => x.name === t.name))]));
  kvSet(SAVED_KEY, JSON.stringify([...now, ...back]));
  kvSet(SAVED_DIRTY_KEY, '1');
  hooks?.refresh();
  schedulePush();
  hooks?.toast(back.length ? `Brought back ${back.length} ${back.length === 1 ? 'row' : 'rows'} from before the move` : 'Every row from before the move is already here');
}

/** Settle a save whose file holds a merge clash: keep the first side, the second, or both. */
export async function settleSave(key: string, keep: Keep): Promise<void> {
  const r = root();
  const cur = await notes.savedList(r);
  const item = cur.items.find(i => i.key === key);
  if (!item) return;
  await notes.savedSync(r, { writes: [{ key, text: settle(item.text, keep) }] });
  await pullSavedNow();
  hooks?.refresh();
}

let timer: ReturnType<typeof setTimeout> | null = null;
let busy: Promise<unknown> = Promise.resolve();
const failed = (e: unknown) => setWhere('unreachable', e instanceof NotesError ? e.message : String(e));
/** After any change to Saved: write the folder soon, one write at a time. A browser that has not moved yet makes its first move instead. */
function schedulePush(): void {
  const r = root();
  if (!r || kvGet(OFF_KEY) === '1') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    busy = busy.then(() => (isMoved(r) ? pushSaved() : pullSaved()).then(() => undefined).catch(failed));
  }, 300);
}

/** Resolves once every pending write to the folder has finished. Walks call it. */
export async function flushSaved(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; const r = root(); busy = busy.then(() => (isMoved(r) ? pushSaved() : pullSaved()).then(() => undefined).catch(() => undefined)); }
  await busy;
}

let lastPull = 0;
/** Wire Saved to the folder: pull now and whenever the page comes back to the front. */
export function startSavedSync(h: SavedHooks): void {
  hooks = h;
  onSavedChanged(schedulePush);
  const pull = () => { lastPull = Date.now(); busy = busy.then(() => pullSaved().catch(() => undefined)); };
  pull();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastPull > 3000) pull(); });
  window.addEventListener('focus', () => { if (Date.now() - lastPull > 3000) pull(); });
}

/** For walks and the settings page: look at the folder again now. */
export const pullSavedNow = (): Promise<unknown> => (busy = busy.then(() => pullSaved().catch(() => undefined)));

/** Move Saved into the notes folder again after Undo. */
export function enableSavedFolder(): Promise<unknown> {
  kvRemove(OFF_KEY);
  return pullSavedNow();
}
