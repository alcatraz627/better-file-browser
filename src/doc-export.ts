// Taking a markdown document out of bfb. The Export menu on a file page saves
// the doc as a web page or a Word file, prints it to PDF, or copies it for a
// new Google Doc; and any table or code block on a page can be saved as an
// SVG or PNG picture (diagrams carry their own Download menu).
//
// Every export starts from a fresh render of the file, not the page on screen,
// so a doc view's extras (a directions doc's bar and pills, folded rows) stay
// out, and it is drawn in dark ink on white whatever the theme. Diagrams come
// from the page, where they are already drawn, and are redrawn in that ink.
import { renderFile } from './formats';
import { toDocx } from './docx';
import { esc } from './utils';
import { openLayer, type Layer } from './layer';
import { UI_ICON } from './control-icons';
import type { Toast } from './toast';

type Format = 'html' | 'docx' | 'gdoc' | 'pdf';
const FORMATS: { id: Format; label: string; hint: string; icon: string }[] = [
  { id: 'gdoc', label: 'Google Doc', hint: 'Copies the doc and opens a new Google Doc to paste it into', icon: UI_ICON.external },
  { id: 'docx', label: 'Word document', hint: 'A .docx with real headings, lists and tables', icon: UI_ICON.file },
  { id: 'pdf', label: 'PDF', hint: 'Opens the print dialog; choose Save as PDF', icon: UI_ICON.export },
  { id: 'html', label: 'Web page', hint: 'One .html file with its pictures inside', icon: UI_ICON.fmtCode },
];

/** Save a blob under a file name, through the browser's own download. */
export function saveBlob(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// The styles a still copy of a diagram needs, read off the drawn one.
const SVG_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'background-color', 'border-radius', 'text-anchor', 'dominant-baseline', 'display', 'marker-end', 'marker-start'];

/** A drawn diagram as a self-contained SVG, in dark ink on white. */
export function diagramSvg(svg: SVGSVGElement): { svg: string; w: number; h: number } {
  const host = svg.closest<HTMLElement>('.dl') ?? svg.parentElement!;
  host.classList.add('fe-ink-light');
  try {
    const c = svg.cloneNode(true) as SVGSVGElement;
    const a = svg.querySelectorAll('*'), b = c.querySelectorAll('*');
    a.forEach((el, i) => { const cs = getComputedStyle(el); (b[i] as Element).setAttribute('style', SVG_PROPS.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';')); });
    c.querySelectorAll('.dl-guides, .dl-ehit').forEach(n => n.remove());
    const vb = svg.viewBox.baseVal;
    const w = Math.round(vb?.width || svg.getBoundingClientRect().width), h = Math.round(vb?.height || svg.getBoundingClientRect().height);
    c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    c.setAttribute('width', String(w));
    c.setAttribute('height', String(h));
    c.removeAttribute('class');
    c.style.cssText = 'background:#fff';
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    Object.entries({ x: vb?.x ?? 0, y: vb?.y ?? 0, width: w, height: h, fill: '#fff' }).forEach(([k, v]) => bg.setAttribute(k, String(v)));
    c.prepend(bg);
    return { svg: new XMLSerializer().serializeToString(c), w, h };
  } finally { host.classList.remove('fe-ink-light'); }
}

