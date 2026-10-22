// Everything that floats over the page (menus, dropdowns, hover cards, the
// palette, dialogs) opens through here, so each one places, stacks, closes and
// hands focus back the same way (docs/plan/component-system.md, 5.4 and 7).
//
// A layer is any element the caller builds. openLayer() puts it in the
// browser's top layer, which stacks later layers above earlier ones and above
// any z-index, positions it against an anchor or a point, and closes it on the
// events its archetype lists. Esc and a click outside close only the topmost
// layer. The caller learns why a layer closed, so a pick can be told from a
// dismissal.

export type Archetype = 'popover' | 'hovercard' | 'transient' | 'command' | 'dialog' | 'float';
export type CloseWhy = 'esc' | 'outside' | 'anchor' | 'pick' | 'blur' | 'scroll' | 'replaced' | 'api';

export interface LayerOptions {
  kind: Archetype;
  /// The element the layer belongs to; it gets aria-expanded and is where focus returns.
  anchor?: HTMLElement | null;
  /// For a layer shown at a point: the element it belongs to, so a scroll
  /// that moves that element closes it and any other scroll leaves it.
  origin?: HTMLElement | null;
  /// Where to show it: next to the anchor (default below), or at a pointer position.
  place?: 'below' | 'above' | 'right' | 'point' | 'none';
  point?: { x: number; y: number };
  align?: 'start' | 'end';
  /// Gap between anchor and layer, in px.
  offset?: number;
  /// The dimmed area behind a modal layer: a press that starts and ends on it
  /// closes the layer; a drag that only ends there does not.
  backdrop?: HTMLElement | null;
  /// Opening a layer closes any other open layer with the same group.
  group?: string;
  /// Move focus into the layer on open: its first focusable, a given element, or nowhere.
  focus?: 'first' | 'none' | HTMLElement;
  role?: string;
  label?: string;
  onClose?: (why: CloseWhy) => void;
}

export interface Layer {
  el: HTMLElement;
  kind: Archetype;
  close(why?: CloseWhy): void;
  /// Re-measure and re-place, after the content changed size.
  place(): void;
  readonly open: boolean;
}

// Which events close which archetype. A hover card also closes when the pointer
// leaves; the HoverCard helper below handles that.
const CLOSES: Record<Archetype, Partial<Record<CloseWhy, boolean>>> = {
  popover:   { esc: true, outside: true, anchor: true, scroll: true, blur: true },
  hovercard: { esc: true, scroll: true },
  transient: {},
  command:   { esc: true, outside: true },
  dialog:    { esc: true },
  float:     { esc: true },
};
const MODAL: Partial<Record<Archetype, boolean>> = { command: true, dialog: true, float: true };

