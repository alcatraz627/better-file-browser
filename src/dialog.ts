// One dialog chrome for Help and Settings, the shape of the kanban board's
// help modal: a title row with a mark and a subtitle, a tab strip, and one
// scrolling pane at a time. Title and tabs are flex:none siblings of the
// pane, so the chrome never scrolls. Esc closes, and focus goes back to
// where it was; the preview shares the focus half through the two helpers.
import { esc } from './utils';

export interface DialogTab { key: string; label: string; hint?: string; body: string }
export interface DialogSpec { id: string; mark: string; title: string; subtitle: string; tabs: DialogTab[] }

export function renderDialog(d: DialogSpec): string {
  return `
  <div id="${esc(d.id)}" class="fe-dlg" style="display:none">
    <div class="fe-dlg-bg"></div>
    <div class="fe-dlg-box" role="dialog" aria-labelledby="${esc(d.id)}-title" tabindex="-1">
      <div class="fe-dlg-title">
        <span class="fe-dlg-mark">${d.mark}</span>
        <span class="fe-dlg-tx"><b id="${esc(d.id)}-title">${esc(d.title)}</b><i>${esc(d.subtitle)}</i></span>
        <button class="fe-dlg-close" title="Close (Esc)">✕</button>
      </div>
      <div class="fe-dlg-tabs" role="tablist">
        ${d.tabs.map(t => `<button class="fe-dlg-tab" role="tab" data-tab="${esc(t.key)}" title="${esc(t.label)} · [ ] switch tabs · Esc closes"><b>${esc(t.label)}</b>${t.hint ? `<i>${esc(t.hint)}</i>` : ''}</button>`).join('')}
      </div>
      ${d.tabs.map(t => `<div class="fe-dlg-pane" role="tabpanel" data-tab="${esc(t.key)}">${t.body}</div>`).join('')}
    </div>
  </div>`;
}

let focusBefore: HTMLElement | null = null;
// Called when any overlay opens: remember what had focus so close can return it.
export function rememberFocus(): void {
  focusBefore = document.activeElement as HTMLElement | null;
}
export function restoreFocus(): void {
  const el = focusBefore;
  focusBefore = null;
  if (el && document.contains(el) && typeof el.focus === 'function') el.focus();
}

export interface Dialog { open(tab?: string): void; close(): void; isOpen(): boolean; show(tab: string): void }

// Wire a rendered dialog: close button and scrim, tab switching (the last
// tab is remembered per dialog), Esc, and focus in and out.
export function mountDialog(id: string, hooks: { onOpen?: () => void; onClose?: () => void } = {}): Dialog {
  const root = document.getElementById(id)!;
  const box = root.querySelector<HTMLElement>('.fe-dlg-box')!;
  const tabs = [...root.querySelectorAll<HTMLElement>('.fe-dlg-tab')];
  const panes = [...root.querySelectorAll<HTMLElement>('.fe-dlg-pane')];
  const memory = `bfb-dialog-tab:${id}`;
  const isOpen = () => root.style.display !== 'none';

  function show(tab: string): void {
    if (!tabs.some(t => t.dataset.tab === tab)) tab = tabs[0]?.dataset.tab ?? '';
    tabs.forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
    panes.forEach(p => { p.classList.toggle('on', p.dataset.tab === tab); if (p.dataset.tab === tab) p.scrollTop = 0; });
    try { localStorage.setItem(memory, tab); } catch { /* fine */ }
  }
  function open(tab?: string): void {
    rememberFocus();
    hooks.onOpen?.();
    let last = '';
    try { last = localStorage.getItem(memory) || ''; } catch { /* fine */ }
    show(tab ?? last);
    root.style.display = 'flex';
    box.focus();
  }
  function close(): void {
    if (!isOpen()) return;
    root.style.display = 'none';
    hooks.onClose?.();
    restoreFocus();
  }

  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab!)));
  root.querySelector('.fe-dlg-close')!.addEventListener('click', close);
  root.querySelector('.fe-dlg-bg')!.addEventListener('click', close);
  document.addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if ((e.key === '[' || e.key === ']') && !['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement as HTMLElement)?.tagName)) {
      const i = tabs.findIndex(t => t.classList.contains('on'));
      const j = (i + (e.key === ']' ? 1 : -1) + tabs.length) % tabs.length;
      e.preventDefault();
      show(tabs[j].dataset.tab!);
    }
  });
  return { open, close, isOpen, show };
}
