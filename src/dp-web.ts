// A decision page outside the extension: gcc's page server serves this bundle
// at /dp-assets/dp-web.js and a one-line shell at /dp/<slug>/, so a page opened
// over http (another device on the tailnet) is drawn by the same view, cards
// and answer panel as in bfb. Everything is read and sent by relative or
// same-origin URL; no host is written into the page.
import { CSS } from './styles';
import { UI_CSS } from './styles-ui';
import { decisionPageView } from './dp-page';
import { setDpIo, type DpVerb } from './dp-io';
import { NotesError } from './notes';
import { makeToast } from './toast';
import { bind, listenForKeys, setContext, runCommand } from './commands';
import { themeMode, setThemeMode, followSystem } from './theme';
import { textPref } from './storage';
import { markDocView } from './docview';
import { esc } from './utils';
import { UI_ICON, line } from './control-icons';
import { KEYMAP } from './keymap';
import { openLayer } from './layer';

// The same moon the bfb toolbar draws for "switch to dark".
const MOON = line('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>');

/** The keys a decision page answers, as the key map lists them, plus the help and theme keys. */
export const pageKeys = () => KEYMAP.filter(d => d.group === 'Decision page' || d.id === 'keys');

// Only what this page needs beyond the shared styles: a full-window page with
// no shell around it, and no buttons for things only the extension can do.
const WEB_CSS = `html,body{margin:0;height:100%;background:var(--bg)}#fe.fe-dp-web{position:fixed;inset:0;display:flex}
.fe-dp-web #fe-main{flex:1;min-width:0}
.fe-dp-web [data-docview-files],.fe-dp-web [data-img="open"],.fe-dp-web [data-img="copy"]{display:none}
.fe-dp-web .fe-dp-titlebar .fe-dp-title{flex:1}
.fe-dp-web-keys{min-width:300px;padding:var(--sp-4) var(--sp-5);font-size:var(--fs-sm)}
.fe-dp-web-keys-h{margin:0 0 var(--sp-3);font-weight:600;color:var(--tx)}
.fe-dp-web-key{display:flex;justify-content:space-between;gap:var(--sp-6);padding:var(--sp-1) 0;color:var(--mt)}
.fe-dp-web-key kbd{font-family:var(--mono);font-size:var(--fs-xs);padding:0 var(--sp-2);border:1px solid var(--bd);border-radius:var(--r-xs);color:var(--tx)}
.fe-dp-web-fail{max-width:640px;margin:15vh auto;padding:0 var(--sp-6);color:var(--mt)}`;

/** The page's name from its address, /dp/<slug>/. */
export const slugFromPath = (p: string): string | null => /^\/dp\/([a-z0-9][a-z0-9._-]{0,80})\/?$/.exec(p)?.[1] ?? null;

const code = (status: number) => (status === 409 ? 'dp_conflict' : 'dp_failed');

async function post(route: string, body: unknown): Promise<Record<string, unknown>> {
  let r: Response;
  try {
    r = await fetch(route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new NotesError('dp_unavailable', "gcc's page server is not answering; nothing was written");
  }
  const j = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok) throw new NotesError(code(r.status), typeof j.error === 'string' ? j.error : `the server answered ${r.status}`);
  return j;
}

// The server answers a submit at once and wakes the asker after, as gcc's own
// command does: wait for a .notify.json written by this submit, up to 12 seconds.
async function notifyAfter(since: number): Promise<unknown> {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('.notify.json', { cache: 'no-store' });
      if (r.ok) { const n = await r.json() as { at?: string }; if (n.at && Date.parse(n.at) >= since) return n; }
    } catch { /* not there yet */ }
    await new Promise(res => setTimeout(res, 200));
  }
  return null;
}

async function dp(verb: DpVerb, slug: string, payload?: unknown): Promise<unknown> {
  const s = encodeURIComponent(slug);
  const p = (payload ?? {}) as { answer?: string; replace?: boolean };
  if (verb === 'compose') return { answer: (await post(`/api/dp-compose/${s}`, { state: payload ?? null })).answer };
  if (verb === 'parse') return (await post(`/api/dp-parse/${s}`, { answer: p.answer ?? '' })).state;
  if (verb === 'seen') return post(`/api/dp-seen/${s}`, {});
  const since = Date.now() - 1000;
  const body = await post(`/api/dp-submit/${s}`, { answer: p.answer ?? '', replace: p.replace === true, via: 'page' });
  return { ...body, notify: await notifyAfter(since) };
}

