// bfb on the phone: the Settings switch that puts this Mac's folders on the
// tailnet, the link a toolbar button copies for any file or folder, and the
// copy of the Mac's settings the phone starts from. The phone build itself is
// web.ts; its server is native/web_server.py.
import { notes, type PhoneState } from './notes';
import { kvGet, kvSet, kvKeys, onKvChange } from './kv';
import { copyToClipboard, esc } from './utils';
import { errorText } from './errors';

const URL_KEY = 'bfb-phone-url';
const ON_KEY = 'bfb-phone-on';
/** Whether this page is the phone build rather than the extension. */
export const onPhone = (): boolean => /^https?:$/.test(location.protocol);

/** A file's or folder's address on the phone, or '' while phone access is off. */
export function phoneLink(path: string): string {
  const base = onPhone() ? location.origin : (kvGet(ON_KEY) === '1' ? kvGet(URL_KEY) || '' : '');
  return base ? base + path.split('/').map(encodeURIComponent).join('/') : '';
}

/** Copy a path's phone link, or say how to get one. */
export async function copyPhoneLink(path: string, toast: (m: string) => void): Promise<void> {
  const url = phoneLink(path);
  if (!url) { toast('Turn on "Open on my phone" in Settings, Data, to get a phone link'); return; }
  toast(await copyToClipboard(url) ? 'Phone link copied' : 'Copy failed');
}

// The Mac is the phone's source of settings: send them when access turns on,
// on each page while it is on, and a moment after any setting changes.
let seedT = 0;
function pushSeed(): void {
  if (onPhone() || kvGet(ON_KEY) !== '1') return;
  clearTimeout(seedT);
  seedT = window.setTimeout(() => {
    const kv: Record<string, string> = {};
    for (const k of kvKeys()) { const v = kvGet(k); if (v != null) kv[k] = v; }
    void notes.phoneSeed(kv).catch(() => { /* the host is missing: the phone keeps its last copy */ });
  }, 1500);
}
export function initPhoneSeed(): void {
  if (onPhone()) return;
  pushSeed();
  onKvChange(pushSeed);
}

/** The top bar's phone button copies this page's link; each Saved row's copies the row's. */
export function initPhoneButtons(currentPath: string, toast: (m: string) => void): void {
  document.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    if (t.closest('#fe-phone-btn')) { e.preventDefault(); void copyPhoneLink(currentPath, toast); return; }
    const row = t.closest<HTMLElement>('.fe-phone-row-btn');
    if (row?.dataset.path) { e.preventDefault(); e.stopPropagation(); void copyPhoneLink(row.dataset.path.split('#')[0], toast); }
  }, true);
}

/** Bind the Settings card; returns the function that rereads the state when Settings opens. */
export function initPhoneSettings(toast: (m: string) => void): () => void {
  const sw = document.getElementById('fe-st-phone') as HTMLInputElement | null;
  const out = document.getElementById('fe-st-phone-url');
  const hint = document.getElementById('fe-st-phone-hint');
  const copy = document.getElementById('fe-st-phone-copy') as HTMLButtonElement | null;
  if (!sw || !out || !hint) return () => {};
  if (onPhone()) {
    // On the phone itself the switch would turn off the page you are reading.
    sw.closest('.fe-set-group')?.setAttribute('hidden', '');
    return () => {};
  }
  const show = (s: PhoneState | null, err?: unknown) => {
    sw.disabled = false;
    sw.checked = !!s?.on;
    kvSet(ON_KEY, s?.on ? '1' : '0');
    if (s?.url) kvSet(URL_KEY, s.url);
    out.innerHTML = s?.on && s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https:\/\//, ''))}</a>` : '<span>Off</span>';
    if (copy) copy.disabled = !(s?.on && s.url);
    hint.textContent = err ? errorText(err, 'Phone access')
      : s?.why ? s.why
      : s?.on ? 'Open the link on any device signed in to your tailnet. Nobody else can reach it.'
      : s?.server && !s.served ? 'The server is running but not on the tailnet yet; switch on again.'
      : 'Shows this Mac’s folders, files and comments to your own devices on the tailnet.';
    if (s?.on) pushSeed();
  };
  const refresh = () => { void notes.phone('status').then(s => show(s), e => show(null, e)); };
  sw.addEventListener('change', () => {
    const want = sw.checked;
    sw.disabled = true;
    hint.textContent = want ? 'Starting the phone server…' : 'Turning it off…';
    void notes.phone(want ? 'on' : 'off').then(s => { show(s); toast(s.on ? 'bfb is on your tailnet' : 'Phone access is off'); }, e => { show(null, e); toast(errorText(e, 'Phone access')); });
  });
  copy?.addEventListener('click', () => { const u = kvGet(URL_KEY); if (u) void copyToClipboard(u).then(ok => toast(ok ? 'Link copied' : 'Copy failed')); });
  return refresh;
}
