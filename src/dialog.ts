// One dialog chrome for Help and Settings: the title and the list of tabs
// down the left, one scrolling pane at a time on the right. A tab with an
// icon gets a coloured tile in the list and a page header (tile, title, a
// line on what the page covers) at the top of its pane. Esc closes, and
// focus goes back to where it was; the preview shares the focus half
// through the two helpers.
import { esc } from './utils';
import { UI_ICON } from './control-icons';
import { openLayer, focusTrap, type Layer } from './layer';
import { bind } from './commands';
import { SIZE_BTN, wireSize } from './panel-size';
import { getDialogPlace, saveDialogPlace, textPref } from './storage';
import { setSidebarShown, sidebarShown } from './motion';

// Every mounted dialog; the page keys act on the one that is open.
const mounted: { isOpen: () => boolean; step: (dir: 1 | -1) => void; inSide: () => boolean; close: () => void; box: HTMLElement }[] = [];
const openOne = () => mounted.find(d => d.isOpen());
bind('dlg-tabs', key => openOne()?.step(key === '[' ? -1 : 1), () => !!openOne());

export interface DialogTab { key: string; label: string; hint?: string; icon?: string; tone?: string; desc?: string; body: string }
export interface DialogSpec { id: string; mark: string; title: string; subtitle: string; tabs: DialogTab[] }

const tile = (t: DialogTab, size = '') =>
  `<span class="fe-dlg-tile ${size}" style="--tone:${t.tone ?? 'var(--ac)'}" aria-hidden="true">${t.icon}</span>`;

export function renderDialog(d: DialogSpec): string {
  return `
  <div id="${esc(d.id)}" class="fe-dlg" style="display:none">
    <div class="fe-dlg-bg scrim"></div>
    <div class="fe-dlg-box panel" role="dialog" aria-labelledby="${esc(d.id)}-title" tabindex="-1">
      <div class="sect fe-dlg-title" data-level="page">
        <span class="fe-dlg-mark">${d.mark}</span>
        <span class="sect-tx"><b id="${esc(d.id)}-title">${esc(d.title)}</b><i>${esc(d.subtitle)}</i></span>
      </div>
      <div class="fe-dlg-acts"><button class="btn fe-dlg-place" data-icon title="Open in the sidebar">${UI_ICON.preview}</button>${SIZE_BTN(`${esc(d.id)}-size`)}<button class="btn fe-dlg-close" data-icon title="Close (Esc)">${UI_ICON.close}</button></div>
      <div class="fe-dlg-tabs" role="tablist">
        ${d.tabs.map(t => `<button class="fe-dlg-tab" role="tab" data-tab="${esc(t.key)}" title="${esc(t.label)} · [ ] switch tabs · Esc closes"><span class="fe-dlg-tab-main">${t.icon ? tile(t) : ''}<b>${esc(t.label)}</b></span>${t.hint ? `<i>${esc(t.hint)}</i>` : ''}</button>`).join('')}
      </div>
      ${d.tabs.map(t => `<div class="fe-dlg-pane" role="tabpanel" data-tab="${esc(t.key)}">${t.icon ? `<header class="sect fe-dlg-ph" data-level="page">${tile(t, 'lg')}<div class="sect-tx"><h2>${esc(t.label)}</h2>${t.desc || t.hint ? `<p>${esc(t.desc || t.hint!)}</p>` : ''}</div></header>` : ''}${t.body}</div>`).join('')}
    </div>
  </div>`;
}

// The preview remembers focus here until it opens through the layer service
// too. A stack, not one slot, so nested openings each return to their opener.
const focusStack: (HTMLElement | null)[] = [];
export function rememberFocus(): void {
  focusStack.push(document.activeElement as HTMLElement | null);
}
export function restoreFocus(): void {
  const el = focusStack.pop() ?? null;
  if (el && document.contains(el) && typeof el.focus === 'function') el.focus();
}

export interface Dialog { open(tab?: string): void; close(): void; isOpen(): boolean; show(tab: string): void }

// The pane over the sidebar that holds a dialog opened there; one at a time.
function sidePane(): HTMLElement | null {
  const side = document.getElementById('fe-side');
  if (!side) return null;
  let pane = document.getElementById('fe-side-pane');
  if (!pane) {
    pane = document.createElement('div');
    pane.id = 'fe-side-pane';
    pane.hidden = true;
    side.appendChild(pane);
  }
  return pane;
}

