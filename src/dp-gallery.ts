// Pictures and mock pages on a decision page. Each one can grow in place to
// the full row (several at once, as the owner ruled), open large on its own
// with ← → to the next, or, among an option gallery, be compared with another
// side by side. A mock page (.html in the page's folder) runs live in a frame
// that may run its own script but cannot reach bfb, the files or the network.
import { esc } from './utils';
import { UI_ICON, GLYPH } from './control-icons';
import { openLayer, type Layer } from './layer';
import { mountImageTools } from './image-tools';

/** The width a mock page is laid out at before it is scaled into its tile. */
const MOCK_W = 1280;
/** How tall a mock page is drawn in the compare view, so both sides scroll together. */
const MOCK_TALL = 2400;

export interface Media { src: string; name: string; kind: 'img' | 'html' }

/** What a page's `images` entry points at: a picture or a mock page inside the page's folder, a web picture, or nothing when it climbs out with `..`. */
export function mediaOf(base: string, p: string): Media | null {
  const html = /\.html?$/i.test(p);
  if (/^https?:\/\//.test(p)) return html ? null : { src: p, name: p.split('/').pop() || p, kind: 'img' };
  if (!p || p.startsWith('/') || p.split(/[\\/]/).includes('..') || /^[a-z]+:/i.test(p)) return null;
  return { src: base + p.split('/').map(encodeURIComponent).join('/'), name: p, kind: html ? 'html' : 'img' };
}

const actBtn = (act: string, icon: string, title: string, extra = '') =>
  `<button type="button" class="btn" data-icon data-size="sm" data-variant="ghost" data-media="${act}" title="${esc(title)}" aria-label="${esc(title)}"${extra}>${icon}</button>`;

/** One picture or mock page with its zoom, open-large and (in an option gallery) compare buttons. */
export function mediaHtml(m: Media, compare = false): string {
  const body = m.kind === 'html'
    ? `<div class="fe-dp-frame"><iframe sandbox="allow-scripts" src="${esc(m.src)}" title="${esc(m.name)}" loading="lazy" tabindex="-1"></iframe></div>`
    : `<img src="${esc(m.src)}" alt="${esc(m.name)}" loading="lazy">`;
  return `<figure class="fe-dp-media" data-kind="${m.kind}" data-src="${esc(m.src)}" data-name="${esc(m.name)}">
    ${body}
    <span class="fe-dp-media-acts">
      ${m.kind === 'img' ? actBtn('zoom', UI_ICON.zoomIn, 'Grow to the full row, or shrink back') : ''}
      ${actBtn('focus', UI_ICON.size, 'Open large; ← → go to the next')}
      ${compare ? actBtn('compare', GLYPH.column, 'Compare with another option side by side', ' aria-pressed="false"') : ''}
    </span>
  </figure>`;
}

const mediaIn = (scope: Element) => [...scope.querySelectorAll<HTMLElement>('.fe-dp-media')];
const toMedia = (f: HTMLElement): Media => ({ src: f.dataset.src!, name: f.dataset.name!, kind: f.dataset.kind as Media['kind'] });
const smooth = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

/** Grow or shrink one picture in place; a grown one is scrolled into view. */
function toggleZoom(f: HTMLElement): void {
  const on = !f.classList.contains('zoomed');
  f.classList.toggle('zoomed', on);
  f.closest('.fe-dp-opt')?.classList.toggle('zoomed', on);
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
export const viewerOpen = (): boolean => !!viewer?.layer.open;
export const viewerStep = (by: number): void => viewer?.step?.(by);

function shell(title: string, label: string): { root: HTMLElement; body: HTMLElement; head: HTMLElement } {
  const root = document.createElement('div');
  root.className = 'fe-dlg fe-dp-view';
  root.innerHTML = `<div class="fe-dlg-bg scrim"></div>
    <div class="panel fe-dp-view-box" role="dialog" aria-label="${esc(label)}" tabindex="-1">
      <header class="bar fe-dp-view-head"><b class="fe-dp-view-title">${esc(title)}</b><span class="fe-dp-view-tools"></span>${actBtn('close', UI_ICON.close, 'Close (Esc)')}</header>
      <div class="fe-dp-view-body"></div>
    </div>`;
  (document.getElementById('fe') ?? document.body).append(root);
  return { root, body: root.querySelector('.fe-dp-view-body')!, head: root.querySelector('.fe-dp-view-head')! };
}

function openShell(root: HTMLElement, onClose?: () => void): Layer {
  const layer = openLayer(root, {
    kind: 'dialog', place: 'none', focus: root.querySelector<HTMLElement>('.fe-dp-view-box')!,
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
  head.querySelector('.fe-dp-view-tools')!.innerHTML = set.length > 1 ? actBtn('prev', UI_ICON.prev, 'Previous (←)') + actBtn('next', UI_ICON.next, 'Next (→)') : '';
  let i = at;
  const draw = () => {
    const m = set[i];
    head.querySelector('.fe-dp-view-title')!.textContent = set.length > 1 ? `${m.name} · ${i + 1} of ${set.length}` : m.name;
    body.dataset.kind = m.kind;
    if (m.kind === 'html') body.innerHTML = `<iframe class="fe-dp-view-frame" sandbox="allow-scripts" src="${esc(m.src)}" title="${esc(m.name)}"></iframe>`;
    else {
      body.innerHTML = '<div class="fe-ql-imgwrap"></div>';
      mountImageTools(body.firstElementChild as HTMLElement, {
        href: m.src, name: m.name, path: decodeURIComponent(new URL(m.src, location.href).pathname), notify,
        openNative: p => new Promise(res => chrome.runtime.sendMessage(
          { type: 'bfb-native-oneshot', host: 'com.better_file_browser.ghostty', payload: { action: 'open_file', path: p } },
          r => res(!chrome.runtime.lastError && !!r?.ok && r.response?.success === true))),
      });
    }
  };
  const step = (by: number) => { if (set.length > 1) { i = (i + by + set.length) % set.length; draw(); } };
  head.querySelector('[data-media="prev"]')?.addEventListener('click', () => step(-1));
  head.querySelector('[data-media="next"]')?.addEventListener('click', () => step(1));
  draw();
  viewer = { layer: openShell(root), step };
}

/**
 * Two options side by side. Pictures share one zoom and one scroll position,
 * so the same spot shows on both; mock pages are drawn tall and scroll
 * together. A frame cannot report how tall its page is, so a mock longer
 * than MOCK_TALL is cut there.
 */
export function openCompare(a: Media, b: Media, labels: [string, string], onClose: () => void): void {
  viewer?.layer.close('replaced');
  const { root, body, head } = shell(`${labels[0]}  ·  ${labels[1]}`, 'Compare two options');
  head.querySelector('.fe-dp-view-tools')!.innerHTML = actBtn('out', UI_ICON.zoomOut, 'Zoom out both') + actBtn('fit', UI_ICON.fit, 'Fit both') + actBtn('in', UI_ICON.zoomIn, 'Zoom in both');
  body.classList.add('fe-dp-compare');
  body.innerHTML = [a, b].map((m, k) => `<section class="fe-dp-cmp-pane" data-kind="${m.kind}">
      <div class="fe-dp-cmp-label">${esc(labels[k])}</div>
      <div class="fe-dp-cmp-scroll">${m.kind === 'html'
        ? `<iframe sandbox="allow-scripts" src="${esc(m.src)}" title="${esc(m.name)}"></iframe>`
        : `<img src="${esc(m.src)}" alt="${esc(m.name)}">`}</div>
    </section>`).join('');
  const panes = [...body.querySelectorAll<HTMLElement>('.fe-dp-cmp-scroll')];
  let zoom = 1;
  const setZoom = (z: number) => { zoom = Math.min(8, Math.max(1, z)); panes.forEach(p => p.style.setProperty('--zoom', String(zoom))); };
  head.querySelector('.fe-dp-view-tools')!.addEventListener('click', e => {
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

/** Wire every picture and mock page on the page: zoom in place, open large, compare two options. */
export function wireGallery(box: HTMLElement, notify: (m: string) => void): void {
  // A mock page is laid out at desktop width and scaled down to fit its tile.
  const ro = new ResizeObserver(entries => {
    for (const e of entries) (e.target as HTMLElement).style.setProperty('--scale', String(e.contentRect.width / MOCK_W));
  });
  box.querySelectorAll<HTMLElement>('.fe-dp-frame').forEach(f => { f.style.setProperty('--mock-w', `${MOCK_W}px`); ro.observe(f); });

  const comparing: HTMLElement[] = [];
  const clearCompare = () => { comparing.splice(0).forEach(f => f.querySelector('[data-media="compare"]')?.setAttribute('aria-pressed', 'false')); };
  const labelOf = (f: HTMLElement) => {
    const o = f.closest<HTMLElement>('.fe-dp-opt');
    return o ? `${o.dataset.code} · ${o.querySelector('.fe-dp-opt-lbl')?.textContent ?? ''}` : f.dataset.name!;
  };

  box.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const f = t.closest<HTMLElement>('.fe-dp-media');
    if (!f) return;
    const act = t.closest<HTMLElement>('[data-media]')?.dataset.media ?? (t.tagName === 'IMG' ? 'zoom' : '');
    if (!act) return;
    // Looking at a picture never picks the option it sits in.
    e.preventDefault();
    e.stopPropagation();
    if (act === 'zoom') toggleZoom(f);
    else if (act === 'focus') {
      const set = mediaIn(f.closest('.fe-dp-opts, .fe-dp-strip') ?? f);
      openFocus(set.map(toMedia), set.indexOf(f), notify);
    } else if (act === 'compare') {
      const at = comparing.indexOf(f);
      if (at >= 0) { comparing.splice(at, 1); f.querySelector('[data-media="compare"]')!.setAttribute('aria-pressed', 'false'); return; }
      // A second pick in another decision starts over there.
      if (comparing[0] && comparing[0].closest('.fe-dp-opts') !== f.closest('.fe-dp-opts')) clearCompare();
      comparing.push(f);
      f.querySelector('[data-media="compare"]')!.setAttribute('aria-pressed', 'true');
      if (comparing.length === 2) {
        const [a, b] = comparing;
        openCompare(toMedia(a), toMedia(b), [labelOf(a), labelOf(b)], clearCompare);
      }
    }
  }, true);
}
