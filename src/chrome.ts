// The path bar's own controls: theme toggle, terminal button, and the crumb
// dropdown that lists a parent folder in place.
import type { App } from './app';
import { el } from './el';
import { esc, pageHref, fileHref, copyToClipboard } from './utils';
import { kvGet, kvSet } from './kv';
import { getIcon } from './icons';
import { TERMINAL_CMDS, saveSettings, homeDir, getRecents } from './storage';
import { absPath, resolvePath, readable } from './goto';
import { fetchFileText } from './file-fetch';
import { parseListing } from './parse';
import { setSidebarShown } from './motion';
import { setThemeMode } from './theme';
import { openLayer, type Layer } from './layer';

/// Interface size: the tab's own Chrome zoom, set through the extension's
/// worker. A CSS zoom on the page scaled every menu's screen coordinates a
/// second time, so menus opened away from what was clicked.
export function setUiScale(percent: number): void {
  try { void chrome.runtime.sendMessage({ type: 'bfb-zoom', factor: (percent || 100) / 100 }); } catch { /* no worker in tests */ }
}

export function initChrome(app: App): void {
  const { fe, settings, toast } = app;

  el('fe-status-path').addEventListener('click', () => {
    void copyToClipboard(app.rawPath).then(ok => toast(ok ? 'Copied the path' : 'Copy failed'));
  });

  // The toolbar button flips to the other look and leaves System mode.
  el('fe-theme-btn').addEventListener('click', () => setThemeMode(fe, fe.dataset.theme === 'dark' ? 'light' : 'dark'));

  function getTermCmd(path: string): string {
    const term = settings.terminalApp || 'ghostty';
    const tpl = term === 'custom'
      ? (settings.terminalCmd || 'cd "${p}"')
      : (TERMINAL_CMDS[term] || TERMINAL_CMDS.ghostty);
    return tpl.replace(/\$\{p\}/g, path);
  }
  function fallbackCopy(path: string): void {
    const cmd = getTermCmd(path);
    navigator.clipboard.writeText(cmd).catch(() => {});
    toast(`Copied: ${cmd}`);
  }
  app.openInTerminal = (path: string) => {
    const term = settings.terminalApp || 'ghostty';
    // A named terminal opens through the launcher host; a custom command is
    // only copied, because the extension never runs shell text.
    if (term !== 'custom') {
      // connectNative is unavailable in content scripts; the background
      // worker relays, and a missing host falls back to the clipboard.
      chrome.runtime.sendMessage(
        { type: 'bfb-native-oneshot', host: 'com.better_file_browser.ghostty', payload: { action: 'open_terminal', path, app: term } },
        res => { if (chrome.runtime.lastError || !res?.ok) fallbackCopy(path); },
      );
      return;
    }
    fallbackCopy(path);
  };
  el('fe-term-btn').addEventListener('click', e => {
    if ((e as MouseEvent).shiftKey) fallbackCopy(app.folderPath);
    else app.openInTerminal(app.folderPath);
  });

  // The button beside a crumb lists that folder with a filter box.
  const crumbMenu = el('fe-crumb-menu');
  let crumbMenuUrl: string | null = null;
  let crumbLayer: Layer | null = null;
  function closeCrumbMenu(): void { crumbLayer?.close('api'); }
  const bc = el('fe-bc'), more = el('fe-crumb-more');
  // False when the press that ended on `btn` had just closed this menu.
  const openCrumbMenu = (btn: HTMLElement, key: string, html: string): boolean => {
    crumbMenu.innerHTML = html;
    crumbLayer = openLayer(crumbMenu, { kind: 'popover', anchor: btn, role: 'menu', group: 'menu', onClose: () => { crumbMenuUrl = null; } });
    if (!crumbLayer.open) return false;
    crumbMenuUrl = key;
    return true;
  };
  // Fold middle folders into "…" until the path fits: first the ones between
  // the top folder and the last two, then those too, so the current folder
  // is the last to go. Measured, so a path that fits never folds.
  // Folders above home ("~") start folded and never count as room to win.
  const fitCrumbs = () => {
    const groups = [...bc.querySelectorAll<HTMLElement>('.fe-cg')];
    const pre = groups.filter(g => g.hasAttribute('data-pre')).length;
    groups.forEach((g, i) => { g.hidden = i < pre; });
    more.hidden = true;
    const n = groups.length, order: number[] = [];
    for (let i = pre + 2; i < n - 2; i++) order.push(i);
    for (const i of [pre + 1, n - 2]) if (i > pre && i < n - 1 && !order.includes(i)) order.push(i);
    for (const i of order) {
      if (bc.scrollWidth <= bc.clientWidth) break;
      groups[i].hidden = true;
      more.hidden = false;
    }
    // Under home, "…" always offers the folders above "~"; it sits before
    // "~" unless middle folders folded too, then where they were.
    const first = groups.find((g, i) => g.hidden && i >= pre) ?? (pre ? groups[pre] : undefined);
    if (pre) more.hidden = false;
    if (first) first.before(more);
  };
  fitCrumbs();
  new ResizeObserver(() => { closeCrumbMenu(); fitCrumbs(); }).observe(bc);
  // Click an empty part of the bar to type a path, like an address bar:
  // Enter goes there in this tab, Esc or a click elsewhere puts the folders back.
  const home = homeDir(app.rawPath);
  let edit: HTMLFormElement | null = null;
  const endEdit = () => {
    if (!edit) return;
    edit.remove(); edit = null;
    bc.hidden = false;
    fitCrumbs();
  };
  const startEdit = () => {
    if (edit) return;
    closeCrumbMenu();
    const shown = home && (app.rawPath === home || app.rawPath.startsWith(home + '/')) ? '~' + app.rawPath.slice(home.length) : app.rawPath;
    edit = document.createElement('form');
    edit.id = 'fe-bc-edit';
    edit.innerHTML = `<input type="text" list="fe-bc-recent" spellcheck="false" autocomplete="off" aria-label="Path to a file or folder" title="Enter goes there · Esc cancels">
      <datalist id="fe-bc-recent">${getRecents().slice(0, 30).map(r => `<option value="${esc(r.path)}"></option>`).join('')}</datalist>`;
    bc.after(edit);
    bc.hidden = true;
    const input = edit.querySelector('input')!;
    input.value = shown;
    input.focus(); input.select();
    input.addEventListener('blur', () => setTimeout(() => { if (edit && !edit.contains(document.activeElement)) endEdit(); }, 120));
    input.addEventListener('keydown', ke => {
      if (ke.key === 'Escape') { ke.preventDefault(); ke.stopPropagation(); endEdit(); }
    });
    edit.addEventListener('submit', async se => {
      se.preventDefault();
      const path = absPath(input.value, home);
      if (!path) { input.setAttribute('aria-invalid', 'true'); toast('Type a full path, such as ~/Code or /Users/you/notes.md'); return; }
      const found = await resolvePath(path);
      if (!found) { input.setAttribute('aria-invalid', 'true'); toast(`Nothing at ${path}`); return; }
      const slow = setTimeout(() => toast('Checking that folder…'), 600);
      const ok = await readable(found);
      clearTimeout(slow);
      if (!ok) { input.setAttribute('aria-invalid', 'true'); toast(`The browser could not open ${found}. It may not have permission to read it.`); return; }
      if (found.replace(/\/$/, '') === app.rawPath.replace(/\/$/, '')) { endEdit(); return; }
      location.href = pageHref(fileHref(found));
    });
    input.addEventListener('input', () => input.removeAttribute('aria-invalid'));
  };
  bc.title = 'Click an empty part of the bar to type a path';
  bc.addEventListener('click', e => { if (e.target === bc) startEdit(); });

  bc.addEventListener('click', async e => {
    if ((e.target as HTMLElement).closest('#fe-crumb-more')) {
      e.preventDefault(); e.stopPropagation();
      if (crumbLayer?.open && crumbMenuUrl === 'more') { closeCrumbMenu(); return; }
      const hid = [...bc.querySelectorAll<HTMLAnchorElement>('.fe-cg[hidden] .fe-crumb')];
      openCrumbMenu(more, 'more', `<div class="fe-dd-items">${hid.map(a => {
        const href = a.getAttribute('href')!, name = a.textContent!;
        const icon = getIcon({ name, href, isDir: true, isParent: false, isHidden: false, rawBytes: -1, dateMs: NaN, dateStr: '' }, app.iconRules);
        return `<a href="${esc(href)}" class="fe-dd-item dir" data-name="${esc(name.toLowerCase())}" title="${esc(decodeURIComponent(href.slice(7)))}">${icon}<span>${esc(name)}</span></a>`;
      }).join('')}</div>`);
      return;
    }
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.fe-crumb-dd');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    const url = btn.dataset.url!;
    if (crumbLayer?.open && crumbMenuUrl === url) { closeCrumbMenu(); return; }
    if (!openCrumbMenu(btn, url, '<div class="fe-dd-spinner">Loading…</div>')) return;

    const text = await fetchFileText(url)
      .catch(err => { console.error('[BFB] crumb dropdown failed:', url, err); return null; });
    if (text === null) {
      if (crumbMenuUrl === url) crumbMenu.innerHTML = '<div class="fe-dd-empty">Cannot load directory</div>';
      return;
    }
    if (crumbMenuUrl !== url) return;
    try {
      const entries = parseListing(text, url);
      if (!entries.length) { crumbMenu.innerHTML = '<div class="fe-dd-empty">Empty folder</div>'; crumbLayer?.place(); return; }
      crumbMenu.innerHTML =
        `<div class="fe-dd-search-wrap"><input class="fe-dd-search" type="text" placeholder="Filter" autocomplete="off" spellcheck="false" title="Type to narrow · Enter opens the first match · Esc closes"></div>` +
        `<div class="fe-dd-items">${entries.map(en =>
          `<a href="${esc(en.href)}" class="fe-dd-item${en.isDir ? ' dir' : ''}" data-name="${esc(en.name.toLowerCase())}" title="${esc(decodeURIComponent(en.href.slice(7)))}">${getIcon(en, app.iconRules)}<span>${esc(en.name)}</span></a>`
        ).join('')}</div>`;
      // Placed from the spinner's size at first; the listing needs its own.
      crumbLayer?.place();
      const ddSearch = crumbMenu.querySelector<HTMLInputElement>('.fe-dd-search')!;
      ddSearch.focus();
      ddSearch.addEventListener('input', () => {
        const q = ddSearch.value.toLowerCase();
        crumbMenu.querySelectorAll<HTMLElement>('.fe-dd-item').forEach(it => {
          it.style.display = !q || it.dataset.name!.includes(q) ? '' : 'none';
        });
      });
      ddSearch.addEventListener('keydown', ke => {
        if (ke.key === 'Enter') {
          const first = [...crumbMenu.querySelectorAll<HTMLAnchorElement>('.fe-dd-item')]
            .find(it => it.style.display !== 'none');
          if (first) location.href = pageHref(first.href);
        }
      });
    } catch (err) {
      console.error('[BFB] crumb dropdown parse error:', url, err);
      if (crumbMenuUrl === url) crumbMenu.innerHTML = '<div class="fe-dd-empty">Cannot load directory</div>';
    }
  });

  // The hamburger shows or hides the sidebar; the setting and its Settings
  // checkbox follow along.
  const side = el('fe-side');
  const rz = el('fe-side-rz');
  el('fe-side-toggle').addEventListener('click', () => {
    settings.showSidebar = !settings.showSidebar;
    saveSettings(settings);
    setSidebarShown(settings.showSidebar);
    const box = document.getElementById('fe-st-sidebar') as HTMLInputElement | null;
    if (box) box.checked = settings.showSidebar;
  });

  // Drag the handle to resize the sidebar; the width persists.
  rz.addEventListener('pointerdown', e => {
    e.preventDefault();
    rz.classList.add('drag');
    const startX = e.clientX;
    const startW = side.getBoundingClientRect().width;
    const move = (m: PointerEvent) => { side.style.width = Math.max(210, Math.min(520, startW + m.clientX - startX)) + 'px'; };
    const up = () => {
      rz.classList.remove('drag');
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      settings.sidebarWidth = Math.round(side.getBoundingClientRect().width);
      settings.sidebarRail = true;
      saveSettings(settings);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
}
