// The content script's entry: decide whether this page is a folder listing
// or a file to render, build the shell once, then hand each part to its
// module. One shell serves both pages, so nothing moves when a file opens.
import { parseEntries } from './parse';
import { getExt } from './utils';
import {
  getView, getTheme, getZoom, getShowHidden, getIconRules, getSettings, getRecents, pushRecent, getSaved,
} from './storage';
import { initPreview } from './preview';
import { CSS } from './styles';
import { esc } from './utils';
import { PI } from './icons';
import { filePageExt, filePagesEnabled, mountFileContent } from './file-page';
import { mountStrip } from './strip';
import { makeToast } from './toast';
import { renderPage } from './page';
import { el } from './el';
import type { App } from './app';
import { initChrome } from './chrome';
import { initListing } from './listing';
import { initListingInput } from './listing-input';
import { initSidebar } from './sidebar';
import { initSettingsUi } from './settings-ui';

(function () {
  const preload = document.getElementById('bfb-preload');
  const settings = getSettings();
  const fileExt = filePageExt(location.pathname);
  const fileMode = !!fileExt && filePagesEnabled(fileExt, settings);
  if (!fileMode && !document.title.startsWith('Index of')) {
    preload?.remove();
    return;
  }
  const fileText = fileMode ? (document.body.textContent || '') : '';

  const rawPath  = decodeURIComponent(window.location.pathname);
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
  const extOpts = allExts.map(x => `<option value="${x}">.${x}</option>`).join('');

  const iconRules = getIconRules();
  const initZoom   = getZoom();
  const initView   = getView();
  const initTheme  = getTheme();
  const initHidden = getShowHidden();

  // Snapshot history BEFORE recording this visit so the list shown
  // excludes the folder we're in.
  const recents = getRecents().filter(r => r.path !== folderPath).slice(0, 6);
  pushRecent(folderPath);
  const recentsHTML = recents.length ? `
      <div class="fe-sec">
        <div class="fe-sh">Recent</div>
        ${recents.map(r => {
          const lbl = r.path.split('/').filter(Boolean).pop() || '/';
          return `<a href="file://${esc(r.path)}" class="fe-si" title="${esc(r.path)}">${PI.recent}<span class="fe-sl">${esc(lbl)}</span></a>`;
        }).join('')}
      </div>` : '';

  const html = renderPage({
    initTheme, initView, initZoom, initHidden, fileMode, rawPath, folderPath, fileName, segments, settings,
    curIsBookmarked: getSaved().some(p => p.path === rawPath),
    dirs, files, extOpts, recentsHTML, entries, ctx: { rawPath, iconRules, settings },
  });

  const dirName  = fileMode ? fileName : (segments[segments.length - 1] || '/');
  const shortDir = dirName.length > 20 ? dirName.slice(0, 20) + '…' : dirName;
  document.title = `${shortDir} | Better File Browser`;
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%230d1117"/><path d="M3 12.5A1.5 1.5 0 0 1 4.5 11h5.5l2.5 3H28a1.5 1.5 0 0 1 1.5 1.5V24A1.5 1.5 0 0 1 28 25.5H4.5A1.5 1.5 0 0 1 3 24z" fill="%234a9eff"/><path d="M9 18.5h14M9 22h9" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.75"/></svg>`;
  document.head.innerHTML = `<meta charset="utf-8"><title>${document.title}</title><link rel="icon" href="data:image/svg+xml,${faviconSvg}">`;
  document.body.innerHTML = html;
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
  preload?.remove();

  const fe = el('fe');
  if (!settings.showSidebar) el('fe-side').style.display = 'none';
  if (settings.compactMode) fe.classList.add('compact');

  const app: App = {
    fileMode, rawPath, folderPath, fileName, fe, settings, iconRules,
    toast: makeToast(el('fe-toast')),
    strip: null as unknown as App['strip'],
    filePage: null,
    applyAll: () => {}, refreshSaved: () => {}, refreshNotes: () => {}, newNote: () => {},
    openInTerminal: () => {},
    goUp: () => {
      if (fileMode) { location.href = 'file://' + folderPath; return; }
      const up = entries.find(x => x.isParent);
      if (up) location.href = up.href;
      else if (rawPath !== '/') location.href = 'file:///';
    },
  };

  initPreview({ iconRules: () => app.iconRules, aiModel: () => settings.aiModel });
  // The strip: this Chrome tab's working set. Navigation is real, so the
  // address bar is always the active tab's location.
  app.strip = mountStrip({ el: el('fe-tabs'), rawPath, toast: app.toast, onSavedChange: () => app.refreshSaved() });
  if (fileMode) app.filePage = mountFileContent({ ext: fileExt!, text: fileText, rawPath, href: location.href });

  initChrome(app);
  const listing = initListing(app, entries, { view: initView, zoom: initZoom, hidden: initHidden });
  initListingInput(app, listing);
  initSettingsUi(app);
  initSidebar(app);

  // The first render drew the listing raw; apply the persisted sort/group
  // last, once every handler applyAll touches (selection included) exists.
  if (listing.ls.sort.col || listing.ls.group !== 'none') listing.applyAll();
  listing.applyFindFromHash();
})();
