// Pure list operations for the sidebar's Saved folders and their tags.
// Kept separate from the DOM so they're unit-testable; main.ts persists the
// result and re-renders. Identity is the path (one entry per folder).
import type { Bookmark, Place, Tag } from './types';

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

export function togglePlace(list: Place[], place: Place): Place[] {
  return list.some(p => p.path === place.path) ? removePlace(list, place.path) : upsertPlace(list, place);
}

// Tags come in as typed text: "work, versable" → ["work", "versable"].
export function parseTags(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[,\s]+/)) {
    const t = raw.trim().toLowerCase();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function setTags(list: Place[], path: string, tags: string[]): Place[] {
  return list.map(p => (p.path === path ? { ...p, tags: tags.length ? tags : undefined } : p));
}

export const TAG_COLORS = ['#58a6ff', '#3fb950', '#d29922', '#f778ba', '#a371f7', '#f0883e', '#39c5cf', '#8b949e'];

// Every tag named on any place exists in the registry, coloured from the
// palette in first-seen order; tags nobody uses any more are dropped.
export function reconcileTags(list: Place[], tags: Tag[]): Tag[] {
  const used: string[] = [];
  for (const p of list) for (const t of p.tags ?? []) if (!used.includes(t)) used.push(t);
  const kept = tags.filter(t => used.includes(t.name));
  for (const name of used) {
    if (kept.some(t => t.name === name)) continue;
    kept.push({ name, color: TAG_COLORS[kept.length % TAG_COLORS.length] });
  }
  return kept;
}

export function cycleTagColor(tags: Tag[], name: string): Tag[] {
  return tags.map(t => {
    if (t.name !== name) return t;
    const i = TAG_COLORS.indexOf(t.color);
    return { ...t, color: TAG_COLORS[(i + 1) % TAG_COLORS.length] };
  });
}

export interface SavedGroup { tag: Tag | null; items: Place[] }

// Untagged places first, then one group per tag in registry order. A place
// with several tags renders under its first tag only.
export function groupByTag(list: Place[], tags: Tag[]): SavedGroup[] {
  const groups: SavedGroup[] = [{ tag: null, items: list.filter(p => !p.tags?.length) }];
  for (const tag of tags) {
    const items = list.filter(p => p.tags?.[0] === tag.name);
    if (items.length) groups.push({ tag, items });
  }
  return groups;
}

// One-time merge of the two old lists. Places came with user-typed labels,
// so theirs win; order is Places first, then bookmarks not already present.
export function mergeLegacy(bookmarks: Bookmark[], places: Place[]): Place[] {
  let out: Place[] = places.map(p => ({ ...p }));
  for (const b of bookmarks) out = upsertPlace(out, { path: b.path, label: b.label });
  return out;
}
