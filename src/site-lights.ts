// Lights: a dark mode for ordinary websites. Native turns on the site's own dark
// theme, Smart rewrites its colours while keeping hues and pictures, Invert flips
// the page with a filter, and Auto picks between them. The choice is kept per
// site in chrome.storage. docs/site-plugins.md has the full account.

import { isDark, mapValue, parseColor, roleForProperty } from './site-lights-color';
import { collectSelectors, findThemeHooks, nativeCss, oppositeClasses, smartCss, type ImportReader, type ThemeHook } from './site-lights-sheets';

import { LIGHTS_KEY, LIGHTS_MODES, readSettings, type LightsMode, type LightsSettings } from './site-lights-settings';

export { LIGHTS_MODES, type LightsMode };

/** What the page is showing now, for the panel and the menu. */
export interface LightsState {
  /** The mode chosen for this site, or inherited from the default. */
  mode: LightsMode;
  /** Whether that choice is this site's own or the default's. */
  fromDefault: boolean;
  /** What is actually applied; Auto resolves to one of the others. */
  applied: Exclude<LightsMode, 'auto'>;
  /** One line on why, such as "The page is already dark". */
  note: string;
}

const STYLE_ID = 'bfb-lights-style';
const READY = 'data-bfb-lights-ready';
const OVERLAY_SELECTOR = '[data-bfb-overlay]';
const FLIP = 'invert(1) hue-rotate(180deg)';
const DARK_CANVAS = 'rgb(24, 25, 27)';
const LIGHT_TEXT = 'rgb(226, 226, 222)';

// ---- Settings ----

let settings: LightsSettings = { default: 'off', sites: {} };
const host = location.hostname;

const chosenMode = (): LightsMode => settings.sites[host] ?? settings.default;

/** Save a mode for this site, or for every site without its own choice. */
export async function setLightsMode(mode: LightsMode, scope: 'site' | 'default' = 'site'): Promise<void> {
  const next = readSettings(settings);
  if (scope === 'default') {
    next.default = mode;
    // This site now follows the default it just set.
    delete next.sites[host];
  } else if (mode === next.default) delete next.sites[host];
  else next.sites[host] = mode;
  settings = next;
  await chrome.storage.local.set({ [LIGHTS_KEY]: next });
  await apply();
}

/**
 * Switch dark on or off for this site. Turning on picks Auto, or Smart when Auto
 * had left an already-dark page alone and the owner still asked for dark.
 */
export function toggleLights(): Promise<void> {
  if (state.applied !== 'off') return setLightsMode('off');
  return setLightsMode(chosenMode() === 'auto' ? 'smart' : 'auto');
}

// ---- Applying ----

