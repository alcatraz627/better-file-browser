// The page's focus areas: the parts F6 walks between (sidebar, tabs, path
// bar, toolbar, listing, preview). Each area declares itself once here:
// where it is, which key scope it gives the keyboard, how the keyboard goes
// in, and the arrow-key group inside it. The key context, F6, the "go to
// area" commands and the flash ring all read this list.
import { rovingFocus } from './layer';
import type { Scope } from './keymap';

export interface Area {
  name: string;
  /// The area's elements; the first one showing is where the keyboard goes.
  root: string;
  /// The key scope it gives while focus is inside, if any.
  scope?: Scope;
  /// Its own moving keys (arrows, Enter, Space, Delete) are not commands for elsewhere.
  widget?: boolean;
  /// Put the keyboard in the area; false when nothing there can take it.
  enter: () => boolean;
  /// Arrow keys walk these items inside each root.
  roving?: { items: string; axis?: 'vertical' | 'horizontal'; wrap?: boolean };
}

const list: Area[] = [];

/// Add an area, in F6 order; its arrow-key group starts now for roots already on the page.
export function declareArea(a: Area): void {
  list.push(a);
  if (a.roving) for (const r of document.querySelectorAll<HTMLElement>(a.root)) rovingFocus(r, a.roving.items, { axis: a.roving.axis, wrap: a.roving.wrap });
}

/// The area holding `x`, if any.
export function areaOf(x: Element | null): Area | null {
  return (x && list.find(a => x.closest(a.root))) || null;
}

export function areaNamed(name: string): Area | null { return list.find(a => a.name === name) ?? null; }

/// The next area from the one holding focus that can take the keyboard, in F6 order.
export function cycleArea(from: Element | null, dir: 1 | -1, isHome: (a: Area) => boolean): Area | null {
  let i = list.findIndex(a => (from ? !!from.closest(a.root) : false) || (from === document.body && isHome(a)));
  for (let n = 0; n < list.length; n++) {
    i = (i + dir + list.length) % list.length;
    if (list[i].enter()) return list[i];
  }
  return null;
}

/// Every area's roots, for a selector such as the flash ring's.
export const allRoots = () => list.map(a => a.root).join(', ');
