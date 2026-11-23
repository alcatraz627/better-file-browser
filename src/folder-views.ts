// Folders that keep their own view. By default every folder shows the same
// view, sort and grouping. A folder the person marks "Keep for this folder"
// remembers its own instead, and changes made there stay with that folder.
// Nothing is kept unless asked for.

import { jsonPref } from './storage';
import type { GroupMode, SortConfig } from './types';
import { VIEW_ICONS } from './control-icons';

const VIEWS: string[] = VIEW_ICONS.map(v => v.id);
const COLS = [null, 'name', 'size', 'date', 'type', 'ext'];
const GROUPS = ['none', 'folders-first', 'files-first', 'ext', 'type'];

/** The keep button's tooltip, kept and not. */
export const KEEP_ON = 'Kept for this folder; click for the default';
export const KEEP_OFF = 'Keep this view and sort for this folder';

export interface FolderView { view?: string; sort?: SortConfig; group?: GroupMode }

const isObject = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
const store = jsonPref<Record<string, FolderView>>('bfb-folder-views-v1', {}, isObject);
// A damaged row is left out on its own; turning the whole store away would
// let the next keep write over every other folder.
const rows = (): Record<string, FolderView> => Object.fromEntries(Object.entries(store.get()).filter(([, v]) => isObject(v)));

/** A folder's key: its path without a trailing slash, so /a/ and /a are one folder. */
export const folderKey = (path: string) => path.replace(/\/+$/, '') || '/';

export const allFolderViews = (): Record<string, FolderView> => rows();

/** A folder's kept view, with any damaged part left out so the defaults fill it. */
export function folderView(path: string): FolderView | null {
  const v = rows()[folderKey(path)];
  if (!v) return null;
  const out: FolderView = {};
  if (VIEWS.includes(v.view as string)) out.view = v.view;
  if (v.sort && typeof v.sort === 'object' && (v.sort.dir === 'asc' || v.sort.dir === 'desc') && COLS.includes(v.sort.col)) out.sort = { col: v.sort.col, dir: v.sort.dir };
  if (GROUPS.includes(v.group as string)) out.group = v.group;
  return out;
}

/** Keep this folder's view, or change part of what it keeps. */
export function keepFolderView(path: string, patch: FolderView): void {
  const all = rows();
  const key = folderKey(path);
  all[key] = { ...all[key], ...patch };
  store.set(all);
}

/** Let a folder follow the default view again. */
export function dropFolderView(path: string): void {
  const all = rows();
  delete all[folderKey(path)];
  store.set(all);
}

/** Folders in path order, each with how deep it sits under another kept folder
 *  (for the tree layout) and the part of its path below that folder. */
export function folderTree(paths: string[]): { path: string; depth: number; tail: string }[] {
  const sorted = [...paths].sort((a, b) => a.localeCompare(b));
  const out: { path: string; depth: number; tail: string }[] = [];
  const stack: string[] = [];
  for (const p of sorted) {
    while (stack.length && !(p.startsWith(stack[stack.length - 1] + '/') || stack[stack.length - 1] === '/')) stack.pop();
    const parent = stack[stack.length - 1];
    out.push({ path: p, depth: stack.length, tail: parent ? p.slice(parent === '/' ? 1 : parent.length + 1) : p });
    stack.push(p);
  }
  return out;
}