let state: LightsState = { mode: 'off', fromDefault: true, applied: 'off', note: '' };
const listeners = new Set<(s: LightsState) => void>();
export const lightsState = () => state;
export function onLightsChange(fn: (s: LightsState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setState(applied: LightsState['applied'], note: string) {
  const mode = chosenMode();
  state = { mode, fromDefault: !(host in settings.sites), applied, note };
  document.documentElement.setAttribute('data-bfb-lights', applied);
  for (const fn of listeners) fn(state);
}

function styleEl(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
  }
  // Last in the document, so the copy wins over the rules it was made from.
  if (el !== document.documentElement.lastElementChild) document.documentElement.append(el);
  return el;
}

let generation = 0;

async function apply(): Promise<void> {
  const run = ++generation;
  const mode = chosenMode();  stopSmart();
  clearHooks();
  if (mode === 'off') {
    document.getElementById(STYLE_ID)?.remove();
    setState('off', '');
    return;
  }
  if (mode === 'invert') { applyInvert(); return; }
  await sheetsSettled();
  if (run !== generation) return;
  if (mode === 'auto') {
    if (pageIsDark()) {
      document.getElementById(STYLE_ID)?.remove();
      setState('off', 'The page is already dark');
      return;
    }
    const native = await nativeAvailable();
    if (run !== generation) return;
    if (native && await applyNative(run, 'This site has its own dark theme')) return;
    if (run !== generation) return;
    await applySmart(run, native ? 'The site\'s dark theme did not take, so its colours are rewritten' : 'The site has no dark theme, so its colours are rewritten');
    return;
  }
  if (mode === 'native') {
    const native = await nativeAvailable();
    if (native && await applyNative(run, 'Using the site\'s own dark theme')) return;
    if (run !== generation) return;
    await applySmart(run, native ? 'The site\'s dark theme did not take, so Smart is used' : 'This site has no dark theme of its own, so Smart is used');
    return;
  }
  await applySmart(run, 'Colours rewritten, pictures untouched');
}

/** Once the page is past its first paint, take over from the early stylesheet. */
function markReady() {
  document.documentElement.setAttribute(READY, '');
}

/** Whether the page as it stands paints dark: its background, else its canvas and text. */
function looksDark(): boolean {
  const root = document.documentElement;
  for (const el of [document.body, root]) {
    if (!el) continue;
    const col = parseColor(getComputedStyle(el).backgroundColor);
    if (col && col.a > 0.5) return isDark(col);
  }
  // No background set: light text gives a dark page away, and dark text a light
  // one, whatever the canvas does. Only with no body to read does color-scheme decide.
  const text = document.body && parseColor(getComputedStyle(document.body).color);
  // Mid-grey body text (Hacker News's #828282 sits at 0.6) says nothing either way.
  if (text) return text.l > 0.75;
  return getComputedStyle(root).colorScheme.trim() === 'dark';
}

/** Whether the page paints itself dark already, measured past the early stylesheet and ours. */
function pageIsDark(): boolean {
  const root = document.documentElement;
  const had = root.getAttribute(READY);
  root.setAttribute(READY, 'measuring');
  const ours = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (ours) ours.disabled = true;
  try {
    return looksDark();
  } finally {
    if (ours) ours.disabled = false;
    if (had == null) root.removeAttribute(READY); else root.setAttribute(READY, had);
  }
}

/** Resolves once the page's head stylesheets have loaded, or after a short wait. */
function sheetsSettled(): Promise<void> {
  return new Promise(resolve => {
    const started = performance.now();
    const check = () => {
      const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')];
      const loaded = links.every(l => l.sheet || l.disabled || l.dataset.bfbFailed);
      if ((document.body && loaded) || document.readyState !== 'loading' || performance.now() - started > 700) resolve();
      else requestAnimationFrame(check);
    };
    check();
  });
}

// ---- Invert ----

function applyInvert() {
  const pictures = 'img:not(picture img),picture,video,canvas,iframe,embed,object,svg image,[style*="url("]';
  const bg = bgImageSelectors.length ? `,${bgImageSelectors.join(',')}` : '';
  styleEl().textContent =
    `html{filter:${FLIP}!important;background-color:#fff!important}` +
    `:is(${pictures}${bg}){filter:${FLIP}!important}` +
    `:is(${pictures}) :is(${pictures}){filter:none!important}`;
  setState('invert', 'The page is flipped and pictures flipped back');
  markReady();
  // Background pictures set by stylesheets are found once the sheets are read.
  void sheetsSettled().then(() => {
    const found = scanSelectors().bgImages.slice(0, 300);
    if (found.length && found.join() !== bgImageSelectors.join() && chosenMode() === 'invert') {
      bgImageSelectors = found;
      applyInvert();
    }
  });
}
let bgImageSelectors: string[] = [];

// ---- Reading sheets, including ones from other origins ----

const fetched = new Map<string, Promise<CSSRuleList | null>>();
const ready = new Map<string, CSSRuleList | null>();

/** Rules of a stylesheet the page may not read, fetched by the extension. */
function rulesFromUrl(url: string): CSSRuleList | null | undefined {
  if (ready.has(url)) return ready.get(url);
  if (!fetched.has(url)) {
    const job = chrome.runtime.sendMessage({ type: 'bfb-fetch-css', url })
      .then((res: { ok?: boolean; text?: string }) => {
        if (!res?.ok || typeof res.text !== 'string') return null;
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(res.text);
        return sheet.cssRules;
      })
      .catch(() => null)
      .then(rules => { ready.set(url, rules); scheduleRebuild(); return rules; });
    fetched.set(url, job);
  }
  return undefined;
}

function readable(sheet: CSSStyleSheet): CSSRuleList | null | undefined {
  try {
    return sheet.cssRules;
  } catch {
    return sheet.href ? rulesFromUrl(sheet.href) : null;
  }
}

const readImport: ImportReader = rule => {
  if (rule.styleSheet) {
    const r = readable(rule.styleSheet);
    if (r) return r;
  }
  try {
    const base = rule.parentStyleSheet?.href ?? location.href;
    return rulesFromUrl(new URL(rule.href, base).href) ?? null;
  } catch {
    return null;
  }
};

/** The page's own sheets, skipping ours and any not yet readable. */
function pageSheets(): { rules: CSSRuleList; media: string }[] {
  const out: { rules: CSSRuleList; media: string }[] = [];
  for (const sheet of [...document.styleSheets]) {
    const owner = sheet.ownerNode as Element | null;
    if (owner?.id === STYLE_ID || sheet.disabled) continue;
    const rules = readable(sheet);
    if (!rules) continue;
    const media = sheet.media?.mediaText ?? '';
    out.push({ rules, media: media === 'all' ? '' : media });
  }
  return out;
}

const wrapMedia = (css: string, media: string) => (css && media ? `@media ${media}{${css}}` : css);

function scanSelectors() {
  const selectors: string[] = [], bgImages: string[] = [];
  for (const { rules } of pageSheets()) collectSelectors(rules, readImport, selectors, bgImages);
  return { selectors, bgImages };
}

// ---- Native ----

let hooks: ThemeHook[] = [];
let hookUndo: (() => void)[] = [];
let hookWatch: MutationObserver | null = null;

/** Whether the site ships a dark theme, either as media rules or as a switch. */
async function nativeAvailable(): Promise<boolean> {
  await settleFetches();
  hooks = findThemeHooks(scanSelectors().selectors);
  return hooks.length > 0 || pageSheets().some(s => nativeCss(s.rules, readImport).length > 0);
}

/** Waits briefly for stylesheets from other origins, so the first answer is whole. */
async function settleFetches() {
  pageSheets();
  const pending = [...fetched.values()];
  if (pending.length) await Promise.race([Promise.all(pending), new Promise(r => setTimeout(r, 900))]);
}

function setHooks() {
  for (const hook of hooks) {
    const el = hook.on === 'body' ? document.body : document.documentElement;
    if (!el) continue;
    if (hook.kind === 'class') {
      if (!el.classList.contains(hook.name)) {
        el.classList.add(hook.name);
        hookUndo.push(() => el.classList.remove(hook.name));
      }
      for (const name of oppositeClasses(hook.name)) {
        if (el.classList.contains(name)) {
          el.classList.remove(name);
          hookUndo.push(() => el.classList.add(name));
        }
      }
    } else if (el.getAttribute(hook.name) !== hook.value) {
      const was = el.getAttribute(hook.name);
      el.setAttribute(hook.name, hook.value!);
      hookUndo.push(() => (was == null ? el.removeAttribute(hook.name) : el.setAttribute(hook.name, was)));
    }
  }
}

function clearHooks() {
  hookWatch?.disconnect();
  hookWatch = null;
  for (const undo of hookUndo.reverse()) undo();
  hookUndo = [];
}

/**
 * Turns on the site's own dark theme. Returns false, leaving nothing applied,
 * when the page still looks light afterwards: dark rules can sit behind a
 * switch this cannot see, and a light page under a "dark" label is worse than Smart.
 */
async function applyNative(run: number, note: string): Promise<boolean> {
  const css = pageSheets().map(s => wrapMedia(nativeCss(s.rules, readImport), s.media)).join('');
  if (run !== generation) return true;
  styleEl().textContent = `:root{color-scheme:dark!important}${css}`;
  setHooks();
  if (!looksDark()) {
    clearHooks();
    return false;
  }
  // A framework re-rendering <html> (Next.js, theme scripts) would drop the switch.
  hookWatch = new MutationObserver(() => { hookWatch?.takeRecords(); setHooks(); });
  for (const el of [document.documentElement, document.body]) if (el) hookWatch.observe(el, { attributes: true, attributeFilter: ['class', ...hooks.filter(h => h.kind === 'attr').map(h => h.name)] });
  setState('native', note);
  markReady();
  return true;
}

// ---- Smart ----

let smartOn = false;
let inlineWatch: MutationObserver | null = null;
let sheetWatch: MutationObserver | null = null;
let poll = 0;
const inline = new Map<HTMLElement | SVGElement, { orig: string; written: string }>();
const sheetLengths = new WeakMap<CSSRuleList, number>();

const ROOT_DEFAULTS =
  `:root{color-scheme:dark!important}` +
  `:where(html){background-color:${DARK_CANVAS};color:${LIGHT_TEXT}}` +
  `:where(a:link){color:rgb(122, 170, 255)}:where(a:visited){color:rgb(190, 150, 255)}`;

async function applySmart(run: number, note: string) {
  smartOn = true;
  buildSmart();
  if (run !== generation) return;
  rewriteInline(document.querySelectorAll<HTMLElement>(OWN_COLOURS));
  setState('smart', note);
  markReady();
  watchSmart();
}

function buildSmart() {
  let css = ROOT_DEFAULTS;
  for (const s of pageSheets()) {
    css += wrapMedia(smartCss(s.rules, readImport), s.media);
    sheetLengths.set(s.rules, s.rules.length);
  }
  styleEl().textContent = css;
}

let rebuildTimer = 0;
function scheduleRebuild() {
  if (!smartOn && state.applied !== 'native') return;
  clearTimeout(rebuildTimer);
  rebuildTimer = window.setTimeout(() => {
    if (smartOn) buildSmart();
    else if (state.applied === 'native') void apply();
  }, 80);
}

// Attribute, the style property it becomes, its role, and the only tag it means that on.
const LEGACY: [string, string, 'bg' | 'text', string | null][] = [
  ['bgcolor', 'background-color', 'bg', null], ['color', 'color', 'text', 'FONT'], ['text', 'color', 'text', 'BODY'],
];
const OWN_COLOURS = '[style],[bgcolor],font[color],body[text]';

/** Moves the colours in elements' own style attributes, remembering the original. */
function rewriteInline(els: Iterable<HTMLElement | SVGElement>) {
  for (const el of els) {
    if (el.closest?.(OVERLAY_SELECTOR)) continue;
    const attr = el.getAttribute('style') ?? '';
    const seen = inline.get(el);
    if (seen && attr === seen.written) continue;
    const orig = attr;
    // Old HTML colour attributes (Hacker News's tables) become inline styles first.
    for (const [name, prop, role, tag] of LEGACY) {
      if (tag && el.tagName !== tag) continue;
      const value = el.getAttribute(name);
      if (!value || el.style.getPropertyValue(prop)) continue;
      const moved = mapValue(value, role) ?? (/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value) ? mapValue(`#${value}`, role) : null);
      if (moved) el.style.setProperty(prop, moved);
    }
    for (let i = 0; i < el.style.length; i++) {
      const prop = el.style[i];
      const role = roleForProperty(prop);
      if (!role) continue;
      const value = el.style.getPropertyValue(prop);
      if (/url\(/i.test(value)) continue;
      const moved = mapValue(value, role);
      if (moved) el.style.setProperty(prop, moved, el.style.getPropertyPriority(prop));
    }
    inline.set(el, { orig, written: el.getAttribute('style') ?? '' });
  }
}

function watchSmart() {
  inlineWatch = new MutationObserver(records => {
    const els = new Set<HTMLElement | SVGElement>();
    for (const r of records) {
      if (r.type === 'attributes') els.add(r.target as HTMLElement);
      else for (const n of r.addedNodes) {
        if (!(n instanceof Element)) continue;
        if (n.matches(OWN_COLOURS)) els.add(n as HTMLElement);
        for (const child of n.querySelectorAll<HTMLElement>(OWN_COLOURS)) els.add(child);
        if (n.matches('style,link[rel~="stylesheet"]') || n.querySelector('style,link[rel~="stylesheet"]')) scheduleRebuild();
      }
    }
    if (els.size) rewriteInline(els);
  });
  inlineWatch.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'bgcolor', 'color', 'text'] });
  // <style> text edited in place, as some CSS-in-JS libraries do.
  sheetWatch = new MutationObserver(scheduleRebuild);
  for (const s of document.querySelectorAll('style')) if (s.id !== STYLE_ID) sheetWatch.observe(s, { characterData: true, childList: true, subtree: true });
  // Rules added with insertRule raise no event, so their count is checked now and then.
  poll = window.setInterval(() => {
    if (document.hidden) return;
    for (const s of pageSheets()) if (sheetLengths.get(s.rules) !== s.rules.length) { scheduleRebuild(); return; }
  }, 1500);
}