/** Close whichever dialog is open in the sidebar; false when none is. */
export function closeSideDialog(): boolean {
  const d = mounted.find(m => m.inSide());
  d?.close();
  return !!d;
}

// Wire a rendered dialog: close button and scrim, tab switching (the last
// tab is remembered per dialog), Esc, and focus in and out. It opens as a
// window over the page or as a pane over the sidebar, from the same markup,
// and remembers which (docs/system/dialog.md).
export function mountDialog(id: string, hooks: { onOpen?: () => void; onClose?: () => void } = {}): Dialog {
  const root = document.getElementById(id)!;
  const box = root.querySelector<HTMLElement>('.fe-dlg-box')!;
  const tabs = [...root.querySelectorAll<HTMLElement>('.fe-dlg-tab')];
  const panes = [...root.querySelectorAll<HTMLElement>('.fe-dlg-pane')];
  const lastTab = textPref(`bfb-dialog-tab:${id}`);
  const placeBtn = root.querySelector<HTMLElement>('.fe-dlg-place')!;
  wireSize(root.querySelector<HTMLElement>(`#${id}-size`)!, box, id);
  let place = getDialogPlace(id);
  const inSide = () => box.parentElement?.id === 'fe-side-pane' && !box.parentElement.hidden;
  const isOpen = () => root.style.display !== 'none' || inSide();
  // A sidebar folded away (by its setting or a docked preview) comes out for
  // the pane and goes back when the pane closes.
  let unfolded = false;

  function show(tab: string): void {
    if (!tabs.some(t => t.dataset.tab === tab)) tab = tabs[0]?.dataset.tab ?? '';
    tabs.forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
    panes.forEach(p => { p.classList.toggle('on', p.dataset.tab === tab); if (p.dataset.tab === tab) p.scrollTop = 0; });
    lastTab.set(tab);
  }
  const paintPlace = () => {
    placeBtn.title = place === 'side' ? 'Open as a window' : 'Open in the sidebar';
    placeBtn.classList.toggle('on', place === 'side');
  };
  paintPlace();
  let layer: Layer | null = null;
  function open(tab?: string): void {
    hooks.onOpen?.();
    show(tab ?? lastTab.get());
    const pane = place === 'side' ? sidePane() : null;
    if (pane) {
      // Another dialog in the pane gives way to this one.
      mounted.find(m => m.inSide() && m.box !== box)?.close();
      if (!sidebarShown()) { setSidebarShown(true); unfolded = true; }
      box.dataset.dock = '';
      pane.appendChild(box);
      pane.hidden = false;
      box.focus();
      return;
    }
    root.style.display = 'flex';
    if (layer?.open) { box.focus(); return; }
    // Esc and focus going back to the opener come from the layer.
    layer = openLayer(root, { kind: 'dialog', place: 'none', focus: box, backdrop: root.querySelector<HTMLElement>('.fe-dlg-bg'), onClose: () => { root.style.display = 'none'; hooks.onClose?.(); } });
  }
  function close(): void {
    if (inSide()) {
      const pane = box.parentElement!;
      pane.hidden = true;
      delete box.dataset.dock;
      root.appendChild(box);
      if (unfolded) { unfolded = false; setSidebarShown(false); }
      hooks.onClose?.();
      return;
    }
    layer?.close('api');
  }
  // Move between the window and the sidebar, keeping the page that is open.
  placeBtn.addEventListener('click', () => {
    const tab = tabs.find(t => t.classList.contains('on'))?.dataset.tab;
    close();
    place = place === 'side' ? 'window' : 'side';
    saveDialogPlace(id, place);
    paintPlace();
    open(tab);
  });

  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab!)));
  root.querySelector('.fe-dlg-close')!.addEventListener('click', close);
  // As a window, Tab stays inside it; in the sidebar it is part of the page.
  focusTrap(box, { when: () => isOpen() && !inSide() });
  const step = (dir: 1 | -1) => {
    const i = tabs.findIndex(t => t.classList.contains('on'));
    show(tabs[(i + dir + tabs.length) % tabs.length].dataset.tab!);
  };
  // [ and ] step through its pages while it is a window, or while the
  // keyboard is inside it in the sidebar; elsewhere they move strip tabs.
  const owns = () => root.style.display !== 'none' || (inSide() && box.contains(document.activeElement));
  mounted.push({ isOpen: owns, step, inSide, close, box });
  return { open, close, isOpen, show };
}
