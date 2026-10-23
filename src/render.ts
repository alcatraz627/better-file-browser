import type { Entry, IconRule, Place, Settings, Tag, TipData } from './types';
import { esc, fmtSize, fmtDate, fmtType, getExt, fullPath, fileHref } from './utils';
import { getIcon, icoFile, IMG_EXTS, PI, CHEVRON_DOWN, CHEVRON_RIGHT, DISCLOSE } from './icons';
import { groupByTag, filterSaved, samePlace } from './places';
import { isViewPath } from './find';
import { canPreview } from './preview';
import type { ContentHit } from './find';
import { UI_ICON } from './control-icons';
import { emptyHtml, CLEAR } from './empty-state';

export interface RenderContext {
  rawPath:   string;
  iconRules: IconRule[] | null;
  settings:  Settings;
  // The tags a saved file or folder carries, for the Tags column.
  tagsOf?:   (path: string) => { name: string; color: string }[];
  // Open comment threads on a document in this folder, by its name.
  openComments?: (name: string) => number;
}

function commentBadge(e: Entry, ctx: RenderContext): string {
  const n = e.isDir || e.isParent ? 0 : ctx.openComments?.(e.name) ?? 0;
  return n ? `<span class="badge fe-row-cm" title="${n} open comment${n === 1 ? '' : 's'}">${UI_ICON.comment}${n}</span>` : '';
}

// Tags as chips. A tag's colour tints its outline, so the eye can group by
// colour without a dot, which is kept for states that need attention.
// Past two, the rest fold into one "+N" chip that names them on hover, so a
// long tag list never ends in a chip cut in half.
const CHIPS_SHOWN = 2;
function tagChips(e: Entry, ctx: RenderContext): string {
  if (e.isParent || !ctx.tagsOf) return '';
  const tags = ctx.tagsOf(fullPath(ctx.rawPath, e));
  const shown = tags.length > CHIPS_SHOWN + 1 ? tags.slice(0, CHIPS_SHOWN) : tags;
  const rest = tags.slice(shown.length);
  if (!tags.length) return '';
  return '<div class="fe-chips">' + shown.map(t =>
    `<span class="chip" data-size="sm" style="--chip:${esc(t.color)}" title="Tag: ${esc(t.name)}"><span>${esc(t.name)}</span></span>`).join('')
    + (rest.length ? `<span class="chip fe-chip-more" data-size="sm" title="Also tagged: ${esc(rest.map(t => t.name).join(', '))}">+${rest.length}</span>` : '') + '</div>';
}

export function buildTipData(e: Entry, ctx: RenderContext): string {
  if (e.isParent) {
    return JSON.stringify({ icon: '', name: 'Parent Directory', lines: ['Navigate up one level'] } satisfies TipData);
  }
  const fp = fullPath(ctx.rawPath, e);
  const lines = [`Path: ${fp}`, `Type: ${fmtType(e)}`];
  if (!e.isDir) lines.push(`Size: ${fmtSize(e.rawBytes)}`);
  lines.push(`Modified: ${fmtDate(e.dateMs, ctx.settings, e.dateStr)}`);
  if (e.isHidden) lines.push(e.name.startsWith('.') ? 'Hidden file (dotfile)' : 'Comments on ' + e.name.replace(/\.bfb[^./]*\.json$/, ''));
  lines.push(e.isDir
    ? 'Click opens · ⌥-click keeps a tab · middle-click: Chrome tab'
    : 'Click looks · double-click opens · ⌥-click keeps a tab · middle-click: Chrome tab');
  const tip: TipData = {
    icon: getIcon(e, ctx.iconRules),
    name: e.name,
    lines,
  };
  return JSON.stringify(tip);
}

