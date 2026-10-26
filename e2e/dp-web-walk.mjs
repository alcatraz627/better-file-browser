// The web build of a decision page (B8), in a plain browser with no extension,
// against a stand-in for gcc's page server over a scratch folder (the live
// registry is never touched). It serves the routes gcc's server serves: the
// shell at /dp/<slug>/, the page's files, the bundle at /dp-assets/, and the
// compose, parse, submit and seen posts, composing with gcc's real composer.
// The page must load with no 404, ask only its own origin, draw with bfb's
// parts (the same classes as bfb's own render, none of decision.html's),
// answer by key, submit end to end, and switch dark and light.
//
//   node e2e/dp-web-walk.mjs      (BFB_THEME=light for the light theme)
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import puppeteer from 'puppeteer-core';
import { launch, findChrome, BUN, SHOTS, THEME } from './harness.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const scratch = mkdtempSync(join(tmpdir(), 'bfb-dpweb-'));
const SLUG = 'web-walk';
const CFG = {
  title: 'Web walk page', copyHeader: 'web rulings', origin: { project: 'bfb', session: 'walker' },
  intro: 'Answer from **any** device on the tailnet.',
  decisions: [
    { id: 'D1', question: 'Which layout?', none: true, options: [{ code: 'a', label: 'Grid', rec: true, images: ['grid.svg'] }, { code: 'b', label: 'List', images: ['list.svg'] }] },
    { id: 'D2', question: 'Ship when?', none: true, options: [{ code: 'a', label: 'Today', rec: true }, { code: 'b', label: 'Friday' }] },
  ],
  sections: [{ id: 's1', title: 'Spacing', read: 'Rows are 8px apart.' }],
};
const page = join(scratch, SLUG);
mkdirSync(page);
writeFileSync(join(page, 'config.json'), JSON.stringify(CFG));
const svg = c => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="${c}"/></svg>`;
writeFileSync(join(page, 'grid.svg'), svg('#2a9d8f'));
writeFileSync(join(page, 'list.svg'), svg('#e9c46a'));
const core = join(scratch, 'core.ts');
writeFileSync(core, `import { compose, parse } from ${JSON.stringify(join(homedir(), '.claude/scripts/decision-page/dp-core.ts'))};
const [verb, cfgPath] = process.argv.slice(2);
const cfg = JSON.parse(await Bun.file(cfgPath).text());
const input = await Bun.stdin.text();
console.log(JSON.stringify(verb === 'compose' ? { answer: compose(cfg, JSON.parse(input).state ?? null) } : { state: parse(JSON.parse(input).answer, cfg) }));
`);

// The stand-in server: gcc's routes, logging every request.
const seen = [];
const send = (res, status, body, type = 'application/json') => { res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    seen.push({ method: req.method, p, origin: req.headers.origin ?? null });
    if (req.method === 'GET' && (p === '/favicon.svg' || p === '/favicon.ico')) return send(res, 200, svg('#5b9dff'), 'image/svg+xml');
    if (req.method === 'GET' && p === '/dp-assets/dp-web.js') return send(res, 200, readFileSync(join(ROOT, 'assets/dp-web/dp-web.js')), 'text/javascript');
    if (req.method === 'GET' && p === `/dp/${SLUG}/`) return send(res, 200, readFileSync(join(ROOT, 'assets/dp-web/index.html')), 'text/html; charset=utf-8');
    if (req.method === 'GET' && p.startsWith(`/dp/${SLUG}/`)) {
      const f = join(page, p.slice(`/dp/${SLUG}/`.length));
      if (!existsSync(f) || !statSync(f).isFile()) return send(res, 404, { error: 'no such file' });
      return send(res, 200, readFileSync(f), f.endsWith('.svg') ? 'image/svg+xml' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream');
    }
    const route = /^\/api\/dp-(compose|parse|submit|seen)\/([^/]+)$/.exec(p);
    if (req.method === 'POST' && route && route[2] === SLUG) {
      const verb = route[1];
      if (verb === 'compose' || verb === 'parse') {
        const r = spawnSync(BUN, [core, verb, join(page, 'config.json')], { input: body, encoding: 'utf8' });
        return r.status === 0 ? send(res, 200, r.stdout) : send(res, 500, { error: r.stderr });
      }
      if (verb === 'seen') { if (!existsSync(join(page, '.seen.json'))) writeFileSync(join(page, '.seen.json'), JSON.stringify({ seen_at: Date.now() / 1000 })); return send(res, 200, { ok: true }); }
      const b = JSON.parse(body || '{}');
      if (existsSync(join(page, '.answer.json')) && b.replace !== true) return send(res, 409, { error: 'this page is already answered; send replace:true to overwrite it', answered: true });
      writeFileSync(join(page, '.answer.json'), JSON.stringify({ answer: b.answer, submitted_at: Math.floor(Date.now() / 1000), via: b.via }));
      setTimeout(() => writeFileSync(join(page, '.notify.json'), JSON.stringify({ state: 'requested', via: ['alias:walker'], reason: '', at: new Date().toISOString() })), 300);
      return send(res, 200, { ok: true, slug: SLUG, routed: null });
    }
    send(res, 404, { error: 'not served' });
  });
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-first-run', '--window-size=1400,900'], defaultViewport: { width: 1400, height: 900 } });
try {
  const tab = await browser.newPage();
  const errors = [], bad = [];
  tab.on('pageerror', e => errors.push(e.message));
  // An unanswered page has no .answer.json, and Chrome logs that 404; it is the one expected miss.
  tab.on('console', m => { if (m.type() === 'error' && !/\/\.(answer|notify)\.json$/.test(m.location()?.url ?? '')) errors.push(`${m.text()} ${m.location()?.url ?? ''}`); });
  tab.on('requestfinished', r => { const s = r.response()?.status(); const u = new URL(r.url()); if (u.origin !== ORIGIN && !u.protocol.startsWith('data')) bad.push(`other origin: ${r.url()}`); if (s >= 400 && !/\.(answer|notify)\.json$/.test(u.pathname)) bad.push(`${s} ${u.pathname}`); });
  tab.on('requestfailed', r => bad.push(`failed ${r.url()}`));
  if (THEME === 'light') await tab.evaluateOnNewDocument(() => localStorage.setItem('bfb-theme', 'light'));
  tab.on('pageerror', e => console.error('[pageerror]', e.message));
  await tab.goto(`${ORIGIN}/dp/${SLUG}/`, { waitUntil: 'load' });
  await tab.waitForSelector('.fe-dp-title', { timeout: 8000 }).catch(async () => console.error('[no title]', await tab.evaluate(() => document.body.innerHTML.slice(0, 400)), JSON.stringify(seen.slice(-8))));
  await tab.waitForFunction(() => document.getElementById('fe-dp-answer-text')?.textContent.length > 0, { timeout: 8000 });
  const first = await tab.evaluate(() => ({
    title: document.title, h1: document.querySelector('.fe-dp-title')?.textContent, cards: document.querySelectorAll('.fe-dp-card').length,
    tiles: document.querySelectorAll('.fe-dp-card[data-id="D1"] img').length, intro: document.querySelector('.fe-dp-intro strong')?.textContent,
    files: getComputedStyle(document.getElementById('fe-dp-files')).display, theme: document.getElementById('fe').dataset.theme,
    tileW: [...document.querySelectorAll('.fe-dp-card[data-id="D1"] .fe-dp-opt.tile')].map(t => Math.round(t.getBoundingClientRect().width)),
    bg: getComputedStyle(document.body).backgroundColor,
  }));
  check(first.h1 === 'Web walk page' && first.title === 'Web walk page' && first.cards === 3 && first.tiles === 2 && first.tileW.every(w => w >= 380) && first.intro === 'any' && first.files === 'none',
    `the http page draws the decision page with bfb's cards, pictures and markdown, and no Files button: ${JSON.stringify(first)}`);
  check(existsSync(join(page, '.seen.json')), 'opening it tells the server it was seen');
  check(!bad.length, `it loads with no 404 and asks only its own origin: ${JSON.stringify(bad)}`);
  check(!errors.length, `no errors in the console: ${JSON.stringify(errors)}`);
  await tab.screenshot({ path: join(SHOTS, `dp-web${THEME === 'light' ? '-light' : ''}.png`) });
  const classes = p => p.evaluate(() => [...new Set([...document.querySelectorAll('#fe-dp *')].flatMap(e => [...e.classList]))].sort());
  const web = await classes(tab);

  // Keys, the panel and a submit, end to end over http.
  await tab.click('.fe-dp-card[data-id="D2"]');
  await tab.keyboard.press('2');
  await tab.keyboard.press('p');
  await tab.waitForFunction(t => document.getElementById('fe-dp-answer-text').textContent === t, { timeout: 5000 }, 'web rulings:\nD1a D2b').catch(() => null);
  const panel = await tab.$eval('#fe-dp-answer-text', e => e.textContent);
  check(panel === 'web rulings:\nD1a D2b' && !(await tab.$eval('#fe-dp-answer', e => e.hidden)), `2 picks by key and p shows gcc's composed answer: ${JSON.stringify(panel)}`);
  await tab.keyboard.press('s');
  await tab.waitForFunction(() => !document.getElementById('fe-dp-sent').hidden, { timeout: 15000 }).catch(() => null);
  const sent = existsSync(join(page, '.answer.json')) ? JSON.parse(readFileSync(join(page, '.answer.json'), 'utf8')) : null;
  const after = await tab.evaluate(() => ({ toast: document.getElementById('fe-toast').textContent, head: document.querySelector('.fe-dp-sent-head')?.textContent.replace(/\s+/g, ' ').trim(), btn: document.getElementById('fe-dp-submit').textContent }));
  check(sent?.answer === panel && sent.via === 'page' && /woken/.test(after.toast) && /agent was woken/.test(after.head ?? '') && after.btn === 'Replace answer',
    `s submits over http; the server stores the answer and the page shows it was woken: ${JSON.stringify({ sent, ...after })}`);
  const posts = seen.filter(r => r.method === 'POST');
  check(posts.length > 0 && posts.every(r => r.origin === ORIGIN), `every post carries this page's own origin, as G8 requires: ${JSON.stringify([...new Set(posts.map(r => r.origin))])}`);

  // Dark and light from the page's own switch.
  const t0 = await tab.$eval('#fe', e => e.dataset.theme);
  await tab.click('#fe-dp-web-theme');
  const t1 = await tab.evaluate(() => ({ theme: document.getElementById('fe').dataset.theme, bg: getComputedStyle(document.getElementById('fe-dp')).backgroundColor, label: document.getElementById('fe-dp-web-theme').title }));
  check(t0 !== t1.theme && /Switch to/.test(t1.label), `the switch by the title flips dark and light: ${JSON.stringify([t0, t1])}`);
  await tab.click('#fe-dp-web-theme');

  // G1 a way back to every page, and B12 ? shows the page's keys.
  const nav = await tab.evaluate(() => ({ href: document.getElementById('fe-dp-web-all')?.getAttribute('href'), text: document.getElementById('fe-dp-web-all')?.textContent }));
  check(nav.href === '/dp/' && /All decisions/.test(nav.text ?? ''), `G1 an All decisions link goes back to /dp/, which answers on both listeners: ${JSON.stringify(nav)}`);
  await tab.evaluate(() => document.activeElement?.blur());
  await tab.keyboard.press('?');
  const keysCard = await tab.evaluate(() => {
    const c = document.querySelector('.fe-dp-web-keys');
    return c ? { rows: c.querySelectorAll('.fe-dp-web-key').length, has: ['Copy the answer', 'Next card', 'Send the answer'].map(t => c.textContent.includes(t)), bg: getComputedStyle(c).backgroundColor } : null;
  });
  await tab.keyboard.press('Escape');
  const keysGone = await tab.evaluate(() => !document.querySelector('.fe-dp-web-keys'));
  check(!!keysCard && keysCard.rows >= 14 && keysCard.has.every(Boolean) && keysGone, `B12 ? opens a card of the page's keys from the key map, and Esc closes it: ${JSON.stringify({ keysCard, keysGone })}`);
  await tab.click('#fe-dp-web-help');
  const byButton = await tab.evaluate(() => !!document.querySelector('.fe-dp-web-keys'));
  await tab.keyboard.press('Escape');
  check(byButton, 'B12 the ? button by the title opens the same card');

  // At phone width every bar button stays on screen.
  await tab.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 300));
  const phone = await tab.evaluate(() => ['fe-dp-panel', 'fe-dp-copy', 'fe-dp-submit', 'fe-dp-reset'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return { id, left: Math.round(r.left), right: Math.round(r.right) }; }));
  check(phone.every(b => b.left >= 0 && b.right <= 390), `at 390px Answer, Copy, Submit and Reset are all on screen: ${JSON.stringify(phone)}`);
  await tab.screenshot({ path: join(SHOTS, `dp-web-phone${THEME === 'light' ? '-light' : ''}.png`) });
  await tab.setViewport({ width: 1400, height: 900 });

  // The same parts as bfb's own render, and none of decision.html's, both as first drawn.
  const old = [...readFileSync(join(homedir(), '.claude/scripts/kanban/decision.html'), 'utf8').matchAll(/class="([a-z][\w -]*)/g)].flatMap(m => m[1].split(/\s+/)).filter(Boolean);
  // card and badge are names bfb's own kit uses too; everything else is decision.html's alone.
  const oldOnly = [...new Set(old)].filter(c => !['card', 'badge'].includes(c));
  const leaked = web.filter(c => oldOnly.includes(c));
  check(!leaked.length, `no decision.html class name appears in the http page: ${JSON.stringify(leaked)}`);
  const h = await launch();
  try {
    const regPage = join(h.dpRegistry, SLUG);
    mkdirSync(regPage, { recursive: true });
    for (const f of ['config.json', 'grid.svg', 'list.svg']) writeFileSync(join(regPage, f), readFileSync(join(page, f)));
    const ext = await h.open(regPage);
    await ext.waitForSelector('#fe-dp:not([hidden]) .fe-dp-title', { timeout: 8000 });
    await ext.waitForFunction(() => document.getElementById('fe-dp-answer-text')?.textContent.length > 0, { timeout: 8000 });
    const mine = await classes(ext);
    const onlyExt = mine.filter(c => !web.includes(c)), onlyWeb = web.filter(c => !mine.includes(c));
    check(!onlyExt.length && !onlyWeb.length,`the http page and bfb's page are drawn from the same parts: ${JSON.stringify({ onlyExt, onlyWeb, shared: mine.length })}`);
  } finally { await h.close(); }
} finally {
  console.log(results.join('\n'));
  await browser.close();
  server.close();
  rmSync(scratch, { recursive: true, force: true });
}
