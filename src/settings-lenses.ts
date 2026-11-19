// Settings, Sidebar, Sections: one row per sidebar lens with a drag handle and a
// switch. Dragging a row, or Alt with an arrow key on its handle, changes the
// rail's order; the switch takes a lens off the rail. The last lens on stays on.

import { el } from './el';
import { esc } from './utils';
import { PI } from './icons';
import { switchHtml } from './controls';
import { saveSettings } from './storage';
import { lensOrder, lensOn, setLensOn } from './lens-list';
import type { App } from './app';
import type { Settings } from './types';

type Toast = (msg: string, ms?: number) => void;

/** Wires the Sections list once; call the returned function when Settings opens. */
export function initLensSettings(app: App, settings: Settings, toast: Toast): () => void {
  const list = el('fe-st-lenses');

  const apply = () => { saveSettings(settings); app.arrangeLenses?.(settings); };

  function render(): void {
    list.innerHTML = lensOrder(settings).map(l => {
      const on = lensOn(settings, l.id);
      return `<div class="fe-lens-row${on ? '' : ' off'}" data-lens="${l.id}" draggable="true">
        <button type="button" class="fe-lens-grip" title="Drag, or Alt+arrow, to move" aria-label="Move ${esc(l.label)}">${PI.drag}</button>
        <span class="fe-lens-ico" aria-hidden="true">${l.icon}</span>
        <span class="fe-lens-nm">${esc(l.label)}</span>
        ${switchHtml({ id: l.id === 'history' ? 'fe-st-sec-recent' : undefined, title: on ? 'On the sidebar' : 'Off the sidebar', label: `Show ${l.label}`, checked: on, small: true, cls: 'fe-st-lens-on' })}
      </div>`;
    }).join('');
  }

  const order = () => [...list.querySelectorAll<HTMLElement>('.fe-lens-row')].map(r => r.dataset.lens!);
  const moved = () => { settings.lensOrder = order(); apply(); };

  list.addEventListener('change', e => {
    const t = e.target as HTMLInputElement;
    if (!t.classList.contains('fe-st-lens-on')) return;
    const row = t.closest<HTMLElement>('.fe-lens-row')!;
    if (!setLensOn(settings, row.dataset.lens!, t.checked)) {
      t.checked = true;
      toast('One section has to stay on');
      return;
    }
    row.classList.toggle('off', !t.checked);
    t.title = t.checked ? 'On the sidebar' : 'Off the sidebar';
    apply();
  });

  // Keyboard: Alt+Up or Alt+Down on a handle moves its row, and focus stays on it.
  list.addEventListener('keydown', e => {
    const grip = (e.target as HTMLElement).closest<HTMLElement>('.fe-lens-grip');
    if (!grip || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const row = grip.closest<HTMLElement>('.fe-lens-row')!;
    const other = e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
    if (!other) return;
    if (e.key === 'ArrowUp') other.before(row); else other.after(row);
    grip.focus();
    moved();
  });

  // Mouse: drag a row onto another; it lands above or below by the pointer's half.
  let dragged: HTMLElement | null = null;
  list.addEventListener('dragstart', e => {
    dragged = (e.target as HTMLElement).closest<HTMLElement>('.fe-lens-row');
    if (!dragged) return;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', dragged.dataset.lens!);
    requestAnimationFrame(() => dragged?.classList.add('dragging'));
  });
  list.addEventListener('dragover', e => {
    const over = (e.target as HTMLElement).closest<HTMLElement>('.fe-lens-row');
    if (!dragged || !over || over === dragged) return;
    e.preventDefault();
    const r = over.getBoundingClientRect();
    if (e.clientY < r.top + r.height / 2) over.before(dragged); else over.after(dragged);
  });
  list.addEventListener('drop', e => e.preventDefault());
  list.addEventListener('dragend', () => {
    if (!dragged) return;
    dragged.classList.remove('dragging');
    dragged = null;
    if (order().join() !== lensOrder(settings).map(l => l.id).join()) moved();
  });

  return render;
}
