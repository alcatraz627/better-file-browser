// The waiting list on Home: everything that is waiting on the owner, from every place it can come from.
// Pure functions; home-lens.ts draws the result. Nothing here reads a file or the page.
import type { NoteMeta } from './notes';
import { reminderState } from './notes';
import type { DocRow } from './docs-lens';
import type { DpRow } from './dp-lens';

export type WaitKind = 'reminder' | 'comment' | 'decision' | 'capture' | 'agent';

export interface WaitItem {
  kind: WaitKind;
  /** Stable across visits: the kind and the note, document or page it is about. */
  key: string;
  title: string;
  why: string;
  /** A Mac path to open, or for a decision page its registry path. */
  path: string;
  /** When it first showed up here, in ms. */
  since: number;
  /** Past the fade age and not a missed reminder: drawn dimmer and listed last. */
  faded: boolean;
}

/** An item that has waited this long without being dealt with fades. A missed reminder never does. */
export const FADE_DAYS = 7;
const DAY = 86400_000;

/** A capture is a note that came from somewhere else (`source`), has not been sorted yet (no tags, not pinned),
 *  and was not written by an agent. The spec has no "unclaimed" field, so this is the stand-in. */
export const isUnclaimedCapture = (n: Pick<NoteMeta, 'source' | 'tags' | 'pinned' | 'agent'>): boolean =>
  !!n.source && !(n.tags ?? []).length && !n.pinned && !n.agent;

export interface WaitInputs { root: string; notes: NoteMeta[]; docs: DocRow[]; pages: DpRow[] }

const noteTitle = (n: NoteMeta) => n.title || n.rel.replace(/\.md$/, '');
const forMe = (r: DocRow) => (r.mentions ?? []).some(m => m === 'user' || m === 'owner');

/**
 * The list, plus the first-seen times to keep. `seen` maps each item's key to when it first appeared;
 * a key that is no longer waiting is dropped from it, so an item that comes back starts fresh.
 */
export function buildWaiting(i: WaitInputs, seen: Record<string, number>, now = Date.now()): { items: WaitItem[]; seen: Record<string, number> } {
  const keep: Record<string, number> = {};
  const items: WaitItem[] = [];
  const add = (kind: WaitKind, key: string, title: string, why: string, path: string, never = false) => {
    const since = seen[key] ?? now;
    keep[key] = since;
    items.push({ kind, key, title, why, path, since, faded: !never && now - since >= FADE_DAYS * DAY });
  };
  for (const n of i.notes) {
    const path = `${i.root}/${n.rel}`;
    if (reminderState(n, now) === 'missed') add('reminder', `reminder:${n.rel}`, noteTitle(n), `Missed reminder${n.remindOn === 'phone' ? ' (it rings on the phone)' : ''}`, path, true);
    else if (n.agent && !n.pinned) add('agent', `agent:${n.rel}`, noteTitle(n), `New note from ${n.agent}`, path);
    else if (isUnclaimedCapture(n)) add('capture', `capture:${n.rel}`, noteTitle(n), `Captured from ${n.source}, not sorted yet`, path);
  }
  for (const d of i.docs) {
    if (d.exists !== false && d.open > 0 && forMe(d)) add('comment', `comment:${d.doc}`, d.name, `${d.open} open comment${d.open === 1 ? '' : 's'} for you`, d.doc);
  }
  for (const p of i.pages) if (p.state === 'waiting') add('decision', `decision:${p.slug}`, p.title ?? p.slug, 'Decision page waiting', p.path);
  const order: WaitKind[] = ['reminder', 'comment', 'decision', 'capture', 'agent'];
  items.sort((a, b) => Number(a.faded) - Number(b.faded) || order.indexOf(a.kind) - order.indexOf(b.kind) || b.since - a.since);
  return { items, seen: keep };
}
