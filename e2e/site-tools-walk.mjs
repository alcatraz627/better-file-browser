// Lights (dark mode) and Marks (comments and pins) on ordinary web pages.
//
// Two local servers stand in for websites: one serves the pages, the other a
// stylesheet from a different origin, so the path where the page cannot read a
// sheet's rules and the extension fetches it is real. Actions are sent to the
// page the way the right-click menu and the keyboard shortcuts send them; the
// menu clicks and key presses themselves are Chrome's and are not driven here.
import { createServer } from 'node:http';
import { launch, shot, store, THEME } from './harness.mjs';

const CDN_CSS = `.cdn { background-color: #fffbe6; color: #333; border: 1px solid #f0e0a0; }`;

const PAGES = {
  // A light page with no dark theme of its own: Auto should choose Smart.
  '/light': (cdn) => `<!doctype html><html><head><title>Light page</title>
<link rel="stylesheet" href="${cdn}/s.css">
<style>
  body { margin: 0; font: 16px/1.5 system-ui; background: #ffffff; color: #1f2328; }
  header { background: #111; color: #fff; padding: 12px 20px; }
  main { padding: 20px; max-width: 720px; }
  .card { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 8px; padding: 12px; margin: 12px 0; }
  .note { background: hsl(214 100% 95%); color: rgb(9, 105, 218); padding: 8px; }
  a { color: #0969da; }
  :root { --surface: #ffffff; --text-main: #222; }
  .vars { background: var(--surface); color: var(--text-main); padding: 8px; }
</style></head><body>
<header>Site header</header>
<main>
  <h1>A light page</h1>
  <p id="para">The quick brown fox jumps over the lazy dog near the river bank.</p>
  <div class="card" id="card">A card with a pale background. <a href="#x">A link</a></div>
  <div class="note" id="note">A pale blue note.</div>
  <div class="cdn" id="cdn">Styled by a stylesheet from another origin.</div>
  <div class="vars" id="vars">Styled with CSS variables.</div>
  <div id="inline" style="background-color: #fff; color: #000; padding: 8px">An inline style.</div>
  <img id="pic" width="80" height="40" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'%3E%3Crect width='80' height='40' fill='%23e33'/%3E%3C/svg%3E">
  <p>Filler so the page scrolls.</p><div style="height: 600px"></div>
  <p id="later">A last paragraph, far down the page.</p>
</main></body></html>`,
  // A site that ships a dark theme by media query: Auto should choose Site.
  '/native': () => `<!doctype html><title>Native</title><style>
  body { background: #fff; color: #111; font: 16px system-ui; }
  @media (prefers-color-scheme: dark) { body { background: #0d1117; color: #e6edf3; } }
</style><p>Has its own dark theme.</p>`,
  // A site whose dark theme hangs off a class on <html>, as Tailwind does.
  '/hook': () => `<!doctype html><html class="light"><title>Hook</title><style>
  body { background: #fff; color: #111; } .dark body { background: #000814; color: #eee; }
  .dark p { color: #ddd; } .dark a { color: #9cf; } .dark .x { color: #fff; }
</style><p>Dark via a class.</p></html>`,
  // Old HTML colour attributes, as Hacker News uses for its page background.
  '/legacy': () => `<!doctype html><title>Legacy</title><body><table id="t" bgcolor="#f6f6ef" width="100%"><tr><td><font id="f" color="#000">Old-style page</font></td></tr></table></body>`,
  // A dark theme switched by a class on <html> with a long name, as Wikipedia does.
  '/wiki': () => `<!doctype html><html class="skin-theme-clientpref-day"><title>Wiki</title><style>
  body { background: #f8f9fa; color: #202122; }
  html.skin-theme-clientpref-night body { background: #101418; color: #eaecf0; }
  html.skin-theme-clientpref-night .a { color: #88a3e8; } html.skin-theme-clientpref-night .b { color: #fff; }
  .btn-dark { color: #000; } .btn-dark:hover { color: #111; } .btn-dark span { color: #222; }
</style><p class="a">Wiki-like.</p></html>`,
  // Dark rules the page never turns on (a class that is not there): Site must fall back.
  '/gated': () => `<!doctype html><title>Gated</title><style>
  body { background: #fff; color: #111; }
  @media (prefers-color-scheme: dark) { html.os-pref body { background: #000; color: #fff; } }
</style><p>Gated dark rules.</p>`,
  // Already dark: Auto should leave it alone.
  '/dark': () => `<!doctype html><title>Dark</title><style>body { background: #121212; color: #ddd; }</style><p>Already dark.</p>`,
};

