// Pictures and mock pages in a doc view. Each one can grow in place to the
// full row (several at once), open large on its own with ← → through its
// set, or be compared with another of its set side by side. A mock page
// (.html beside the doc) runs live in a frame that may run its own script
// but cannot reach bfb, the files or the network. Pictures inside a view's
// prose (markdown images) open large the same way.
import { esc } from './utils';
import { UI_ICON, GLYPH } from './control-icons';
import { openLayer, type Layer } from './layer';
import { mountImageTools } from './image-tools';
import { bind } from './commands';
import { mountDiagram, type LabOptions } from './diagram-lab';

/** The width a mock page is laid out at before it is scaled into its tile. */
const MOCK_W = 1280;
/** How tall a mock page is drawn in the compare view, so both sides scroll together. */
const MOCK_TALL = 2400;

/** A box drawn on a picture to say "look here": its place as fractions (0 to 1) of the picture, and a short label. */
export interface Mark { x: number; y: number; w: number; h: number; label?: string }
export interface Media { src: string; name: string; kind: 'img' | 'html'; marks?: Mark[] }
/** An `images` entry: a path, or a path with the marks to draw on it. */
export type ImageEntry = string | { src: string; marks?: Mark[] };

/** The most marks drawn on one picture; past this they stop helping. */
const MAX_MARKS = 12;

const fraction = (n: unknown) => typeof n === 'number' && n >= 0 && n <= 1;
/** The marks worth drawing: those whose box lies inside the picture, up to MAX_MARKS. */
export function marksOf(v: unknown): Mark[] {
  if (!Array.isArray(v)) return [];
  return v.filter((m): m is Mark => !!m && [m.x, m.y, m.w, m.h].every(fraction) && m.x + m.w <= 1.001 && m.y + m.h <= 1.001)
    .slice(0, MAX_MARKS).map(m => ({ x: m.x, y: m.y, w: m.w, h: m.h, label: typeof m.label === 'string' ? m.label : undefined }));
}