async function start(): Promise<void> {
  document.head.insertAdjacentHTML('beforeend', '<meta name="viewport" content="width=device-width,initial-scale=1">');
  const style = document.createElement('style');
  style.textContent = CSS + UI_CSS + WEB_CSS;
  document.head.appendChild(style);
  document.body.innerHTML = '<div id="fe" class="fe-dp-page fe-dp-web"><main id="fe-main"><div id="fe-dp"></div></main><div id="fe-toast"></div></div>';
  const fe = document.getElementById('fe')!, box = document.getElementById('fe-dp')!;
  // gcc's pages share one dark and light choice under kanban-theme; this page follows it and keeps it.
  const kanbanPref = textPref('kanban-theme');
  const kanbanTheme = (): 'dark' | 'light' | null => { const t = kanbanPref.get(); return t === 'dark' || t === 'light' ? t : null; };
  setThemeMode(fe, kanbanTheme() ?? themeMode(), false);
  followSystem(fe);
  const toast = makeToast(document.getElementById('fe-toast')!);
  const fail = (msg: string) => { box.innerHTML = `<p class="fe-dp-web-fail">${esc(msg)}</p>`; };

  const slug = slugFromPath(location.pathname);
  if (!slug) { fail('This address is not a decision page. Pages live at /dp/<name>/.'); return; }
  setDpIo({
    text: url => fetch(url, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.text(); }),
    exists: url => fetch(url, { cache: 'no-store' }).then(r => r.ok, () => false),
    dp,
    // gcc's boards are served on its loopback listener only, so over the tailnet there is nothing to link to.
    server: ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname) ? '' : null,
  });
  // The page's own keys work everywhere on it; a field keeps its typing.
  setContext(() => {
    const ae = document.activeElement as HTMLElement | null;
    return { scopes: new Set(['any', 'decision']), typing: !!ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT' && (ae as HTMLInputElement).type === 'text' || ae.isContentEditable), blocked: false };
  });
  listenForKeys();
  bind('theme', () => {
    const next = fe.dataset.theme === 'dark' ? 'light' : 'dark';
    setThemeMode(fe, next);
    kanbanPref.set(next);
  });

  const base = new URL('.', location.href).href;
  const ok = await Promise.resolve(decisionPageView.mount({ root: box, base, path: location.pathname, toast: m => toast(m), slug })).catch(() => false);
  if (!ok) { fail('This page could not be drawn: its config.json is missing or is not a decision page.'); return; }
  markDocView(box, decisionPageView.id);
  document.title = box.querySelector('.fe-dp-title')?.textContent || 'Decision page';
  // There is no bfb toolbar here, so the dark and light switch sits by the title.
  const sw = document.createElement('button');
  sw.type = 'button'; sw.id = 'fe-dp-web-theme'; sw.className = 'btn';
  Object.assign(sw.dataset, { variant: 'ghost', size: 'sm', icon: '' });
  const paintSw = () => {
    const dark = fe.dataset.theme === 'dark';
    sw.innerHTML = dark ? UI_ICON.appearance : MOON;
    sw.title = sw.ariaLabel = `Switch to ${dark ? 'light' : 'dark'} (t)`;
  };
  sw.addEventListener('click', () => { runCommand('theme'); paintSw(); });
  new MutationObserver(paintSw).observe(fe, { attributes: true, attributeFilter: ['data-theme'] });
  paintSw();
  // Back to every page: /dp/ answers on both of gcc's listeners, where / does not.
  const all = document.createElement('a');
  all.id = 'fe-dp-web-all'; all.className = 'btn'; all.href = '/dp/';
  Object.assign(all.dataset, { variant: 'ghost', size: 'sm' });
  all.title = 'Every decision page, waiting ones first';
  all.innerHTML = `${UI_ICON.opinion}All decisions`;
  // The page's keys, read from the key map, on ? or the button.
  const help = document.createElement('button');
  help.type = 'button'; help.id = 'fe-dp-web-help'; help.className = 'btn';
  Object.assign(help.dataset, { variant: 'ghost', size: 'sm', icon: '' });
  help.textContent = '?';
  help.title = help.ariaLabel = 'Keys on this page (?)';
  let card: ReturnType<typeof openLayer> | null = null;
  const toggleKeys = () => {
    if (card?.open) { card.close(); return; }
    const el = document.createElement('div');
    el.className = 'fe-ctx fe-dp-web-keys';
    el.innerHTML = `<p class="fe-dp-web-keys-h">Keys on this page</p>${pageKeys().map(k => `<div class="fe-dp-web-key"><span>${k.keys.map(x => `<kbd>${esc(x)}</kbd>`).join(' ')}</span><span>${esc(k.title)}</span></div>`).join('')}`;
    document.body.appendChild(el);
    card = openLayer(el, { kind: 'popover', anchor: help, place: 'below', align: 'end', label: 'Keys on this page', onClose: () => el.remove() });
  };
  help.addEventListener('click', toggleKeys);
  bind('keys', toggleKeys);
  box.querySelector('.fe-dp-titlebar')?.append(all, help, sw);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void start());
else void start();
