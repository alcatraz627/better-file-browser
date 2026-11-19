// Settings, Web pages: dark mode on websites (the default mode and each site's
// own), the keys that drive it, and the pages you have marked. Reads and writes
// the same chrome.storage values the web pages use, so a change here reaches
// every open tab at once, and a change made on a page shows here.

import { el } from './el';
import { esc } from './utils';
import { UI_ICON } from './control-icons';
import { ddHtml, upgradeControls, type Opt, type ValuedEl } from './controls';
import { emptyHtml } from './empty-state';
import { LIGHTS_KEY, LIGHTS_MODES, MODE_LABEL, MODE_TIP, hostFrom, readSettings, type LightsMode, type LightsSettings } from './site-lights-settings';

type Toast = (msg: string, ms?: number, action?: { label: string; run: () => void }) => void;

const MARKS_PREFIX = 'bfb-marks-v1:';
const MARKS_INDEX = 'bfb-marks-index-v1';

export const MODE_OPTS: Opt[] = LIGHTS_MODES.map(m => ({ value: m, label: MODE_LABEL[m], hint: MODE_TIP[m] }));

interface MarkedPage { key: string; title: string; count: number; updated: number }

const read = async (): Promise<LightsSettings> => readSettings((await chrome.storage.local.get(LIGHTS_KEY))[LIGHTS_KEY]);
const write = (s: LightsSettings) => chrome.storage.local.set({ [LIGHTS_KEY]: s });

