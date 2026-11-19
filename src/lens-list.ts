// The sidebar's sections (lenses): which exist, in what order the person keeps
// them, and which are switched off. The rail draws from this, and Settings,
// Sidebar edits it. History's switch is the older hideRecent setting, so a
// choice made before this list existed still holds.

import { PI } from './icons';
import { UI_ICON } from './control-icons';
import type { Settings } from './types';

export interface Lens { id: string; label: string; icon: string; hint: string }

export const LENSES: Lens[] = [
  { id: 'home', label: 'Home', icon: UI_ICON.dashboard, hint: 'Home: every chat, the decisions still open, and what each repo asks of you' },
  { id: 'places', label: 'Places', icon: PI.home, hint: 'Places: Home, your folders, Applications and Root' },
  { id: 'saved', label: 'Saved', icon: PI.bm, hint: 'Saved: places and views you kept' },
  { id: 'notes', label: 'Notes', icon: PI.docs, hint: 'Notes: your notes folder' },
  { id: 'history', label: 'History', icon: PI.recent, hint: 'History: folders and files you opened lately, and closed tabs' },
  { id: 'search', label: 'Search', icon: PI.search, hint: 'Search: find text in the files of this folder' },
  { id: 'ask', label: 'Ask', icon: PI.ask, hint: 'Ask: put a question about this file or folder to the local model' },
  { id: 'comments', label: 'Comments', icon: UI_ICON.comment, hint: 'Comments: every document with comments' },
  { id: 'decisions', label: 'Decisions', icon: UI_ICON.opinion, hint: 'Decisions: pages an agent asked you to answer' },
];

type LensSettings = Pick<Settings, 'lensOrder' | 'lensOff' | 'hideRecent'>;

/** The lenses in the person's order. A lens added later, or missing from a
 *  saved order, takes its place after the lens it follows in the built-in list. */
export function lensOrder(s: LensSettings): Lens[] {
  const known = new Map(LENSES.map(l => [l.id, l]));
  const out = [...new Set(Array.isArray(s.lensOrder) ? s.lensOrder : [])].filter(id => known.has(id)).map(id => known.get(id)!);
  LENSES.forEach((l, i) => {
    if (out.includes(l)) return;
    const before = LENSES.slice(0, i).reverse().find(p => out.includes(p));
    out.splice(before ? out.indexOf(before) + 1 : 0, 0, l);
  });
  return out;
}

const offList = (s: LensSettings): string[] => (Array.isArray(s.lensOff) ? s.lensOff : []);

export const lensOn = (s: LensSettings, id: string) =>
  id === 'history' ? !s.hideRecent : !offList(s).includes(id);

/** Whether the rail shows a lens. Stored settings that switch every lens off
 *  (an import, a hand edit) show them all, so the rail is never empty. */
export const lensShown = (s: LensSettings, id: string) =>
  lensOn(s, id) || !LENSES.some(l => lensOn(s, l.id));

/** Switch a lens on or off. The last lens on cannot be switched off; returns false then. */
export function setLensOn(s: LensSettings, id: string, on: boolean): boolean {
  if (!on && LENSES.filter(l => l.id !== id && lensOn(s, l.id)).length === 0) return false;
  if (id === 'history') s.hideRecent = !on;
  else s.lensOff = on ? offList(s).filter(x => x !== id) : [...new Set([...offList(s), id])];
  return true;
}