const stack: (Layer & { opts: LayerOptions; returnTo: Element | null; at: DOMRect | null; seq: number })[] = [];
const topLayer = typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';
let wired = false;
// A press on an open layer's anchor closes it; the click that ends the same
// press, however long it was held, must not open it again. Cleared once that
// click has run, or by the next key or press.
let anchorClosed: HTMLElement | null = null;
let pressTarget: EventTarget | null = null;
// Counts layer openings, so a raised part knows when something has opened over it.
let opened = 0;

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/// Open `el` as a layer. If it is already open as a layer, it is closed first.
export function openLayer(el: HTMLElement, opts: LayerOptions): Layer {
  wire();
  if (opts.anchor && anchorClosed === opts.anchor) {
    anchorClosed = null;
    return { el, kind: opts.kind, open: false, close() {}, place() {} };
  }
  const existing = stack.find(l => l.el === el);
  existing?.close('replaced');
  if (opts.group) stack.filter(l => l.opts.group === opts.group).forEach(l => l.close('replaced'));

  const host = document.getElementById('fe') ?? document.body;
  // A layer the page already holds stays in place when it closes; one built
  // for this opening leaves with it.
  const added = !el.isConnected;
  if (added) host.appendChild(el);
  el.dataset.layer = opts.kind;
  if (opts.role) el.setAttribute('role', opts.role);
  if (opts.label) el.setAttribute('aria-label', opts.label);
  if (MODAL[opts.kind]) el.setAttribute('aria-modal', 'true');
  if (topLayer) { el.setAttribute('popover', 'manual'); el.showPopover(); }
  const anchor = opts.anchor ?? null;
  anchor?.setAttribute('aria-expanded', 'true');
  if (anchor && el.id) anchor.setAttribute('aria-controls', el.id);

  let open = true;
  const layer = {
    el, kind: opts.kind, opts,
    returnTo: document.activeElement,
    at: null as DOMRect | null,
    seq: 0,
    get open() { return open; },
    place: () => position(el, opts),
    close(why: CloseWhy = 'api') {
      if (!open) return;
      open = false;
      const i = stack.indexOf(layer);
      if (i >= 0) stack.splice(i, 1);
      anchor?.setAttribute('aria-expanded', 'false');
      const hadFocus = el.contains(document.activeElement);
      if (topLayer && el.matches(':popover-open')) el.hidePopover();
      el.removeAttribute('popover');
      delete el.dataset.layer;
      if (added) el.remove();
      // Focus goes back to where it came from when it was inside the layer.
      if (hadFocus || document.activeElement === document.body) {
        const back = (anchor ?? layer.returnTo) as HTMLElement | null;
        if (back?.isConnected) back.focus({ preventScroll: true });
      }
      opts.onClose?.(why);
    },
  };
  stack.push(layer);
  layer.seq = ++opened;
  position(el, opts);
  layer.at = (anchor ?? opts.origin)?.getBoundingClientRect() ?? null;
  const f = opts.focus ?? (MODAL[opts.kind] ? 'first' : 'none');
  if (f === 'first') el.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
  else if (f instanceof HTMLElement) f.focus({ preventScroll: true });
  return layer;
}

/// Lifts a part that shows and hides itself (a toast, a tooltip) above every
/// open layer, without making it a layer: it takes no Esc and no outside click,
/// and stays in the top layer so its own fade-out still runs. Call it just
/// before showing the part.
export function raise(el: HTMLElement): void {
  if (!topLayer) return;
  // Already showing: move it up only when a layer opened since is still open
  // over it, and never while focus is inside (hiding it would drop focus).
  if (el.matches(':popover-open')) {
    const since = Number(el.dataset.raised);
    if (!stack.some(l => l.seq > since) || el.contains(document.activeElement)) return;
  }
  el.dataset.raised = String(opened);
  if (!el.hasAttribute('popover')) el.setAttribute('popover', 'manual');
  if (el.matches(':popover-open')) el.hidePopover();
  el.showPopover();
  void el.offsetWidth;   // a class added next starts its transition from here
}

/// Takes a raised part back out of the top layer, for when it joins the
/// page's own layout (the docked preview).
export function lower(el: HTMLElement): void {
  if (topLayer && el.matches(':popover-open')) el.hidePopover();
  el.removeAttribute('popover');
  delete el.dataset.raised;
}

/// The topmost open layer, if any.
export function topmost(): Layer | null { return stack[stack.length - 1] ?? null; }
/// Whether an open layer closes on Esc, so Esc is its and no command's.
export function escTaken(): boolean { return stack.some(l => CLOSES[l.kind].esc); }
/// Close every open layer (for a page change or a reset).
export function closeAll(why: CloseWhy = 'api'): void { [...stack].reverse().forEach(l => l.close(why)); }

function position(el: HTMLElement, o: LayerOptions): void {
  const place = o.place ?? (o.point ? 'point' : o.anchor ? 'below' : 'none');
  if (place === 'none') return;
  el.style.position = 'fixed';
  el.style.margin = '0';
  el.style.inset = 'auto';
  const gap = o.offset ?? 4, pad = 8;
  const w = el.offsetWidth, h = el.offsetHeight;
  let x: number, y: number;
  if (place === 'point' && o.point) { x = o.point.x; y = o.point.y; }
  else {
    const r = (o.anchor ?? el).getBoundingClientRect();
    if (place === 'right') { x = r.right + gap; y = r.top; }
    else {
      x = o.align === 'end' ? r.right - w : r.left;
      const below = r.bottom + gap, above = r.top - gap - h;
      y = place === 'above' ? (above >= pad ? above : below) : (below + h <= innerHeight - pad || above < pad ? below : above);
    }
  }
  el.style.left = `${Math.max(pad, Math.min(x, innerWidth - w - pad))}px`;
  el.style.top = `${Math.max(pad, Math.min(y, innerHeight - h - pad))}px`;
}

