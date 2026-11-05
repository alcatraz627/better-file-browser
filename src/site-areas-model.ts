// The rules behind the map's Areas layer, kept apart from the page so they can
// be tested: which areas a filter keeps, how dates read, and which labels fit on
// the map without covering each other.

import type { Area, AreaKind, TripEvent } from './site-areas-data';

/**
 * The areas left after a filter. No kinds chosen means every kind; several
 * chosen means an area with any of them. `eventsOnly` keeps areas with an event.
 */
export function filterAreas(areas: Area[], kinds: ReadonlySet<AreaKind>, eventsOnly: boolean): Area[] {
  return areas.filter(a => (!kinds.size || a.kinds.some(k => kinds.has(k))) && (!eventsOnly || a.events.length > 0));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parts = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { m: m - 1, d, day: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
};

/** When an event runs, in words: "Sat Nov 14" for one day, "Nov 14 to 17" within a month, "Oct 30 to Dec 25" across months. */
export function eventDates(e: Pick<TripEvent, 'start' | 'end'>): string {
  const a = parts(e.start), b = parts(e.end);
  if (e.start === e.end) return `${DAYS[a.day]} ${MONTHS[a.m]} ${a.d}`;
  return a.m === b.m ? `${MONTHS[a.m]} ${a.d} to ${b.d}` : `${MONTHS[a.m]} ${a.d} to ${MONTHS[b.m]} ${b.d}`;
}

/** A label centred on its point: `w` wide with its name alone, `fullW` wide when it also says what the area is like. */
export interface LabelBox { id: string; x: number; y: number; w: number; fullW: number; h: number }

/**
 * Which labels to draw, and which of those have room for their full text, so
 * none covers another. Names are placed first, with earlier ones winning, so
 * as many areas as possible stay named; spare room then goes to the full text.
 * The result maps each label drawn to whether it shows its full text.
 */
export function labelsThatFit(boxes: LabelBox[]): Map<string, boolean> {
  const clash = (a: LabelBox, aw: number, b: LabelBox, bw: number) =>
    Math.abs(a.x - b.x) < (aw + bw) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
  const kept: { box: LabelBox; w: number }[] = [];
  for (const box of boxes) {
    if (!kept.some(k => clash(k.box, k.w, box, box.w))) kept.push({ box, w: box.w });
  }
  const result = new Map<string, boolean>();
  for (const k of kept) {
    const roomy = !kept.some(o => o !== k && clash(o.box, o.w, k.box, k.box.fullW));
    if (roomy) k.w = k.box.fullW;
    result.set(k.box.id, roomy);
  }
  return result;
}
