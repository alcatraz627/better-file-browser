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
import { fetchFileText } from './file-fetch';
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
import { initMarkdownUi } from './md-ui';

(function () {
  const preload = document.getElementById('bfb-preload');
  const settings = getSettings();
  const fileExt = filePageExt(location.pathname);
  const fileMode = !!fileExt && filePagesEnabled(fileExt, settings);
  if (!fileMode && !document.title.startsWith('Index of')) {
    preload?.remove();
    return;
  }
  const isHtmlSource = fileMode && (fileExt === 'html' || fileExt === 'htm');
  const fileText = fileMode ? (isHtmlSource ? 'Loading HTML source…' : (document.body.textContent || '')) : '';

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
      <div class="fe-sec" data-sec="recent" data-collapse="recent"${settings.hideRecent ? ' style="display:none"' : ''}>
        <div class="fe-sh"><span class="fe-sh-label">Recent</span></div>
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
  document.head.innerHTML = `<meta charset="utf-8"><title>${document.title}</title><link rel="icon" type="image/svg+xml" href="${chrome.runtime.getURL('assets/favicon.svg')}">`;
  document.body.innerHTML = html;
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
  preload?.remove();

  const fe = el('fe');
  if (settings.sidebarWidth) el('fe-side').style.width = settings.sidebarWidth + 'px';
  if (!settings.showSidebar) { el('fe-side').style.display = 'none'; el('fe-side-rz').style.display = 'none'; }
  if (settings.uiScale && settings.uiScale !== 100) (fe.style as CSSStyleDeclaration & { zoom: string }).zoom = String(settings.uiScale / 100);
  if (settings.compactMode) fe.classList.add('compact');
  document.documentElement.style.setProperty('--ui-text-scale', String((settings.readerSize || 15) / 15));
  fe.style.setProperty('--rd-lh', String(settings.readerLineHeight || 1.65));
  fe.style.setProperty('--rd-code', `${settings.readerCodeSize || 13}px`);
  if (settings.tooltips === false) fe.classList.add('fe-notips');

  const app: App = {
    fileMode, rawPath, folderPath, fileName, fe, settings, iconRules,
    toast: makeToast(el('fe-toast')),
    strip: null as unknown as App['strip'],
    filePage: null,
    applyAll: () => {}, refreshSaved: () => {}, refreshNotes: () => {}, newNote: () => {},
    openInTerminal: () => {}, openHelp: () => {}, openSettings: () => {},
    goUp: () => {
      if (fileMode) { location.href = 'file://' + folderPath; return; }
      const up = entries.find(x => x.isParent);
      if (up) location.href = up.href;
      else if (rawPath !== '/') location.href = 'file:///';
    },
  };

  initPreview({ iconRules: () => app.iconRules, aiModel: () => settings.aiModel, keepTab: path => { app.strip.open(path, true); app.toast('Kept as a tab'); }, saveError: message => app.toast(message), toast: message => app.toast(message) });
  // The strip: this Chrome tab's working set. Navigation is real, so the
  // address bar is always the active tab's location.
  app.strip = mountStrip({ el: el('fe-tabs'), rawPath, toast: app.toast, onSavedChange: () => app.refreshSaved(), restore: settings.stripRestore !== false });
  if (fileMode) {
    app.filePage = mountFileContent({ ext: fileExt!, text: fileText, rawPath, href: location.href, column: settings.readerColumn });
    if (isHtmlSource) fetchFileText(location.href).then(text => app.filePage?.setText(text)).catch(() => {
      app.filePage?.setText('Could not load the HTML source.');
    });
  }

  initChrome(app);
  initMarkdownUi(app.toast);
  const listing = initListing(app, entries, { view: initView, zoom: initZoom, hidden: initHidden });
  initListingInput(app, listing);
  initSettingsUi(app);
  initSidebar(app);

  // Apply the saved view after all listing handlers exist.
  listing.applyAll();
  listing.applyFindFromHash();
  // Tooltips off: strip every title now and after each listing render.
  if (settings.tooltips === false) {
    const strip = () => document.querySelectorAll('[title]').forEach(x => x.removeAttribute('title'));
    strip();
    new MutationObserver(strip).observe(fe, { childList: true, subtree: true });
  }
})();
