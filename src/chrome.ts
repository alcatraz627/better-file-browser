// The path bar's own controls: theme toggle, terminal button, and the crumb
// dropdown that lists a parent folder in place.
import type { App } from './app';
import { el } from './el';
import { esc } from './utils';
import { getIcon } from './icons';
import { THEME_KEY, TERMINAL_CMDS } from './storage';
import { fetchFileText } from './file-fetch';
import { parseListing } from './parse';

export function initChrome(app: App): void {
  const { fe, settings, toast } = app;

  el('fe-theme-btn').addEventListener('click', () => {
    const next = fe.dataset.theme === 'dark' ? 'light' : 'dark';
    fe.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
  });

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
    if ((settings.terminalApp || 'ghostty') === 'ghostty') {
      // connectNative is unavailable in content scripts; the background
      // worker relays, and a missing host falls back to the clipboard.
      chrome.runtime.sendMessage(
        { type: 'bfb-native-oneshot', host: 'com.better_file_browser.ghostty', payload: { action: 'open_terminal', path } },
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

  // Crumb dropdown: the ▾ beside a segment lists that folder with a filter box.
  const crumbMenu = el('fe-crumb-menu');
  let crumbMenuUrl: string | null = null;
  function closeCrumbMenu(): void { crumbMenu.style.display = 'none'; crumbMenuUrl = null; }
  el('fe-bc').addEventListener('click', async e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.fe-crumb-dd');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    const url = btn.dataset.url!;
    if (crumbMenu.style.display !== 'none' && crumbMenuUrl === url) { closeCrumbMenu(); return; }
    const rect = btn.getBoundingClientRect();
    crumbMenu.style.left    = Math.min(rect.left, window.innerWidth - 260) + 'px';
    crumbMenu.style.top     = (rect.bottom + 4) + 'px';
    crumbMenu.style.display = 'block';
    crumbMenu.innerHTML     = '<div class="fe-dd-spinner">Loading…</div>';
    crumbMenuUrl = url;

    const text = await fetchFileText(url)
      .catch(err => { console.error('[BFB] crumb dropdown failed:', url, err); return null; });
    if (text === null) {
      if (crumbMenuUrl === url) crumbMenu.innerHTML = '<div class="fe-dd-empty">Cannot load directory</div>';
      return;
    }
    if (crumbMenuUrl !== url) return;
    try {
      const entries = parseListing(text, url);
      if (!entries.length) { crumbMenu.innerHTML = '<div class="fe-dd-empty">Empty folder</div>'; return; }
      crumbMenu.innerHTML =
        `<div class="fe-dd-search-wrap"><input class="fe-dd-search" type="text" placeholder="Filter…" autocomplete="off" spellcheck="false" title="Type to narrow · Enter opens the first match · Esc closes"></div>` +
        `<div class="fe-dd-items">${entries.map(en =>
          `<a href="${esc(en.href)}" class="fe-dd-item${en.isDir ? ' dir' : ''}" data-name="${esc(en.name.toLowerCase())}" title="${esc(decodeURIComponent(en.href.slice(7)))}">${getIcon(en, app.iconRules)}<span>${esc(en.name)}</span></a>`
        ).join('')}</div>`;
      const ddSearch = crumbMenu.querySelector<HTMLInputElement>('.fe-dd-search')!;
      ddSearch.focus();
      ddSearch.addEventListener('input', () => {
        const q = ddSearch.value.toLowerCase();
        crumbMenu.querySelectorAll<HTMLElement>('.fe-dd-item').forEach(it => {
          it.style.display = !q || it.dataset.name!.includes(q) ? '' : 'none';
        });
      });
      ddSearch.addEventListener('keydown', ke => {
        if (ke.key === 'Escape') { ke.stopPropagation(); closeCrumbMenu(); }
        else if (ke.key === 'Enter') {
          const first = [...crumbMenu.querySelectorAll<HTMLAnchorElement>('.fe-dd-item')]
            .find(it => it.style.display !== 'none');
          if (first) location.href = first.href;
        }
      });
    } catch (err) {
      console.error('[BFB] crumb dropdown parse error:', url, err);
      if (crumbMenuUrl === url) crumbMenu.innerHTML = '<div class="fe-dd-empty">Cannot load directory</div>';
    }
  });
  document.addEventListener('click', e => {
    if (!crumbMenu.contains(e.target as Node) && !(e.target as HTMLElement).classList.contains('fe-crumb-dd'))
      closeCrumbMenu();
  });
}
