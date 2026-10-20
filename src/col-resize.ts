// Resizable columns for every table the explorer renders (markdown tables and
// CSV/TSV previews). Each header cell carries the same drag handle as the
// listing's Details view; one handler on the document serves them all, so a
// table rendered later needs nothing wired up. Widths last until the table is
// rendered again; a double-click on a handle returns the table to its natural
// widths.

/** The handle markup a renderer puts inside each header cell. */
export const COL_HANDLE = '<span class="fe-col-rz" title="Drag to resize this column · double-click to reset"></span>';

const MIN_W = 40;
let installed = false;

export function installColumnResize(): void {
  if (installed) return;
  installed = true;

  const handleOf = (e: Event) => (e.target as Element | null)?.closest?.<HTMLElement>('table.fe-rz .fe-col-rz') ?? null;

  // A click on the handle must not sort the column.
  document.addEventListener('click', e => { if (handleOf(e)) e.stopPropagation(); }, true);

  document.addEventListener('dblclick', e => {
    const handle = handleOf(e);
    if (!handle) return;
    e.stopPropagation();
    const table = handle.closest<HTMLTableElement>('table')!;
    table.classList.remove('fe-rz-fixed');
    table.style.width = '';
    table.querySelectorAll<HTMLElement>('thead th').forEach(th => { th.style.width = ''; });
  }, true);

  document.addEventListener('pointerdown', e => {
    const handle = handleOf(e);
    if (!handle || e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const th = handle.closest<HTMLElement>('th')!;
    const table = th.closest<HTMLTableElement>('table')!;
    const ths = [...table.querySelectorAll<HTMLElement>('thead th')];
    // Freeze every column at its rendered width first, so dragging one column
    // moves only that column and the table grows or shrinks with it.
    if (!table.classList.contains('fe-rz-fixed')) {
      const widths = ths.map(h => h.getBoundingClientRect().width);
      ths.forEach((h, i) => { h.style.width = widths[i] + 'px'; });
      table.style.width = widths.reduce((a, b) => a + b, 0) + 'px';
      table.classList.add('fe-rz-fixed');
    }
    const startX = e.clientX;
    const startW = parseFloat(th.style.width);
    const startTable = parseFloat(table.style.width);
    document.body.classList.add('fe-col-dragging');
    const onMove = (ev: PointerEvent) => {
      const w = Math.max(MIN_W, startW + ev.clientX - startX);
      th.style.width = w + 'px';
      table.style.width = startTable + (w - startW) + 'px';
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.classList.remove('fe-col-dragging');
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, true);
}
