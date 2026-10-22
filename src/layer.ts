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
  /// Where to show it: next to the anchor (default below), or at a pointer position.
  place?: 'below' | 'above' | 'right' | 'point' | 'none';
  point?: { x: number; y: number };
  align?: 'start' | 'end';
  /// Gap between anchor and layer, in px.
  offset?: number;
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
  transient: { esc: true },
  command:   { esc: true, outside: true },
  dialog:    { esc: true },
  float:     { esc: true },
};
const MODAL: Partial<Record<Archetype, boolean>> = { command: true, dialog: true, float: true };

const stack: (Layer & { opts: LayerOptions; returnTo: Element | null })[] = [];
const topLayer = typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';
let wired = false;
// A press on an open layer's anchor closes it; the click that follows the same
// press must not open it again.
let anchorClosed: { anchor: HTMLElement; at: number } | null = null;

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

/// Open `el` as a layer. If it is already open as a layer, it is closed first.
export function openLayer(el: HTMLElement, opts: LayerOptions): Layer {
  wire();
  if (opts.anchor && anchorClosed?.anchor === opts.anchor && performance.now() - anchorClosed.at < 600) {
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
  position(el, opts);
  const f = opts.focus ?? (MODAL[opts.kind] ? 'first' : 'none');
  if (f === 'first') el.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
  else if (f instanceof HTMLElement) f.focus({ preventScroll: true });
  return layer;
}

/// The topmost open layer, if any.
export function topmost(): Layer | null { return stack[stack.length - 1] ?? null; }
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
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const top = [...stack].reverse().find(l => CLOSES[l.kind].esc);
    if (!top) return;
    e.preventDefault(); e.stopPropagation();
    top.close('esc');
  }, true);
  document.addEventListener('pointerdown', e => {
    const t = e.target as Node;
    const top = stack[stack.length - 1];
    if (!top || top.el.contains(t)) return;
    const anchor = top.opts.anchor;
    if (anchor?.contains(t)) {
      if (CLOSES[top.kind].anchor) { top.close('anchor'); anchorClosed = { anchor, at: performance.now() }; }
      return;
    }
    anchorClosed = null;
    if (CLOSES[top.kind].outside) top.close('outside');
  }, true);
  document.addEventListener('scroll', e => {
    const t = e.target as Node;
    for (const l of [...stack]) if (CLOSES[l.kind].scroll && !l.el.contains(t)) l.close('scroll');
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
export function rovingFocus(root: HTMLElement, items: string, o: { wrap?: boolean; axis?: 'vertical' | 'horizontal' | 'both' } = {}): () => void {
  const axis = o.axis ?? 'vertical';
  const onKey = (e: KeyboardEvent) => {
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
  };
  root.addEventListener('keydown', onKey);
  return () => root.removeEventListener('keydown', onKey);
}

/// Keeps Tab and Shift+Tab inside `root`.
export function focusTrap(root: HTMLElement): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const list = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(x => x.offsetParent !== null);
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  root.addEventListener('keydown', onKey);
  return () => root.removeEventListener('keydown', onKey);
}
