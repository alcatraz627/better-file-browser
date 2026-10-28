// Moving around a drawn diagram: zoom with the toolbar or ⌘ or ⌃ with the
// wheel; drag to look around once zoomed; double-click to fit again. The same
// behaviour runs on a diagram in the page and in its large view. No keys of
// its own: = - 0 already zoom the listing.
import { UI_ICON } from './control-icons';
import { esc } from './utils';

export const STEP = 1.25;
export const clampZoom = (z: number) => Math.min(8, Math.max(0.5, z));

export interface Pan { z: number; x: number; y: number }
export const FIT: Pan = { z: 1, x: 0, y: 0 };

/// The view after zooming by `k` so the point `at` (in the diagram's own unzoomed box) stays under the pointer.
export function zoomAt(v: Pan, k: number, at: { x: number; y: number }): Pan {
  const z = clampZoom(v.z * k);
  const r = z / v.z;
  return { z, x: at.x - (at.x - v.x) * r, y: at.y - (at.y - v.y) * r };
}

const BTN = (act: string, icon: string, title: string, extra = '') =>
  `<button type="button" class="btn" data-icon data-size="sm" data-variant="ghost" data-mm="${act}" title="${esc(title)}" aria-label="${esc(title)}"${extra}>${icon}</button>`;

/// The zoom buttons, shared by a diagram's bar and its large view.
export const ZOOM_BUTTONS = BTN('out', UI_ICON.zoomOut, 'Zoom out (⌘ scroll)') + BTN('fit', UI_ICON.fit, 'Fit (double-click)') + BTN('in', UI_ICON.zoomIn, 'Zoom in (⌘ scroll)');

/// Every button on a diagram's bar in a page.
export const DIAGRAM_BUTTONS = ZOOM_BUTTONS
  + BTN('source', UI_ICON.fmtCode, 'Show the source', ' aria-pressed="false"')
  + BTN('copy', UI_ICON.copy, 'Copy the source')
  + BTN('save', UI_ICON.export, 'Save as SVG')
  + BTN('large', UI_ICON.expand, 'Open large');

const views = new WeakMap<HTMLElement, Pan>();

/// Draw `stage`'s diagram at view `v`; the stage's data-zoom says the zoom in percent.
function apply(stage: HTMLElement, v: Pan): void {
  views.set(stage, v);
  const svg = stage.querySelector<SVGElement>(':scope > svg');
  if (svg) svg.style.transform = v.z === 1 && !v.x && !v.y ? '' : `translate(${v.x}px,${v.y}px) scale(${v.z})`;
  stage.dataset.zoom = String(Math.round(v.z * 100));
  stage.classList.toggle('zoomed', v.z !== 1);
}

/// Back to the whole diagram, fitted. Called after a fresh drawing too.
export function fitDiagram(stage: HTMLElement): void { apply(stage, FIT); }

/// Zoom by `k`, about the pointer when given, else about the middle.
export function zoomDiagram(stage: HTMLElement, k: number, client?: { x: number; y: number }): void {
  const svg = stage.querySelector<SVGElement>(':scope > svg');
  if (!svg) return;
  const v = views.get(stage) ?? FIT;
  const r = svg.getBoundingClientRect();
  // The diagram's unzoomed box starts where its zoomed box starts, less the pan.
  const left = r.left - v.x, top = r.top - v.y;
  const at = client ? { x: client.x - left, y: client.y - top } : { x: r.width / v.z / 2, y: r.height / v.z / 2 };
  apply(stage, zoomAt(v, k, at));
}

/// Act on a zoom button: 'in', 'out' or 'fit'. Returns false for any other button.
export function zoomAction(stage: HTMLElement, act: string): boolean {
  if (act === 'in') zoomDiagram(stage, STEP);
  else if (act === 'out') zoomDiagram(stage, 1 / STEP);
  else if (act === 'fit') fitDiagram(stage);
  else return false;
  return true;
}

/// Wheel, drag, double-click and keys on a stage. Bound once; the diagram inside may be redrawn.
export function bindDiagramStage(stage: HTMLElement): void {
  if (stage.dataset.panBound) return;
  stage.dataset.panBound = '1';
  stage.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    zoomDiagram(stage, e.deltaY < 0 ? STEP : 1 / STEP, { x: e.clientX, y: e.clientY });
  }, { passive: false });
  stage.addEventListener('dblclick', () => fitDiagram(stage));
  stage.addEventListener('pointerdown', e => {
    const v0 = views.get(stage) ?? FIT;
    if (e.button !== 0 || v0.z === 1) return;
    // No preventDefault here: Chrome would then drop the double-click that fits the diagram.
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('dragging');
    const sx = e.clientX, sy = e.clientY;
    const move = (m: PointerEvent) => apply(stage, { ...v0, x: v0.x + m.clientX - sx, y: v0.y + m.clientY - sy });
    const up = () => {
      stage.classList.remove('dragging');
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
    };
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
  });
}

/// Save a diagram's drawing as an .svg file in Downloads.
export function saveSvg(svg: SVGElement, name = 'diagram.svg'): void {
  const copy = svg.cloneNode(true) as SVGElement;
  copy.style.removeProperty('transform');
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const url = URL.createObjectURL(new Blob([copy.outerHTML], { type: 'image/svg+xml' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