// One listener per event for every layer. Esc and outside clicks reach only the
// topmost layer that closes on them.
function wire(): void {
  if (wired) return;
  wired = true;
  // A hover card goes on Esc too, but never takes an Esc meant for the layer under it.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    stack.filter(l => l.kind === 'hovercard').forEach(l => l.close('esc'));
    const top = [...stack].reverse().find(l => CLOSES[l.kind].esc);
    if (!top) return;
    e.preventDefault(); e.stopPropagation();
    top.close('esc');
  }, true);
  document.addEventListener('pointerdown', e => {
    pressTarget = e.target;
    const t = e.target as Node;
    const top = stack[stack.length - 1];
    if (!top || top.el.contains(t)) return;
    const anchor = top.opts.anchor;
    if (anchor?.contains(t)) {
      if (CLOSES[top.kind].anchor) { top.close('anchor'); anchorClosed = anchor; }
      return;
    }
    anchorClosed = null;
    if (CLOSES[top.kind].outside) top.close('outside');
  }, true);
  document.addEventListener('click', e => {
    if (anchorClosed) setTimeout(() => { anchorClosed = null; });
    const top = stack[stack.length - 1], bd = top?.opts.backdrop;
    if (bd && e.target === bd && pressTarget === bd) top.close('outside');
  }, true);
  document.addEventListener('keydown', () => { anchorClosed = null; }, true);
  // A scroll closes a layer only when it moved the layer's anchor: a scroll
  // event that lands just after opening, from the scroll that brought the
  // anchor into view, leaves it open.
  document.addEventListener('scroll', e => {
    const t = e.target as Node;
    for (const l of [...stack]) {
      if (!CLOSES[l.kind].scroll || l.el.contains(t)) continue;
      const a = l.opts.anchor ?? l.opts.origin;
      if (a && l.at) {
        const r = a.getBoundingClientRect();
        if (Math.abs(r.top - l.at.top) < 2 && Math.abs(r.left - l.at.left) < 2) continue;
      }
      l.close('scroll');
    }
  }, true);
  document.addEventListener('focusin', e => {
    const t = e.target as Node;
    for (const l of [...stack]) if (CLOSES[l.kind].blur && !l.el.contains(t) && !l.opts.anchor?.contains(t)) l.close('blur');
  });
}

/// A card that shows while the pointer rests on `anchor` (or it has focus), and
/// stays while the pointer moves onto the card. Never opens during a drag.
export function hoverCard(anchor: HTMLElement, build: () => HTMLElement | null, o: { delay?: number; hide?: number; place?: LayerOptions['place']; align?: LayerOptions['align'] } = {}): () => void {
  let timer = 0, layer: Layer | null = null, dragging = false;
  const show = () => {
    if (dragging || layer?.open) return;
    const el = build();
    if (!el) return;
    layer = openLayer(el, { kind: 'hovercard', anchor, place: o.place ?? 'right', align: o.align, role: 'tooltip', focus: 'none' });
    el.addEventListener('pointerenter', () => clearTimeout(timer));
    el.addEventListener('pointerleave', hideSoon);
  };
  const hideSoon = () => { clearTimeout(timer); timer = window.setTimeout(() => layer?.close('api'), o.hide ?? 120); };
  const onEnter = () => { clearTimeout(timer); timer = window.setTimeout(show, o.delay ?? 400); };
  const onDrag = () => { dragging = true; clearTimeout(timer); layer?.close('api'); };
  const onDragEnd = () => { dragging = false; };
  anchor.addEventListener('pointerenter', onEnter);
  anchor.addEventListener('pointerleave', hideSoon);
  anchor.addEventListener('focus', onEnter);
  anchor.addEventListener('blur', hideSoon);
  anchor.addEventListener('dragstart', onDrag);
  anchor.addEventListener('dragend', onDragEnd);
  return () => {
    clearTimeout(timer); layer?.close('api');
    anchor.removeEventListener('pointerenter', onEnter);
    anchor.removeEventListener('pointerleave', hideSoon);
    anchor.removeEventListener('focus', onEnter);
    anchor.removeEventListener('blur', hideSoon);
    anchor.removeEventListener('dragstart', onDrag);
    anchor.removeEventListener('dragend', onDragEnd);
  };
}

