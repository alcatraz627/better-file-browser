// The Gallery view of a folder: a large preview of the picked file on top and
// the folder's files as a strip of thumbnails along the bottom, like Finder's
// Gallery view or Picasa. ← and → walk the strip, the grip between the two
// resizes them, and a double-click or Enter opens the file.
//
// The large preview is the same panel the other views open beside the list,
// moved into this view's stage, so every file type previews the way it
// already does. Thumbnails are the Tiles view's own, drawn in one row; for a
// text file the strip shows its first lines, read only when it scrolls into
// view, and a video shows its first frame.
import type { App } from './app';
import type { Listing } from './listing';
import type { Entry } from './types';
import { openPreview, canPreview, closePreview, setPreviewHost, VIDEO_EXTS } from './preview';
import { esc, getExt, fmtSize, fmtDate, fmtType } from './utils';
import { getIcon, IMG_EXTS } from './icons';
import { CODE_EXTS, TABLE_EXTS } from './renderers';
import { fetchFileText } from './file-fetch';
import { jsonPref } from './storage';
import { go } from './nav';

const stripPref = jsonPref<{ h: number }>('bfb-gallery-v1', { h: 168 }, v => !!v && typeof v === 'object' && typeof (v as { h: unknown }).h === 'number');
const MIN_STRIP = 96;
// A text thumbnail reads this much of the file, and only from files this small.
const SNIP_CHARS = 900, SNIP_MAX_BYTES = 512 * 1024;
const TEXTISH = (e: Entry) => { const x = getExt(e); return x === 'md' || x === 'txt' || x === 'json' || x === '' || CODE_EXTS.has(x) || TABLE_EXTS.has(x); };

/** Wire the Gallery view: its stage, its grip, its thumbnails and its keys. */
export function initGallery(app: App, listing: Listing): void {
  const { fe } = app;
  const { ls, sel } = listing;
  const stage = document.getElementById('fe-gal');
  const grip = document.getElementById('fe-gal-rz');
  const scroll = document.getElementById('fe-scroll');
  if (!stage || !grip || !scroll) return;
  const card = stage.querySelector<HTMLElement>('.fe-gal-card')!;
  const on = () => fe.dataset.view === 'gallery' && !app.fileMode;

  // The strip's height, kept between visits; the stage takes the rest.
  const setStrip = (h: number) => {
    const room = (document.getElementById('fe-main')?.clientHeight ?? 600) - 160;
    const v = Math.round(Math.max(MIN_STRIP, Math.min(room, h)));
    fe.style.setProperty('--gal-strip', `${v}px`);
    return v;
  };
  setStrip(stripPref.get().h);

  // Best-effort thumbnails for what the Tiles view draws as an icon.
  const seen = new IntersectionObserver(items => items.forEach(it => {
    if (!it.isIntersecting) return;
    seen.unobserve(it.target);
    void fillThumb(it.target as HTMLElement, ls.visible[Number((it.target as HTMLElement).dataset.idx)]);
  }), { root: scroll, rootMargin: '0px 400px' });
  function paintThumbs(): void {
    if (!on()) return;
    scroll!.querySelectorAll<HTMLElement>('#fe-tiles .fe-tile[data-idx]:not([data-gal])').forEach(t => {
      t.dataset.gal = '1';
      const en = ls.visible[Number(t.dataset.idx)];
      if (en && !en.isDir && !en.isParent && !IMG_EXTS.has(getExt(en)) && (VIDEO_EXTS.has(getExt(en)) || TEXTISH(en))) seen.observe(t);
    });
  }
  // What the stage shows for the lead: the preview when the file has one, a
  // card naming it otherwise (a folder, or a type with no preview).
  const show = () => {
    if (!on()) return;
    const en = ls.selIdx >= 0 ? ls.visible[ls.selIdx] : null;
    if (en && canPreview(en)) { card.hidden = true; openPreview(en); return; }
    card.hidden = false;
    card.innerHTML = en ? cardHtml(app, en) : '<p class="fe-gal-none">Nothing to show in this folder.</p>';
  };
  card.addEventListener('click', e => {
    if (!(e.target as Element).closest('.fe-gal-open')) return;
    const en = ls.visible[ls.selIdx];
    if (en) go(en.href);
  });

  // Entering the view puts the preview in the stage and picks a file when none is; leaving gives it back.
  let was = false;
  const sync = () => {
    const now = on();
    if (now === was) { if (now) paintThumbs(); return; }
    was = now;
    stage.hidden = grip.hidden = !now;
    if (now) {
      setPreviewHost(stage);
      if (ls.selIdx < 0 || ls.visible[ls.selIdx]?.isParent) {
        const first = ls.visible.findIndex((en, i) => !en.isDir && sel.selectable(i));
        const any = ls.visible.findIndex((_, i) => sel.selectable(i));
        if (first >= 0 || any >= 0) sel.setSel(first >= 0 ? first : any);
      }
      show();
      paintThumbs();
    } else {
      setPreviewHost(null);
      closePreview();
      card.hidden = true;
    }
  };
  new MutationObserver(sync).observe(fe, { attributes: true, attributeFilter: ['data-view'] });
  document.addEventListener('bfb-lead', show);
  sync();

  // ← and → walk the strip (the other views give them to the preview's step,
  // which skips folders); Enter is the listing's own.
  document.addEventListener('keydown', e => {
    if (!on() || e.metaKey || e.ctrlKey || e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable="true"], .fe-ql-imgwrap, video, audio')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    sel.moveSel(e.key === 'ArrowLeft' ? -1 : 1);
  }, true);
  // A mouse wheel scrolls the strip sideways.
  scroll.addEventListener('wheel', e => {
    if (!on() || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    scroll.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  // The grip: drag to share the height between stage and strip, double-click to reset.
  grip.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const y0 = e.clientY, h0 = scroll.getBoundingClientRect().height;
    grip.setPointerCapture(e.pointerId);
    fe.classList.add('fe-gal-dragging');
    const move = (ev: PointerEvent) => setStrip(h0 - (ev.clientY - y0));
    const up = (ev: PointerEvent) => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      fe.classList.remove('fe-gal-dragging');
      stripPref.set({ h: setStrip(h0 - (ev.clientY - y0)) });
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
  });
  grip.addEventListener('dblclick', () => stripPref.set({ h: setStrip(168) }));
  grip.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const h = scroll.getBoundingClientRect().height + (e.key === 'ArrowUp' ? 24 : -24);
    stripPref.set({ h: setStrip(h) });
  });

  // The tiles are drawn again on every sort, filter or refresh.
  new MutationObserver(() => { if (on()) { paintThumbs(); show(); } }).observe(document.getElementById('fe-tiles')!, { childList: true });
}

