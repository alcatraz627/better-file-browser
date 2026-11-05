// Finds the live Google map behind a map element on a page.

/** The few calls the overlay needs from a Google map; enough to recognise one. */
export interface MapLike {
  getBounds(): unknown;
  getZoom(): number | undefined;
  getDiv(): Element;
}

function isMapLike(v: unknown): v is MapLike {
  const m = v as Partial<MapLike> | null;
  return !!m && typeof m === 'object' && typeof m.getBounds === 'function'
    && typeof m.getZoom === 'function' && typeof m.getDiv === 'function';
}

const SKIP_KEYS = new Set(['return', 'sibling', 'alternate', '_owner']);
const MAX_DEPTH = 6;
const MAX_VISITS = 20000;
const MAX_FIBER_HOPS = 60;

/**
 * Finds the Google map a page drew inside this element.
 *
 * Google gives no way back from an element to its map, but both sites keep the
 * map in React state or context. This looks for anything shaped like a map, not
 * a named path, so a renamed field on either site does not break it.
 */
export function findMapFor(mapEl: Element): MapLike | null {
  const seen = new WeakSet<object>();
  let visits = 0;
  let found: MapLike | null = null;

  const scan = (v: unknown, depth: number): void => {
    if (found || !v || typeof v !== 'object' || depth > MAX_DEPTH || visits > MAX_VISITS) return;
    if (seen.has(v) || v instanceof Node) return;
    seen.add(v);
    visits++;
    if (isMapLike(v)) {
      if (v.getDiv()?.contains(mapEl)) found = v;
      return;
    }
    let keys: string[];
    try { keys = Object.keys(v); } catch { return; }
    for (const k of keys.slice(0, 60)) {
      if (found) return;
      if (SKIP_KEYS.has(k)) continue;
      let child: unknown;
      try { child = (v as Record<string, unknown>)[k]; } catch { continue; }
      scan(child, depth + 1);
    }
  };

  type Fiber = { memoizedProps?: unknown; memoizedState?: unknown; stateNode?: unknown; return?: Fiber | null };
  for (let el: Element | null = mapEl; el && !found; el = el.parentElement) {
    const key = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
    let fiber = key ? (el as unknown as Record<string, Fiber>)[key] : null;
    for (let hops = 0; fiber && hops < MAX_FIBER_HOPS && !found; hops++) {
      scan(fiber.memoizedProps, 0);
      scan(fiber.memoizedState, 0);
      scan(fiber.stateNode, 0);
      fiber = fiber.return ?? null;
    }
    if (key) break;
  }
  return found;
}