function stopSmart() {
  smartOn = false;
  inlineWatch?.disconnect();
  sheetWatch?.disconnect();
  inlineWatch = sheetWatch = null;
  clearInterval(poll);
  clearTimeout(rebuildTimer);
  for (const [el, { orig, written }] of inline) {
    // Leave an element alone if the page has since rewritten its style itself.
    if (el.isConnected && el.getAttribute('style') === written) {
      if (orig) el.setAttribute('style', orig); else el.removeAttribute('style');
    }
  }
  inline.clear();
}

// ---- Start ----

let started = false;

/** Starts Lights on this page: reads the saved choice and follows later changes. */
export async function startLights(): Promise<void> {
  if (started) return;
  started = true;
  // A late stylesheet triggers a Native or Smart rebuild once it loads.
  document.addEventListener('load', e => { if ((e.target as Element)?.matches?.('link[rel~="stylesheet"]')) scheduleRebuild(); }, true);
  document.addEventListener('error', e => {
    const t = e.target as HTMLLinkElement;
    if (t?.matches?.('link[rel~="stylesheet"]')) t.dataset.bfbFailed = '1';
  }, true);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[LIGHTS_KEY]) return;
    const before = chosenMode();
    settings = readSettings(changes[LIGHTS_KEY].newValue);
    if (chosenMode() !== before) void apply();
    else setState(state.applied, state.note);
  });
  try {
    settings = readSettings((await chrome.storage.local.get(LIGHTS_KEY))[LIGHTS_KEY]);
  } catch { /* storage unreadable: stay off */ }
  await apply();
  markReady();
}