export function itemActions(e: Entry, rawPath: string): string {
  if (e.isParent) return '';
  const dPath = esc(fullPath(rawPath, e)), dName = esc(e.name);
  const pvBtn = canPreview(e)
    ? `<button class="btn fe-act-btn fe-act-pv" data-icon data-size="sm" data-variant="surface" title="Preview (Space)" data-pv="${dName}">
        <svg width="12" height="12" viewBox="0 0 13 13"><path d="M1 6.5C2.5 3 4.8 1.5 6.5 1.5S10.5 3 12 6.5C10.5 10 8.2 11.5 6.5 11.5S2.5 10 1 6.5z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="6.5" cy="6.5" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
      </button>`
    : '';
  return `<span class="fe-acts" data-path="${dPath}" data-name="${dName}">
    ${pvBtn}<button class="btn fe-act-btn fe-act-cp" data-icon data-size="sm" data-variant="surface" title="Copy full path" data-copy="${dPath}">
      <svg width="11" height="12" viewBox="0 0 11 12"><rect x="3" y="3" width="7" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1 1h6v1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
    </button>
    <button class="btn fe-act-btn fe-act-nm" data-icon data-size="sm" data-variant="surface" title="Copy name" data-copy="${dName}">
      <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 3h7M2 6h7M2 9h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
    </button>
  </span>`;
}

export function renderHitSnippet(hit: ContentHit): string {
  return `<span class="fe-find-snippet" title="First match on line ${hit.lineNumber}">${esc(hit.line.slice(0, hit.start))}<mark>${esc(hit.line.slice(hit.start, hit.end))}</mark>${esc(hit.line.slice(hit.end))}</span>`;
}

export function renderRow(e: Entry, ctx: RenderContext, idx = -1, hit?: ContentHit): string {
  const tipData = buildTipData(e, ctx);
  return `<tr class="fe-row${e.isDir ? ' dir' : ''}${e.isParent ? ' par' : ''}${e.isHidden ? ' dotfile' : ''}"
             data-name="${esc(e.name.toLowerCase())}"
             data-idx="${idx}"
             ${e.isParent ? '' : `data-tip="${esc(tipData)}"`}>
    <td class="c-nm"><a href="${esc(e.href)}" class="fe-lnk">${getIcon(e, ctx.iconRules)}<span class="fe-nm">${esc(e.isParent ? 'Parent Directory' : e.name)}</span>${commentBadge(e, ctx)}</a>${hit ? renderHitSnippet(hit) + `<span class="badge fe-find-badge">${hit.count}</span>` : ''}${itemActions(e, ctx.rawPath)}</td>
    <td class="c-tp">${fmtType(e)}</td>
    <td class="c-tg">${tagChips(e, ctx)}</td>
    <td class="c-sz">${e.isDir ? '—' : fmtSize(e.rawBytes)}</td>
    <td class="c-dt">${fmtDate(e.dateMs, ctx.settings, e.dateStr)}</td>
    <td class="c-match">${hit ? hit.count : ''}</td>
  </tr>`;
}