const ago = (ms: number) => {
  const d = Date.now() - ms;
  if (d < 3_600_000) return `${Math.max(1, Math.round(d / 60_000))} min ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)} h ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** Wires the Web pages tab once; call refreshWebSettings when the dialog opens. */
export function initWebSettings(toast: Toast): () => Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return async () => {};
  const defaultCtl = el<ValuedEl>('fe-st-web-default');
  const sitesBox = el('fe-st-web-sites');
  const marksBox = el('fe-st-web-marks');
  const addInput = el<HTMLInputElement>('fe-st-web-add-host');
  const addMode = el<ValuedEl>('fe-st-web-add-mode');
  addMode.value = 'auto';

  async function renderSites() {
    const s = await read();
    defaultCtl.value = s.default;
    el('fe-st-web-default-note').textContent = s.default === 'off'
      ? 'Sites stay as they are unless you set them below, from a page\'s panel, or with Alt+Shift+D.'
      : `Every site uses ${MODE_LABEL[s.default]} unless it is listed below.`;
    const hosts = Object.keys(s.sites).sort();
    sitesBox.innerHTML = hosts.length
      ? hosts.map(h => `<div class="fe-rule fe-web-site" data-host="${esc(h)}">
          <span class="fe-web-host" title="${esc(h)}">${esc(h)}</span>
          ${ddHtml(`fe-st-web-site-${hosts.indexOf(h)}`, MODE_OPTS, `Dark mode for ${h}`)}
          <button type="button" class="btn fe-ibtn fe-web-del" data-icon data-size="sm" data-tone="danger" title="Forget ${esc(h)}: it follows the default again" aria-label="Forget ${esc(h)}">${UI_ICON.trash}</button>
        </div>`).join('')
      : emptyHtml('empty', 'No sites of their own yet', { inline: true, hint: 'Add one here, or pick a mode on any page' });
    upgradeControls(sitesBox);
    sitesBox.querySelectorAll<HTMLElement>('.fe-web-site').forEach(row => {
      (row.querySelector('.fe-dd') as ValuedEl).value = s.sites[row.dataset.host!];
    });
  }

  async function renderMarks() {
    const index = ((await chrome.storage.local.get(MARKS_INDEX))[MARKS_INDEX] ?? {}) as Record<string, Omit<MarkedPage, 'key'>>;
    const pages: MarkedPage[] = Object.entries(index).map(([key, v]) => ({ key, ...v })).sort((a, b) => b.updated - a.updated);
    const total = pages.reduce((n, p) => n + p.count, 0);
    el('fe-st-web-marks-count').textContent = pages.length ? `${total} mark${total === 1 ? '' : 's'} on ${pages.length} page${pages.length === 1 ? '' : 's'}` : '';
    marksBox.innerHTML = pages.length
      ? pages.map(p => {
        let host = p.key;
        try { host = new URL(p.key).hostname; } catch { /* keep the key */ }
        return `<div class="fe-rule fe-web-page" data-key="${esc(p.key)}">
          <a class="fe-web-title" href="${esc(p.key)}" target="_blank" rel="noopener" title="Open ${esc(p.key)}">${esc(p.title)}</a>
          <span class="fe-web-meta">${p.count} mark${p.count === 1 ? '' : 's'} · ${esc(host)} · ${ago(p.updated)}</span>
          <button type="button" class="btn fe-ibtn fe-web-forget" data-icon data-size="sm" data-tone="danger" title="Delete this page's marks" aria-label="Delete this page's marks">${UI_ICON.trash}</button>
        </div>`;
      }).join('')
      : emptyHtml('empty', 'No marks yet', { inline: true, hint: 'On any page, select words and press Alt+Shift+M' });
  }

  defaultCtl.addEventListener('change', async () => {
    const s = await read();
    s.default = defaultCtl.value as LightsMode;
    // A site whose own mode now matches the default no longer needs its own.
    for (const [h, m] of Object.entries(s.sites)) if (m === s.default) delete s.sites[h];
    await write(s);
  });

  sitesBox.addEventListener('change', async e => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.fe-web-site');
    const dd = row?.querySelector<ValuedEl>('.fe-dd');
    if (!row || !dd) return;
    const s = await read();
    s.sites[row.dataset.host!] = dd.value as LightsMode;
    await write(s);
  });

  sitesBox.addEventListener('click', async e => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.fe-web-site');
    if (!row || !(e.target as HTMLElement).closest('.fe-web-del')) return;
    const host = row.dataset.host!;
    const s = await read();
    const was = s.sites[host];
    delete s.sites[host];
    await write(s);
    toast(`${host} follows the default again`, 8000, { label: 'Undo', run: async () => { const now = await read(); now.sites[host] = was; await write(now); } });
  });

  const add = async () => {
    const host = hostFrom(addInput.value);
    if (!host) { addInput.setAttribute('aria-invalid', 'true'); addInput.title = 'Type a site such as github.com'; addInput.focus(); return; }
    addInput.removeAttribute('aria-invalid');
    const s = await read();
    s.sites[host] = addMode.value as LightsMode;
    await write(s);
    addInput.value = '';
    toast(`${host}: ${MODE_LABEL[addMode.value as LightsMode]}`);
  };
  el('fe-st-web-add').addEventListener('click', () => void add());
  addInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); void add(); } });
  addInput.addEventListener('input', () => addInput.removeAttribute('aria-invalid'));

  marksBox.addEventListener('click', async e => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.fe-web-page');
    if (!row || !(e.target as HTMLElement).closest('.fe-web-forget')) return;
    const key = row.dataset.key!;
    const got = await chrome.storage.local.get([MARKS_PREFIX + key, MARKS_INDEX]);
    const marks = got[MARKS_PREFIX + key];
    const index = (got[MARKS_INDEX] ?? {}) as Record<string, unknown>;
    const entry = index[key];
    delete index[key];
    await chrome.storage.local.remove(MARKS_PREFIX + key);
    await chrome.storage.local.set({ [MARKS_INDEX]: index });
    toast('Marks deleted', 8000, { label: 'Undo', run: async () => {
      const now = ((await chrome.storage.local.get(MARKS_INDEX))[MARKS_INDEX] ?? {}) as Record<string, unknown>;
      now[key] = entry;
      await chrome.storage.local.set({ [MARKS_PREFIX + key]: marks, [MARKS_INDEX]: now });
    } });
  });

  el('fe-st-web-shortcuts').addEventListener('click', () => void chrome.runtime.sendMessage({ type: 'bfb-open-shortcuts' }));

  // A change made on a web page, in another tab, or by Undo shows here at once.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[LIGHTS_KEY]) void renderSites();
    if (changes[MARKS_INDEX]) void renderMarks();
  });

  return async () => { await Promise.all([renderSites(), renderMarks()]); };
}
