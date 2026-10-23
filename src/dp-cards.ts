// The body of a decision page: one card per decision or item to review,
// banded into foldable groups, each with its note field, and the "Notes for
// Claude" card at the end. Markup only; dp-page.ts wires it to the answers.
import type { DpConfig, DpDecision, DpSection, DpOption } from './dp-page';
import { noneCode } from './dp-form';
import { esc } from './utils';
import { renderMarkdown } from './renderers';
import { switchHtml } from './controls';
import { DISCLOSE } from './icons';

/** An image the page may show: a file inside the page's folder, or a web image. Anything climbing out with `..` is refused. */
export function imgSrc(base: string, p: string): string | null {
  if (/^https?:\/\//.test(p)) return p;
  if (!p || p.startsWith('/') || p.split(/[\\/]/).includes('..') || /^[a-z]+:/i.test(p)) return null;
  return base + p.split('/').map(encodeURIComponent).join('/');
}

// Agent-written context keeps its line breaks, as the old page's pre-wrap did.
const md = (text: string, base: string) =>
  `<div class="fe-dp-md">${renderMarkdown(text.replace(/([^\n])\n(?!\n)/g, '$1  \n'), base)}</div>`;

const stripHtml = (images: string[] | undefined, base: string) => {
  const ok = (images ?? []).map(p => [p, imgSrc(base, p)] as const).filter((x): x is readonly [string, string] => !!x[1]);
  return ok.length ? `<div class="fe-dp-strip">${ok.map(([p, src]) => `<a class="fe-dp-shot" href="${esc(src)}" target="_blank" title="${esc(p)}"><img src="${esc(src)}" alt="${esc(p)}" loading="lazy"></a>`).join('')}</div>` : '';
};

const noteHtml = (id: string, notes: boolean) => notes ? `
  <div class="fe-dp-note" hidden>
    <textarea class="tb" data-note="${esc(id)}" rows="2" placeholder="A note for Claude about ${esc(id)}" aria-label="Note on ${esc(id)}"></textarea>
  </div>
  <button type="button" class="btn fe-dp-addnote" data-variant="ghost" data-size="sm" data-note-for="${esc(id)}">Add a note</button>` : '';

function optionHtml(d: DpDecision, o: DpOption, n: number, base: string, none = false): string {
  const imgs = (o.images ?? []).map(p => imgSrc(base, p)).filter((s): s is string => !!s);
  return `<label class="fe-dp-opt${imgs.length ? ' tile' : ''}${none ? ' none' : ''}" data-code="${esc(o.code)}">
      <input type="radio" name="dp-${esc(d.id)}" value="${esc(o.code)}">
      ${imgs.length ? `<span class="fe-dp-tile-img">${imgs.map(s => `<img src="${esc(s)}" alt="" loading="lazy">`).join('')}</span>` : ''}
      <span class="fe-dp-opt-row">
        <span class="badge fe-dp-num" data-size="sm">${n}</span>
        <span class="fe-dp-opt-lbl">${esc(o.label)}</span>
        <span class="badge fe-dp-code" data-tone="quiet" title="Answer code">${esc(o.code)}</span>
        ${o.rec ? '<span class="badge fe-dp-rec" data-tone="solid">Recommended</span>' : ''}
      </span>
      ${o.why ? `<span class="fe-dp-why">${esc(o.why)}</span>` : ''}
    </label>`;
}

function decisionHtml(d: DpDecision, base: string, notes: boolean): string {
  const opts = [...d.options];
  const tiles = opts.some(o => o.images?.length);
  const none: DpOption | null = d.none ? { code: noneCode(d), label: d.noneLabel || 'None of these' } : null;
  return `<article class="card fe-dp-card" data-id="${esc(d.id)}" data-kind="decision" tabindex="-1">
    <header class="fe-dp-card-head"><span class="badge fe-dp-id" data-tone="quiet">${esc(d.id)}</span><h3 class="fe-dp-q">${esc(d.question)}</h3></header>
    ${d.context ? md(d.context, base) : ''}
    ${stripHtml(d.images, base)}
    <div class="fe-dp-opts${tiles ? ' gallery' : ''}" role="radiogroup" aria-label="${esc(d.question)}">
      ${opts.map((o, i) => optionHtml(d, o, i + 1, base)).join('')}
      ${none ? optionHtml(d, none, opts.length + 1, base, true) : ''}
    </div>
    ${noteHtml(d.id, notes)}
  </article>`;
}

function sectionHtml(x: DpSection, base: string, notes: boolean): string {
  const slots = Object.entries(x.slots ?? {});
  return `<article class="card fe-dp-card" data-id="${esc(x.id)}" data-kind="section" tabindex="-1">
    <header class="fe-dp-card-head">
      <span class="badge fe-dp-id" data-tone="quiet">${esc(x.id)}</span>
      <h3 class="fe-dp-q">${esc(x.title || x.id)}</h3>
      ${x.prio ? `<span class="badge fe-dp-prio" data-prio="${esc(x.prio.toLowerCase())}">${esc(x.prio)}</span>` : ''}
      <label class="fe-dp-agree"><span class="fe-dp-agree-lbl">Agree</span>${switchHtml({ title: 'Agree with this as drafted', label: `Agree with ${x.id}`, checked: true, small: true, cls: 'fe-dp-agree-sw' })}</label>
    </header>
    ${x.read ? md(x.read, base) : ''}
    ${x.pre ? `<pre class="fe-dp-pre">${esc(x.pre)}</pre>` : ''}
    ${slots.length ? `<dl class="fe-dp-slots">${slots.map(([k, v]) => `<div class="fe-dp-slot" data-slot="${esc(k.toLowerCase())}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${stripHtml(x.images, base)}
    ${noteHtml(x.id, notes)}
  </article>`;
}

function groupHtml(key: string, title: string, cards: string[], cfg: DpConfig, base: string): string {
  const g = cfg.groups?.[title];
  return `<details class="fe-grp fe-dp-grp" data-grp="${esc(key)}" open${g?.color ? ` style="--grp:${esc(g.color)}"` : ''}>
    <summary class="sect" data-level="group">${DISCLOSE}${esc(title)}<span class="fe-grp-n">${cards.length}</span></summary>
    ${g?.context ? `<div class="fe-dp-grp-ctx">${md(g.context, base)}</div>` : ''}
    <div class="fe-grp-body">${cards.join('')}</div>
  </details>`;
}

/** The whole body: decisions first under one heading, then items in their groups in first-seen order, then the end notes. */
export function bodyHtml(cfg: DpConfig, base: string): string {
  const notes = cfg.notes !== false;
  const out: string[] = [];
  const ds = cfg.decisions ?? [];
  if (ds.length) out.push(groupHtml('Decisions', 'Decisions', ds.map(d => decisionHtml(d, base, notes)), cfg, base));
  const bands = new Map<string, string[]>();
  for (const x of cfg.sections ?? []) {
    const name = x.group || 'To review';
    if (!bands.has(name)) bands.set(name, []);
    bands.get(name)!.push(sectionHtml(x, base, notes));
  }
  for (const [name, cards] of bands) out.push(groupHtml('s:' + name, name, cards, cfg, base));
  if (notes) out.push(`<section class="card fe-dp-end" id="fe-dp-end">
    <h3 class="fe-dp-q">Notes for Claude</h3>
    <textarea class="tb" id="fe-dp-endnotes" rows="3" placeholder="Anything else Claude should know" aria-label="Notes for Claude"></textarea>
  </section>`);
  return out.join('');
}
