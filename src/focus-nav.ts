// Moving around with the keyboard: the page's areas (sidebar, tabs, path bar,
// toolbar, listing, preview) that F6 cycles through; arrow keys inside each
// area; arrow keys in every popup menu; and the key badges that appear while
// ⌥ is held. It also binds the commands that act on the page's own buttons.
import type { App } from './app';
import { KEYMAP, type Scope } from './keymap';
import { bind, dispatch, setContext, openPalette, paletteOpen, runCommand, addPaletteSource } from './commands';
import { isPreviewOpen, openPreview, noteAction } from './preview';
import { raise, rovingFocus } from './layer';
import { declareArea, areaOf, areaNamed, cycleArea, allRoots } from './areas';
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
    const blocked = paletteOpen() || !!openMenu() || !!document.querySelector('.fe-dd-list, .fe-rule-pop');
    // An open dialog has the keyboard to itself: only its own keys run.
    if (dialogOpen()) return { scopes: new Set<Scope>(['dialog']), typing: isTyping(ae), blocked };
    const scopes = new Set<Scope>(['any']);
    const preview = isPreviewOpen();
    if (preview) scopes.add('preview');
    if (app.fileMode && !preview) scopes.add('file');
    if (document.getElementById('fe-goto')) scopes.add('goto');
    if (visible(document.getElementById('fe-ed-bar'))) scopes.add('editor');
    const area = areaOf(ae);
    if (area?.scope) scopes.add(area.scope);
    if (!app.fileMode && !preview && !area?.widget) {
      scopes.add('listing');
      if (fe.dataset.view === 'tree') scopes.add('tree');
    }
    if (openMenu()) scopes.add('menu');
    return { scopes, typing: isTyping(ae), widget: !!area?.widget, blocked };
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
  const ROW_SEL = '.fe-si, .fe-si-link, .fe-grp > summary, .fe-nt-grp';
  const BAR_ITEMS = ':is(a[href], button, input):not([tabindex="-1"])';
  declareArea({ name: 'sidebar', root: '#fe-side', scope: 'sidebar', widget: true, roving: { items: ROW_SEL, wrap: false },
    enter: () => sideBack() || focusFirst('#fe-lenses .fe-lens:not([hidden])', ROW_SEL) || focusFirst('#fe-lenses .fe-lens:not([hidden])', 'input, textarea, button') || focusFirst('#fe-rail', '.fe-rail-btn.on') });
  declareArea({ name: 'tabs', root: '#fe-tabbar', scope: 'tabs', widget: true, roving: { items: '#fe-tabs .fe-tab, #fe-tabs-end button', axis: 'horizontal', wrap: false },
    enter: () => focusFirst('#fe-tabs', '.fe-tab.on') || focusFirst('#fe-tabbar', 'button') });
  declareArea({ name: 'path', root: '#fe-bar', scope: 'bar', widget: true, roving: { items: BAR_ITEMS, axis: 'horizontal', wrap: false },
    enter: () => focusFirst('#fe-bc', '.fe-crumb.cur, .fe-crumb:last-of-type') || focusFirst('#fe-bar', 'button') });
  declareArea({ name: 'toolbar', root: '#fe-toolbar, #fe-fp-bar', scope: 'bar', widget: true, roving: { items: BAR_ITEMS, axis: 'horizontal', wrap: false },
    enter: () => focusFirst('#fe-toolbar, #fe-fp-bar', 'button') });
  declareArea({ name: 'listing', root: '#fe-scroll, #fe-page', enter: () => { runCommand('to-listing'); return true; } });
  declareArea({ name: 'preview', root: '#fe-qlook', enter: () => isPreviewOpen() && focusFirst('#fe-qlook', '#fe-ql-close, button') });
  function focusFirst(scope: string, sel: string): boolean {
    const root = [...document.querySelectorAll(scope)].find(visible);
    const t = root && [...root.querySelectorAll<HTMLElement>(sel)].find(visible);
    if (!t) return false;
    t.focus({ preventScroll: false });
    return true;
  }
  const cycle = (dir: 1 | -1) => {
    if (cycleArea(document.activeElement ?? document.body, dir, a => a.name === 'listing')) flash(document.activeElement as HTMLElement);
  };
  // A short ring on the area the keyboard just moved to.
  function flash(x: HTMLElement | null): void {
    const box = x?.closest<HTMLElement>(allRoots());
    if (!box) return;
    box.classList.remove('fe-area-flash');
    void box.offsetWidth;
    box.classList.add('fe-area-flash');
  }
  bind('area-next', () => cycle(1));
  bind('area-prev', () => cycle(-1));
  const goArea = (name: string) => { areaNamed(name)?.enter(); flash(document.activeElement as HTMLElement); };
  bind('to-sidebar', () => { if (fe.querySelector('#fe-side')?.checkVisibility?.() === false) runCommand('sidebar'); goArea('sidebar'); });
  bind('to-tabs', () => goArea('tabs'));
  bind('to-toolbar', () => goArea('toolbar'));

  // Esc closes the sidebar shown over the page in a narrow window, and from
  // the sidebar, tabs or a toolbar hands the keyboard back to the listing.
  const ae = () => document.activeElement as HTMLElement | null;
  const inArea = () => !!areaOf(ae())?.widget;
  bind('area-leave', () => {
    const leave = inArea();
    app.closeSideOverlay?.();
    if (leave) { ae()?.blur(); runCommand('to-listing'); }
  }, () => inArea() || !!document.querySelector('#fe-side.open'));

  // Sidebar rows: ⌥↩ keeps a background tab; F2 and ⌫ rename and remove a
  // Saved or Places row (note rows answer these themselves); ← goes to the
  // lens bar, and ⌥↓ from the bar comes back into the open lens.
  const sideRow = () => ae()?.closest<HTMLElement>('#fe-lenses .fe-lens .fe-bm-item, #fe-lenses .fe-lens .fe-pl-item') ?? null;
  const inLens = () => !!ae()?.closest('#fe-lenses .fe-lens');
  const LENS_ROWS = '.fe-si, .fe-si-link, .fe-grp > summary, .fe-nt-grp';
  bind('side-bg', () => ae()?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true })), () => inLens() && !!ae()?.matches('a'));
  const LABEL = '.fe-pl-label, .fe-nt-label';
  bind('side-rename', () => sideRow()!.querySelector(LABEL)!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })), () => !!sideRow()?.querySelector(LABEL));
  // After a remove the list may redraw (notes do, once the file has moved),
  // so the next row is found again by its path.
  bind('side-remove', () => {
    const row = sideRow()!, lens = row.closest<HTMLElement>('.fe-lens')!;
    const rows = [...lens.querySelectorAll<HTMLElement>(LENS_ROWS)].filter(visible);
    const at = rows.indexOf(ae()!);
    const next = rows[at + 1] ?? rows[at - 1];
    const nextKey = next?.closest<HTMLElement>('[data-rel]')?.dataset.rel ?? next?.getAttribute('href') ?? '';
    row.querySelector<HTMLElement>('.fe-rm-btn')!.click();
    const refocus = () => {
      const again = nextKey && [...lens.querySelectorAll<HTMLElement>(LENS_ROWS)].find(r => (r.closest<HTMLElement>('[data-rel]')?.dataset.rel ?? r.getAttribute('href')) === nextKey);
      (again || (next && document.contains(next) ? next : lens.querySelector<HTMLElement>('.fe-si, .fe-si-link')))?.focus();
    };
    // The second try is for a list that redraws late, and only if focus went nowhere since.
    setTimeout(refocus, 50);
    setTimeout(() => { const a = ae(); if (!a || a === document.body || !a.isConnected) refocus(); }, 450);
  }, () => !!sideRow()?.querySelector('.fe-rm-btn'));
  bind('side-rail', () => document.querySelector<HTMLElement>('#fe-rail .fe-rail-btn.on')?.focus(), () => inLens() && !!ae()?.matches(LENS_ROWS));
  bind('side-into', () => areaNamed('sidebar')?.enter(), () => !!ae()?.closest('#fe-rail'));

  // The focused tab: ⇧← and ⇧→ move it, ⌫ closes it, ⇧F10 opens its menu.
  const focusedTab = () => { const t = ae(); return t?.closest('#fe-tabs') && t.classList.contains('fe-tab') ? t : null; };
  bind('tab-focus-shift', key => {
    const id = focusedTab()!.dataset.id!;
    app.strip.move(id, key === '⇧←' ? -1 : 1);
    document.querySelector<HTMLElement>(`#fe-tabs .fe-tab[data-id="${id}"]`)?.focus();
  }, () => !!focusedTab()?.dataset.id);
  bind('tab-focus-close', () => {
    const t = focusedTab()!, tabs = [...document.querySelectorAll<HTMLElement>('#fe-tabs .fe-tab')];
    const at = tabs.indexOf(t);
    const nextId = (tabs[at + 1] ?? tabs[at - 1])?.dataset.id;
    t.querySelector<HTMLElement>('.fe-tab-x')!.click();
    setTimeout(() => document.querySelector<HTMLElement>(`#fe-tabs .fe-tab[data-id="${nextId}"]`)?.focus(), 30);
  }, () => !!focusedTab()?.querySelector('.fe-tab-x'));
  bind('tab-focus-menu', () => {
    const t = focusedTab()!, r = t.getBoundingClientRect();
    t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 8, clientY: r.bottom }));
  }, () => !!focusedTab()?.dataset.id);   // a temporary tab has no menu

  // A path crumb: ↓ opens its folder menu.
  const crumbDd = () => {
    const t = ae();
    if (!t?.closest('#fe-bc')) return null;
    return t.matches('.fe-crumb-dd') ? t : t.nextElementSibling?.matches('.fe-crumb-dd') ? t.nextElementSibling as HTMLElement : null;
  };
  bind('crumb-menu', () => crumbDd()?.click(), () => !!crumbDd());

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
  bind('tab-step', key => stripKey(key === '[' ? '[' : ']')());
  bind('tab-jump', key => stripKey(key ?? '1')());
  bind('tab-reopen', stripKey('T'));
  bind('new-note', () => app.newNote(), () => !!app.settings.notesRoot);
  bind('fp-raw', () => app.filePage?.toggleRaw(), () => !!app.filePage);
  bind('fp-edit', () => app.filePage?.edit(), () => !!app.filePage);
  const noteBtn = (act: string) => document.querySelector<HTMLElement>(`#fe-ed-bar [data-act="${act}"]`);
  bind('note-rename', () => noteAction('rename'), () => visible(noteBtn('rename')));
  bind('note-delete', () => noteAction('delete'), () => visible(noteBtn('delete')));
  bind('goto-bg', gotoBackground, () => !!document.getElementById('fe-goto'));
  const commentable = () => !!app.filePage?.commentable();
  bind('fp-comment', () => app.filePage?.comment('comment'), commentable);
  bind('fp-cm-reply', () => app.filePage?.comment('reply'), commentable);
  bind('fp-comments', () => app.filePage?.comment('panel'), commentable);
  bind('fp-cm-step', key => app.filePage?.comment(key === '⌥↑' ? 'prev' : 'next'), commentable);
  // Inside the comments box its own Esc runs: it puts a draft away and keeps focus.
  bind('fp-cm-clear', () => app.filePage?.comment('clear'), () => !!app.filePage?.commentHeld() && !ae()?.closest('#fe-cm'));
  bind('fp-find', () => document.getElementById('fe-ff-q')?.focus(), () => app.fileMode && !app.filePage?.editing());
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
    const cmd = KEY_OF[x.id] ?? (x.matches('#fe-view-group [data-v]') ? 'view-' + x.dataset.v : '');
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
    document.querySelectorAll<HTMLElement>('#fe-view-group [data-v]').forEach(b => { const k = keyOf('view-' + b.dataset.v); if (visible(b) && k) spots.push([b, k]); });
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