/** What an `images` entry points at: a picture or a mock page inside the doc's folder, a web picture, or nothing when it climbs out with `..`. */
export function mediaOf(base: string, entry: ImageEntry): Media | null {
  const p = typeof entry === 'string' ? entry : entry?.src;
  if (typeof p !== 'string') return null;
  const html = /\.html?$/i.test(p);
  const marks = typeof entry === 'object' && !html ? marksOf(entry.marks) : [];
  const withMarks = (m: Media): Media => marks.length ? { ...m, marks } : m;
  if (/^https?:\/\//.test(p)) return html ? null : withMarks({ src: p, name: p.split('/').pop() || p, kind: 'img' });
  if (!p || p.startsWith('/') || p.split(/[\\/]/).includes('..') || /^[a-z]+:/i.test(p)) return null;
  return withMarks({ src: base + p.split('/').map(encodeURIComponent).join('/'), name: p, kind: html ? 'html' : 'img' });
}

/** The boxes for a picture's marks, numbered; placed over the picture by placeMarks or by their container. */
const marksHtml = (marks: Mark[]) => `<span class="fe-dv-marks" aria-hidden="true">${marks.map((m, i) =>
  `<span class="fe-dv-mark" style="--x:${m.x};--y:${m.y};--w:${m.w};--h:${m.h}"${m.label ? ` title="${esc(m.label)}"` : ''}><b>${i + 1}</b></span>`).join('')}</span>`;

/** The key under a marked picture: each mark's number and label. */
const markKeyHtml = (marks: Mark[]) => marks.some(m => m.label)
  ? `<figcaption class="fe-dv-mark-key">${marks.map((m, i) => `<span><b>${i + 1}</b>${esc(m.label ?? '')}</span>`).join('')}</figcaption>`
  : '';

/**
 * Lay a picture's marks over the part of the box the picture is drawn in.
 * A tile letterboxes its picture (object-fit: contain), so the marks follow
 * the drawn picture, not the element.
 */
function placeMarks(img: HTMLImageElement, layer: HTMLElement): void {
  const host = layer.offsetParent as HTMLElement | null;
  if (!host || !img.naturalWidth) return;
  const r = img.getBoundingClientRect(), h = host.getBoundingClientRect();
  const s = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
  const w = img.naturalWidth * s, ht = img.naturalHeight * s;
  layer.style.left = `${r.left - h.left + host.scrollLeft + (r.width - w) / 2}px`;
  layer.style.top = `${r.top - h.top + host.scrollTop + (r.height - ht) / 2}px`;
  layer.style.width = `${w}px`;
  layer.style.height = `${ht}px`;
}

/** Keep a marked picture's boxes on it as it loads, grows, shrinks or zooms. */
function followMarks(img: HTMLImageElement, layer: HTMLElement): void {
  const place = () => placeMarks(img, layer);
  if (img.complete) place(); else img.addEventListener('load', place, { once: true });
  new ResizeObserver(place).observe(img);
}

const actBtn = (act: string, icon: string, title: string, extra = '') =>
  `<button type="button" class="btn" data-icon data-size="sm" data-variant="ghost" data-media="${act}" title="${esc(title)}" aria-label="${esc(title)}"${extra}>${icon}</button>`;

/** One picture or mock page with its grow, open-large and (when `compare`) compare buttons. */
export function mediaHtml(m: Media, compare = false): string {
  const body = m.kind === 'html'
    ? `<div class="fe-dv-frame"><iframe sandbox="allow-scripts" src="${esc(m.src)}" title="${esc(m.name)}" loading="lazy" tabindex="-1"></iframe></div>`
    : `<img src="${esc(m.src)}" alt="${esc(m.name)}" loading="lazy">${m.marks ? marksHtml(m.marks) : ''}`;
  return `<figure class="fe-dv-media" data-kind="${m.kind}" data-src="${esc(m.src)}" data-name="${esc(m.name)}"${m.marks ? ` data-marks="${esc(JSON.stringify(m.marks))}"` : ''}>
    ${body}
    <span class="fe-dv-media-acts">
      ${m.marks ? actBtn('marks', UI_ICON.eye, 'Show or hide the marks', ' aria-pressed="true"') : ''}
      ${m.kind === 'img' ? actBtn('zoom', UI_ICON.zoomIn, 'Grow to the full row, or shrink back') : ''}
      ${actBtn('focus', UI_ICON.size, 'Open large; ← → go to the next')}
      ${compare ? actBtn('compare', GLYPH.column, 'Compare with another side by side', ' aria-pressed="false"') : ''}
    </span>
    ${m.marks ? markKeyHtml(m.marks) : ''}
  </figure>`;
}

/** A row of pictures that open large as one set. */
export function stripHtml(ms: Media[]): string {
  return ms.length ? `<div class="fe-dv-strip" data-media-set>${ms.map(m => mediaHtml(m)).join('')}</div>` : '';
}

const mediaIn = (scope: Element) => [...scope.querySelectorAll<HTMLElement>('.fe-dv-media')];
const toMedia = (f: HTMLElement): Media => {
  const marks = f.dataset.marks ? marksOf(JSON.parse(f.dataset.marks)) : [];
  return { src: f.dataset.src!, name: f.dataset.name!, kind: f.dataset.kind as Media['kind'], ...(marks.length ? { marks } : {}) };
};
const smooth = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

/** Grow or shrink one picture in place; a grown one is scrolled into view. */
function toggleZoom(f: HTMLElement): void {
  const on = !f.classList.contains('zoomed');
  f.classList.toggle('zoomed', on);
  // An option spans the row while any of its pictures is grown.
  const opt = f.closest<HTMLElement>('[data-media-label]');
  opt?.classList.toggle('zoomed', !!opt.querySelector('.fe-dv-media.zoomed'));
  if (on) requestAnimationFrame(() => f.scrollIntoView({ block: 'nearest', behavior: smooth() }));
}

/** Shrink every grown picture; false when none was grown. */
export function unzoomAll(box: HTMLElement): boolean {
  const zoomed = [...box.querySelectorAll<HTMLElement>('.zoomed')];
  zoomed.forEach(z => z.classList.remove('zoomed'));
  return zoomed.length > 0;
}

// The large view: one item at a time with ← → through its set, or two side by side.
let viewer: { layer: Layer; step?: (by: number) => void } | null = null;

// Whether marks show across the page; the large view starts the same way.
let marksShown = true;
/** Show or hide every picture's marks and their key in a view, and in any large view opened from it. */
export function showMarks(root: HTMLElement, on: boolean): void {
  marksShown = on;
  root.classList.toggle('marks-off', !on);
}
// ← → step through the set while the large view is open, whichever view opened it.
bind('dp-view-step', k => viewer?.step?.(k === '←' ? -1 : 1), () => !!viewer?.layer.open);

function shell(title: string, label: string): { root: HTMLElement; body: HTMLElement; head: HTMLElement } {
  const root = document.createElement('div');
  root.className = 'fe-dlg fe-dv-view';
  root.innerHTML = `<div class="fe-dlg-bg scrim"></div>
    <div class="panel fe-dv-view-box" role="dialog" aria-label="${esc(label)}" tabindex="-1">
      <header class="bar fe-dv-view-head"><b class="fe-dv-view-title">${esc(title)}</b><span class="fe-dv-view-tools"></span>${actBtn('close', UI_ICON.close, 'Close (Esc)')}</header>
      <div class="fe-dv-view-body"></div>
    </div>`;
  (document.getElementById('fe') ?? document.body).append(root);
  return { root, body: root.querySelector('.fe-dv-view-body')!, head: root.querySelector('.fe-dv-view-head')! };
}

function openShell(root: HTMLElement, onClose?: () => void): Layer {
  const layer = openLayer(root, {
    kind: 'dialog', place: 'none', focus: root.querySelector<HTMLElement>('.fe-dv-view-box')!,
    backdrop: root.querySelector<HTMLElement>('.fe-dlg-bg'),
    onClose: () => { root.remove(); viewer = null; onClose?.(); },
  });
  root.querySelector('[data-media="close"]')!.addEventListener('click', () => layer.close('api'));
  return layer;
}

/** Open one item of a set large, with ← → and the arrow buttons moving through the set. */
export function openFocus(set: Media[], at: number, notify: (m: string) => void): void {
  viewer?.layer.close('replaced');
  const { root, body, head } = shell('', 'Large view');
  const anyMarks = set.some(m => m.marks);
  head.querySelector('.fe-dv-view-tools')!.innerHTML = (anyMarks ? actBtn('marks', UI_ICON.eye, 'Show or hide the marks', ' aria-pressed="true"') : '')
    + (set.length > 1 ? actBtn('prev', UI_ICON.prev, 'Previous (←)') + actBtn('next', UI_ICON.next, 'Next (→)') : '');
  const marksBtn = head.querySelector<HTMLElement>('[data-media="marks"]');
  root.classList.toggle('marks-off', !marksShown);
  marksBtn?.setAttribute('aria-pressed', String(marksShown));
  let i = at;
  const draw = () => {
    const m = set[i];
    head.querySelector('.fe-dv-view-title')!.textContent = set.length > 1 ? `${m.name} · ${i + 1} of ${set.length}` : m.name;
    body.dataset.kind = m.kind;
    if (marksBtn) marksBtn.hidden = !m.marks;
    if (m.kind === 'html') body.innerHTML = `<iframe class="fe-dv-view-frame" sandbox="allow-scripts" src="${esc(m.src)}" title="${esc(m.name)}"></iframe>`;
    else {
      body.innerHTML = '<div class="fe-ql-imgwrap"></div>';
      mountImageTools(body.firstElementChild as HTMLElement, {
        href: m.src, name: m.name, path: decodeURIComponent(new URL(m.src, location.href).pathname), notify,
        // Outside the extension (the web build of a page) there is no app to open it in.
        openNative: p => typeof chrome === 'undefined' || !chrome.runtime?.id ? Promise.resolve(false) : new Promise(res => chrome.runtime.sendMessage(
          { type: 'bfb-native-oneshot', host: 'com.better_file_browser.ghostty', payload: { action: 'open_file', path: p } },
          r => res(!chrome.runtime.lastError && !!r?.ok && r.response?.success === true))),
      });
      // The picture fills its sizer exactly, so its marks lie over the sizer; a turned or mirrored picture hides them.
      if (m.marks) body.querySelector('.fe-ql-imgsizer')?.insertAdjacentHTML('beforeend', marksHtml(m.marks));
    }
  };
  const step = (by: number) => { if (set.length > 1) { i = (i + by + set.length) % set.length; draw(); } };
  head.querySelector('[data-media="prev"]')?.addEventListener('click', () => step(-1));
  head.querySelector('[data-media="next"]')?.addEventListener('click', () => step(1));
  marksBtn?.addEventListener('click', () => {
    const off = root.classList.toggle('marks-off');
    marksBtn.setAttribute('aria-pressed', String(!off));
  });
  draw();
  viewer = { layer: openShell(root), step };
}

/** Open a diagram large, filling the window, with every way of reading it and the side panel. */
export function openDiagram(o: LabOptions): void {
  viewer?.layer.close('replaced');
  const { root, body } = shell(o.name || 'Diagram', 'Diagram, large');
  // The viewer's own bar carries the title and close, so the dialog has one bar, not two.
  root.classList.add('fe-dv-view-diagram');
  body.innerHTML = '<div class="fe-dv-diagram"></div>';
  const layer = openShell(root);
  viewer = { layer };
  void mountDiagram(body.firstElementChild as HTMLElement, {
    ...o, compact: false, expand: false, tools: [], height: '100%',
    title: o.name || 'Diagram', subtitle: o.file ? decodeURIComponent(new URL(o.file).pathname.split('/').pop() ?? '') : undefined,
    onClose: () => layer.close('api'),
  });
}

/**
 * Two items side by side. Pictures share one zoom and one scroll position,
 * so the same spot shows on both; mock pages are drawn tall and scroll
 * together. A frame cannot report how tall its page is, so a mock longer
 * than MOCK_TALL is cut there.
 */
export function openCompare(a: Media, b: Media, labels: [string, string], onClose: () => void): void {
  viewer?.layer.close('replaced');
  const { root, body, head } = shell(`${labels[0]}  ·  ${labels[1]}`, 'Compare two');
  head.querySelector('.fe-dv-view-tools')!.innerHTML = actBtn('out', UI_ICON.zoomOut, 'Zoom out both') + actBtn('fit', UI_ICON.fit, 'Fit both') + actBtn('in', UI_ICON.zoomIn, 'Zoom in both');
  body.classList.add('fe-dv-compare');
  body.innerHTML = [a, b].map((m, k) => `<section class="fe-dv-cmp-pane" data-kind="${m.kind}">
      <div class="fe-dv-cmp-label">${esc(labels[k])}</div>
      <div class="fe-dv-cmp-scroll">${m.kind === 'html'
        ? `<iframe sandbox="allow-scripts" src="${esc(m.src)}" title="${esc(m.name)}"></iframe>`
        : `<span class="fe-dv-pic"><img src="${esc(m.src)}" alt="${esc(m.name)}">${m.marks ? marksHtml(m.marks) : ''}</span>`}</div>
    </section>`).join('');
  const panes = [...body.querySelectorAll<HTMLElement>('.fe-dv-cmp-scroll')];
  let zoom = 1;
  const setZoom = (z: number) => { zoom = Math.min(8, Math.max(1, z)); panes.forEach(p => p.style.setProperty('--zoom', String(zoom))); };
  head.querySelector('.fe-dv-view-tools')!.addEventListener('click', e => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-media]')?.dataset.media;
    if (act === 'in') setZoom(zoom * 1.5); else if (act === 'out') setZoom(zoom / 1.5); else if (act === 'fit') setZoom(1);
  });
  // Scrolling one side moves the other to the same place, by proportion.
  let syncing = false;
  for (const p of panes) p.addEventListener('scroll', () => {
    if (syncing) return;
    syncing = true;
    const fx = p.scrollLeft / Math.max(1, p.scrollWidth - p.clientWidth), fy = p.scrollTop / Math.max(1, p.scrollHeight - p.clientHeight);
    for (const q of panes) if (q !== p) { q.scrollLeft = fx * (q.scrollWidth - q.clientWidth); q.scrollTop = fy * (q.scrollHeight - q.clientHeight); }
    requestAnimationFrame(() => { syncing = false; });
  });
  body.style.setProperty('--mock-tall', `${MOCK_TALL}px`);
  viewer = { layer: openShell(root, onClose) };
}

