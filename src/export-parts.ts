// What an Export can hold, in parts the owner switches on or off in Settings,
// Data. Every stored key belongs to exactly one part. Dark mode and marks are
// kept as objects in chrome.storage rather than in bfb's text store, so they are
// read and written separately (`webKey`).

import { BM_KEY, PLACES_KEY, RECENTS_KEY, SAVED_KEY, TAGS_KEY } from './storage';
import { MARKS_INDEX, MARKS_PREFIX } from './site-marks-store';

export interface ExportPart { id: string; label: string; title: string; on: boolean; has: (key: string) => boolean }

/** A key Lights or Marks keeps as an object outside bfb's text store. */
export const webKey = (k: string) => k === 'bfb-lights-v1' || k.startsWith('bfb-marks-');

const isObject = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Whether an imported dark mode or marks value has the shape its reader needs. */
export function webValueOk(key: string, value: unknown): boolean {
  if (key === MARKS_INDEX) return isObject(value);
  if (key.startsWith(MARKS_PREFIX)) return Array.isArray(value) && value.every(isObject);
  if (key === 'bfb-lights-v1') return isObject(value);
  return false;
}

/** Where the values an import replaced are kept, so its Undo can put them back. */
export const WEB_UNDO_KEY = 'bfb-web-undo-v1';

const SAVED = new Set([SAVED_KEY, PLACES_KEY, BM_KEY, TAGS_KEY, 'bfb-tag-colours-v1']);
const isSaved = (k: string) => SAVED.has(k) || k.startsWith('bfb-saved-');
const isHistory = (k: string) => k === RECENTS_KEY;
const isChats = (k: string) => k === 'bfb-ask-history-v1';

export const EXPORT_PARTS: ExportPart[] = [
  { id: 'settings', label: 'Settings', title: 'Every preference, your commands and icon rules', on: true, has: k => !isSaved(k) && !isHistory(k) && !isChats(k) && !webKey(k) },
  { id: 'saved', label: 'Saved', title: 'Saved places, tags and their colours', on: true, has: isSaved },
  { id: 'history', label: 'History', title: 'Places and files opened lately', on: true, has: isHistory },
  { id: 'chats', label: 'Ask chats', title: 'Every Ask conversation; off by default, as chats can be long and private', on: false, has: isChats },
  { id: 'web', label: 'Dark mode and marks', title: 'Dark mode choices for websites, and your comments and pins', on: true, has: webKey },
];

/** Whether a part is switched on, falling back to its default. */
export const partOn = (saved: Record<string, boolean> | undefined, p: ExportPart) => saved?.[p.id] ?? p.on;

/** The parts' keys that go in, given the switches. */
export function keepKey(key: string, saved: Record<string, boolean> | undefined): boolean {
  const part = EXPORT_PARTS.find(p => p.has(key));
  return !!part && partOn(saved, part);
}
