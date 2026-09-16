import type { Entry, IconRule, Place, Settings, Tag, TipData } from './types';
import { esc, fmtSize, fmtDate, fmtType, getExt, fullPath } from './utils';
import { getIcon, IMG_EXTS, PI } from './icons';
import { groupByTag, filterSaved } from './places';
import { isViewPath } from './find';
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
  lines.push(e.isDir
    ? 'Click opens · ⌥-click keeps a tab · middle-click: Chrome tab'
    : 'Click looks · double-click opens · ⌥-click keeps a tab · middle-click: Chrome tab');
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

// Saved folders, untagged first, then one sub-heading per tag. Each row has
// a drag grip, the label (double-click renames), a tag button and a remove.
export function renderSavedList(saved: Place[], tags: Tag[], rawPath: string, filter = ''): string {
  if (!saved.length) return `<div class="fe-hint">Nothing saved yet.<br>Click ☆ in the path bar, or + to name this folder.</div>`;
  saved = filterSaved(saved, filter);
  if (!saved.length) return `<div class="fe-hint">No saved item matches.</div>`;
  const color = (name: string) => tags.find(t => t.name === name)?.color ?? '#8b949e';
  const VIEW_ICON = `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1.5 2h11l-4.2 5v4.5l-2.6-1.3V7z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
  const row = (p: Place) => `
    <div class="fe-bm-item fe-pl-item${isViewPath(p.path) ? ' fe-view' : ''}" draggable="true" data-path="${esc(p.path)}">
      <span class="fe-drag-h" title="Drag to reorder">${PI.drag}</span>
      <a href="file://${esc(p.path)}" class="fe-si-link${p.path === rawPath ? ' active' : ''}" title="${esc(isViewPath(p.path) ? 'Saved view in ' + p.path.split('#')[0] : p.path)}">
        ${isViewPath(p.path) ? VIEW_ICON : PI.folder}<span class="fe-sl fe-pl-label" title="Double-click to rename">${esc(p.label)}</span>
        <span class="fe-pl-dots">${(p.tags ?? []).map(t => `<i class="fe-sv-mini" style="background:${esc(color(t))}" title="${esc(t)}"></i>`).join('')}</span>
      </a>
      <span class="fe-pl-tags" title="Tags, comma separated"></span>
      <button class="fe-tag-btn" data-path="${esc(p.path)}" title="Tags">#</button>
      <button class="fe-rm-btn" data-path="${esc(p.path)}" title="Remove">✕</button>
    </div>`;
  return groupByTag(saved, tags).map(g => {
    const head = g.tag
      ? `<div class="fe-sv-tag"><i class="fe-sv-dot" data-tag="${esc(g.tag.name)}" style="background:${esc(g.tag.color)}" title="Click to change colour"></i>${esc(g.tag.name)}</div>`
      : '';
    return head + g.items.map(row).join('');
  }).join('');
}

export function renderCrumbs(rawPath: string, segments: string[]): string {
  const crumbs = [{ label: '/', href: 'file:///' }];
  let acc = '/';
  for (const seg of segments) { acc += seg + '/'; crumbs.push({ label: seg, href: 'file://' + acc }); }
  return crumbs.map((c, i) =>
    `<a href="${esc(c.href)}" class="fe-crumb" title="Go to ${esc(decodeURIComponent(c.href.slice(7)))}">${esc(c.label)}</a>` +
    `<button class="fe-crumb-dd" data-url="${esc(c.href)}" title="Browse ${esc(c.href)}">▾</button>` +
    (i < crumbs.length - 1 ? `<span class="fe-sep">›</span>` : '')
  ).join('');
}