function serve(handler) {
  return new Promise(resolve => {
    const s = createServer(handler);
    s.listen(0, '127.0.0.1', () => resolve({ server: s, port: s.address().port }));
  });
}

const cdn = await serve((req, res) => {
  res.writeHead(200, { 'content-type': 'text/css' });
  res.end(CDN_CSS);
});
const CDN = `http://localhost:${cdn.port}`;
const site = await serve((req, res) => {
  const page = PAGES[req.url.split('?')[0]];
  res.writeHead(page ? 200 : 404, { 'content-type': 'text/html' });
  res.end(page ? page(CDN) : 'not found');
});
const ORIGIN = `http://127.0.0.1:${site.port}`;

const { browser, close, sw } = await launch();
// BFB_THEME=light shows bfb's own pages (Settings) in the light theme.
if (THEME === 'light') await store.set('bfb-theme', 'light');
let failed = 0;
const check = (name, ok, got) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got: ${JSON.stringify(got)}`}`);
  if (!ok) failed++;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The lightness (0 to 1) of an element's computed colour, in the page.
const LUM = `(css) => { const m = css.match(/[\\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); }`;
const colours = page => page.evaluate(lum => {
  const L = eval(lum);
  const get = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
  const out = {};
  for (const sel of ['body', '#card', '#note', '#cdn', '#vars', '#inline', 'header']) {
    if (!document.querySelector(sel)) continue;
    out[sel] = { bg: L(get(sel, 'backgroundColor')), fg: L(get(sel, 'color')) };
  }
  return out;
}, LUM);

