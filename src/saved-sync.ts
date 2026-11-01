// Keeps Saved in the notes folder. Each save is a file in `.saved/` and tag colours live in
// `.meta/tags.json`, so Saved survives outside Chrome and syncs with the rest of the folder.
// Reads stay synchronous: chrome.storage holds a cache (getSaved), the folder overrides it
// when it is reachable, and with no host or no notes folder Saved works from the cache alone.
import type { Place, Tag } from './types';
import { notes, NotesError } from './notes';
import { getSaved, getTags, setSavedFromFolder, setSavedQuiet, onSavedChanged, savedUnsent, markSavedSent, getSettings, SAVED_KEY, TAGS_KEY, SAVED_DIRTY_KEY } from './storage';
import { kvGet, kvSet, kvRemove } from './kv';
import { planSaved, placesFromFiles } from './saved-files';
import { onPhone } from './phone';

const BACKUP_SAVED = 'bfb-saved-premigration-v1';
const BACKUP_TAGS = 'bfb-tags-premigration-v1';
// Set by Undo: Saved stays in this browser until the person moves it back to the folder.
const OFF_KEY = 'bfb-saved-folder-off-v1';

/** Where Saved stands, for the Saved lens to say plainly. */
export type SavedWhere = 'folder' | 'browser' | 'unreachable' | 'unknown';
let where: SavedWhere = 'unknown';
let whereWhy = '';
const watchers: (() => void)[] = [];
export const savedWhere = (): { where: SavedWhere; why: string } => ({ where, why: whereWhy });
export const onSavedWhere = (fn: () => void): void => { watchers.push(fn); };
function setWhere(w: SavedWhere, why = ''): void { if (w !== where || why !== whereWhy) { where = w; whereWhy = why; watchers.forEach(f => f()); } }

export interface SavedHooks { refresh(): void; toast(msg: string, ms?: number, action?: { label: string; run: () => void }): void }
let hooks: SavedHooks | null = null;

const root = (): string => (getSettings().notesRoot || '').replace(/\/$/, '');

const coloursOf = (tags: Tag[]): Record<string, string> => Object.fromEntries(tags.map(t => [t.name, t.color]));

/** Write the cache to the folder. Resolves once the folder holds exactly the cache's saves. */
export async function pushSaved(r = root(), createOnly = false): Promise<{ written: number; removed: number }> {
  const cur = await notes.savedList(r);
  const list = getSaved();
  const snapshot = JSON.stringify(list);
  const plan = await planSaved(list, cur.items);
  const colours = coloursOf(getTags());
  const known = cur.tags ?? {};
  const tags = Object.fromEntries(Object.entries(colours).filter(([n, c]) => known[n] !== c));
  const batch = await notes.savedSync(r, { writes: plan.writes, removes: createOnly ? [] : plan.removes, tags, createOnly });
  // The folder assigned positions and dates; keep them in the cache so the next push rewrites nothing.
  // Only if nothing changed while the write ran; otherwise the change's own push follows.
  if (JSON.stringify(getSaved()) === snapshot) { setSavedQuiet(plan.placed); markSavedSent(); }
  setWhere('folder');
  return { written: batch.written.length, removed: batch.removed.length };
}

/** Read the folder into the cache. A folder that has never held Saved is filled from the cache once. */
export async function pullSaved(): Promise<'migrated' | 'pulled' | 'pushed' | 'none'> {
  const r = root();
  if (!r) { setWhere('browser', 'There is no notes folder set in Settings.'); return 'none'; }
  if (kvGet(OFF_KEY) === '1') { setWhere('browser', 'Saved was moved back to this browser.'); return 'none'; }
  let got;
  try { got = await notes.savedList(r); }
  catch (e) { setWhere('unreachable', e instanceof NotesError ? e.message : String(e)); return 'none'; }
  // The phone never makes the first move of Saved: the Mac does, and the phone reads the result.
  if (!got.exists) { if (onPhone()) { setWhere('folder'); return 'none'; } return migrateSaved(r); }
  if (savedUnsent()) { await pushSaved(r); hooks?.refresh(); return 'pushed'; }
  const next = placesFromFiles(got.items);
  const before = JSON.stringify(getSaved()), regBefore = kvGet(TAGS_KEY);
  setSavedFromFolder(next, got.tags ?? undefined);
  setWhere('folder');
  if (JSON.stringify(getSaved()) !== before || kvGet(TAGS_KEY) !== regBefore) hooks?.refresh();
  return 'pulled';
}

/** The one-time move of Saved into the folder. It keeps a copy of the old rows and tag colours for
 *  Undo, only ever creates files (a second run changes nothing), and says what it did. */
async function migrateSaved(r: string): Promise<'migrated' | 'none'> {
  const rows = getSaved();
  if (!rows.length) { await notes.savedSync(r, {}); setWhere('folder'); return 'none'; }
  if (kvGet(BACKUP_SAVED) === null) { kvSet(BACKUP_SAVED, kvGet(SAVED_KEY) ?? '[]'); kvSet(BACKUP_TAGS, kvGet(TAGS_KEY) ?? '[]'); }
  const done = await pushSaved(r, true);
  hooks?.refresh();
  hooks?.toast(`Saved now lives in your notes folder: ${done.written} ${done.written === 1 ? 'save' : 'saves'} in .saved/`, 12000, { label: 'undo', run: () => void undoMigration(r) });
  return 'migrated';
}

/** Take the migration back: remove the files it made and restore the rows and colours it kept. */
export async function undoMigration(r = root()): Promise<void> {
  const savedBackup = kvGet(BACKUP_SAVED), tagsBackup = kvGet(BACKUP_TAGS);
  if (savedBackup === null || !r) return;
  const cur = await notes.savedList(r);
  const mine = (await planSaved(JSON.parse(savedBackup) as Place[], [])).writes.map(w => w.key);
  const gone = cur.items.map(i => i.key).filter(k => mine.includes(k));
  await notes.savedSync(r, { removes: gone });
  kvSet(SAVED_KEY, savedBackup);
  if (tagsBackup !== null) kvSet(TAGS_KEY, tagsBackup);
  markSavedSent();
  kvRemove(BACKUP_SAVED); kvRemove(BACKUP_TAGS);
  kvSet(OFF_KEY, '1');
  setWhere('browser', 'Saved was moved back to this browser.');
  hooks?.refresh();
  hooks?.toast('Saved is back where it was');
}

let timer: ReturnType<typeof setTimeout> | null = null;
let busy: Promise<unknown> = Promise.resolve();
/** After any change to Saved: write the folder soon, one write at a time. */
function schedulePush(): void {
  if (!root() || kvGet(OFF_KEY) === '1') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    busy = busy.then(() => pushSaved().catch(e => setWhere('unreachable', e instanceof NotesError ? e.message : String(e))));
  }, 300);
}

/** Resolves once every pending write to the folder has finished. Walks call it. */
export async function flushSaved(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; busy = busy.then(() => pushSaved().catch(() => undefined)); }
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
  kvSet(SAVED_DIRTY_KEY, '1');   // this browser's list is the one to keep: write it to the folder, do not read the folder over it
  return pullSavedNow();
}
