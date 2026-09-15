// Pointer and keyboard input for the listing: the click model on rows and
// tiles, the row hover tip, the context menu, and the page's keydown router
// (dialog and preview keys first, then listing keys, then the strip's).
import type { App } from './app';
import type { Listing } from './listing';
import { el } from './el';
import { esc, fullPath, copyToClipboard } from './utils';
import { openPreview, closePreview, isPreviewOpen, canPreview, previewEntry, keepPreviewedAsTab } from './preview';

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
    if (en.isParent) { location.href = en.href; return; }
    if (e.altKey) { app.strip.open(fullPath(rawPath, en), true); return; }
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      if (!sel.selectable(i)) return;
      if (e.shiftKey && (e.metaKey || e.ctrlKey)) sel.rangeSel(i); else sel.toggleSel(i);
      return;
    }
    if (en.isDir) { location.href = en.href; return; }
    if (!sel.selectable(i)) return;
    sel.setSel(i);
    if (!canPreview(en) || app.settings.clickOpens === 'go') { location.href = en.href; return; }
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
    location.href = en.href;
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
  ctxMenu.style.display = 'none';
  fe.appendChild(ctxMenu);
  const closeCtx = () => { ctxMenu.style.display = 'none'; };
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
    ctxMenu.style.display = 'block';
    ctxMenu.style.left = Math.min(e.clientX, window.innerWidth  - ctxMenu.offsetWidth  - 8) + 'px';
    ctxMenu.style.top  = Math.min(e.clientY, window.innerHeight - ctxMenu.offsetHeight - 8) + 'px';
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
  document.addEventListener('click', e => {
    if (ctxMenu.style.display !== 'none' && !ctxMenu.contains(e.target as Node)) closeCtx();
  });

  // Keys, in order: cmd-F, inputs and dialogs, the context menu, the open
  // preview, the file page, the listing, the strip.
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
      if (app.fileMode) return;   // Chrome's find is the right one on a file page
      const s = el<HTMLInputElement>('fe-search');
      if (document.activeElement !== s) { e.preventDefault(); s.focus(); s.select(); }
      return;
    }
    const ae = document.activeElement;
    if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)) return;
    if (el('fe-settings-modal').style.display !== 'none') return;
    if (el('fe-help-modal').style.display !== 'none') return;
    if (e.metaKey && e.key === 'ArrowUp') { e.preventDefault(); app.goUp(); return; }   // Finder: go to parent
    if (ctxMenu.style.display !== 'none') {
      if (e.key === 'Escape') closeCtx();
      return;
    }
    if (isPreviewOpen()) {
      if (e.key === 'Escape' || e.key === ' ') { e.preventDefault(); closePreview(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); sel.previewStep(1); }
      else if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft')  { e.preventDefault(); sel.previewStep(-1); }
      else if (e.key === 'Enter') { const en = previewEntry(); if (en) location.href = en.href; }
      else if (e.key === 't' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); keepPreviewedAsTab(); }
      else if (['[', ']', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key) && app.strip.handleKey(e)) e.preventDefault();
      return;
    }
    if (app.filePage && e.key === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); app.filePage.toggleRaw(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel.moveSel(1); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); sel.moveSel(-1); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); sel.selectAll(); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && ls.selSet.size) { e.preventDefault(); sel.copySelection(); }
    else if (e.key === 'Enter' && ls.selIdx >= 0) { location.href = ls.visible[ls.selIdx].href; }
    else if (e.key === 'Backspace') { e.preventDefault(); app.goUp(); }
    else if (e.key === ' ' && ls.selIdx >= 0) { e.preventDefault(); sel.tryPreview(ls.visible[ls.selIdx]); }
    else if (e.key === 'n' && !e.metaKey && !e.ctrlKey && app.settings.notesRoot) { e.preventDefault(); app.newNote(); }
    else if (app.strip.handleKey(e)) e.preventDefault();
  });
}

type Entry = import('./types').Entry;
