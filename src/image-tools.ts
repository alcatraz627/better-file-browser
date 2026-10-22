// The image preview's toolbar: zoom, actual size, rotate, flip, copy, open in the default app.
import { UI_ICON } from './control-icons';
import { esc } from './utils';
import { errorText } from './errors';

export interface View { fit: boolean; zoom: number; rot: number; flip: boolean }
export const START_VIEW: View = { fit: true, zoom: 1, rot: 0, flip: false };

/// The picture's size on screen at zoom 1: width and height swap on a quarter turn.
export function turnedSize(w: number, h: number, rot: number): { w: number; h: number } {
  return rot % 180 === 0 ? { w, h } : { w: h, h: w };
}

/// The zoom that fits the picture inside the stage, never enlarging past actual size.
export function fitZoom(w: number, h: number, rot: number, stageW: number, stageH: number): number {
  const t = turnedSize(w, h, rot);
  if (!t.w || !t.h) return 1;
  return Math.min(1, Math.max(stageW - 32, 1) / t.w, Math.max(stageH - 32, 1) / t.h);
}

export const STEP = 1.25;
export const clampZoom = (z: number) => Math.min(16, Math.max(0.05, z));

/// The CSS transform for a view: the flip mirrors the screen, after the turn.
export function viewTransform(v: View): string {
  return `translate(-50%,-50%) scaleX(${v.flip ? -1 : 1}) rotate(${v.rot}deg)`;
}

const BTN = (act: string, icon: string, text: string, title: string) =>
  `<button class="btn" data-img="${act}" title="${esc(title)}">${icon}<span>${text}</span></button>`;

/// Builds the toolbar and the zoomable stage inside `wrap`. `open` hands the file to its default app.
export function mountImageTools(wrap: HTMLElement, o: {
  href: string; name: string; path: string;
  notify: (m: string) => void;
  openNative: (path: string) => Promise<boolean>;
}): void {
  wrap.innerHTML = `
    <div class="bar fe-ql-imgbar" role="toolbar" aria-label="Image tools">
      ${BTN('in', UI_ICON.zoomIn, 'zoom in', 'Zoom in')}
      ${BTN('out', UI_ICON.zoomOut, 'zoom out', 'Zoom out')}
      ${BTN('fit', UI_ICON.fit, 'fit', 'Fit the picture in the panel')}
      ${BTN('actual', UI_ICON.actualSize, 'actual size', 'Show at 100%')}
      ${BTN('rotate', UI_ICON.rotate, 'rotate', 'Turn a quarter clockwise')}
      ${BTN('flip', UI_ICON.flip, 'flip', 'Mirror left to right')}
      ${BTN('copy', UI_ICON.copyImage, 'copy image', 'Copy the picture as shown')}
      ${BTN('open', UI_ICON.external, 'open in app', 'Open in the default app')}
    </div>
    <div class="fe-ql-imgstage"><div class="fe-ql-imgsizer"><img class="fe-ql-img" src="${esc(o.href)}" alt="${esc(o.name)}"></div></div>
    <div class="fe-ql-dim"></div>`;
  const stage = wrap.querySelector<HTMLElement>('.fe-ql-imgstage')!;
  const sizer = wrap.querySelector<HTMLElement>('.fe-ql-imgsizer')!;
  const img = wrap.querySelector<HTMLImageElement>('img.fe-ql-img')!;
  const dim = wrap.querySelector<HTMLElement>('.fe-ql-dim')!;
  let v: View = { ...START_VIEW };

  const natural = () => ({ w: img.naturalWidth, h: img.naturalHeight });
  const zoomNow = () => v.fit ? fitZoom(natural().w, natural().h, v.rot, stage.clientWidth, stage.clientHeight) : v.zoom;
  const draw = () => {
    const n = natural();
    if (!n.w) return;
    const z = zoomNow();
    const t = turnedSize(n.w * z, n.h * z, v.rot);
    sizer.style.width = `${t.w}px`; sizer.style.height = `${t.h}px`;
    img.style.width = `${n.w * z}px`; img.style.height = `${n.h * z}px`;
    img.style.transform = viewTransform(v);
    dim.textContent = `${n.w} × ${n.h} · ${Math.round(z * 100)}%`;
    wrap.dataset.zoom = String(Math.round(z * 100));
    wrap.dataset.rot = String(v.rot);
    wrap.dataset.flip = v.flip ? '1' : '0';
  };
  if (img.complete) draw(); else img.addEventListener('load', draw, { once: true });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { if (v.fit) draw(); }).observe(stage);

  const copy = async () => {
    try {
      const reply = await new Promise<{ ok: boolean; base64?: string; type?: string; error?: string }>(res =>
        chrome.runtime.sendMessage({ type: 'bfb-fetch-image', url: new URL(o.href, location.href).href }, r => res(r ?? { ok: false, error: 'no reply' })));
      if (!reply.ok || !reply.base64) throw new Error(reply.error || 'could not read the image');
      const bytes = Uint8Array.from(atob(reply.base64), c => c.charCodeAt(0));
      const src = URL.createObjectURL(new Blob([bytes], { type: reply.type || 'image/png' }));
      const pic = new Image();
      await new Promise((ok, bad) => { pic.onload = ok; pic.onerror = () => bad(new Error('cannot decode the image')); pic.src = src; });
      const n = { w: pic.naturalWidth, h: pic.naturalHeight };
      const t = turnedSize(n.w, n.h, v.rot);
      const cv = document.createElement('canvas');
      cv.width = t.w; cv.height = t.h;
      const ctx = cv.getContext('2d')!;
      ctx.translate(t.w / 2, t.h / 2);
      ctx.scale(v.flip ? -1 : 1, 1);
      ctx.rotate(v.rot * Math.PI / 180);
      ctx.drawImage(pic, -n.w / 2, -n.h / 2);
      URL.revokeObjectURL(src);
      const png = await new Promise<Blob | null>(res => cv.toBlob(res, 'image/png'));
      if (!png) throw new Error('could not encode the image');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      o.notify('Image copied');
    } catch (e) { o.notify(errorText(e, 'Copying the image')); }
  };

  const act = (a: string) => {
    if (a === 'in' || a === 'out') { v = { ...v, zoom: clampZoom(zoomNow() * (a === 'in' ? STEP : 1 / STEP)), fit: false }; }
    else if (a === 'fit') v = { ...v, fit: true };
    else if (a === 'actual') v = { ...v, zoom: 1, fit: false };
    else if (a === 'rotate') v = { ...v, rot: (v.rot + 90) % 360 };
    else if (a === 'flip') v = { ...v, flip: !v.flip };
    else if (a === 'copy') { void copy(); return; }
    else if (a === 'open') { void o.openNative(o.path).then(ok => { if (!ok) o.notify('Open in app needs the native host: run native/install.sh'); }); return; }
    draw();
  };
  wrap.querySelector('.fe-ql-imgbar')!.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-img]');
    if (b) act(b.dataset.img!);
  });
  // Wheel with ⌘ or ⌃ zooms, like a trackpad pinch.
  stage.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    act(e.deltaY < 0 ? 'in' : 'out');
  }, { passive: false });
}
