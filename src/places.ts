// Pure list operations for the user's custom "Places" sidebar entries.
// Kept separate from the DOM so they're unit-testable; main.ts persists the
// result and re-renders. Identity is the path (one entry per folder).
import type { Place } from './types';

export function upsertPlace(list: Place[], place: Place): Place[] {
  if (list.some(p => p.path === place.path)) return list;   // dedupe by path
  return [...list, place];
}

export function removePlace(list: Place[], path: string): Place[] {
  return list.filter(p => p.path !== path);
}

export function renamePlace(list: Place[], path: string, label: string): Place[] {
  return list.map(p => (p.path === path ? { ...p, label } : p));
}

export function movePlace(list: Place[], fromPath: string, toPath: string): Place[] {
  const from = list.findIndex(p => p.path === fromPath);
  const to = list.findIndex(p => p.path === toPath);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
