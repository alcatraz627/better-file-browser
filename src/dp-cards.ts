// The body of a decision page: one card per decision or item to review,
// banded into foldable groups, and the "Notes for Claude" card at the end.
// Each card leads with its question; long context folds to a few lines, and
// the note field opens from a button in the card's head. Markup only;
// dp-page.ts wires it to the answers.
import type { DpConfig, DpDecision, DpSection, DpOption } from './dp-page';
import { noneCode } from './dp-form';
import { esc } from './utils';
import { renderMarkdown } from './renderers';
import { switchHtml } from './controls';
import { DISCLOSE } from './icons';
import { UI_ICON } from './control-icons';
import { mediaOf, mediaHtml, stripHtml, type Media, type ImageEntry } from './docview-media';
import { clampHtml } from './docview-clamp';

// Agent-written context keeps its line breaks, as the old page's pre-wrap did.
const md = (text: string, base: string) =>
  `<div class="fe-dp-md">${renderMarkdown(text.replace(/([^\n])\n(?!\n)/g, '$1  \n'), base)}</div>`;

/**
 * Whether preformatted text is laid out by its characters, a terminal render
 * or a boxed table, and must stay verbatim. Anything else (a PR body, a Slack
 * message) reads better rendered. Measured on the live pages: box lines or
 * column-aligned runs of spaces mark every terminal render and no message.
 */
export const isLaidOut = (text: string): boolean => /[─│┌┐└┘├┤═║╭╮╰╯]/.test(text) || /\S {3,}\S/.test(text);

// A `pre` block shows rendered or verbatim, as its text suits, with Raw to switch.
const preHtml = (text: string, base: string) => {
  const raw = isLaidOut(text);
  return `<div class="fe-dp-preview" data-view="${raw ? 'raw' : 'md'}">
    <button type="button" class="btn fe-dp-rawbtn" data-variant="ghost" data-size="sm" aria-pressed="${raw}" title="Show the text exactly as written, or rendered">Raw</button>
    ${md(text, base)}
    <pre class="fe-dp-pre">${esc(text)}</pre>
  </div>`;
};

const mediaList = (images: ImageEntry[] | undefined, base: string): Media[] =>
  (images ?? []).map(p => mediaOf(base, p)).filter((m): m is Media => !!m);

const noteBtn = (id: string, notes: boolean) => notes
  ? `<button type="button" class="btn fe-dp-addnote" data-icon data-variant="ghost" data-size="sm" data-note-for="${esc(id)}" title="Add a note (n)" aria-label="Add a note on ${esc(id)}">${UI_ICON.comment}</button>`
  : '';

const noteHtml = (id: string, notes: boolean) => notes ? `
  <div class="fe-dp-note" hidden>
    <textarea class="tb" data-note="${esc(id)}" rows="2" placeholder="A note for Claude about ${esc(id)}" aria-label="Note on ${esc(id)}"></textarea>
  </div>` : '';

function optionHtml(d: DpDecision, o: DpOption, n: number, base: string, none = false): string {
  const imgs = mediaList(o.images, base);
  return `<label class="fe-dp-opt${imgs.length ? ' tile' : ''}${none ? ' none' : ''}" data-code="${esc(o.code)}" data-media-label="${esc(`${o.code} · ${o.label}`)}" title="Answer code ${esc(o.code)}">
      <input type="radio" name="dp-${esc(d.id)}" value="${esc(o.code)}">
      ${imgs.length ? `<span class="fe-dp-tile-img">${imgs.map(m => mediaHtml(m, true)).join('')}</span>` : ''}
      <span class="fe-dp-opt-row">
        <kbd class="fe-dp-num">${n}</kbd>
        <span class="fe-dp-opt-tx"><span class="fe-dp-opt-lbl">${esc(o.label)}</span>${o.why ? `<span class="fe-dp-why">${esc(o.why)}</span>` : ''}</span>
        ${o.rec ? '<span class="badge fe-dp-rec" data-size="sm" data-tone="quiet">Recommended</span>' : ''}
      </span>
    </label>`;
}

