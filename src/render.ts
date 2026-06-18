import type { Entry, Bookmark, IconRule, Place, Settings, TipData } from './types';
import { esc, fmtSize, fmtDate, fmtType, getExt, fullPath } from './utils';
import { getIcon, IMG_EXTS, PI } from './icons';
import { canPreview } from './preview';

export interface RenderContext {
  rawPath:   string;
  iconRules: IconRule[] | null;
  settings:  Settings;
}

export function buildTipData(e: Entry, ctx: RenderContext): string {
  if (e.isParent) {
    return JSON.stringify({ icon: '', name: 'Parent Directory', lines: ['Navigate up one level'] } satisfies TipData);
  }
  const fp = fullPath(ctx.rawPath, e);
  const lines = [`Path: ${fp}`, `Type: ${fmtType(e)}`];
  if (!e.isDir) lines.push(`Size: ${fmtSize(e.rawBytes)}`);
  lines.push(`Modified: ${fmtDate(e.dateMs, ctx.settings, e.dateStr)}`);
  if (e.isHidden) lines.push('Hidden file (dotfile)');
  if (IMG_EXTS.has(getExt(e))) lines.push('Image — dimensions require native host');
  const tip: TipData = {
    icon: getIcon(e, ctx.iconRules),
    name: e.name,
    lines,
    warn: 'Permissions/creation date require native host',
  };
  return JSON.stringify(tip);
}

export function itemActions(e: Entry, rawPath: string): string {
  if (e.isParent) return '';
  const dPath = esc(fullPath(rawPath, e)), dName = esc(e.name);
  const pvBtn = canPreview(e)
    ? `<button class="fe-act-btn fe-act-pv" title="Preview (Space)" data-pv="${dName}">
        <svg width="12" height="12" viewBox="0 0 13 13"><path d="M1 6.5C2.5 3 4.8 1.5 6.5 1.5S10.5 3 12 6.5C10.5 10 8.2 11.5 6.5 11.5S2.5 10 1 6.5z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="6.5" cy="6.5" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>`
    : '';
  return `<span class="fe-acts" data-path="${dPath}" data-name="${dName}">
    ${pvBtn}<button class="fe-act-btn fe-act-cp" title="Copy full path" data-copy="${dPath}">
      <svg width="11" height="12" viewBox="0 0 11 12"><rect x="3" y="3" width="7" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1 1h6v1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
    </button>
    <button class="fe-act-btn fe-act-nm" title="Copy name" data-copy="${dName}">
      <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 3h7M2 6h7M2 9h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
    </button>
  </span>`;
}

export function renderRow(e: Entry, ctx: RenderContext, idx = -1): string {
  const tipData = buildTipData(e, ctx);
  return `<tr class="fe-row${e.isDir ? ' dir' : ''}${e.isParent ? ' par' : ''}${e.isHidden ? ' dotfile' : ''}"
             data-name="${esc(e.name.toLowerCase())}"
             data-idx="${idx}"
             data-tip="${esc(tipData)}">
    <td class="c-nm"><a href="${esc(e.href)}" class="fe-lnk">${getIcon(e, ctx.iconRules)}<span class="fe-nm">${esc(e.isParent ? 'Parent Directory' : e.name)}</span></a>${itemActions(e, ctx.rawPath)}</td>
    <td class="c-tp">${fmtType(e)}</td>
    <td class="c-sz">${e.isDir ? '—' : fmtSize(e.rawBytes)}</td>
    <td class="c-dt">${fmtDate(e.dateMs, ctx.settings, e.dateStr)}</td>
  </tr>`;
}

export function renderTile(e: Entry, ctx: RenderContext, idx = -1): string {
  const tipData = buildTipData(e, ctx);
  const isImg = !e.isDir && !e.isParent && IMG_EXTS.has(getExt(e));
  const iconHtml = isImg
    ? `<span class="fe-tile-img-wrap"><img class="fe-tile-thumb" src="${esc(e.href)}" loading="lazy" alt="" onerror="this.closest('.fe-tile-img-wrap').classList.add('err')">${getIcon(e, ctx.iconRules)}</span>`
    : getIcon(e, ctx.iconRules);
  return `<a href="${esc(e.href)}" class="fe-tile${e.isDir ? ' dir' : ''}${e.isParent ? ' par' : ''}${e.isHidden ? ' dotfile' : ''}"
            data-name="${esc(e.name.toLowerCase())}"
            data-idx="${idx}"
            data-tip="${esc(tipData)}">
    <span class="fe-tile-ic">${iconHtml}</span>
    <span class="fe-tile-nm">${esc(e.isParent ? '..' : e.name)}</span>
    ${!e.isDir && !e.isParent ? `<span class="fe-tile-sz">${fmtSize(e.rawBytes)}</span>` : ''}
    ${itemActions(e, ctx.rawPath)}
  </a>`;
}

export function renderRows(entries: Entry[], ctx: RenderContext, start = 0): string {
  return entries.map((e, i) => renderRow(e, ctx, start + i)).join('');
}
export function renderTiles(entries: Entry[], ctx: RenderContext, start = 0): string {
  return entries.map((e, i) => renderTile(e, ctx, start + i)).join('');
}

export function renderBMList(bm: Bookmark[], rawPath: string): string {
  if (!bm.length) return `<div class="fe-hint">No bookmarks.<br>Click ☆ in the path bar to add.</div>`;
  return bm.map(b => `
    <div class="fe-bm-item" draggable="true" data-path="${esc(b.path)}">
      <span class="fe-drag-h">${PI.drag}</span>
      <a href="file://${esc(b.path)}" class="fe-si-link${b.path === rawPath ? ' active' : ''}" title="${esc(b.path)}">
        ${PI.bm}<span class="fe-sl">${esc(b.label)}</span>
      </a>
      <button class="fe-rm-btn" data-path="${esc(b.path)}" title="Remove">✕</button>
    </div>`).join('');
}

export function renderPlacesList(places: Place[], rawPath: string): string {
  if (!places.length) return `<div class="fe-hint">No places yet.<br>Click + to add this folder.</div>`;
  return places.map(p => `
    <div class="fe-bm-item fe-pl-item" draggable="true" data-path="${esc(p.path)}">
      <span class="fe-drag-h">${PI.drag}</span>
      <a href="file://${esc(p.path)}" class="fe-si-link${p.path === rawPath ? ' active' : ''}" title="${esc(p.path)}">
        ${PI.folder}<span class="fe-sl fe-pl-label" title="Double-click to rename">${esc(p.label)}</span>
      </a>
      <button class="fe-rm-btn" data-path="${esc(p.path)}" title="Remove">✕</button>
    </div>`).join('');
}

export function renderCrumbs(rawPath: string, segments: string[]): string {
  const crumbs = [{ label: '/', href: 'file:///' }];
  let acc = '/';
  for (const seg of segments) { acc += seg + '/'; crumbs.push({ label: seg, href: 'file://' + acc }); }
  return crumbs.map((c, i) =>
    `<a href="${esc(c.href)}" class="fe-crumb">${esc(c.label)}</a>` +
    `<button class="fe-crumb-dd" data-url="${esc(c.href)}" title="Browse ${esc(c.href)}">▾</button>` +
    (i < crumbs.length - 1 ? `<span class="fe-sep">›</span>` : '')
  ).join('');
}