/** Put a first frame or the first lines of the file where the tile shows its icon. */
async function fillThumb(tile: HTMLElement, en: Entry | undefined): Promise<void> {
  const ic = tile.querySelector<HTMLElement>('.fe-tile-ic');
  if (!ic || !en) return;
  if (VIDEO_EXTS.has(getExt(en))) {
    ic.innerHTML = `<span class="fe-tile-img-wrap fe-gal-vid"><video src="${esc(en.href)}#t=0.5" preload="metadata" muted playsinline></video></span>`;
    return;
  }
  if (en.rawBytes > SNIP_MAX_BYTES) return;
  try {
    const text = (await fetchFileText(en.href)).slice(0, SNIP_CHARS);
    if (!text.trim() || /[\u0000-\u0008]/.test(text)) return;
    ic.innerHTML = `<span class="fe-tile-img-wrap fe-gal-snip"><span>${esc(text)}</span></span>`;
  } catch { /* the icon stays */ }
}

/** The stage's card for a file the preview cannot show, or a folder. */
function cardHtml(app: App, en: Entry): string {
  const facts = [fmtType(en), en.isDir ? '' : fmtSize(en.rawBytes), fmtDate(en.dateMs, app.settings, en.dateStr)].filter(Boolean);
  return `<div class="fe-gal-card-in">
    <span class="fe-gal-card-ic">${getIcon(en, app.iconRules)}</span>
    <div class="fe-gal-card-nm">${esc(en.isParent ? '..' : en.name)}</div>
    <div class="fe-gal-card-meta">${facts.map(esc).join(' · ')}</div>
    <p class="fe-gal-card-note">${en.isDir || en.isParent ? 'A folder. Open it to see what it holds.' : 'No preview for this kind of file.'}</p>
    <button type="button" class="btn fe-gal-open" data-variant="outline" title="Open (Enter)">${en.isDir || en.isParent ? 'Open folder' : 'Open'}</button>
  </div>`;
}