const send = (action, extra = {}) => sw.evaluate(async (origin, action, extra) => {
  const tabs = await chrome.tabs.query({});
  const tab = tabs.find(t => t.url?.startsWith(origin));
  return chrome.tabs.sendMessage(tab.id, { type: 'bfb-site-tools', action, ...extra });
}, ORIGIN, action, extra);
const setLights = value => sw.evaluate(v => chrome.storage.local.set({ 'bfb-lights-v1': v }), value);
const lightsOf = page => page.evaluate(() => document.documentElement.getAttribute('data-bfb-lights'));
const waitLights = (page, want) => page.waitForFunction(w => document.documentElement.getAttribute('data-bfb-lights') === w, { timeout: 8000 }, want);
const shadow = (page, fn, ...args) => page.evaluate((src, ...a) => {
  const root = document.getElementById('bfb-site-tools')?.shadowRoot;
  return new Function('root', ...a.map((_, i) => `a${i}`), src)(root, ...a);
}, fn, ...args);

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 760 });
  // The machine running the walk may be in dark mode, which would make the
  // stand-in sites dark already; Lights is for a light system.
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  page.on('pageerror', e => check(`no page error (${e.message})`, false));

  // ---- Lights off: the page is untouched ----
  await page.goto(`${ORIGIN}/light`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-bfb-lights-ready'), { timeout: 5000 });
  const before = await colours(page);
  check('off by default, page stays light', (await lightsOf(page)) === 'off' && before.body.bg > 0.9, before.body);
  check('no Lights stylesheet when off', await page.evaluate(() => !document.getElementById('bfb-lights-style')), null);
  await shot(page, 'site-tools-light-off');

  // ---- Auto on a light page picks Smart ----
  await send('lights-set', { mode: 'auto' });
  await waitLights(page, 'smart');
  await sleep(300);
  const smart = await colours(page);
  check('Auto chooses Smart on a page without a dark theme', (await lightsOf(page)) === 'smart', await lightsOf(page));
  check('Smart: body goes dark', smart.body.bg < 0.06, smart.body);
  check('Smart: body text goes light', smart.body.fg > 0.55, smart.body);
  check('Smart: pale card goes dark', smart['#card'].bg < 0.08, smart['#card']);
  check('Smart: pale blue note goes dark and keeps light text', smart['#note'].bg < 0.12 && smart['#note'].fg > 0.15, smart['#note']);
  check('Smart: stylesheet from another origin is rewritten too', smart['#cdn'].bg < 0.1 && smart['#cdn'].fg > 0.4, smart['#cdn']);
  check('Smart: CSS variables are rewritten', smart['#vars'].bg < 0.1 && smart['#vars'].fg > 0.4, smart['#vars']);
  check('Smart: inline style is rewritten', smart['#inline'].bg < 0.1 && smart['#inline'].fg > 0.5, smart['#inline']);
  check('Smart: dark header stays dark with light text', smart.header.bg < 0.03 && smart.header.fg > 0.6, smart.header);
  check('Smart: pictures are not filtered', await page.evaluate(() => getComputedStyle(document.getElementById('pic')).filter === 'none'), null);
  const saved = await sw.evaluate(() => chrome.storage.local.get('bfb-lights-v1').then(r => r['bfb-lights-v1']));
  check('the choice is saved for this site only', saved?.sites?.['127.0.0.1'] === 'auto' && saved.default === 'off', saved);
  await shot(page, 'site-tools-light-smart');

  // A style written by the page's own script after Smart started is caught.
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'late'; d.style.backgroundColor = '#ffffff'; d.textContent = 'late'; document.querySelector('main').append(d); });
  await sleep(200);
  const lateBg = await page.evaluate(lum => eval(lum)(getComputedStyle(document.getElementById('late')).backgroundColor), LUM);
  check('Smart: an element added later is rewritten', lateBg < 0.1, lateBg);

  // ---- The before-first-paint stylesheet is registered for this site ----
  const regs = await sw.evaluate(() => chrome.scripting.getRegisteredContentScripts());
  const early = regs.find(r => r.id === 'bfb-lights-early-dark');
  check('early stylesheet registered for the site', !!early && early.matches.some(m => m.includes('127.0.0.1')), regs);

  // A reload paints dark from the first frame: the canvas under the early sheet is dark before Lights runs.
  await page.reload({ waitUntil: 'domcontentloaded' });
  const firstFrame = await page.evaluate(lum => eval(lum)(getComputedStyle(document.documentElement).backgroundColor), LUM);
  check('reload: canvas is dark at once (no white flash)', firstFrame < 0.06, firstFrame);
  await waitLights(page, 'smart');
  await page.waitForFunction(() => getComputedStyle(document.body).opacity === '1', { timeout: 3000 });
  check('reload: page is revealed once Lights is ready', true);

  // ---- Off restores the page exactly ----
  await send('lights-set', { mode: 'off' });
  await waitLights(page, 'off');
  await sleep(100);
  const restored = await colours(page);
  check('Off: page is light again', restored.body.bg > 0.9 && restored['#card'].bg > 0.85, restored);
  check('Off: inline style restored to what the site wrote', await page.evaluate(() => document.getElementById('inline').getAttribute('style')) === 'background-color: #fff; color: #000; padding: 8px', await page.evaluate(() => document.getElementById('inline').getAttribute('style')));
  const regsOff = await sw.evaluate(() => chrome.scripting.getRegisteredContentScripts());
  check('Off: early stylesheet unregistered', !regsOff.some(r => r.id === 'bfb-lights-early-dark'), regsOff);

  // ---- Toggle (Alt+Shift+D) turns it on and off ----
  await send('lights-toggle');
  await waitLights(page, 'smart');
  check('toggle turns dark on', true);
  await send('lights-toggle');
  await waitLights(page, 'off');
  check('toggle turns it off again', true);

  // ---- Invert ----
  await send('lights-set', { mode: 'invert' });
  await waitLights(page, 'invert');
  const inv = await page.evaluate(() => ({ html: getComputedStyle(document.documentElement).filter, pic: getComputedStyle(document.getElementById('pic')).filter }));
  check('Invert: page flipped and picture flipped back', /invert/.test(inv.html) && /invert/.test(inv.pic), inv);
  await shot(page, 'site-tools-light-invert');
  await send('lights-set', { mode: 'off' });
  await waitLights(page, 'off');

  // ---- Native: media-query dark theme ----
  await page.goto(`${ORIGIN}/native`, { waitUntil: 'load' });
  await send('lights-set', { mode: 'auto' });
  await waitLights(page, 'native');
  const nat = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('Auto uses the site\'s own dark theme (media query)', nat === 'rgb(13, 17, 23)', nat);
  await shot(page, 'site-tools-native');

  // ---- Native: class switch ----
  await page.goto(`${ORIGIN}/hook`, { waitUntil: 'load' });
  await send('lights-set', { mode: 'native' });
  await waitLights(page, 'native');
  const hook = await page.evaluate(() => ({ cls: document.documentElement.className, bg: getComputedStyle(document.body).backgroundColor }));
  check('Site mode sets the dark class and drops the light one', hook.cls === 'dark' && hook.bg === 'rgb(0, 8, 20)', hook);
  // A framework putting its own class back is answered.
  await page.evaluate(() => { document.documentElement.className = 'light'; });
  await sleep(100);
  check('the dark switch survives the page resetting <html>', await page.evaluate(() => document.documentElement.classList.contains('dark')), null);
  await send('lights-set', { mode: 'off' });
  await waitLights(page, 'off');
  check('Off: the page\'s own class comes back', await page.evaluate(() => document.documentElement.className) === 'light', await page.evaluate(() => document.documentElement.className));

  // ---- Wikipedia-style class switch ----
  await page.goto(`${ORIGIN}/wiki`, { waitUntil: 'load' });
  await send('lights-set', { mode: 'auto' });
  await waitLights(page, 'native');
  const wiki = await page.evaluate(() => ({ cls: document.documentElement.className, bg: getComputedStyle(document.body).backgroundColor }));
  check('a long-named night class is found and turned on, day class off', wiki.cls === 'skin-theme-clientpref-night' && wiki.bg === 'rgb(16, 20, 24)', wiki);
  await send('lights-set', { mode: 'off' });
  await waitLights(page, 'off');

  // ---- Dark rules the page never reaches: fall back to Smart ----
  await page.goto(`${ORIGIN}/gated`, { waitUntil: 'load' });
  await send('lights-set', { mode: 'native' });
  await waitLights(page, 'smart');
  const gated = await page.evaluate(lum => eval(lum)(getComputedStyle(document.body).backgroundColor), LUM);
  check('Site mode falls back to Smart when the dark theme does not take', gated < 0.06, gated);
  await send('lights-set', { mode: 'off' });
  await waitLights(page, 'off');

  // ---- Old HTML colour attributes ----
  await page.goto(`${ORIGIN}/legacy`, { waitUntil: 'load' });
  await send('lights-set', { mode: 'smart' });
  await waitLights(page, 'smart');
  const legacy = await page.evaluate(lum => { const L = eval(lum); return { t: L(getComputedStyle(document.getElementById('t')).backgroundColor), f: L(getComputedStyle(document.getElementById('f')).color) }; }, LUM);
  check('Smart: bgcolor and font colour attributes are rewritten', legacy.t < 0.06 && legacy.f > 0.55, legacy);
  await send('lights-set', { mode: 'off' });
  await waitLights(page, 'off');
  check('Off: the attribute page is back as it was', await page.evaluate(() => !document.getElementById('t').hasAttribute('style') && !document.getElementById('f').hasAttribute('style')), null);

  // ---- Already dark ----
  await page.goto(`${ORIGIN}/dark`, { waitUntil: 'load' });
  await send('lights-set', { mode: 'auto' });
  await page.waitForFunction(() => document.getElementById('bfb-lights-style') === null && document.documentElement.getAttribute('data-bfb-lights') === 'off', { timeout: 5000 });
  check('Auto leaves an already-dark page alone', await page.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(18, 18, 18)', null);
  await send('lights-set', { mode: 'off' });

  // ---- Marks: a comment on selected words ----
  await page.goto(`${ORIGIN}/light`, { waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-bfb-lights-ready'));
  const select = (id, word) => page.evaluate((id, word) => {
    const t = document.getElementById(id).firstChild;
    const at = t.data.indexOf(word);
    const r = document.createRange();
    r.setStart(t, at); r.setEnd(t, at + word.length);
    getSelection().removeAllRanges(); getSelection().addRange(r);
  }, id, word);
  await select('para', 'brown fox');
  await send('mark');
  await page.waitForFunction(() => document.getElementById('bfb-site-tools')?.shadowRoot?.querySelector('.card textarea'), { timeout: 3000 });
  check('comment card opens with the quoted words', (await shadow(page, `return root.querySelector('.card .quote')?.textContent`)) === 'brown fox', null);
  await page.keyboard.type('Check this fox');
  await shot(page, 'site-tools-comment-card');
  await page.keyboard.down('Meta'); await page.keyboard.press('Enter'); await page.keyboard.up('Meta');
  await sleep(200);
  const key = `bfb-marks-v1:${ORIGIN}/light`;
  let stored = await sw.evaluate(k => chrome.storage.local.get(k).then(r => r[k]), key);
  check('comment saved with its words and note', stored?.length === 1 && stored[0].quote.exact === 'brown fox' && stored[0].note === 'Check this fox', stored);
  check('words are highlighted', await page.evaluate(() => CSS.highlights.get('bfb-mark')?.size === 1), null);
  check('a badge sits by the words', await shadow(page, `return root.querySelectorAll('.badge').length`) === 1, null);

  // Typed then closed with Esc: the words are kept, not lost.
  await select('para', 'lazy dog');
  await send('comment');
  await page.waitForFunction(() => document.getElementById('bfb-site-tools')?.shadowRoot?.querySelector('.card textarea'));
  await page.keyboard.type('Esc keeps me');
  await page.keyboard.press('Escape');
  await sleep(150);
  stored = await sw.evaluate(k => chrome.storage.local.get(k).then(r => r[k]), key);
  check('Esc on a typed comment keeps it', stored?.length === 2 && stored[1].note === 'Esc keeps me', stored?.map(m => m.note));

  // A new comment closed with nothing typed is dropped.
  await select('later', 'last paragraph');
  await send('comment');
  await page.waitForFunction(() => document.getElementById('bfb-site-tools')?.shadowRoot?.querySelector('.card textarea'));
  await page.keyboard.press('Escape');
  await sleep(150);
  stored = await sw.evaluate(k => chrome.storage.local.get(k).then(r => r[k]), key);
  check('an empty new comment is dropped on close', stored?.length === 2, stored?.length);

  // ---- Comments come back after a reload, and survive the page changing ----
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => CSS.highlights.get('bfb-mark')?.size === 2, { timeout: 4000 });
  check('comments come back after a reload', true);
  await page.evaluate(() => { const p = document.createElement('p'); p.textContent = 'A new line also about a brown fox, added above.'; document.querySelector('main').prepend(p); });
  await sleep(700);
  const anchored = await page.evaluate(() => [...CSS.highlights.get('bfb-mark')].map(r => ({ text: r.toString(), inPara: document.getElementById('para').contains(r.startContainer) })));
  check('a comment stays on its own words when the same phrase is added above', anchored.some(a => a.text === 'brown fox' && a.inPara) && anchored.length === 2, anchored);

  // Clicking highlighted words opens their comment.
  const foxBox = await page.evaluate(() => { const r = [...CSS.highlights.get('bfb-mark')].find(x => x.toString() === 'brown fox').getBoundingClientRect(); return { x: r.left + 10, y: r.top + r.height / 2 }; });
  await page.mouse.click(foxBox.x, foxBox.y);
  await sleep(150);
  check('clicking highlighted words opens the comment', (await shadow(page, `return root.querySelector('.card textarea')?.value`)) === 'Check this fox', null);
  await page.keyboard.press('Escape');

  // ---- Pins ----
  const cardBox = await page.evaluate(() => { const r = document.getElementById('card').getBoundingClientRect(); return { x: r.left + 100, y: r.top + 10 }; });
  await send('mark');
  await page.waitForFunction(() => document.getElementById('bfb-site-tools')?.shadowRoot?.querySelector('.veil'));
  check('with nothing selected, the mark key asks where to pin', (await shadow(page, `return root.querySelector('.hint')?.textContent`))?.startsWith('Click where'), null);
  await page.mouse.click(cardBox.x, cardBox.y);
  await page.waitForFunction(() => document.getElementById('bfb-site-tools')?.shadowRoot?.querySelector('.card textarea'));
  await page.keyboard.type('Pinned on the card');
  await page.keyboard.down('Meta'); await page.keyboard.press('Enter'); await page.keyboard.up('Meta');
  await sleep(200);
  stored = await sw.evaluate(k => chrome.storage.local.get(k).then(r => r[k]), key);
  const pin = stored?.find(m => m.kind === 'pin');
  check('pin saved on the element under it', pin?.pin?.selector?.includes('#card') && pin.note === 'Pinned on the card', pin);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('bfb-site-tools')?.shadowRoot?.querySelector('.pin'), { timeout: 4000 });
  // The paragraph added earlier is gone after the reload, so the card sits higher; the pin follows it.
  const pinAt = await shadow(page, `const r = root.querySelector('.pin').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom }`);
  const cardNow = await page.evaluate(() => { const r = document.getElementById('card').getBoundingClientRect(); return { x: r.left + 100, y: r.top + 10 }; });
  check('pin comes back on the same spot of its element', Math.abs(pinAt.x - cardNow.x) < 20 && Math.abs(pinAt.y - cardNow.y) < 12, { pinAt, cardNow });

  // Dragging moves it to another element.
  const noteBox = await page.evaluate(() => { const r = document.getElementById('note').getBoundingClientRect(); return { x: r.left + 60, y: r.top + 12 }; });
  const grip = await shadow(page, `const r = root.querySelector('.pin').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`);
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(noteBox.x, noteBox.y, { steps: 6 });
  await page.mouse.up();
  await sleep(200);
  stored = await sw.evaluate(k => chrome.storage.local.get(k).then(r => r[k]), key);
  check('dragging a pin moves it to the new spot', stored.find(m => m.kind === 'pin')?.pin?.selector?.includes('#note'), stored.find(m => m.kind === 'pin')?.pin);

  // ---- Panel ----
  await send('panel');
  await page.waitForFunction(() => document.getElementById('bfb-site-tools')?.shadowRoot?.querySelector('.panel'));
  check('panel lists this page\'s three marks', await shadow(page, `return root.querySelectorAll('.panel .list li[data-id]').length`) === 3, null);
  await shadow(page, `root.querySelector('.seg [data-mode="smart"]').click()`);
  await waitLights(page, 'smart');
  await sleep(250);
  check('panel switches this site to Smart', await shadow(page, `return root.querySelector('.seg [aria-pressed="true"]').dataset.mode`) === 'smart', null);
  check('panel turns dark with the page', await shadow(page, `return root.querySelector('.root').classList.contains('dark')`), null);
  await shot(page, 'site-tools-panel-smart');
  // Delete from the panel, then Undo.
  await shadow(page, `root.querySelector('.panel [data-del]').click()`);
  await sleep(150);
  stored = await sw.evaluate(k => chrome.storage.local.get(k).then(r => r[k]), key);
  check('delete from the panel removes the mark', stored.length === 2, stored.length);
  await shadow(page, `root.querySelector('.hint.undo button').click()`);
  await sleep(150);
  stored = await sw.evaluate(k => chrome.storage.local.get(k).then(r => r[k]), key);
  check('Undo brings it back', stored.length === 3, stored.length);
  await shadow(page, `root.querySelector('[data-act="all"]').click()`);
  await sleep(200);
  check('All pages lists this page', (await shadow(page, `return root.querySelector('.panel section:last-child .list a')?.getAttribute('href')`)) === `${ORIGIN}/light`, null);

  // Under Invert the panel still sits fixed in the window and reads dark.
  await shadow(page, `root.querySelector('.seg [data-mode="invert"]').click()`);
  await waitLights(page, 'invert');
  await page.evaluate(() => scrollTo(0, 400));
  await sleep(250);
  const panelTop = await shadow(page, `return root.querySelector('.panel').getBoundingClientRect().top`);
  check('Invert: panel stays fixed in the window', Math.abs(panelTop - 12) < 2, panelTop);
  // What reaches the screen is the panel's colour flipped twice (its own filter, then the page's).
  const panelLook = await shadow(page, `const p = root.querySelector('.panel'); return { dark: root.querySelector('.root').classList.contains('dark'), filter: getComputedStyle(p).filter, bg: getComputedStyle(p).backgroundColor }`);
  check('Invert: panel keeps its dark colours on screen', panelLook.dark && /invert/.test(panelLook.filter) && panelLook.bg === 'rgb(31, 31, 35)', panelLook);
  await shot(page, 'site-tools-panel-invert');
  await shadow(page, `root.querySelector('.seg [data-mode="off"]').click()`);
  await waitLights(page, 'off');
  await page.keyboard.press('Escape');
  await sleep(100);
  check('Esc closes the panel', await shadow(page, `return !root.querySelector('.panel')`), null);

  // ---- The same page open in another tab ----
  // Another tab's save lands in storage with a pin this tab has never seen.
  // This tab shows it, and this tab's next save keeps it.
  stored = await sw.evaluate(k => chrome.storage.local.get(k).then(r => r[k]), key);
  const twin = { ...stored.find(m => m.kind === 'pin'), id: 'other-tab-pin', note: 'From another tab', created: Date.now(), updated: Date.now() };
  await sw.evaluate((k, list) => chrome.storage.local.set({ [k]: list }), key, [...stored, twin]);
  const sawTwin = await page.waitForFunction(() => document.getElementById('bfb-site-tools')?.shadowRoot?.querySelectorAll('.pin').length === 2, { timeout: 3000 }).then(() => true, () => false);
  check('a pin saved from another tab shows here without a reload', sawTwin, await shadow(page, `return root.querySelectorAll('.pin').length`));
  await send('panel');
  await page.waitForFunction(() => document.getElementById('bfb-site-tools')?.shadowRoot?.querySelector('.panel'));
  await shadow(page, `root.querySelector('.panel [data-del]').click()`);
  await sleep(250);
  stored = await sw.evaluate(k => chrome.storage.local.get(k).then(r => r[k]), key);
  check('this tab\'s next save keeps the other tab\'s pin', stored.length === 3 && stored.some(m => m.id === 'other-tab-pin'), stored.map(m => m.id));
  await page.keyboard.press('Escape');
  await sleep(100);

  // ---- Settings, Web pages ----
  await send('panel');
  await page.waitForFunction(() => document.getElementById('bfb-site-tools')?.shadowRoot?.querySelector('.panel'));
  const opened = browser.waitForTarget(t => t.type() === 'page' && t.url().startsWith('file://'), { timeout: 10000 });
  await shadow(page, `root.querySelector('[data-act="settings"]').click()`);
  const st = await (await opened).page();
  await st.setViewport({ width: 1100, height: 800 });
  await st.waitForFunction(() => !document.getElementById('fe-settings-modal')?.hidden && document.querySelector('.fe-dlg-pane.on')?.getAttribute('data-tab') === 'web', { timeout: 12000 });
  check('the panel\'s gear opens bfb Settings on Web pages', true);
  await st.waitForFunction(() => document.querySelector('#fe-st-web-marks .fe-web-page'), { timeout: 4000 });
  check('Settings lists the marked page with its count', (await st.evaluate(() => document.querySelector('#fe-st-web-marks .fe-web-meta')?.textContent ?? '')).startsWith('3 marks ·'), await st.evaluate(() => document.querySelector('#fe-st-web-marks')?.textContent));

  // Add this site with its own mode: the open page follows at once.
  await st.type('#fe-st-web-add-host', `http://127.0.0.1:${site.port}/light`);
  // bfb's dropdowns keep their value in the extension's world, so they are clicked as a person would.
  const pick = async (scope, v) => { await st.click(`${scope} .fe-dd-btn`); await st.waitForSelector(`.fe-dd-list .fe-dd-opt[data-v="${v}"]`); await st.click(`.fe-dd-list .fe-dd-opt[data-v="${v}"]`); };
  const shown = scope => st.evaluate(sel => document.querySelector(`${sel} .fe-dd-btn`)?.textContent.trim(), scope);
  const ROW = '.fe-web-site[data-host="127.0.0.1"]';
  await pick('#fe-st-web-add-mode', 'smart');
  await st.click('#fe-st-web-add');
  await waitLights(page, 'smart');
  check('adding a site in Settings turns it dark in its open tab', true);
  await st.waitForSelector(ROW);
  check('the site shows in the list with its mode', (await shown(ROW)) === 'Smart', await shown(ROW));
  await shot(st, 'site-tools-settings-web');

  // Change its mode from the list.
  await pick(ROW, 'invert');
  await waitLights(page, 'invert');
  check('changing a site\'s mode in Settings reaches the page', true);

  // Forget it: it follows the default (Off) again, and Undo brings it back.
  await st.click('.fe-web-site[data-host="127.0.0.1"] .fe-web-del');
  await waitLights(page, 'off');
  check('forgetting a site sends it back to the default', await st.evaluate(() => !document.querySelector('.fe-web-site[data-host="127.0.0.1"]')), null);

  // The default for every site.
  await st.click('#fe-st-web-default .fe-seg-b[data-v="auto"]');
  await waitLights(page, 'smart');
  const def = await sw.evaluate(() => chrome.storage.local.get('bfb-lights-v1').then(r => r['bfb-lights-v1']));
  check('the default in Settings applies to sites without their own mode', def.default === 'auto' && !def.sites['127.0.0.1'], def);
  await st.click('#fe-st-web-default .fe-seg-b[data-v="off"]');
  await waitLights(page, 'off');

  // A page's mode set on the page shows in Settings straight away.
  await send('lights-set', { mode: 'native' });
  await st.waitForFunction(sel => document.querySelector(`${sel} .fe-dd-btn`)?.textContent.trim() === 'Site', { timeout: 4000 }, ROW);
  check('a mode picked on a page shows in open Settings', true);
  await send('lights-set', { mode: 'off' });

  // Delete a page's marks from Settings.
  await st.click('#fe-st-web-marks .fe-web-forget');
  await sleep(300);
  const left = await sw.evaluate(k => chrome.storage.local.get([k, 'bfb-marks-index-v1']), key);
  check('deleting a page\'s marks in Settings removes them', !left[key] && !Object.keys(left['bfb-marks-index-v1'] ?? {}).length, left);
  await st.close();

  // Chrome's Options item for bfb sends its own tab to Home with Settings open on Web pages.
  const extId = new URL(sw.url()).host;
  const opt = await browser.newPage();
  await opt.goto(`chrome-extension://${extId}/options.html`);
  await opt.waitForFunction(() => location.protocol === 'file:' && !document.getElementById('fe-settings-modal')?.hidden && document.querySelector('.fe-dlg-pane.on')?.getAttribute('data-tab') === 'web', { timeout: 12000, polling: 250 }).catch(() => null);
  const optAt = await opt.evaluate(() => ({ url: location.protocol, tab: document.querySelector('.fe-dlg-pane.on')?.getAttribute('data-tab') })).catch(err => ({ err: String(err) }));
  check('Chrome\'s Options item opens Settings on Web pages in the same tab', optAt.url === 'file:' && optAt.tab === 'web', optAt);
  await opt.close();
} catch (err) {
  console.error(err);
  failed++;
} finally {
  await close();
  site.server.close();
  cdn.server.close();
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll site tools checks passed');
process.exit(failed ? 1 : 0);