export function renderTile(e: Entry, ctx: RenderContext, idx = -1, hit?: ContentHit): string {
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
    ${hit ? `<span class="badge fe-find-badge">${hit.count}</span>${renderHitSnippet(hit)}` : ''}
    ${!e.isDir && !e.isParent ? `<span class="fe-tile-sz">${fmtSize(e.rawBytes)}</span>` : ''}
    ${e.isParent ? '' : `<span class="fe-tile-meta"><span class="fe-tile-tp">${fmtType(e)}</span><span class="fe-tile-dt">${fmtDate(e.dateMs, ctx.settings, e.dateStr)}</span><span class="fe-tile-tags">${tagChips(e, ctx)}${commentBadge(e, ctx)}</span></span>`}
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
// A saved file keeps its path without a trailing slash; a folder ends in one.
const savedFileExt = (path: string) => path.endsWith('/') ? '' : (path.split('/').pop()!.match(/\.([^.]+)$/)?.[1].toLowerCase() ?? '');

/** The Saved list: one quiet line per place, grouped under its first tag.
 *  `hits` holds places found by looking inside them (a deep search), each with
 *  the name that matched; they show even when their own name does not match. */
export function renderSavedList(saved: Place[], tags: Tag[], rawPath: string, filter = '', folded: Set<string> = new Set(), hits: Map<string, string> = new Map()): string {
  if (!saved.length) return emptyHtml('empty', 'Nothing saved yet', { inline: true, hint: 'Click ☆ in the path bar, or + to name this folder' });
  const byName = filterSaved(saved, filter);
  saved = saved.filter(p => byName.includes(p) || hits.has(p.path));
  if (!saved.length) return emptyHtml('filtered', 'No saved item matches', { inline: true, actions: [CLEAR] });
  const VIEW_ICON = `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1.5 2h11l-4.2 5v4.5l-2.6-1.3V7z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
  const row = (p: Place) => {
    const n = p.tags?.length ?? 0, hit = hits.get(p.path);
    return `
    <div class="row fe-bm-item fe-pl-item${isViewPath(p.path) ? ' fe-view' : ''}" draggable="true" data-path="${esc(p.path)}">
      <span class="fe-drag-h" aria-hidden="true">${PI.drag}</span>
      <a href="${isViewPath(p.path) ? 'file://' + esc(p.path) : fileHref(p.path)}" class="fe-si-link${samePlace(p.path, rawPath) ? ' active" aria-current="page' : ''}">
        ${isViewPath(p.path) ? VIEW_ICON : savedFileExt(p.path) ? icoFile(savedFileExt(p.path)) : PI.folder}<span class="fe-sl fe-pl-label">${esc(p.label || p.path.split('/').filter(Boolean).pop() || '/')}</span>
        ${n ? `<span class="fe-pl-meta">${UI_ICON.tag}${n}</span>` : ''}
      </a>${hit ? `<span class="fe-pl-hit">${esc(hit)}</span>` : ''}
      <span class="fe-pl-tags" title="Tags, comma separated"></span>
      <button class="btn fe-tag-btn" data-icon data-size="sm" data-path="${esc(p.path)}" title="Edit tags" aria-label="Edit tags">${UI_ICON.tag}</button>
      <button class="btn fe-rm-btn" data-icon data-size="sm" data-tone="danger" data-path="${esc(p.path)}" title="Remove from Saved" aria-label="Remove from Saved">${UI_ICON.close}</button>
    </div>`;
  };
  // A filter opens every group so no match hides inside a folded one.
  return groupByTag(saved, tags).map(g => {
    if (!g.tag) return g.items.map(row).join('');
    const open = filter.trim() || !folded.has(g.tag.name) ? ' open' : '';
    return `<details class="fe-grp" data-tag="${esc(g.tag.name)}"${open}>
      <summary class="sect fe-sv-tag" data-level="group">${DISCLOSE}<i class="fe-sv-dot" data-tag="${esc(g.tag.name)}" style="--dot:${esc(g.tag.color)}" title="Click to change colour"></i>${esc(g.tag.name)}<span class="fe-grp-n">${g.items.length}</span></summary>
      <div class="fe-grp-body">${g.items.map(row).join('')}</div>
    </details>`;
  }).join('');
}

// The path bar: one crumb per folder, each followed by a chevron that is both
// the separator and a menu of what that folder holds. The current folder's
// chevron points down, since nothing follows it unless a file does. Middle
// crumbs fold into a "…" menu when the bar runs out of room (fitCrumbs in chrome.ts).
// Inside your home folder the path starts at "~": the folders above it stay in
// the bar, folded from the start, so the "…" menu still reaches them.
export function renderCrumbs(rawPath: string, segments: string[], trailing = false, home = ''): string {
  const crumbs = [{ label: '/', href: 'file:///' }];
  let acc = '/';
  for (const seg of segments) { acc += seg + '/'; crumbs.push({ label: seg, href: fileHref(acc) }); }
  const homeAt = home && (acc === home + '/' || acc.startsWith(home + '/')) ? home.split('/').length - 1 : -1;
  return crumbs.map((c, i) => {
    const last = i === crumbs.length - 1, where = esc(decodeURIComponent(c.href.slice(7)));
    const end = last && !trailing;
    const label = i === homeAt ? '~' : c.label;
    const pre = i < homeAt ? ' data-pre hidden' : '';
    return `<span class="fe-cg" data-i="${i}"${pre}><a href="${esc(c.href)}" class="fe-crumb${end ? ' cur' : ''}" title="Go to ${where}">${esc(label)}</a>` +
      `<button class="btn fe-crumb-dd" data-url="${esc(c.href)}" title="What is in ${where}" aria-label="What is in ${where}">${end ? CHEVRON_DOWN : CHEVRON_RIGHT}</button></span>`;
  }).join('');
}
