// What a directions doc is filtered to: Doc or List, Overview or Full, the
// state chips pressed, and the words in the filter box. The same record drives
// the doc, the list, the bar's status line and the page address, so they never
// disagree.
//
// The address carries the state after `#dir?`, for example
// `#dir?layout=list&depth=overview&s=needs,waiting&q=sensor`, so a filtered
// view can be linked and a reload or Back comes back to it. On load the
// address wins, then what was last chosen for this doc, then the defaults.
import type { DirState } from './directions';

export type DirLayout = 'doc' | 'list';
export type DirDepth = 'overview' | 'full';
export interface DirFilter { layout: DirLayout; depth: DirDepth; states: Set<DirState>; q: string }

const STATE_IDS: readonly DirState[] = ['needs', 'waiting', 'ready', 'parked', 'done'];
const PREFIX = '#dir?';

export const defaultFilter = (): DirFilter => ({ layout: 'doc', depth: 'full', states: new Set(), q: '' });

/** Whether rows are narrowed by a chip or the filter box (Overview alone is not a filter). */
export const isFiltered = (f: DirFilter): boolean => f.states.size > 0 || !!f.q.trim();

/** The filter an address holds, or null when the address is about something else (a heading, a comment). */
export function filterFromHash(hash: string): Partial<DirFilter> | null {
  if (!hash.startsWith(PREFIX)) return null;
  const p = new URLSearchParams(hash.slice(PREFIX.length));
  const out: Partial<DirFilter> = {};
  const layout = p.get('layout'), depth = p.get('depth');
  if (layout === 'doc' || layout === 'list') out.layout = layout;
  if (depth === 'overview' || depth === 'full') out.depth = depth;
  out.states = new Set((p.get('s') ?? '').split(',').filter((s): s is DirState => (STATE_IDS as string[]).includes(s)));
  out.q = p.get('q') ?? '';
  return out;
}

/** The address for a filter: empty when it is the default, so a plain doc keeps a plain address. */
export function hashFor(f: DirFilter): string {
  const p = new URLSearchParams();
  if (f.layout !== 'doc') p.set('layout', f.layout);
  if (f.depth !== 'full') p.set('depth', f.depth);
  if (f.states.size) p.set('s', STATE_IDS.filter(s => f.states.has(s)).join(','));
  if (f.q.trim()) p.set('q', f.q.trim());
  const s = p.toString().replace(/%2C/g, ',');
  return s ? PREFIX + s : '';
}

/** The filter to start from: the address first, then this doc's remembered layout and depth, then the defaults. */
export function startFilter(hash: string, saved: { layout?: DirLayout; depth?: DirDepth }): DirFilter {
  const f = defaultFilter();
  if (saved.layout) f.layout = saved.layout;
  if (saved.depth) f.depth = saved.depth;
  const fromUrl = filterFromHash(hash);
  if (fromUrl) Object.assign(f, fromUrl);
  return f;
}

/** Whether the page address may be rewritten to carry the filter: not while it points at a comment or the comments panel. */
export const ownsHash = (hash: string): boolean => !hash.startsWith('#c=') && hash !== '#comments';
