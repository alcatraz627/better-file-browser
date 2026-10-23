// While the sidebar is hidden, the left edge of the page brings it back for a
// moment. A thin zone along the edge brightens as the pointer comes near and
// opens the sidebar over the page when the pointer reaches it. The sidebar
// stays while the pointer is on it, and closes a set time after the pointer
// leaves (Settings, Sidebar, Peek closes), on Esc, or on a click elsewhere.
// Typing in one of its fields keeps it open, and Esc there belongs to the field.
import { el } from './el';
import { getSettings } from './storage';
import { sidebarShown } from './motion';
import { openLayer, type Layer } from './layer';

const NEAR_PX = 48;

export function initSidePeek(): void {
  const fe = el('fe'), side = el('fe-side');
  const edge = document.createElement('div');
  edge.id = 'fe-edge';
  edge.title = 'Show the sidebar';
  fe.append(edge);
  let layer: Layer | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const peeking = () => !!layer?.open;
  const typing = () => !!side.querySelector('input:focus, textarea:focus, [contenteditable="true"]:focus');
  const syncEdge = () => { edge.hidden = peeking() || sidebarShown(); };
  const stay = () => { if (timer) { clearTimeout(timer); timer = null; } };

  // As a layer it sits above the page, takes Esc before the editor under it,
  // and closes on a press elsewhere.
  const open = () => {
    if (peeking() || sidebarShown()) return;
    side.style.display = '';
    side.classList.add('peek');
    edge.classList.remove('near');
    layer = openLayer(side, { kind: 'popover', place: 'none', focus: 'none', label: 'Sidebar', keepOnEsc: typing,
      onClose: () => {
        stay();
        layer = null;
        side.classList.remove('peek');
        if (!sidebarShown()) side.style.display = 'none';
        syncEdge();
      } });
    syncEdge();
  };
  const close = () => { stay(); layer?.close('api'); };
  const later = () => {
    stay();
    const ms = getSettings().peekCloseMs ?? 500;
    if (ms) timer = setTimeout(() => { timer = null; if (!typing()) close(); }, ms);
  };

  edge.addEventListener('pointerenter', open);
  side.addEventListener('pointerenter', stay);
  side.addEventListener('pointerleave', () => { if (peeking()) later(); });
  side.addEventListener('focusout', () => { if (peeking() && !side.matches(':hover')) later(); });
  // The zone shows itself only as the pointer nears the edge.
  document.addEventListener('pointermove', e => {
    if (edge.hidden) return;
    edge.classList.toggle('near', e.clientX < NEAR_PX);
  }, { passive: true });
  document.addEventListener('pointerleave', () => edge.classList.remove('near'));
  // The sidebar shown or hidden for good (the toolbar button, Settings, editing) ends a peek.
  new MutationObserver(() => {
    if (peeking() && !side.classList.contains('peek')) close();
    syncEdge();
  }).observe(side, { attributes: true, attributeFilter: ['style', 'class'] });
  syncEdge();
}
