// Moving around with the keyboard: the page's areas (sidebar, tabs, path bar,
// toolbar, listing, preview) that F6 cycles through; arrow keys inside each
// area; arrow keys in every popup menu; and the key badges that appear while
// ⌥ is held. It also binds the commands that act on the page's own buttons.
import type { App } from './app';
import { KEYMAP, type Scope } from './keymap';
import { bind, dispatch, setContext, openPalette, paletteOpen, runCommand, addPaletteSource } from './commands';
import { isPreviewOpen, openPreview } from './preview';
import { raise, rovingFocus } from './layer';
import { setTooltipKeys } from './tooltip';
import { gotoBackground } from './goto';
import { homeDir, getSaved, getRecents } from './storage';
import { PI } from './icons';
import { fileHref, pageHref, esc } from './utils';

const visible = (x: Element | null): x is HTMLElement => !!x && (x as HTMLElement).offsetParent !== null;
const isTyping = (x: Element | null) => !!x && (['INPUT', 'TEXTAREA', 'SELECT'].includes(x.tagName) || (x as HTMLElement).isContentEditable)
  && !(x as HTMLInputElement).type?.match(/^(checkbox|radio|range|button)$/);

// Menus that take arrow keys while open: the item menu, the tab menu, the
// note menu, the path menu and the note properties menu.
const MENU_SEL = '#fe-ctx, .fe-ctx, #fe-crumb-menu, .fe-pmenu';
const ITEM_SEL = '.fe-ctx-item, .fe-dd-item, .fe-pmenu button';
function openMenu(): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>(MENU_SEL)].find(m => m.style.display !== 'none' && visible(m)) ?? null;
}
function menuKeys(e: KeyboardEvent): boolean {
  const menu = openMenu();
  if (!menu || !['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter'].includes(e.key)) return false;
  const items = [...menu.querySelectorAll<HTMLElement>(ITEM_SEL)].filter(visible);
  if (!items.length) return false;
  let at = items.findIndex(i => i.classList.contains('kb'));
  if (e.key === 'Enter') {
    if (at < 0) return false;
    e.preventDefault(); e.stopImmediatePropagation();
    items[at].click();
    return true;
  }
  at = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : at < 0 ? (e.key === 'ArrowDown' ? 0 : items.length - 1) : (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items.forEach((it, i) => it.classList.toggle('kb', i === at));
  items[at].scrollIntoView({ block: 'nearest' });
  e.preventDefault(); e.stopImmediatePropagation();
  return true;
}

export function initFocusNav(app: App): void {
  const fe = app.fe;
  const dialogOpen = () => [...document.querySelectorAll<HTMLElement>('.fe-dlg')].some(d => d.style.display !== 'none');
  setContext(() => {
    const ae = document.activeElement;
    const scopes = new Set<Scope>(['any']);
    const preview = isPreviewOpen();
    if (preview) scopes.add('preview');
    if (app.fileMode && !preview) scopes.add('file');
    if (document.getElementById('fe-goto')) scopes.add('goto');
    const inSide = !!ae?.closest('#fe-side'), inTabs = !!ae?.closest('#fe-tabbar'), inBar = !!ae?.closest('#fe-bar, #fe-toolbar');
    if (inSide) scopes.add('sidebar');
    if (inTabs) scopes.add('tabs');
    if (!app.fileMode && !preview && !inSide && !inTabs && !inBar) {
      scopes.add('listing');
      if (fe.dataset.view === 'tree') scopes.add('tree');
    }
    if (openMenu()) scopes.add('menu');
    return {
      scopes, typing: isTyping(ae),
      blocked: dialogOpen() || paletteOpen() || !!openMenu() || !!document.querySelector('.fe-dd-list, .fe-rule-pop'),
    };
  });

  // Capture runs before every surface's own handler, so a command key wins
  // only when it is live; anything else falls through untouched.
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented) return;
    if (menuKeys(e)) return;
    dispatch(e);
  }, true);

  // Where focus last was in the sidebar, so coming back lands on that row.
  let lastSide: HTMLElement | null = null;
  document.addEventListener('focusin', e => { const t = e.target as HTMLElement; if (t.closest?.('#fe-lenses')) lastSide = t; });
  const sideBack = () => { if (lastSide && document.contains(lastSide) && visible(lastSide)) { lastSide.focus(); return true; } return false; };

  // The areas, in the order F6 visits them.
  const areas: { name: string; has: (x: Element) => boolean; enter: () => boolean }[] = [
    { name: 'sidebar', has: x => !!x.closest('#fe-side'), enter: () => sideBack() || focusFirst('#fe-lenses .fe-lens:not([hidden])', ROW_SEL) || focusFirst('#fe-lenses .fe-lens:not([hidden])', 'input, textarea, button') || focusFirst('#fe-rail', '.fe-rail-btn.on') },
    { name: 'tabs', has: x => !!x.closest('#fe-tabbar'), enter: () => focusFirst('#fe-tabs', '.fe-tab.on') || focusFirst('#fe-tabbar', 'button') },
    { name: 'path', has: x => !!x.closest('#fe-bar'), enter: () => focusFirst('#fe-bc', '.fe-crumb.cur, .fe-crumb:last-of-type') || focusFirst('#fe-bar', 'button') },
    { name: 'toolbar', has: x => !!x.closest('#fe-toolbar, #fe-fp-bar'), enter: () => focusFirst('#fe-toolbar, #fe-fp-bar', 'button') },
    { name: 'listing', has: x => !!x.closest('#fe-scroll, #fe-page') || x === document.body, enter: () => { runCommand('to-listing'); return true; } },
    { name: 'preview', has: x => !!x.closest('#fe-qlook'), enter: () => isPreviewOpen() && focusFirst('#fe-qlook', '#fe-ql-close, button') },
  ];
  const ROW_SEL = '.fe-si, .fe-si-link, .fe-grp > summary, .fe-nt-grp';
  function focusFirst(scope: string, sel: string): boolean {
    const root = [...document.querySelectorAll(scope)].find(visible);
    const t = root && [...root.querySelectorAll<HTMLElement>(sel)].find(visible);
    if (!t) return false;
    t.focus({ preventScroll: false });
    return true;
  }
  const cycle = (dir: 1 | -1) => {
    const ae = document.activeElement ?? document.body;
    let i = areas.findIndex(a => a.has(ae));
    for (let n = 0; n < areas.length; n++) {
      i = (i + dir + areas.length) % areas.length;
      if (areas[i].enter()) { flash(document.activeElement as HTMLElement); return; }
    }
  };
  // A short ring on the area the keyboard just moved to.
  function flash(x: HTMLElement | null): void {
    const box = x?.closest<HTMLElement>('#fe-side, #fe-tabbar, #fe-bar, #fe-toolbar, #fe-fp-bar, #fe-scroll, #fe-page, #fe-qlook');
    if (!box) return;
    box.classList.remove('fe-area-flash');
    void box.offsetWidth;
    box.classList.add('fe-area-flash');
  }
  bind('area-next', () => cycle(1));
  bind('area-prev', () => cycle(-1));
  bind('to-sidebar', () => { if (fe.querySelector('#fe-side')?.checkVisibility?.() === false) runCommand('sidebar'); areas[0].enter(); flash(document.activeElement as HTMLElement); });
  bind('to-tabs', () => { areas[1].enter(); flash(document.activeElement as HTMLElement); });
  bind('to-toolbar', () => { areas[3].enter(); flash(document.activeElement as HTMLElement); });

  // Arrow keys inside an area. A surface that already handles a key marks it
  // handled, and this leaves it alone.
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    const ae = document.activeElement as HTMLElement | null;
    if (!ae || isTyping(ae)) return;
    // Esc from the sidebar, tabs or a toolbar hands the keyboard back to the listing.
    if (e.key === 'Escape' && !openMenu() && ae.closest('#fe-side, #fe-tabbar, #fe-bar, #fe-toolbar, #fe-fp-bar')) {
      e.preventDefault(); ae.blur(); runCommand('to-listing'); return;
    }
    // Sidebar rows: up and down walk the open lens; ⌥↩ keeps a background tab;
    // F2, ⌫ and # reach the row's rename, remove and tags.
    const lens = ae.closest<HTMLElement>('#fe-lenses .fe-lens');
    if (lens) {
      const rows = [...lens.querySelectorAll<HTMLElement>('.fe-si, .fe-si-link, .fe-grp > summary, .fe-nt-grp')].filter(visible);
      const at = rows.indexOf(ae);
      const row = ae.closest<HTMLElement>('.fe-bm-item, .fe-pl-item');
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && at >= 0) {
        const to = rows[at + (e.key === 'ArrowDown' ? 1 : -1)];
        if (to) { e.preventDefault(); to.focus(); }
      } else if ((e.key === 'Home' || e.key === 'End') && rows.length) { e.preventDefault(); rows[e.key === 'Home' ? 0 : rows.length - 1].focus(); }
      else if (e.key === 'Enter' && e.altKey && ae.matches('a')) { e.preventDefault(); ae.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true })); }
      else if (e.key === 'F2' && row?.querySelector('.fe-pl-label')) { e.preventDefault(); row.querySelector('.fe-pl-label')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && row?.querySelector('.fe-rm-btn') && !row.classList.contains('fe-nt-item')) {
        e.preventDefault();
        const next = rows[at + 1] ?? rows[at - 1];
        row.querySelector<HTMLElement>('.fe-rm-btn')!.click();
        setTimeout(() => (next && document.contains(next) ? next : lens.querySelector<HTMLElement>('.fe-si, .fe-si-link'))?.focus(), 50);
      } else if (e.key === 'ArrowLeft' && !e.altKey) { e.preventDefault(); document.querySelector<HTMLElement>('#fe-rail .fe-rail-btn.on')?.focus(); }
      return;
    }
    // From the lens bar, down goes into the open lens.
    if (ae.closest('#fe-rail') && e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); areas[0].enter(); return; }
    // Tabs: left and right walk them; shift moves the tab; ⌫ closes; ⇧F10 menu.
    if (ae.closest('#fe-tabs') && ae.classList.contains('fe-tab')) {
      const tabs = [...document.querySelectorAll<HTMLElement>('#fe-tabs .fe-tab')];
      const at = tabs.indexOf(ae);
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.shiftKey) {
        e.preventDefault();
        const to = tabs[at + (e.key === 'ArrowRight' ? 1 : -1)] ?? (e.key === 'ArrowRight' ? document.querySelector<HTMLElement>('#fe-tabs-end button:not([hidden])') : null);
        to?.focus();
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.shiftKey && ae.dataset.id) {
        e.preventDefault();
        app.strip.move(ae.dataset.id, e.key === 'ArrowRight' ? 1 : -1);
        document.querySelector<HTMLElement>(`#fe-tabs .fe-tab[data-id="${ae.dataset.id}"]`)?.focus();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && ae.querySelector('.fe-tab-x')) {
        e.preventDefault();
        const next = tabs[at + 1] ?? tabs[at - 1];
        const nextId = next?.dataset.id;
        ae.querySelector<HTMLElement>('.fe-tab-x')!.click();
        setTimeout(() => document.querySelector<HTMLElement>(`#fe-tabs .fe-tab[data-id="${nextId}"]`)?.focus(), 30);
      } else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
        e.preventDefault();
        const r = ae.getBoundingClientRect();
        ae.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 8, clientY: r.bottom }));
      }
      return;
    }
    // Toolbar and path bar: left and right walk the controls in the row.
    const row = ae.closest<HTMLElement>('#fe-bar, #fe-toolbar, #fe-tabs-end, #fe-fp-bar');
    if (row && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.altKey && !e.shiftKey) {
      const ctl = [...row.querySelectorAll<HTMLElement>('a[href], button, input')].filter(x => visible(x) && !(x as HTMLButtonElement).disabled && x.tabIndex >= 0);
      const at = ctl.indexOf(ae);
      if (at < 0 || ae.matches('input[type="range"]')) return;
      const to = ctl[at + (e.key === 'ArrowRight' ? 1 : -1)];
      if (to) { e.preventDefault(); to.focus(); }
      return;
    }
    // A crumb: down opens its folder menu.
    if (ae.closest('#fe-bc') && e.key === 'ArrowDown') {
      const dd = ae.matches('.fe-crumb-dd') ? ae : ae.nextElementSibling?.matches('.fe-crumb-dd') ? ae.nextElementSibling as HTMLElement : null;
      if (dd) { e.preventDefault(); dd.click(); }
    }
  });

  // Commands that press the page's own buttons.
  const click = (id: string, init: MouseEventInit = {}) => () => { const b = document.getElementById(id); if (b && !b.hidden) b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init })); };
  bind('palette', () => openPalette());
  // Actions whose keys their own surfaces answer, bound here so the palette can run them too.
  const stripKey = (key: string) => () => { app.strip.handleKey(new KeyboardEvent('keydown', { key })); };
  bind('settings', () => app.openSettings());
  bind('keys', () => app.openHelp('keys'));
  bind('tab-keep', stripKey('t'));
  bind('tab-close', stripKey('w'));
  bind('tab-pin', stripKey('p'));
  bind('tab-step', stripKey(']'));
  bind('tab-reopen', stripKey('T'));
  bind('new-note', () => app.newNote(), () => !!app.settings.notesRoot);
  bind('fp-raw', () => app.filePage?.toggleRaw(), () => !!app.filePage);
  bind('fp-edit', () => app.filePage?.edit(), () => !!app.filePage);
  bind('goto-bg', gotoBackground, () => !!document.getElementById('fe-goto'));
  const commentable = () => !!app.filePage?.commentable();
  bind('fp-comment', () => app.filePage?.comment('comment'), commentable);
  bind('fp-cm-reply', () => app.filePage?.comment('reply'), commentable);
  bind('fp-comments', () => app.filePage?.comment('panel'), commentable);
  bind('fp-cm-step', () => app.filePage?.comment('next'), commentable);
  bind('fp-find',() => document.getElementById('fe-ff-q')?.focus(), () => app.fileMode);
  bind('to-path', () => { focusFirst('#fe-bc', 'a.fe-crumb:last-of-type, .fe-crumb.cur, a'); flash(document.activeElement as HTMLElement); });
  bind('deep', click('fe-deep-btn'), () => !app.fileMode);
  bind('sidebar', click('fe-side-toggle'));
  bind('theme', click('fe-theme-btn'));
  bind('path', click('fe-open-path'));
  bind('open-pick', click('fe-open-pick'));
  bind('save', click('fe-bm-btn'), () => !!document.getElementById('fe-bm-btn'));
  bind('terminal', click('fe-term-btn'));
  bind('terminal-copy', click('fe-term-btn', { shiftKey: true }));
  const moveHere = (dir: 1 | -1) => { const id = document.querySelector<HTMLElement>('#fe-tabs .fe-tab.on')?.dataset.id; if (id) app.strip.move(id, dir); };
  bind('tab-left', () => moveHere(-1), () => !!document.querySelector('#fe-tabs .fe-tab.on[data-id]:not([data-id=""])'));
  bind('tab-right', () => moveHere(1), () => !!document.querySelector('#fe-tabs .fe-tab.on[data-id]:not([data-id=""])'));
  bind('tab-list', click('fe-tab-list'), () => !document.getElementById('fe-tab-list')?.hidden);
  bind('home', () => { const h = homeDir(app.rawPath); if (h) location.href = pageHref(fileHref(h + '/')); }, () => !!homeDir(app.rawPath));
  const LENSES: [string, string][] = [['lens-places', 'places'], ['lens-saved', 'saved'], ['lens-notes', 'notes'], ['lens-recent', 'history'], ['lens-search', 'search'], ['lens-ask', 'ask'], ['lens-docs', 'comments']];
  for (const [id, lens] of LENSES) bind(id, () => {
    if (!app.settings.showSidebar) runCommand('sidebar');
    app.showLens?.(lens);
    setTimeout(() => {
      const box = document.getElementById(`fe-lens-${lens}`);
      (box?.querySelector<HTMLElement>('input[type="search"], textarea, .fe-tl-input') ?? box?.querySelector<HTMLElement>('.fe-si, .fe-si-link'))?.focus();
    }, 60);
  }, () => !document.getElementById(`fe-rail-${lens}`)?.hidden);

  // Sidebar actions for the journeys: filter the open list, reach its tag
  // chips, preview a file row, open a row in Chrome, and a row's tags.
  const openLens = () => document.querySelector<HTMLElement>('#fe-lenses .fe-lens:not([hidden])');
  const focusedRow = () => (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('#fe-lenses .fe-si-link, #fe-lenses a.fe-si') ?? null;
  const rowPath = (a: HTMLElement) => decodeURIComponent((a.getAttribute('href') || '').slice(7));
  bind('lens-filter', () => {
    const box = [...(openLens()?.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="search"]') ?? [])].find(visible);
    box?.focus(); box?.select();
  }, () => !!openLens());
  bind('lens-tags', () => {
    if (!app.settings.showSidebar) runCommand('sidebar');
    const chip = [...(openLens()?.querySelectorAll<HTMLElement>('.fe-lens-tags .fe-chip, .fe-lens-tags button') ?? [])].find(visible);
    chip?.focus();
  }, () => !!openLens()?.querySelector('.fe-lens-tags'));
  // Arrows walk the chips; Enter or Space toggles one (they are buttons).
  document.querySelectorAll<HTMLElement>('#fe-lenses .fe-lens-tags, #fe-docs-list .fe-lens-tags').forEach(r => rovingFocus(r, '.fe-chip, button', { axis: 'horizontal' }));
  bind('side-look', () => {
    const a = focusedRow()!, path = rowPath(a), name = path.split('/').pop() || path;
    openPreview({ name, href: fileHref(path), isDir: false, isParent: false, isHidden: false, rawBytes: -1, dateMs: NaN, dateStr: '' });
  }, () => { const a = focusedRow(); return !!a && !rowPath(a).endsWith('/') && !rowPath(a).includes('#'); });
  bind('side-chrome', () => focusedRow()!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })), () => !!focusedRow());
  bind('side-props', () => {
    const row = (document.activeElement as HTMLElement).closest<HTMLElement>('.fe-bm-item, .fe-pl-item, .fe-nt-item')!;
    row.querySelector<HTMLElement>('.fe-tag-btn, .fe-nt-props')!.click();
  }, () => !!(document.activeElement as HTMLElement | null)?.closest('.fe-bm-item, .fe-pl-item, .fe-nt-item')?.querySelector('.fe-tag-btn, .fe-nt-props'));

  // Preview and file page buttons.
  const pv = () => isPreviewOpen();
  bind('pv-dock', click('fe-ql-dock'), pv);
  bind('pv-copy', click('fe-ql-copy'), pv);
  bind('pv-ask', () => document.getElementById('fe-ql-ai-q')?.focus(), () => pv() && visible(document.getElementById('fe-ql-ai-q')));
  bind('fp-toc', click('fe-fp-toc'), () => app.fileMode && visible(document.getElementById('fe-fp-toc')));
  bind('fp-width', click('fe-fp-column'), () => app.fileMode && visible(document.getElementById('fe-fp-column')));

  // The palette goes to tabs, saved places and recent places too.
  const placeIcon = (p: string) => p.endsWith('/') ? PI.folder : PI.docs;
  addPaletteSource(() => app.strip.state().list.map((t, i) => ({
    title: t.label, sub: i < 9 ? `tab ${i + 1}` : 'tab', group: 'Tabs', icon: placeIcon(t.path), run: () => app.strip.go(t.path),
  })));
  addPaletteSource(() => getSaved().map(p => ({
    title: p.label || p.path, sub: (p.tags ?? []).map(t => '#' + t).join(' ') || 'saved', group: 'Saved', icon: PI.bm,
    run: () => app.strip.go(p.path), runAlt: () => app.strip.open(p.path, true),
  })));
  addPaletteSource(() => getRecents().slice(0, 30).map(r => ({
    title: r.path.split('/').filter(Boolean).pop() || '/', sub: r.path, group: 'Recent', icon: PI.recent,
    run: () => app.strip.go(r.path), runAlt: () => app.strip.open(r.path, true),
  })));

  // Key badges: hold ⌥ alone for a moment and every control with a key shows it.
  const KEY_OF: Record<string, string> = {
    'fe-side-toggle': 'sidebar', 'fe-theme-btn': 'theme', 'fe-help-btn': 'keys', 'fe-settings-btn': 'settings', 'fe-term-btn': 'terminal',
    'fe-bm-btn': 'save', 'fe-open-pick': 'open-pick', 'fe-open-path': 'path', 'fe-tab-list': 'tab-list', 'fe-filter-btn': 'filter-panel',
    'fe-hidden-btn': 'hidden', 'fe-search': 'filter', 'fe-fp-raw': 'fp-raw', 'fe-fp-edit': 'fp-edit', 'fe-fp-toc': 'fp-toc', 'fe-fp-column': 'fp-width',
    'fe-ql-dock': 'pv-dock', 'fe-ql-copy': 'pv-copy', 'fe-ql-tab': 'pv-tab', 'fe-ql-go': 'pv-open', 'fe-ql-close': 'pv-close',
    'fe-rail-places': 'lens-places', 'fe-rail-saved': 'lens-saved', 'fe-rail-notes': 'lens-notes', 'fe-rail-history': 'lens-recent',
    'fe-rail-search': 'lens-search', 'fe-rail-ask': 'lens-ask', 'fe-rail-comments': 'lens-docs',
  };
  const keyOf = (cmd: string) => KEYMAP.find(d => d.id === cmd)?.keys[0];
  // A control's tooltip shows the keys of the command it runs.
  setTooltipKeys(x => {
    const cmd = KEY_OF[x.id] ?? (x.matches('.fe-view-btn[data-view]') ? 'view-' + x.dataset.view : '');
    return (cmd && KEYMAP.find(d => d.id === cmd)?.keys) || [];
  });
  let hintTimer: ReturnType<typeof setTimeout> | null = null;
  let hints: HTMLElement | null = null;
  const hideHints = () => { if (hintTimer) clearTimeout(hintTimer); hintTimer = null; hints?.remove(); hints = null; };
  function showHints(): void {
    hideHints();
    hints = document.createElement('div');
    hints.className = 'fe-hints';
    const spots: [HTMLElement, string][] = [];
    for (const [id, cmd] of Object.entries(KEY_OF)) { const x = document.getElementById(id); const k = keyOf(cmd); if (visible(x) && k) spots.push([x, k]); }
    document.querySelectorAll<HTMLElement>('.fe-view-btn[data-view]').forEach(b => { const k = keyOf('view-' + (b.dataset.view === 'icons' ? 'icons' : b.dataset.view)); if (visible(b) && k) spots.push([b, k]); });
    document.querySelectorAll<HTMLElement>('#fe-tabs .fe-tab').forEach((t, i) => { if (i < 9 && visible(t)) spots.push([t, String(i + 1)]); });
    hints.innerHTML = spots.map(([x, k]) => { const r = x.getBoundingClientRect(); return `<kbd style="left:${Math.round(r.left + r.width / 2)}px;top:${Math.round(r.bottom - 6)}px">${esc(k)}</kbd>`; }).join('')
      + `<div class="fe-hints-tip"><kbd>⌘K</kbd> every command · <kbd>?</kbd> keyboard map · <kbd>F6</kbd> next area</div>`;
    fe.appendChild(hints);
    raise(hints);
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Alt' && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.repeat) { hideHints(); hintTimer = setTimeout(showHints, 450); }
    else hideHints();
  }, true);
  document.addEventListener('keyup', e => { if (e.key === 'Alt') hideHints(); }, true);
  window.addEventListener('blur', hideHints);
  document.addEventListener('pointerdown', hideHints, true);
}