/** An SVG drawn onto a canvas at twice its size, as a PNG data URL. */
export function svgToPng(svg: string, w: number, h: number, scale = 2): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
      const ctx = cv.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      try { res(cv.toDataURL('image/png')); } catch (e) { rej(e); }
    };
    img.onerror = () => rej(new Error('the picture would not draw'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/** An image on the page as a PNG data URL, or null when the browser will not hand its pixels over. */
function imageData(img: HTMLImageElement): string | null {
  if (!img.complete || !img.naturalWidth) return null;
  try {
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    cv.getContext('2d')!.drawImage(img, 0, 0);
    return cv.toDataURL('image/png');
  } catch { return null; }
}

interface Clean {
  root: HTMLElement;
  title: string;
  /** The doc's front matter, as written, for the exported page's header. */
  meta: [string, string][];
  diagrams: { el: HTMLElement; svg: string; w: number; h: number }[];
}

/** A fresh render of the file with the page's controls taken out and its diagrams drawn still. */
function cleanDoc(text: string, href: string, page: HTMLElement): Clean {
  const holder = document.createElement('div');
  holder.innerHTML = renderFile(text, 'md', href, 'page');
  const root = holder.querySelector<HTMLElement>('.fe-md') ?? holder;
  const meta: [string, string][] = [...root.querySelectorAll('.fe-md-fm dt')].map(dt => [dt.textContent?.trim() ?? '', dt.nextElementSibling?.textContent?.trim() ?? '']);
  root.querySelectorAll('.fe-md-fm, .fe-md-anchor, .fe-md-code-bar, .fe-col-rz, .fe-md-mermaid-source, button').forEach(n => n.remove());
  const live = [...page.querySelectorAll<HTMLElement>('.fe-md-mermaid')];
  const diagrams: Clean['diagrams'] = [];
  root.querySelectorAll<HTMLElement>('.fe-md-mermaid').forEach((el, i) => {
    const svg = live[i]?.querySelector<SVGSVGElement>('.dl-world > svg');
    if (svg) diagrams.push({ el, ...diagramSvg(svg) });
    else el.remove();
  });
  // Pictures the page already shows travel inside the file when the browser allows it.
  const shown = new Map([...page.querySelectorAll<HTMLImageElement>('.fe-md img')].map(i => [i.src, i]));
  root.querySelectorAll<HTMLImageElement>('img').forEach(img => {
    const src = img.src;
    const data = shown.get(src) && imageData(shown.get(src)!);
    if (data) { img.src = data; img.setAttribute('width', String(shown.get(src)!.naturalWidth)); img.setAttribute('height', String(shown.get(src)!.naturalHeight)); }
    else img.src = src;
  });
  const title = root.querySelector('h1')?.textContent?.trim() || decodeURIComponent(href.split('/').pop() || 'Document').replace(/\.\w+$/, '');
  return { root, title, meta, diagrams };
}

/** Strip the app's own markup so the HTML reads as a plain document. */
function plainHtml(root: HTMLElement, opts: { wrapTables?: boolean } = {}): string {
  root.querySelectorAll<HTMLElement>('.fe-md-code').forEach(box => {
    const pre = box.querySelector('pre');
    if (!pre) { box.remove(); return; }
    const out = document.createElement('pre');
    const code = document.createElement('code');
    code.innerHTML = pre.innerHTML;
    out.append(code);
    box.replaceWith(out);
  });
  root.querySelectorAll<HTMLElement>('.fe-md-l').forEach(l => l.replaceWith(...l.childNodes));
  root.querySelectorAll<HTMLElement>('.fe-md-tablewrap').forEach(w => {
    // On a phone a wide table scrolls inside its own box rather than widening the page.
    if (opts.wrapTables) { w.className = 'table-wrap'; w.removeAttribute('data-sl'); } else w.replaceWith(...w.childNodes);
  });
  root.querySelectorAll<HTMLElement>('*').forEach(el => {
    // A diagram's own styles are what draw it.
    if (el.closest('svg')) return;
    for (const a of [...el.attributes]) {
      if (a.name === 'class') {
        const keep = [...el.classList].filter(c => c.startsWith('tok-') || c === 'fe-task' || c === 'table-wrap' || c === 'anchor');
        if (keep.length) el.setAttribute('class', keep.join(' ')); else el.removeAttribute('class');
      } else if (a.name.startsWith('data-') || a.name === 'style' || a.name === 'title' && el.tagName !== 'ABBR') el.removeAttribute(a.name);
    }
  });
  return root.innerHTML;
}

const EXPORT_CSS = `
:root{color-scheme:light dark;--bg:#fff;--fg:#1a1a1a;--mt:#55656f;--dm:#7a8a93;--bd:#dde3e7;--soft:#f4f6f8;--ac:#0b6e69;--head:linear-gradient(135deg,#e8f4f3 0%,#f3f0fa 100%)}
@media (prefers-color-scheme:dark){:root{--bg:#111518;--fg:#e6ecef;--mt:#a3b2ba;--dm:#7f9099;--bd:#2a353c;--soft:#1a2126;--ac:#45c9c2;--head:linear-gradient(135deg,#132a2a 0%,#1d1a2b 100%)}
  .tok-str{color:#7ee787!important}.tok-kw{color:#ff7b72!important}.tok-type{color:#56d4dd!important}.tok-builtin{color:#ffa657!important}.tok-lit,.tok-var,.tok-fn,.tok-section{color:#d2a8ff!important}.tok-num,.tok-deco{color:#f2cc60!important}.tok-key{color:#79c0ff!important}.tok-cmt{color:#8b949e!important}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
.doc-head{background:var(--head);border-bottom:1px solid var(--bd)}
.doc-head-in,main,.doc-foot{max-width:780px;margin:0 auto;padding:0 20px}
.doc-head-in{padding-top:40px;padding-bottom:28px}
.kicker{font-size:13px;letter-spacing:.04em;color:var(--mt);margin:0 0 10px;overflow-wrap:anywhere}
.doc-head h1{font-size:clamp(1.7em,5vw,2.4em);line-height:1.15;margin:0 0 14px;letter-spacing:-.01em}
.facts{display:flex;flex-wrap:wrap;gap:6px 16px;margin:0;padding:0;list-style:none;font-size:14px;color:var(--mt)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 0;padding:0;list-style:none}
.chips li{font-size:13px;padding:3px 10px;border-radius:999px;background:color-mix(in srgb,var(--bg) 70%,transparent);border:1px solid var(--bd);color:var(--mt)}
.chips b{color:var(--fg);font-weight:600;margin-right:4px}
.toc{margin:24px 0 0;padding:12px 16px;border:1px solid var(--bd);border-radius:10px;background:var(--soft);font-size:15px}
.toc summary{cursor:pointer;font-weight:600}
.toc ol{margin:8px 0 0;padding-left:1.2em}.toc li{margin:3px 0}.toc a{text-decoration:none}
main{padding-top:28px;padding-bottom:64px}
h1,h2,h3,h4,h5,h6{line-height:1.3;margin:1.7em 0 .5em;font-weight:650;position:relative;scroll-margin-top:16px}
main h1{font-size:1.8em}h2{font-size:1.45em;padding-bottom:.25em;border-bottom:1px solid var(--bd)}h3{font-size:1.2em}h5,h6{color:var(--mt)}
.anchor{margin-left:.35em;color:var(--dm);text-decoration:none;font-weight:400;opacity:0;transition:opacity .15s}
:is(h1,h2,h3,h4,h5,h6):hover .anchor,.anchor:focus{opacity:1}
@media (hover:none){.anchor{opacity:.45}}
a{color:var(--ac);text-underline-offset:2px}
p,ul,ol,blockquote,pre,.table-wrap,figure{margin:0 0 1em}
code{font:.88em/1.5 "SF Mono",Menlo,Consolas,monospace;background:var(--soft);padding:.1em .35em;border-radius:4px;overflow-wrap:anywhere}
pre{background:var(--soft);border:1px solid var(--bd);border-radius:10px;padding:12px 16px;overflow-x:auto;-webkit-overflow-scrolling:touch}
pre code{background:none;padding:0;white-space:pre;overflow-wrap:normal}
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--bd);border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:.95em}
th,td{border-bottom:1px solid var(--bd);padding:8px 12px;text-align:left;vertical-align:top}
tr:last-child td{border-bottom:0}
th{background:var(--soft);font-weight:600;white-space:nowrap}
blockquote{padding:.2em 1em;border-left:3px solid var(--ac);color:var(--mt);background:var(--soft);border-radius:0 8px 8px 0}
img,svg{max-width:100%;height:auto}
figure{text-align:center}
figure svg{border-radius:10px;border:1px solid var(--bd)}
hr{border:0;border-top:1px solid var(--bd);margin:2em 0}
li.fe-task{list-style:none;margin-left:-1.3em}
.doc-foot{padding-bottom:40px;color:var(--dm);font-size:13px}
.tok-cmt{color:#57606a;font-style:italic}.tok-str{color:#0a7d33}.tok-kw{color:#cf222e}.tok-type{color:#1b7c83}.tok-builtin{color:#953800}
.tok-lit,.tok-var,.tok-fn,.tok-section{color:#8250df}.tok-num,.tok-deco{color:#9a6700}.tok-regex{color:#116329}.tok-key{color:#0550ae}.tok-add{color:#1a7f37}.tok-del{color:#cf222e}
@media (max-width:600px){body{font-size:15.5px}.doc-head-in{padding-top:28px;padding-bottom:20px}main,.doc-head-in,.doc-foot{padding-left:16px;padding-right:16px}pre{border-radius:8px;padding:10px 12px}th,td{padding:6px 10px}}
@media print{.doc-head{background:none}.toc,.anchor{display:none}pre{white-space:pre-wrap}.table-wrap{overflow:visible;border:0}}`;

/** The exported web page: a header with the doc's title and facts, a contents list for longer docs, then the doc. */
function pageHtml(doc: Clean, href: string): string {
  const root = doc.root;
  // The doc's own title moves into the header.
  const h1 = root.querySelector(':scope > h1');
  h1?.remove();
  // Each heading gets a link to itself, so a section can be shared by its address.
  root.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id]').forEach(h => h.insertAdjacentHTML('beforeend', `<a class="anchor" href="#${esc(h.id)}" aria-label="Link to this section">#</a>`));
  const sections = [...root.querySelectorAll<HTMLElement>('h2[id]')];
  const words = (root.textContent ?? '').trim().split(/\s+/).filter(Boolean).length;
  const path = decodeURIComponent(new URL(href, location.href).pathname);
  const folder = path.replace(/\/[^/]*$/, '').split('/').slice(-2).join('/');
  const firstPara = (root.querySelector(':scope > p')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const desc = (doc.meta.find(([k]) => /^(description|summary)$/i.test(k))?.[1] || firstPara).slice(0, 160);
  const when = new Date();
  const facts = [
    `<li>${when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</li>`,
    `<li>${words.toLocaleString()} words</li>`,
    `<li>${Math.max(1, Math.round(words / 230))} min read</li>`,
    sections.length ? `<li>${sections.length} sections</li>` : '',
  ].join('');
  const chips = doc.meta.filter(([k, v]) => k && v && !/^title$/i.test(k)).slice(0, 8)
    .map(([k, v]) => `<li><b>${esc(k)}</b>${esc(v.length > 60 ? v.slice(0, 59) + '…' : v)}</li>`).join('');
  const toc = sections.length >= 3
    ? `<details class="toc" open><summary>Contents</summary><ol>${sections.map(h => `<li><a href="#${esc(h.id)}">${esc((h.firstChild?.textContent ?? h.textContent ?? '').trim())}</a></li>`).join('')}</ol></details>` : '';
  const body = plainHtml(root, { wrapTables: true });
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(doc.title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="generator" content="Better File Browser">
<meta name="date" content="${when.toISOString()}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#e8f4f3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#132a2a" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(doc.title)}">
<meta property="og:description" content="${esc(desc)}">
<style>${EXPORT_CSS}</style>
</head>
<body>
<header class="doc-head"><div class="doc-head-in">
<p class="kicker">${esc(folder)} / ${esc(path.split('/').pop() ?? '')}</p>
<h1 id="${esc(h1?.id || 'top')}">${esc(doc.title)}</h1>
<ul class="facts">${facts}</ul>
${chips ? `<ul class="chips">${chips}</ul>` : ''}
${toc}
</div></header>
<main>
${body}
</main>
<footer class="doc-foot">Exported from Better File Browser</footer>
</body></html>
`;
}

/** The doc as rich text for pasting into a Google Doc: plain blocks only, so nothing arrives indented or padded. */
function pasteHtml(doc: Clean): string {
  const body = plainHtml(doc.root);
  const box = document.createElement('div');
  box.innerHTML = body;
  // Google Docs takes table borders and cell padding from inline styles; nothing else needs them.
  box.querySelectorAll<HTMLElement>('table').forEach(t => { t.setAttribute('style', 'border-collapse:collapse;width:100%'); });
  box.querySelectorAll<HTMLElement>('th, td').forEach(c => { c.setAttribute('style', `border:1px solid #d6dde2;padding:4px 8px;vertical-align:top${c.tagName === 'TH' ? ';background:#eef2f4;font-weight:bold' : ''}`); });
  box.querySelectorAll<HTMLElement>('pre').forEach(p => { p.setAttribute('style', 'font-family:Consolas,Menlo,monospace;font-size:10pt;background:#f3f5f7;margin:0'); });
  box.querySelectorAll<HTMLElement>('blockquote').forEach(q => { q.setAttribute('style', 'margin:0 0 0 12px;color:#4a5a64'); });
  return `<meta charset="utf-8">${box.innerHTML}`;
}

const fileName = (href: string, ext: string) => decodeURIComponent(href.split('/').pop() || 'document').replace(/\.[^.]+$/, '') + '.' + ext;

/** Export the doc in one format. Resolves to what to tell the person. */
export async function exportDoc(fmt: Format, text: string, href: string, page: HTMLElement): Promise<string> {
  if (fmt === 'pdf') { window.print(); return ''; }
  const doc = cleanDoc(text, href, page);
  if (fmt === 'html') {
    for (const d of doc.diagrams) d.el.outerHTML = `<figure>${d.svg}</figure>`;
    const name = fileName(href, 'html');
    saveBlob(new Blob([pageHtml(doc, href)], { type: 'text/html' }), name);
    return `Saved ${name}`;
  }
  // Word and Google Docs take pictures, not SVG.
  for (const d of doc.diagrams) {
    const img = document.createElement('img');
    img.src = await svgToPng(d.svg, d.w, d.h);
    img.alt = 'Diagram';
    img.setAttribute('width', String(d.w));
    img.setAttribute('height', String(d.h));
    d.el.replaceWith(img);
  }
  if (fmt === 'docx') {
    const name = fileName(href, 'docx');
    saveBlob(toDocx(doc.root, doc.title), name);
    return `Saved ${name}`;
  }
  // Google Docs reads pasted rich text faithfully: headings, lists, tables, links and pictures.
  await navigator.clipboard.write([new ClipboardItem({
    'text/html': new Blob([pasteHtml(doc)], { type: 'text/html' }),
    'text/plain': new Blob([text], { type: 'text/plain' }),
  })]);
  window.open('https://docs.new', '_blank', 'noopener');
  return 'Copied. Paste it into the new Google Doc with ⌘V';
}

/** Wire the Export button on a markdown file page. */
export function wireDocExport(btn: HTMLElement, doc: () => { text: string; href: string }, page: HTMLElement, toast: Toast): void {
  const menu = document.createElement('div');
  menu.className = 'fe-ctx fe-export-menu';
  menu.innerHTML = FORMATS.map(f => `<div class="row fe-ctx-item" data-fmt="${f.id}" title="${esc(f.hint)}">${f.icon}<span>${esc(f.label)}</span></div>`).join('');
  let layer: Layer | null = null;
  btn.addEventListener('click', () => { layer = openLayer(menu, { kind: 'popover', anchor: btn, role: 'menu', group: 'menu', label: 'Export' }); });
  menu.addEventListener('click', e => {
    const item = (e.target as Element).closest<HTMLElement>('[data-fmt]');
    if (!item) return;
    layer?.close('pick');
    const { text, href } = doc();
    void exportDoc(item.dataset.fmt as Format, text, href, page)
      .then(msg => { if (msg) toast(msg, 4000); })
      .catch(err => toast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 5000));
  });
}

// The computed styles a block's still copy needs to look the same outside the page.
const BLOCK_PROPS = ['display', 'box-sizing', 'width', 'height', 'min-width', 'margin', 'padding', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-radius', 'border-collapse', 'border-spacing', 'background-color', 'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'letter-spacing', 'text-align', 'text-transform', 'text-decoration', 'vertical-align', 'white-space', 'overflow-wrap', 'word-break', 'tab-size',
  'grid-template-columns', 'gap', 'align-items', 'justify-content', 'flex-direction', 'flex-wrap', 'opacity', 'list-style', 'table-layout', 'box-shadow'];

/** A table or code block as an SVG picture of how it looks on the page now. */
export function blockSvg(el: HTMLElement): { svg: string; w: number; h: number } {
  const r = el.getBoundingClientRect();
  const w = Math.ceil(Math.max(r.width, el.scrollWidth)), h = Math.ceil(Math.max(r.height, el.scrollHeight));
  const c = el.cloneNode(true) as HTMLElement;
  const a = [el, ...el.querySelectorAll<HTMLElement>('*')], b = [c, ...c.querySelectorAll<HTMLElement>('*')];
  // Widths are copied so text wraps where it does on the page; heights only
  // for the block and its pictures, since a table row given its measured
  // height grows by its padding.
  a.forEach((src, i) => {
    const cs = getComputedStyle(src);
    const sized = i === 0 || /^(IMG|SVG|svg)$/.test(src.tagName);
    b[i].setAttribute('style', BLOCK_PROPS.filter(p => sized || p !== 'height').map(p => `${p}:${cs.getPropertyValue(p)}`).join(';'));
    b[i].removeAttribute('class');
  });
  // Line numbers are drawn by the page's stylesheet, which the picture does not carry; leave room where they were.
  c.querySelectorAll<HTMLElement>('pre').forEach(p => { p.style.paddingLeft = '1em'; });
  c.querySelectorAll('button, .fe-col-rz, .fe-blk-x').forEach(n => n.remove());
  c.style.margin = '0';
  c.style.width = `${w}px`;
  c.style.overflow = 'visible';
  // The colour showing behind the block on screen, so a transparent block keeps its look.
  const back = backdrop(el);
  const body = new XMLSerializer().serializeToString(c);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="${back}"/><foreignObject x="0" y="0" width="${w}" height="${h}">${body.replace(/^<(\w+)/, '<$1 xmlns="http://www.w3.org/1999/xhtml"')}</foreignObject></svg>`;
  return { svg, w, h };
}

/** The first solid colour behind an element, walking out to the page. */
function backdrop(el: Element): string {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const c = getComputedStyle(n).backgroundColor;
    if (c && !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(c)) return c;
  }
  return '#fff';
}

/** Save a table or code block as an SVG or a PNG. */
export async function saveBlock(el: HTMLElement, fmt: 'svg' | 'png', base: string): Promise<string> {
  const { svg, w, h } = blockSvg(el);
  const name = `${base}.${fmt}`;
  if (fmt === 'svg') saveBlob(new Blob([svg], { type: 'image/svg+xml' }), name);
  else saveBlob(await (await fetch(await svgToPng(svg, w, h))).blob(), name);
  return `Saved ${name}`;
}


/** Open the SVG / PNG choice for the block a picture button belongs to. */
export function openBlockMenu(btn: HTMLElement, toast: Toast): void {
  const block = btn.closest<HTMLElement>('.fe-md-code, .fe-md-tablewrap');
  if (!block) return;
  const target = block.matches('.fe-md-tablewrap') ? block.querySelector<HTMLElement>('table') ?? block : block;
  const kind = block.matches('.fe-md-tablewrap') ? 'table' : 'code';
  const doc = decodeURIComponent(location.pathname.split('/').pop() || 'doc').replace(/\.[^.]+$/, '');
  const n = [...document.querySelectorAll(block.matches('.fe-md-tablewrap') ? '.fe-md-tablewrap' : '.fe-md-code')].indexOf(block) + 1;
  const menu = document.createElement('div');
  menu.className = 'fe-ctx fe-export-menu';
  menu.innerHTML = `<div class="row fe-ctx-item" data-fmt="svg">${UI_ICON.image}<span>SVG, sharp at any size</span></div><div class="row fe-ctx-item" data-fmt="png">${UI_ICON.image}<span>PNG, twice the size</span></div>`;
  const layer = openLayer(menu, { kind: 'popover', anchor: btn, role: 'menu', group: 'menu', label: 'Save as a picture' });
  menu.addEventListener('click', e => {
    const fmt = (e.target as Element).closest<HTMLElement>('[data-fmt]')?.dataset.fmt as 'svg' | 'png' | undefined;
    if (!fmt) return;
    layer.close('pick');
    void saveBlock(target, fmt, `${doc}-${kind}-${n}`).then(m => toast(m), err => toast(`Could not save the picture: ${err instanceof Error ? err.message : String(err)}`, 5000));
  });
}
