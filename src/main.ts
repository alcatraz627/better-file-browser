// The content script's entry: decide whether this page is a folder listing
// or a file to render, build the shell once, then hand each part to its
// module. One shell serves both pages, so nothing moves when a file opens.
import { parseEntries } from './parse';
import { getExt } from './utils';
import {
  getView, getPalette, getDensity, getShowHidden, getIconRules, getSettings, saveSettings, getRecents, pushRecent, getSaved,
  homeDir, setHomeDir, filePagesEnabled, syncHtmlGuard, keepPageBg, textPref, type CoverShape, SETTINGS_KEY, PALETTE_KEY, THEME_KEY,
} from './storage';
import { notes } from './notes';
import { initPreview, closePreview } from './preview';
import { setSidebarShown, FOLD_SIDE_QUERY } from './motion';
import { initSidePeek } from './side-peek';
import { initDragPan } from './drag-pan';
import { mountKeep, askRename } from './doc-keep';
import { mountFolderView } from './docviews';
import { CSS } from './styles';
import { UI_CSS } from './styles-ui';
import { setUiScale } from './chrome';
import { themeMode, resolveTheme, followSystem, appIconUrl, applyFonts } from './theme';
import { esc, pageHref, fileHref } from './utils';
import { samePlace } from './places';
import { PI, icoFile } from './icons';
import { filePageExt, mountFileContent } from './file-page';
import { editableFoldersOf } from './file-editor';
import { fetchFileText } from './file-fetch';
import { mountStrip, type Strip } from './strip';
import { makeToast } from './toast';
import { renderPage, placesHTML } from './page';
import { el } from './el';
import type { App } from './app';
import { initChrome } from './chrome';
import { initListing } from './listing';
import { initListingInput } from './listing-input';
import { initFocusNav } from './focus-nav';
import { initSidebar } from './sidebar';
import { initToolLenses } from './tool-lenses';
import { watchConnection } from './connection';
import { initSettingsUi } from './settings-ui';
import { initMarkdownUi } from './md-ui';
import { loadKv, onKvChange } from './kv';
import { initTooltips } from './tooltip';
import { installColumnResize } from './col-resize';
import { mountGoto, absPath, resolvePath } from './goto';
import { initDocsLens } from './docs-lens';
import { initDpLens } from './dp-lens';
import { initHomeLens, initHomePage } from './home-lens';
import { emptyHtml } from './empty-state';
import { go, reload } from './nav';
import { setLinkHome } from './renderers';
import { errorText } from './errors';

// Tab sets from Chrome tabs closed in the last day, as rows under Recent. A
// click adds that set's tabs to this strip; nothing is restored on its own.
async function showClosedSets(strip: Strip, visible: boolean): Promise<void> {
  const box = document.getElementById('fe-rc-sets');
  if (!box) return;
  const section = box.closest('.fe-sec') as HTMLElement;
  const ago = (at: number) => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };
  let timer = 0;
  const later = (ms: number) => { clearTimeout(timer); timer = window.setTimeout(() => void paint(), ms); };
  async function paint(): Promise<void> {
    const all = await strip.closedSets();
    const settle = 2500;
    const young = all.filter(s => Date.now() - s.at < settle);
    if (young.length) later(settle - (Date.now() - Math.min(...young.map(s => s.at))) + 100);
    const sets = all.filter(s => !young.includes(s)).slice(0, 3);
    // Tabs closed in this strip come first: one click brings one back.
    const own = strip.closedTabs().slice(0, 8);
    const ownRows = own.map(t => `<button type="button" class="row fe-si fe-rc-tab" data-tab="${esc(t.id)}" title="Reopen ${esc(t.path)}">${t.kind === 'folder' ? PI.folder : icoFile(t.label.includes('.') ? t.label.split('.').pop()!.toLowerCase() : '')}<span class="fe-sl">${esc(t.label)}</span></button>`).join('');
    box!.innerHTML = ownRows + sets.map(s => {
      const n = s.labels.length;
      return `<button type="button" class="row fe-si fe-rc-set" data-set="${esc(s.id)}" title="Add these tabs to this strip: ${esc(s.labels.join(', '))}">${PI.tabset}<span class="fe-sl">${n} tab${n === 1 ? '' : 's'}: ${esc(s.labels.slice(0, 3).join(', '))}${n > 3 ? '…' : ''}</span><span class="fe-rc-ago">${ago(s.at)}</span></button>`;
    }).join('');
    section.hidden = !(visible && (sets.length || own.length));
  }
  box.addEventListener('click', e => {
    const t = (e.target as Element).closest<HTMLElement>('.fe-rc-tab');
    if (t) { strip.reopen(t.dataset.tab!); return; }
    const b = (e.target as Element).closest<HTMLElement>('.fe-rc-set');
    if (b) void strip.restoreSet(b.dataset.set!).then(paint);
  });
  // Another Chrome tab closing changes the list; paint picks it up once settled.
  try {
    chrome.storage.onChanged.addListener((changes, name) => {
      if (name === 'local' && Object.keys(changes).some(k => k.startsWith('bfb-strip-v2:'))) later(300);
    });
  } catch { /* extension reloaded under the page */ }
  strip.onChange(() => void paint());
  await paint();
}

