// Resizable columns for every table the explorer renders (markdown tables and
// CSV/TSV previews). A column's right edge can be dragged from its header
// handle or from any cell along it; one handler on the document serves every
// table, so a table rendered later needs nothing wired up. Widths last until
// the table is rendered again; a double-click on an edge returns the table to
// its first widths. A wide table starts with widths from its content, so one
// long column cannot squeeze the rest (docs/system/resize.md).
import { startDrag } from './resize';

/** The handle markup a renderer puts inside each header cell. */
export const COL_HANDLE = '<span class="fe-col-rz rz" data-axis="x" title="Drag to resize this column · double-click to reset"></span>';

const MIN_W = 40;
// How close to a cell's right edge the pointer must be to grab the column.
const EDGE = 5;
let installed = false;

const cellsOf = (table: HTMLTableElement) => [...table.querySelectorAll<HTMLElement>('thead th')];

/// The column whose right edge is under the pointer, from its header handle or
/// from the edge of any cell in the column.
function edgeAt(e: MouseEvent): { table: HTMLTableElement; th: HTMLElement } | null {
  const t = e.target as Element | null;
  const handle = t?.closest?.<HTMLElement>('table.fe-rz .fe-col-rz');
  if (handle) return { table: handle.closest('table')!, th: handle.closest('th')! };
  const cell = t?.closest?.<HTMLTableCellElement>('table.fe-rz td, table.fe-rz th');
  if (!cell) return null;
  const r = cell.getBoundingClientRect();
  if (r.right - e.clientX > EDGE || r.right - e.clientX < -1) return null;
  const table = cell.closest<HTMLTableElement>('table')!;
  const th = cellsOf(table)[cell.cellIndex + cell.colSpan - 1];
  return th ? { table, th } : null;
}

/// Fix every column at its current width, so moving one edge moves only that
/// column and the table grows or shrinks with it.
function freeze(table: HTMLTableElement): void {
  if (table.classList.contains('fe-rz-fixed')) return;
  const ths = cellsOf(table);
  const widths = ths.map(h => h.getBoundingClientRect().width);
  ths.forEach((h, i) => { h.style.width = widths[i] + 'px'; });
  table.style.width = widths.reduce((a, b) => a + b, 0) + 'px';
  table.classList.add('fe-rz-fixed');
}

/// First widths for a table wider than its box: each column gets room for
/// most of its cells (the 90th longest), within a floor and a ceiling, so a
/// column of long sentences wraps instead of pushing every other column off
/// screen. A table that already fits is left to the browser.
export function fitColumns(table: HTMLTableElement): void {
  const box = table.parentElement;
  if (!box || table.classList.contains('fe-rz-fixed') || table.scrollWidth <= box.clientWidth + 1) return;
  const ths = cellsOf(table);
  if (ths.length < 2) return;
  const rows = [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')].slice(0, 200);
  // Text is measured in the cells' own font, so monospace and proportional
  // tables both get room for what they hold.
  const ctx = document.createElement('canvas').getContext('2d')!;
  const textW = (el: Element | undefined) => { if (!el) return 0; ctx.font = getComputedStyle(el).font; return ctx.measureText((el.textContent ?? '').trim()).width; };
  const pad = (el: Element | undefined) => { if (!el) return 0; const cs = getComputedStyle(el); return parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight); };
  const want = ths.map((th, i) => {
    const ws = rows.map(r => textW(r.cells[i])).sort((a, b) => a - b);
    const p90 = ws.length ? ws[Math.min(ws.length - 1, Math.floor(ws.length * 0.9))] : 0;
    const body = p90 + pad(rows[0]?.cells[i]) + 4;
    const head = textW(th) + pad(th) + 18;   // room for the sort arrow and the handle
    return Math.max(56, Math.min(420, Math.ceil(Math.max(head, body))));
  });
  const total = want.reduce((a, b) => a + b, 0);
  // Room left in the box goes to the columns that wanted the most.
  const spare = box.clientWidth - total;
  const widths = spare > 0 ? want.map(w => w + spare * (w / total)) : want;
  ths.forEach((h, i) => { h.style.width = Math.round(widths[i]) + 'px'; });
  table.style.width = Math.round(widths.reduce((a, b) => a + b, 0)) + 'px';
  table.classList.add('fe-rz-fixed', 'fe-rz-fit');
}

export function installColumnResize(): void {
  if (installed) return;
  installed = true;

  // A wide table gets its first widths once it is in the page.
  // Measured a frame later, once the new table has its layout.
  const fitAll = (root: ParentNode) => requestAnimationFrame(() => root.querySelectorAll<HTMLTableElement>('table.fe-rz:not(.fe-rz-fixed)').forEach(fitColumns));
  new MutationObserver(muts => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n instanceof Element && (n.matches('table.fe-rz') || n.querySelector('table.fe-rz'))) fitAll(n.parentNode ?? n);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  fitAll(document);

  // The resize cursor shows wherever an edge can be grabbed.
  document.addEventListener('pointermove', e => {
    if (document.body.classList.contains('fe-resizing')) return;
    const cell = (e.target as Element | null)?.closest?.('table.fe-rz td, table.fe-rz th');
    const table = cell?.closest<HTMLElement>('table');
    document.querySelectorAll('table.fe-col-edge').forEach(x => { if (x !== table) x.classList.remove('fe-col-edge'); });
    table?.classList.toggle('fe-col-edge', !!edgeAt(e));
  }, { passive: true });

  // A press on an edge must not sort the column or select text.
  document.addEventListener('click', e => { if (edgeAt(e)) e.stopPropagation(); }, true);

  document.addEventListener('dblclick', e => {
    const hit = edgeAt(e);
    if (!hit) return;
    e.stopPropagation();
    const { table } = hit;
    table.classList.remove('fe-rz-fixed', 'fe-rz-fit');
    table.style.width = '';
    cellsOf(table).forEach(th => { th.style.width = ''; });
    fitColumns(table);
  }, true);

  document.addEventListener('pointerdown', e => {
    const hit = edgeAt(e);
    if (!hit || e.button !== 0) return;
    e.stopPropagation();
    const { table, th } = hit;
    freeze(table);
    const startW = parseFloat(th.style.width);
    const startTable = parseFloat(table.style.width);
    th.querySelector('.fe-col-rz')?.classList.add('drag');
    startDrag(e, 'col-resize', dx => {
      const w = Math.max(MIN_W, startW + dx);
      th.style.width = w + 'px';
      table.style.width = startTable + (w - startW) + 'px';
    }, () => th.querySelector('.fe-col-rz')?.classList.remove('drag'));
  }, true);
}