/** How many picture options share a row: all of them up to three, four as two rows of two so each stays large, then three. */
export const tileCols = (n: number): number => (n <= 3 ? n : n === 4 ? 2 : 3);

/** A decision's group as a small label; decisions stay under one heading, so the group only names where it belongs. */
function decisionGroupHtml(d: DpDecision, cfg: DpConfig): string {
  if (!d.group) return '';
  const color = cfg.groups?.[d.group]?.color;
  return `<span class="badge fe-dp-dgrp" data-size="sm" data-tone="quiet"${color ? ` style="--grp:${esc(color)}"` : ''}>${esc(d.group)}</span>`;
}

function decisionHtml(d: DpDecision, cfg: DpConfig, base: string, notes: boolean): string {
  const tiles = d.options.filter(o => o.images?.length).length;
  const none: DpOption | null = d.none ? { code: noneCode(d), label: d.noneLabel || 'None of these' } : null;
  return `<article class="card fe-dp-card" data-id="${esc(d.id)}" data-kind="decision" tabindex="-1">
    <header class="fe-dp-card-head"><span class="badge fe-dp-id" data-tone="quiet">${esc(d.id)}</span><h3 class="fe-dp-q">${esc(d.question)}</h3>${decisionGroupHtml(d, cfg)}${noteBtn(d.id, notes)}</header>
    ${d.context ? clampHtml(md(d.context, base), 3) : ''}
    ${stripHtml(mediaList(d.images, base))}
    <div class="fe-dp-opts${tiles ? ' gallery' : ''}"${tiles ? ` style="--cols:${tileCols(tiles)}"` : ''} role="radiogroup" aria-label="${esc(d.question)}" data-media-set>
      ${d.options.map((o, i) => optionHtml(d, o, i + 1, base)).join('')}
      ${none ? optionHtml(d, none, d.options.length + 1, base, true) : ''}
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
      ${noteBtn(x.id, notes)}
      <label class="fe-dp-agree"><span class="fe-dp-agree-lbl">Agree</span>${switchHtml({ title: 'Agree with this as drafted (a)', label: `Agree with ${x.id}`, checked: true, small: true, cls: 'fe-dp-agree-sw' })}</label>
    </header>
    ${x.read ? clampHtml(md(x.read, base), 4) : ''}
    ${x.pre ? preHtml(x.pre, base) : ''}
    ${slots.length ? `<dl class="fe-dp-slots">${slots.map(([k, v]) => `<div class="fe-dp-slot" data-slot="${esc(k.toLowerCase())}"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${stripHtml(mediaList(x.images, base))}
    ${noteHtml(x.id, notes)}
  </article>`;
}

function groupHtml(key: string, title: string, cards: string[], cfg: DpConfig, base: string): string {
  const g = cfg.groups?.[title];
  return `<details class="fe-grp fe-dp-grp" data-grp="${esc(key)}" open${g?.color ? ` style="--grp:${esc(g.color)}"` : ''}>
    <summary class="sect" data-level="group">${DISCLOSE}${esc(title)}<span class="fe-grp-n">${cards.length}</span></summary>
    ${g?.context ? `<div class="fe-dp-grp-ctx">${clampHtml(md(g.context, base), 2)}</div>` : ''}
    <div class="fe-grp-body">${cards.join('')}</div>
  </details>`;
}

/** The group a section is banded under. */
export const sectionGroup = (x: DpSection): string => x.group || 'To review';

/** The whole body: decisions first under one heading, then items in their groups in first-seen order, then the end notes. */
export function bodyHtml(cfg: DpConfig, base: string): string {
  const notes = cfg.notes !== false;
  const out: string[] = [];
  const ds = cfg.decisions ?? [];
  if (ds.length) out.push(groupHtml('Decisions', 'Decisions', ds.map(d => decisionHtml(d, cfg, base, notes)), cfg, base));
  const bands = new Map<string, string[]>();
  for (const x of cfg.sections ?? []) {
    const name = sectionGroup(x);
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
