// Pointer and keyboard input for the listing: the click model on rows and
// tiles, the row hover tip, the context menu, and the page's keydown router
// (dialog and preview keys first, then listing keys, then the strip's).
import type { App } from './app';
import type { Listing } from './listing';
import { el } from './el';
import { esc, fullPath, copyToClipboard, pageHref } from './utils';
import { openPreview, closePreview, isPreviewOpen, canPreview, previewEntry, keepPreviewedAsTab } from './preview';
import { bind, addPaletteSource } from './commands';
import { openLayer, raise, type Layer } from './layer';
import { getSortConfig, getGroupMode } from './storage';
import { getIcon } from './icons';
import type { SortConfig, GroupMode } from './types';

export function initListingInput(app: App, listing: Listing): void {
  const { fe, toast, rawPath } = app;
  const { ls, sel } = listing;
  const scroll = el('fe-scroll');
  const copyText = (val: string) => { copyToClipboard(val).then(() => toast(`Copied: ${val}`)); };

  // The click model (docs/mouse-key-audit.md): a plain click on a file looks
  // (panel, URL unchanged) and on a folder goes; double-click goes; alt keeps
  // a background strip tab; shift or cmd toggles the row and shift-cmd ranges.
  // The anchor keeps its href so middle click reaches Chrome.
  let lookTimer: ReturnType<typeof setTimeout> | null = null;
  const entryAt = (e: Event): Entry | null => {
    const holder = (e.target as HTMLElement).closest<HTMLElement>('[data-idx]');
    return holder ? ls.visible[parseInt(holder.dataset.idx!)] ?? null : null;
  };
  scroll.addEventListener('click', e => {
    const pv = (e.target as HTMLElement).closest<HTMLElement>('.fe-act-pv');
    if (pv) {
      e.preventDefault(); e.stopPropagation();
      const en = ls.all.find(x => x.name === pv.dataset.pv);
      if (en) { sel.setSel(ls.visible.indexOf(en)); openPreview(en); }
      return;
    }
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.fe-act-btn');
    if (btn) { e.preventDefault(); e.stopPropagation(); copyText(btn.dataset.copy || ''); return; }
    const en = entryAt(e);
    if (!en) return;
    const i = ls.visible.indexOf(en);
    e.preventDefault();
    if (en.isParent) { location.href = pageHref(en.href); return; }
    if (e.altKey) { app.strip.open(fullPath(rawPath, en), true); return; }
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      if (!sel.selectable(i)) return;
      if (e.shiftKey && (e.metaKey || e.ctrlKey)) sel.rangeSel(i); else sel.toggleSel(i);
      return;
    }
    if (en.isDir) { location.href = pageHref(en.href); return; }
    if (!sel.selectable(i)) return;
    sel.setSel(i);
    if (!canPreview(en) || app.settings.clickOpens === 'go') { location.href = pageHref(en.href); return; }
    // The panel waits out the double-click interval, or its scrim would
    // swallow the second click that means go; dblclick below does the going.
    if (lookTimer) clearTimeout(lookTimer);
    if (e.detail > 1) return;
    lookTimer = setTimeout(() => { lookTimer = null; openPreview(en); }, 220);
  });
  scroll.addEventListener('dblclick', e => {
    const en = entryAt(e);
    if (!en || en.isDir || en.isParent || e.altKey || e.shiftKey || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    if (lookTimer) { clearTimeout(lookTimer); lookTimer = null; }
    location.href = pageHref(en.href);
  });
  // Middle click anywhere on a row opens a Chrome tab; on the name link the
  // anchor already does it natively.
  scroll.addEventListener('auxclick', e => {
    if (e.button !== 1 || (e.target as HTMLElement).closest('a')) return;
    const en = entryAt(e);
    if (!en) return;
    e.preventDefault();
    window.open(en.href, '_blank');
  });

  // Row hover tip, from each row's data-tip JSON.
  const tip = el('fe-tip');
  let tipTimeout: ReturnType<typeof setTimeout>;
  scroll.addEventListener('mousemove', e => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (!target) { hideTip(); return; }
    clearTimeout(tipTimeout);
    tipTimeout = setTimeout(() => showTip(target, e), 300);
  });
  scroll.addEventListener('mouseleave', hideTip);
  function showTip(target: HTMLElement, ev: MouseEvent): void {
    try {
      const d = JSON.parse(target.getAttribute('data-tip') ?? '{}');
      const iconHtml  = d.icon  ? `<span class="tip-icon">${d.icon}</span>` : '';
      const linesHtml = (d.lines || []).map((l: string) => `<div class="tip-line">${esc(l)}</div>`).join('');
      const warnHtml  = d.warn  ? `<div class="tip-warn">⚠ ${esc(d.warn)}</div>` : '';
      tip.innerHTML = `<div class="tip-header">${iconHtml}<span class="tip-name">${esc(d.name || '')}</span></div>${linesHtml}${warnHtml}`;
    } catch {
      tip.innerHTML = `<div class="tip-name">${esc(target.getAttribute('data-tip') ?? '')}</div>`;
    }
    raise(tip);
    tip.classList.add('show');
    positionTip(ev);
  }
  function hideTip(): void { clearTimeout(tipTimeout); tip.classList.remove('show'); }
  document.addEventListener('mousemove', e => { if (tip.classList.contains('show')) positionTip(e); });
  function positionTip(e: MouseEvent): void {
    const vw = window.innerWidth, vh = window.innerHeight;
    const tw = tip.offsetWidth || 280, th = tip.offsetHeight || 100;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + tw > vw - 8) x = e.clientX - tw - 10;
    if (y + th > vh - 8) y = e.clientY - th - 10;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }

  // Context menu on a row or tile.
  const ctxMenu = document.createElement('div');
  ctxMenu.id = 'fe-ctx';
  let ctx: Layer | null = null;
  const closeCtx = () => ctx?.close('pick');
  scroll.addEventListener('contextmenu', e => {
    const holder = (e.target as HTMLElement).closest<HTMLElement>('[data-idx]');
    if (!holder) return;
    const idx = parseInt(holder.dataset.idx!);
    const en = ls.visible[idx];
    if (!en || en.isParent) return;
    e.preventDefault();
    // Right-clicking inside an existing multi-selection keeps it (bulk menu);
    // otherwise the click single-selects the row under the cursor.
    const multi = ls.selSet.size > 1 && ls.selSet.has(idx);
    if (!multi) sel.setSel(idx);
    ctxMenu.innerHTML = multi
      ? [
          `<div class="fe-ctx-item" data-act="cp-paths">Copy ${ls.selSet.size} paths</div>`,
          `<div class="fe-ctx-item" data-act="cp-names">Copy ${ls.selSet.size} names</div>`,
        ].join('')
      : [
          canPreview(en) ? `<div class="fe-ctx-item" data-act="pv">Preview<span class="fe-ctx-key">Space</span></div>` : '',
          `<div class="fe-ctx-item" data-act="cp-path">Copy path</div>`,
          `<div class="fe-ctx-item" data-act="cp-name">Copy name</div>`,
          `<div class="fe-ctx-sep"></div>`,
          `<div class="fe-ctx-item" data-act="term">Open in terminal</div>`,
        ].join('');
    ctxMenu.dataset.idx = String(idx);
    ctx = openLayer(ctxMenu, { kind: 'popover', place: 'point', point: { x: e.clientX, y: e.clientY }, role: 'menu', group: 'menu' });
  });
  ctxMenu.addEventListener('click', e => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.fe-ctx-item');
    if (!item) return;
    const en = ls.visible[parseInt(ctxMenu.dataset.idx!)];
    closeCtx();
    if (!en) return;
    const fp = fullPath(rawPath, en);
    if      (item.dataset.act === 'pv')      openPreview(en);
    else if (item.dataset.act === 'cp-path') copyText(fp);
    else if (item.dataset.act === 'cp-name') copyText(en.name);
    else if (item.dataset.act === 'term')    app.openInTerminal(en.isDir ? fp : rawPath);
    else if (item.dataset.act === 'cp-paths') sel.copySelection();
    else if (item.dataset.act === 'cp-names') {
      const names = [...ls.selSet].sort((a, b) => a - b).map(i => ls.visible[i].name).join('\n');
      copyToClipboard(names).then(() => toast(`Copied ${ls.selSet.size} names`));
    }
  });

  // Keys, in order: cmd-F, inputs and dialogs, the context menu, the open
  // preview, the file page, the listing, the strip.
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
      if (app.fileMode) return;   // Chrome's find is the right one on a file page
      const s = el<HTMLInputElement>('fe-search');
      if (document.activeElement !== s) { e.preventDefault(); s.focus({ preventScroll: true }); s.select(); }
      return;
    }
    const ae = document.activeElement;
    if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)) return;
    // With the sidebar, tabs or a toolbar focused, moving and acting keys belong to them.
    if (ae?.closest('#fe-side, #fe-tabbar, #fe-bar, #fe-toolbar, #fe-fp-bar')
      && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Backspace', 'Delete', 'Home', 'End'].includes(e.key)) return;
    if (el('fe-settings-modal').style.display !== 'none') return;
    if (el('fe-help-modal').style.display !== 'none') return;
    if (e.key === '?') { e.preventDefault(); app.openHelp(); return; }
    if (e.key === ',' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); app.openSettings(); return; }
    if (e.metaKey && e.key === 'ArrowUp') { e.preventDefault(); app.goUp(); return; }   // Finder: go to parent
    if (ctx?.open) return;
    if (isPreviewOpen()) {
      if (e.key === 'Escape' || e.key === ' ') { e.preventDefault(); closePreview(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); sel.previewStep(1); }
      else if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft')  { e.preventDefault(); sel.previewStep(-1); }
      else if (e.key === 'Enter') { const en = previewEntry(); if (en) location.href = pageHref(en.href); }
      else if (e.key === 't' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); keepPreviewedAsTab(); }
      else if (['[', ']', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key) && app.strip.handleKey(e)) e.preventDefault();
      return;
    }
    if (app.filePage?.key(e)) e.preventDefault();
    else if (app.filePage && e.key === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); app.filePage.toggleRaw(); }
    else if (app.filePage && e.key === 'e' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); app.filePage.edit(); }
    else if (e.key === 'ArrowDown' && !app.fileMode) { e.preventDefault(); sel.moveSel(1); }
    else if (e.key === 'ArrowUp' && !app.fileMode)   { e.preventDefault(); sel.moveSel(-1); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); sel.selectAll(); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && ls.selSet.size) { e.preventDefault(); sel.copySelection(); }
    else if (e.key === 'Enter' && ls.selIdx >= 0) { location.href = pageHref(ls.visible[ls.selIdx].href); }
    else if (e.key === 'Backspace') { e.preventDefault(); app.goUp(); }
    else if (e.key === ' ' && ls.selIdx >= 0) { e.preventDefault(); sel.tryPreview(ls.visible[ls.selIdx]); }
    else if (e.key === 'n' && !e.metaKey && !e.ctrlKey && app.settings.notesRoot) { e.preventDefault(); app.newNote(); }
    else if (app.strip.handleKey(e)) e.preventDefault();
  });

  // The listing's named commands: what the key map gives keys to here, and
  // what the palette lists for this folder.
  const onListing = () => !app.fileMode;
  const lead = () => (ls.selIdx >= 0 ? ls.visible[ls.selIdx] : null);
  const leadRow = () => scroll.querySelector<HTMLElement>(`[data-idx="${ls.selIdx}"]`);
  const shown = () => ls.visible.map((_, i) => i).filter(i => sel.selectable(i) || ls.visible[i].isParent);
  const perPage = () => Math.max(1, Math.floor(scroll.clientHeight / (leadRow()?.offsetHeight || 32)) - 1);
  const jump = (to: number) => { const list = shown(); if (list.length) sel.setSel(list[Math.max(0, Math.min(list.length - 1, to))]); };
  const pos = () => shown().indexOf(ls.selIdx);
  bind('to-listing', () => {
    (document.activeElement as HTMLElement | null)?.blur();
    if (ls.selIdx < 0) sel.moveSel(1); else sel.setSel(ls.selIdx);
  }, onListing);
  bind('first', () => jump(0), onListing);
  bind('last', () => jump(Infinity), onListing);
  bind('page-up', () => jump(pos() - perPage()), onListing);
  bind('page-down', () => jump(Math.max(0, pos()) + perPage()), onListing);
  const extend = (dir: 1 | -1) => {
    const list = shown();
    const to = list[list.indexOf(ls.selIdx) + dir];
    if (to !== undefined && sel.selectable(to)) { if (ls.anchor < 0) ls.anchor = ls.selIdx; sel.rangeSel(to); }
  };
  bind('extend-up', () => extend(-1), onListing);
  bind('extend-down', () => extend(1), onListing);
  bind('open-bg', () => { const en = lead(); if (en && !en.isParent) { app.strip.open(fullPath(rawPath, en), true); toast(`Kept ${en.name} as a tab`); } }, () => onListing() && !!lead());
  bind('open-chrome', () => { const en = lead(); if (en) window.open(en.href, '_blank'); }, () => onListing() && !!lead());
  bind('copy-path', () => { const en = lead(); if (en) copyText(fullPath(rawPath, en)); }, () => onListing() && !!lead());
  bind('copy-name', () => { const en = lead(); if (en) copyText(en.name); }, () => onListing() && !!lead());
  bind('menu', () => {
    const row = leadRow();
    if (!row) return;
    const r = row.getBoundingClientRect();
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 40, clientY: r.top + r.height }));
    ctxMenu.querySelector('.fe-ctx-item')?.classList.add('kb');
  }, () => onListing() && !!lead());
  const treeToggle = (open: boolean) => {
    const t = leadRow()?.querySelector<HTMLElement>('.fe-tree-toggle');
    if (t && (t.getAttribute('aria-expanded') === 'true') !== open) t.click();
  };
  bind('tree-open', () => treeToggle(true), () => onListing() && fe.dataset.view === 'tree' && !!lead()?.isDir);
  bind('tree-close', () => treeToggle(false), () => onListing() && fe.dataset.view === 'tree' && !!lead()?.isDir);
  bind('filter', () => {
    if (app.fileMode) return;
    const s = el<HTMLInputElement>('fe-search');
    s.focus({ preventScroll: true }); s.select();
  }, onListing);
  bind('filter-panel', () => el('fe-filter-btn').click(), onListing);
  bind('hidden', () => el('fe-hidden-btn').click(), onListing);
  for (const v of ['details', 'list', 'tree', 'tiles', 'icons']) {
    bind('view-' + v, () => document.querySelector<HTMLElement>(`.fe-view-btn[data-view="${v}"]`)?.click(), onListing);
  }
  const sortBy = (col: SortConfig['col']) => { const s = getSortConfig(); app.setOrder({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }, getGroupMode()); };
  bind('sort-name', () => sortBy('name'), onListing);
  bind('sort-date', () => sortBy('date'), onListing);
  bind('sort-size', () => sortBy('size'), onListing);
  bind('sort-type', () => sortBy('type'), onListing);
  bind('sort-rev', () => { const s = getSortConfig(); app.setOrder({ col: s.col ?? 'name', dir: s.dir === 'asc' ? 'desc' : 'asc' }, getGroupMode()); }, onListing);
  const GROUPS: GroupMode[] = ['none', 'folders-first', 'files-first', 'ext', 'type'];
  bind('group', () => {
    const next = GROUPS[(GROUPS.indexOf(getGroupMode()) + 1) % GROUPS.length];
    app.setOrder(getSortConfig(), next);
    toast(`Grouping: ${next.replace('-', ' ')}`);
  }, onListing);
  // Bigger means fewer, larger items with less detail on each.
  const detail = (to: (d: number) => number) => {
    const d = el<HTMLElement & { value: string }>('fe-density');
    d.value = String(Math.max(1, Math.min(5, to(Number(d.value)))));
    d.dispatchEvent(new Event('change'));
  };
  bind('zoom-in', () => detail(d => d - 1), onListing);
  bind('zoom-out', () => detail(d => d + 1), onListing);
  bind('zoom-reset', () => detail(() => 3), onListing);

  // The palette also goes to anything in this folder.
  addPaletteSource(() => onListing() ? ls.all.filter(en => !en.isParent).slice(0, 400).map(en => ({
    title: en.name, sub: en.isDir ? 'folder here' : 'file here', group: 'This folder', icon: getIcon(en, app.iconRules),
    run: () => { location.href = pageHref(en.href); },
    runAlt: () => { app.strip.open(fullPath(rawPath, en), true); toast(`Kept ${en.name} as a tab`); },
  })) : []);
}

type Entry = import('./types').Entry;