/// Arrow keys move focus among `items` inside `root`; Home and End jump; one
/// Tab stop for the group. Returns a function that stops it.
export function rovingFocus(root: HTMLElement, items: string, o: { wrap?: boolean; axis?: 'vertical' | 'horizontal' | 'both'; onMove?: (to: HTMLElement) => void } = {}): () => void {
  const axis = o.axis ?? 'vertical';
  const onKey = (e: KeyboardEvent) => {
    // A key a surface already used, a chord, or one meant for a text box or slider is not a move.
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const t = e.target as HTMLElement;
    if (t.isContentEditable || t.matches('textarea, select, input:not([type=checkbox], [type=radio], [type=button], [type=submit])')) return;
    const list = [...root.querySelectorAll<HTMLElement>(items)].filter(x => !x.hasAttribute('disabled') && x.offsetParent !== null);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement as HTMLElement);
    const next = (axis !== 'horizontal' && e.key === 'ArrowDown') || (axis !== 'vertical' && e.key === 'ArrowRight');
    const prev = (axis !== 'horizontal' && e.key === 'ArrowUp') || (axis !== 'vertical' && e.key === 'ArrowLeft');
    let to = -1;
    if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = list.length - 1;
    else if (next) to = i < 0 ? 0 : i + 1 >= list.length ? (o.wrap === false ? i : 0) : i + 1;
    else if (prev) to = i <= 0 ? (o.wrap === false ? 0 : list.length - 1) : i - 1;
    if (to < 0) return;
    e.preventDefault(); e.stopPropagation();
    list[to].focus();
    o.onMove?.(list[to]);
  };
  root.addEventListener('keydown', onKey);
  return () => root.removeEventListener('keydown', onKey);
}

/// Keeps Tab and Shift+Tab inside `root` while it shows and `when` holds:
/// they wrap at the ends, and from the page behind they step in. In between
/// the browser moves focus, so a radio group stays one stop. A text area or
/// rich editor keeps its Tab (it indents), and a layer above `root` (the
/// palette over a dialog) keeps its own.
export function focusTrap(root: HTMLElement, o: { when?: () => boolean } = {}): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !root.isConnected || getComputedStyle(root).display === 'none' || (o.when && !o.when())) return;
    const ae = document.activeElement as HTMLElement | null;
    if (ae?.closest('textarea, [contenteditable="true"]')) return;
    const inside = !!ae && root.contains(ae);
    const layer = ae?.closest<HTMLElement>('[data-layer]');
    if (!inside && layer && !layer.contains(root)) return;
    // Tab stops in order; a radio group counts once, at its checked radio or its first.
    const seen = new Set<string>();
    const stops = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(x => {
      if (x.offsetParent === null || (x as HTMLButtonElement).disabled || x.tabIndex < 0) return false;
      const r = x as HTMLInputElement;
      if (r.type !== 'radio' || !r.name) return true;
      if (seen.has(r.name)) return false;
      seen.add(r.name);
      return true;
    }).map(x => {
      const r = x as HTMLInputElement;
      return r.type === 'radio' && r.name ? root.querySelector<HTMLElement>(`input[type=radio][name="${CSS.escape(r.name)}"]:checked`) ?? x : x;
    });
    if (!stops.length) return;
    const first = stops[0], last = stops[stops.length - 1];
    const here = (s: HTMLElement) => s === ae || ((ae as HTMLInputElement | null)?.type === 'radio' && (s as HTMLInputElement).name === (ae as HTMLInputElement).name);
    const to = !inside ? (e.shiftKey ? last : first) : e.shiftKey ? (here(first) ? last : null) : (here(last) ? first : null);
    if (!to) return;
    e.preventDefault();
    to.focus();
  };
  document.addEventListener('keydown', onKey, true);
  return () => document.removeEventListener('keydown', onKey, true);
}