// Pictures in a view's prose: the rendered markdown's own <img>, outside any figure the kit drew.
const proseImgs = (box: HTMLElement) =>
  [...box.querySelectorAll<HTMLImageElement>('.fe-md img')].filter(i => !i.closest('.fe-dv-media, a'));

/**
 * Wire every picture and mock page in a view: grow in place, open large,
 * compare two of one set, and open prose pictures large as one set.
 * A set is the nearest `[data-media-set]` around a picture; the label a
 * compare shows comes from the nearest `[data-media-label]`.
 */
export function wireMedia(box: HTMLElement, notify: (m: string) => void): void {
  // A mock page is laid out at desktop width and scaled down to fit its tile.
  const ro = new ResizeObserver(entries => {
    for (const e of entries) (e.target as HTMLElement).style.setProperty('--scale', String(e.contentRect.width / MOCK_W));
  });
  box.querySelectorAll<HTMLElement>('.fe-dv-frame').forEach(f => { f.style.setProperty('--mock-w', `${MOCK_W}px`); ro.observe(f); });
  box.querySelectorAll<HTMLElement>('.fe-dv-media[data-marks]').forEach(f => {
    const img = f.querySelector<HTMLImageElement>('img'), layer = f.querySelector<HTMLElement>('.fe-dv-marks');
    if (img && layer) followMarks(img, layer);
  });
  for (const img of proseImgs(box)) { img.classList.add('fe-dv-prose-img'); img.title ||= 'Open large'; }

  const comparing: HTMLElement[] = [];
  const clearCompare = () => { comparing.splice(0).forEach(f => f.querySelector('[data-media="compare"]')?.setAttribute('aria-pressed', 'false')); };
  const labelOf = (f: HTMLElement) => f.closest<HTMLElement>('[data-media-label]')?.dataset.mediaLabel || f.dataset.name!;

  box.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const prose = t.closest<HTMLImageElement>('img.fe-dv-prose-img');
    if (prose) {
      e.preventDefault(); e.stopPropagation();
      const set = proseImgs(box);
      openFocus(set.map(i => ({ src: i.src, name: i.alt || decodeURIComponent(i.src.split('/').pop() || ''), kind: 'img' as const })), set.indexOf(prose), notify);
      return;
    }
    const f = t.closest<HTMLElement>('.fe-dv-media');
    if (!f) return;
    // Anywhere on a picture grows or shrinks it, its frame and button strip
    // included, so a click near an edge never falls through to the option.
    const act = t.closest<HTMLElement>('[data-media]')?.dataset.media ?? (f.dataset.kind === 'img' ? 'zoom' : '');
    // Looking at a picture never picks the option it sits in.
    e.preventDefault();
    e.stopPropagation();
    if (!act) return;
    if (act === 'marks') {
      const off = f.classList.toggle('marks-off');
      f.querySelector('[data-media="marks"]')!.setAttribute('aria-pressed', String(!off));
    } else if (act === 'zoom') toggleZoom(f);
    else if (act === 'focus') {
      const set = mediaIn(f.closest('[data-media-set]') ?? f);
      openFocus(set.map(toMedia), set.indexOf(f), notify);
    } else if (act === 'compare') {
      const at = comparing.indexOf(f);
      if (at >= 0) { comparing.splice(at, 1); f.querySelector('[data-media="compare"]')!.setAttribute('aria-pressed', 'false'); return; }
      // A second pick in another set starts over there.
      if (comparing[0] && comparing[0].closest('[data-media-set]') !== f.closest('[data-media-set]')) clearCompare();
      comparing.push(f);
      f.querySelector('[data-media="compare"]')!.setAttribute('aria-pressed', 'true');
      if (comparing.length === 2) {
        const [a, b] = comparing;
        openCompare(toMedia(a), toMedia(b), [labelOf(a), labelOf(b)], clearCompare);
      }
    }
  }, true);
}