// Settings must be in memory before the first paint decides anything.
loadKv().catch(() => {}).then(function () {
  const preload = document.getElementById('bfb-preload');
  const settings = getSettings();
  syncHtmlGuard(settings);   // a change made in another browser window reaches the loader too
  // folder/#view=name shows a file Chrome would otherwise download (see pageHref).
  const viewName = location.hash.startsWith('#view=') ? location.hash.slice(6) : '';
  const viewHref = viewName ? location.href.split('#')[0] + viewName : '';
  const fileExt = filePageExt(viewName ? location.pathname + viewName : location.pathname);
  const fileMode = !!fileExt && (!!viewName || filePagesEnabled(fileExt, settings));
  // ~/#home is Home: the shell as usual, with Home in the main pane instead of the listing.
  const homeMode = !fileMode && location.hash === '#home';
  if (!fileMode && !document.title.startsWith('Index of')) {
    preload?.remove();
    return;
  }
  const isHtmlSource = fileMode && (fileExt === 'html' || fileExt === 'htm');
  const fetchSource = isHtmlSource || !!viewName;
  const fileText = fileMode ? (fetchSource ? 'Loading…' : (document.body.textContent || '')) : '';

  const rawPath  = decodeURIComponent(window.location.pathname + viewName);
  // Bare paths under home in rendered text become file links.
  setLinkHome(homeDir(rawPath));
  const segments = rawPath.split('/').filter(Boolean);
  const fileName = fileMode ? (segments.pop() || '') : '';
  // The folder this page belongs to: the path itself for a listing.
  const folderPath = fileMode ? '/' + segments.join('/') + (segments.length ? '/' : '') : rawPath;

  const entries = fileMode ? [] : parseEntries();
  // Chrome's listing no longer includes a "../" table row (the parent link
  // lives outside the table now); synthesize one so the Parent Directory row
  // and up-navigation keep working.
  if (!fileMode && segments.length && !entries.some(e => e.isParent)) {
    const parentSegs = segments.slice(0, -1);
    entries.unshift({
      name: '..',
      href: 'file:///' + parentSegs.map(encodeURIComponent).join('/') + (parentSegs.length ? '/' : ''),
      isDir: true, isParent: true, isHidden: false, rawBytes: -1, dateMs: NaN, dateStr: '',
    });
  }
  const nonPar  = entries.filter(e => !e.isParent);
  const dirs    = nonPar.filter(e => e.isDir).length;
  const files   = nonPar.filter(e => !e.isDir).length;
  const allExts = [...new Set(nonPar.filter(e => !e.isDir && getExt(e)).map(getExt))].sort();
  const extOpts = allExts;

  const iconRules = getIconRules();
  const initDensity = getDensity();
  const initView   = getView();
  const initTheme  = resolveTheme(themeMode());
  const initPalette = getPalette();
  const initHidden = getShowHidden();

  // Snapshot history BEFORE recording this visit so the list shown
  // excludes the folder or file we're on. Files count as visits too, so a
  // doc read yesterday is one click away without restoring a whole strip.
  const recents = getRecents().filter(r => r.path !== rawPath);
  if (!homeMode) pushRecent(rawPath);   // Home is not a visit to the home folder
  // Closed tab sets are added below the list once the strip has read them; the
  // section stays hidden while it has nothing to show.
  // History reads as three short lists: folders, files, closed tabs.
  const ago = (ts?: number) => {
    if (!ts) return '';
    const m = Math.round((Date.now() - ts) / 60000);
    return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
  };
  const recentRow = (r: { path: string; ts?: number }) => {
    const name = r.path.split('/').filter(Boolean).pop() || '/';
    const isDir = r.path.endsWith('/');
    const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : 'txt';
    return `<a href="${esc(fileHref(r.path))}" class="row fe-si" title="${esc(r.path)}">${isDir ? PI.folder : icoFile(ext)}<span class="fe-sl">${esc(name)}</span><span class="fe-rc-ago">${ago(r.ts)}</span></a>`;
  };
  const recentDirs = recents.filter(r => r.path.endsWith('/')).slice(0, 12);
  const recentFiles = recents.filter(r => !r.path.endsWith('/')).slice(0, 12);
  const recentsHTML = `
      <div class="fe-sec" data-sec="recent" data-collapse="recent">
        <div class="sect fe-sh" data-level="group"><span class="fe-sh-label">Folders</span></div>
        ${recentDirs.length ? recentDirs.map(recentRow).join('') : emptyHtml('empty', 'Folders you open show up here', { inline: true })}
      </div>
      <div class="fe-sec" data-collapse="recent-files">
        <div class="sect fe-sh" data-level="group"><span class="fe-sh-label">Files</span></div>
        ${recentFiles.length ? recentFiles.map(recentRow).join('') : emptyHtml('empty', 'Files you open show up here', { inline: true })}
      </div>
      <div class="fe-sec" data-collapse="recent-tabs" id="fe-rc-tabs-sec" hidden>
        <div class="sect fe-sh" data-level="group"><span class="fe-sh-label">Closed tabs</span></div>
        <div id="fe-rc-sets"></div>
      </div>`;

  const html = renderPage({
    initTheme, initPalette, initView, initDensity, initHidden, fileMode, rawPath, folderPath, fileName, segments, settings,
    curIsBookmarked: getSaved().some(p => samePlace(p.path, rawPath)),
    dirs, files, extOpts, recentsHTML, entries, ctx: { rawPath, iconRules, settings },
  });

  const dirName  = fileMode ? fileName : (segments[segments.length - 1] || '/');
  const shortDir = dirName.length > 20 ? dirName.slice(0, 20) + '…' : dirName;
  document.title = `${homeMode ? 'Home' : shortDir} | Better File Browser`;
  document.head.innerHTML = `<meta charset="utf-8"><title>${document.title}</title><link rel="icon" type="image/svg+xml" href="${appIconUrl()}">`;
  document.body.innerHTML = html;
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS + UI_CSS;
  document.head.appendChild(styleEl);
  preload?.remove();

  const fe = el('fe');
  fe.classList.toggle('fe-home-mode', homeMode);
  fe.dataset.wrap = settings.wrapLines === false ? 'off' : 'on';
  followSystem(fe);
  // The loader covers the next page in this colour before anything draws, so
  // moving between pages never flashes another theme's background.
  // Read after the first frame: reading a computed style straight after the body is replaced forces a full style pass on the boot path.
  const cardOf = (id: string): CoverShape | null => {
    const e = document.getElementById(id);
    if (!e?.offsetWidth) return null;
    const r = e.getBoundingClientRect();
    let c = getComputedStyle(e).backgroundColor;
    if (c === 'rgba(0, 0, 0, 0)' && e.firstElementChild) c = getComputedStyle(e.firstElementChild).backgroundColor;
    return { x: Math.round(r.left), y: Math.round(r.top), r: Math.round(innerWidth - r.right), b: Math.round(innerHeight - r.bottom), c };
  };
  const keepBg = () => requestAnimationFrame(() => setTimeout(() => keepPageBg(getComputedStyle(fe).backgroundColor, fe.dataset.theme ?? 'dark', fe.dataset.mode ?? 'system',
    ['fe-side', 'fe-main'].map(cardOf).filter((s): s is CoverShape => !!s)), 0));
  fe.dataset.booting = '';
  requestAnimationFrame(() => requestAnimationFrame(() => { delete fe.dataset.booting; }));
  keepBg();
  new MutationObserver(keepBg).observe(fe, { attributes: true, attributeFilter: ['data-theme', 'data-mode', 'data-palette', 'style'] });
  // A width saved before the lens rail existed is widened once by the rail's
  // 52px, so the lists keep the room they had.
  if (settings.sidebarWidth && !settings.sidebarRail) { settings.sidebarWidth += 52; settings.sidebarRail = true; saveSettings(settings); }
  if (settings.sidebarWidth) el('fe-side').style.width = settings.sidebarWidth + 'px';
  // A narrow window folds the sidebar away so the page keeps its room; the
  // hamburger still opens it, and widening brings it back as it was left.
  // The saved setting is not touched.
  const narrow = matchMedia(FOLD_SIDE_QUERY);
  if (!settings.showSidebar || narrow.matches) { el('fe-side').style.display = 'none'; el('fe-side-rz').style.display = 'none'; }
  narrow.addEventListener('change', () => {
    const docked = !!document.querySelector<HTMLElement>('#fe-qlook.side')?.checkVisibility() && settings.dockFoldsSidebar !== false;
    setSidebarShown(!narrow.matches && !docked && settings.showSidebar);
  });
  // Size, fonts and colours: set at load, and again whenever another tab
  // changes one, so every open tab looks the same. Interface size is the
  // tab's zoom, which Chrome keeps per tab, so 100% is set too, not skipped.
  const applyLook = () => {
    setUiScale(settings.uiScale || 100);
    fe.classList.toggle('compact', !!settings.compactMode);
    document.documentElement.style.setProperty('--ui-text-scale', String((settings.readerSize || 15) / 15));
    fe.style.setProperty('--rd-lh', String(settings.readerLineHeight || 1.65));
    fe.style.setProperty('--rd-code', `${settings.readerCodeSize || 13}px`);
    applyFonts(fe);
    fe.dataset.palette = getPalette();
    fe.dataset.mode = themeMode();
    fe.dataset.theme = resolveTheme(themeMode());
  };
  applyLook();
  onKvChange(k => {
    if (k === SETTINGS_KEY) Object.assign(settings, getSettings());
    if (k === SETTINGS_KEY || k === PALETTE_KEY || k === THEME_KEY || k.startsWith('bfb-font-')) applyLook();
  });
  if (settings.tooltips === false) fe.classList.add('fe-notips');

  const app: App = {
    fileMode, rawPath, folderPath, fileName, fe, settings, iconRules, entryNames: nonPar.map(e => e.name),
    toast: makeToast(el('fe-toast')),
    strip: null as unknown as App['strip'],
    filePage: null,
    applyAll: () => {}, setOrder: () => {}, refreshSaved: () => {}, refreshNotes: () => {}, newNote: () => {}, pickNotesFolder: () => {},
    openInTerminal: () => {}, openHelp: () => {}, openSettings: () => {},
    goUp: () => {
      if (fileMode) { go(fileHref(folderPath), 'here', { exact: true }); return; }
      const up = entries.find(x => x.isParent);
      if (up) go(up.href, 'here', { exact: true });
      else if (rawPath !== '/') go('file:///', 'here', { exact: true });
    },
  };

  initPreview({ iconRules: () => app.iconRules, aiModel: () => settings.aiModel, keepTab: path => { app.strip.open(path, true); app.toast('Kept as a tab'); }, saveError: message => app.toast(message), toast: message => app.toast(message),
    savedChanged: () => app.refreshSaved(), openInTerminal: p => app.openInTerminal(p),
    // The renamed file stays selected when its folder reloads.
    rename: (anchor, p) => askRename(app, anchor, p, to => { closePreview(); textPref('bfb-lead:' + rawPath, '', 'tab').set(to.slice(to.lastIndexOf('/') + 1)); reload(); }),
    // A docked preview folds the sidebar away while it shows; the sidebar's own setting comes back after.
    dockRoom: docked => setSidebarShown(docked && settings.dockFoldsSidebar !== false ? false : settings.showSidebar) });
  // The strip: this Chrome tab's working set. Navigation is real, so the
  // address bar is always the active tab's location.
  app.strip = mountStrip({ el: el('fe-tabs'), rawPath, homeMode, homePath: () => homeDir(rawPath), toast: app.toast, onSavedChange: () => app.refreshSaved(), openInTerminal: p => app.openInTerminal(p) });
  void showClosedSets(app.strip, !settings.hideRecent);
  // Everything that opens a place from the sidebar or beside the strip opens
  // it as a new tab and keeps the one you were on.
  const goTab = (path: string, hash = '') => app.strip.go(path, hash);
  initDocsLens(el('fe-docs-list'), homeDir(rawPath), folderPath, goTab);
  initDpLens(el('fe-dpl-list'), p => goTab(p));
  initHomeLens(el('fe-home'), goTab);
  if (homeMode) { el('fe-home-page').hidden = false; initHomePage(el('fe-home-page'), goTab, app); }
  // Beside the strip: open a file or folder from the system chooser, or go to a pasted path.
  mountGoto(el('fe-open-path'), () => homeDir(rawPath), (path, background) => { if (!background) { goTab(path); return; } app.strip.open(path, true); app.toast('Kept as a tab'); });
  el('fe-open-pick').addEventListener('click', () => {
    notes.pick(rawPath, 'any').then(async p => { const path = p && absPath(p, ''); const found = path && await resolvePath(path); if (found) goTab(found); })
      .catch(err => app.toast(errorText(err, 'Opening the chooser')));
  });
  if (fileMode) {
    const href = viewHref || location.href;
    app.filePage = mountFileContent({ ext: fileExt!, text: fileText, rawPath, href, column: settings.readerColumn, editableFolders: editableFoldersOf(settings) });
    if (fetchSource) fetchFileText(href).then(text => app.filePage?.setText(text)).catch(() => {
      app.filePage?.setText('Could not read this file.');
    });
  }
  // Any file link that Chrome would download goes to its folder's view instead,
  // whichever button or key follows the press.
  document.addEventListener('mousedown', e => {
    const a = (e.target as Element).closest?.<HTMLAnchorElement>('a[href^="file://"]');
    if (a) { const v = pageHref(a.href); if (v !== a.href) a.href = v; }
  }, true);
  // On the folder's own page a #view link only changes the hash; load it properly.
  window.addEventListener('hashchange', () => { if (location.hash.startsWith('#view=') || viewName || homeMode !== (location.hash === '#home')) reload(); });

  initChrome(app);
  initMarkdownUi(app.toast);
  installColumnResize();
  const listing = initListing(app, entries, { view: initView, density: initDensity, hidden: initHidden });
  initListingInput(app, listing);
  if (!homeMode) void mountFolderView(app);
  initSettingsUi(app);
  initToolLenses(app);
  watchConnection();
  initSidebar(app);
  initSidePeek();
  initDragPan();
  if (fileMode) mountKeep(app);
  initFocusNav(app);
  // Before any visit under home, ask the native host where home is, so Places
  // offers Home, Desktop and the rest from the first page.
  if (!homeDir(rawPath)) {
    notes.home().then(home => {
      if (!setHomeDir(home)) return;
      setLinkHome(home);
      const list = document.querySelector('#fe-lens-places .fe-sec[data-sec="places"]');
      if (list) list.innerHTML = placesHTML(home, rawPath);
    }).catch(() => { /* no host installed: Places waits for a visit under home */ });
  }

  // Apply the saved view after all listing handlers exist.
  listing.applyAll();
  listing.applyFindFromHash();
  // Tooltips off: strip every title now and after each listing render.
  if (settings.tooltips === false) {
    const strip = () => document.querySelectorAll('[title]').forEach(x => x.removeAttribute('title'));
    strip();
    new MutationObserver(strip).observe(fe, { childList: true, subtree: true });
  } else {
    initTooltips(document.body);
  }
});
