// Folders that keep their own view. By default every folder shows the same
// view, sort and grouping. A folder the person marks "Keep for this folder"
// remembers its own instead, and changes made there stay with that folder.
// Nothing is kept unless asked for.

import { jsonPref } from './storage';
import type { GroupMode, SortConfig } from './types';

/** The keep button's tooltip, kept and not. */
export const KEEP_ON = 'Kept for this folder; click for the default';
export const KEEP_OFF = 'Keep this view and sort for this folder';

export interface FolderView { view?: string; sort?: SortConfig; group?: GroupMode }

const isObject = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
const store = jsonPref<Record<string, FolderView>>('bfb-folder-views-v1', {}, v => isObject(v) && Object.values(v as object).every(isObject));

/** A folder's key: its path without a trailing slash, so /a/ and /a are one folder. */
export const folderKey = (path: string) => path.replace(/\/+$/, '') || '/';

export const allFolderViews = (): Record<string, FolderView> => store.get();

export const folderView = (path: string): FolderView | null => store.get()[folderKey(path)] ?? null;

/** Keep this folder's view, or change part of what it keeps. */
export function keepFolderView(path: string, patch: FolderView): void {
  const all = store.get();
  const key = folderKey(path);
  all[key] = { ...all[key], ...patch };
  store.set(all);
}

/** Let a folder follow the default view again. */
export function dropFolderView(path: string): void {
  const all = store.get();
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
