// bfb on a phone: the phone server (native/web_server.py) on a free port,
// opened in a phone-sized, touch Chrome with no extension. Folders, files and
// diagrams draw; the sidebar is a drawer; a comment made by touch is written
// beside the doc; Send hands the thread to an agent (a stub claude-ipc here).
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { findChrome, makeFixture, makeNotesDir, SHOTS } from './harness.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const fixture = makeFixture(), notesDir = makeNotesDir();
const tmp = mkdtempSync(join(tmpdir(), 'bfb-phone-'));
const seed = join(tmp, 'seed.json'), sent = join(tmp, 'sent.txt'), ipc = join(tmp, 'claude-ipc');
writeFileSync(seed, JSON.stringify({ kv: { 'bfb-settings-v1': JSON.stringify({ editableFolders: [fixture], notesRoot: notesDir }), 'bfb-saved-v1': JSON.stringify([{ path: fixture + '/nested/', label: 'Saved on the Mac' }]) } }));
// A claude-ipc that lists one live agent and writes down what it is asked to send.
writeFileSync(ipc, `#!/bin/sh\nif [ "$1" = peers ]; then echo '{"peers":[{"alias":"bfb","status":"live","cwd":"/tmp"}]}'; exit 0; fi\nprintf '%s\\n' "$@" > '${sent}'\n`);
chmodSync(ipc, 0o755);

const server = spawn('python3', [join(ROOT, 'native/web_server.py'), '--port', '0'], { env: { ...process.env, BFB_PHONE_SEED: seed, BFB_CLAUDE_IPC: ipc } });
const port = await new Promise((res, rej) => {
  server.stdout.on('data', d => { const m = /127\.0\.0\.1:(\d+)/.exec(String(d)); if (m) res(m[1]); });
  server.on('exit', c => rej(new Error(`server exited ${c}`)));
  setTimeout(() => rej(new Error('server did not start')), 8000);
});
const BASE = `http://127.0.0.1:${port}`;
const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-first-run', '--disable-gpu'] });   // without it a mobile-emulated screenshot can hang in headless Chrome
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));

  // A folder: the listing fills the phone, nothing scrolls sideways.
  await page.goto(`${BASE}${fixture}/`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#fe-tbody tr');
  const folder = await page.evaluate(() => ({ rows: document.querySelectorAll('#fe-tbody tr[data-idx]').length, wide: document.documentElement.scrollWidth, phone: !!document.getElementById('bfb-phone-css') }));
  check(folder.rows >= 7 && folder.wide <= 391 && folder.phone, `a folder lists its files at phone width: ${JSON.stringify(folder)}`);
  await page.screenshot({ path: join(SHOTS, 'phone-folder.png') });

  // The sidebar is a drawer from the bottom: closed at first, raised by a lens button on the bottom bar, lowered by the scrim.
  const sideTop = () => page.$eval('#fe-side', s => Math.round(s.getBoundingClientRect().top));
  check(await sideTop() >= 844, 'the sidebar starts as a closed drawer below the screen');
  await page.tap('#fe-rail-saved');
  await sleep(400);
  const open = await sideTop();
  const drawerBox = await page.$eval('#fe-side', s => { const r = s.getBoundingClientRect(), l = document.getElementById('fe-lenses').getBoundingClientRect(); return { w: Math.round(r.width), lensW: Math.round(l.width), lensH: Math.round(l.height) }; });
  check(open > 100 && open < 844 && drawerBox.w > 360 && drawerBox.lensW > 300 && drawerBox.lensH > 200, `a lens button raises a full-width drawer with its panel: top ${open}, ${JSON.stringify(drawerBox)}`);
  await page.screenshot({ path: join(SHOTS, 'phone-drawer.png') });
  check(await page.evaluate(() => document.getElementById('fe-side').textContent.includes('Saved on the Mac')), 'the Mac\'s Saved list is in the phone drawer');
  await page.touchscreen.tap(195, 40);   // the scrim is the part of the page the drawer leaves uncovered
  await sleep(400);
  check(await sideTop() >= 844, 'a tap on the scrim lowers it');

  // Saved is real through the Mac: a save made on the phone is a file in the notes folder, and a save the Mac adds shows on the phone.
  const savedDir = join(notesDir, '.saved');
  await page.tap('#fe-bm-btn');
  for (let i = 0; i < 40 && !(existsSync(savedDir) && readdirSync(savedDir).length >= 2); i++) await sleep(150);
  const files = existsSync(savedDir) ? readdirSync(savedDir).filter(f => f.endsWith('.md')) : [];
  const texts = files.map(f => readFileSync(join(savedDir, f), 'utf8'));
  check(files.length === 2 && texts.some(t => t.includes('title: "Saved on the Mac"')) && texts.some(t => t.includes(`url: "file://${fixture}/"`)), `saving a folder on the phone writes it to .saved/ in the notes folder, beside the Mac's row: ${files.length} files`);
  writeFileSync(join(savedDir, 'cccccccccccc.md'), `---\ntitle: "Added on the Mac"\nurl: "file://${fixture}/nested/deeper/"\ndevice: "mac"\n---\n`);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.tap('#fe-rail-saved'); await sleep(900);
  const shown = await page.evaluate(() => document.getElementById('fe-sv-list').textContent);
  check(shown.includes('Added on the Mac') && shown.includes('Saved on the Mac'), 'a save the Mac added to the folder shows on the phone after a reload');
  await page.touchscreen.tap(195, 40); await sleep(300);
  // Reachable only as localhost or on the tailnet, over plain HTTP: any other Host name is refused.
  const status = (path, host) => new Promise(res => { const q = httpRequest({ host: '127.0.0.1', port, path, headers: { Host: host } }, r => { r.resume(); res(r.statusCode); }); q.on('error', () => res(0)); q.end(); });
  const refused = await status('/', 'example.com'), tail = await status('/_bfb/seed.json', 'bfb-mac.tail1234.ts.net');
  check(refused === 421 && tail === 200, `the server answers a tailnet name and refuses any other host: other ${refused}, tailnet ${tail}`);

  // One address: a file:// link in a doc opens, on the phone, through this server, never as a file:// address.
  writeFileSync(join(fixture, 'jump.md'), `# Jump\n\n[to the notes](file://${fixture}/notes.txt)\n`);
  await page.goto(`${BASE}${fixture}/jump.md`, { waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-md a[href^="file://"]');
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.tap('#fe-page .fe-md a[href^="file://"]')]);
  check(page.url() === `${BASE}${fixture}/notes.txt`, `a file:// link opens through the phone server: ${page.url().replace(fixture, '<fixture>')}`);

  // A markdown file: rendered, its diagram drawn by the viewer.
  await page.goto(`${BASE}${fixture}/readme.md`, { waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-md h1');
  await page.waitForSelector('#fe-page .fe-md-mermaid .dl-world svg', { timeout: 15_000 }).catch(() => null);
  const file = await page.evaluate(() => ({ h1: document.querySelector('#fe-page .fe-md h1')?.textContent, diagram: !!document.querySelector('#fe-page .dl-world svg'), wide: document.documentElement.scrollWidth }));
  check(file.h1 === 'Fixture' && file.diagram && file.wide <= 391, `a markdown file renders with its diagram at phone width: ${JSON.stringify(file)}`);
  await page.screenshot({ path: join(SHOTS, 'phone-file.png') });

  // A comment by touch: select words, tap Comment, type, post. It lands beside the doc.
  await page.evaluate(() => {
    const p = [...document.querySelectorAll('#fe-page .fe-md p')].find(x => x.textContent.includes('markdown'));
    const r = document.createRange(); r.selectNodeContents(p.querySelector('strong'));
    getSelection().removeAllRanges(); getSelection().addRange(r);
  });
  await page.waitForFunction(() => !document.getElementById('fe-cm-add')?.hidden, { timeout: 4000 }).catch(() => null);
  const addShown = await page.$eval('#fe-cm-add', b => !b.hidden).catch(() => false);
  check(addShown, 'selecting words on the phone offers Comment');
  await page.screenshot({ path: join(SHOTS, 'phone-select.png') });
  await page.tap('#fe-cm-add');
  await page.waitForSelector('#fe-cm .fe-cm-new textarea');
  await page.type('#fe-cm .fe-cm-new textarea', 'Read on the phone. @bfb');
  await page.tap('#fe-cm .fe-cm-new [data-a="post"]');
  const companion = join(fixture, 'readme.md.bfb.json');
  for (let i = 0; i < 40 && !existsSync(companion); i++) await sleep(150);
  const stored = existsSync(companion) ? JSON.parse(readFileSync(companion, 'utf8')).comments.threads : [];
  const th = stored.find(t => t.comments?.[0]?.text?.includes('Read on the phone'));
  check(!!th && th.anchor.exact.includes('markdown') && th.comments[0].author.kind === 'human', `the comment is written beside the doc as the owner's: ${JSON.stringify(th && { q: th.anchor.exact, a: th.comments[0].author })}`);
  await page.waitForSelector('#fe-cm .fe-cm-th.on');
  await page.screenshot({ path: join(SHOTS, 'phone-comment.png') });

  // Send: pick the agent, and the thread reaches it with how to answer.
  await page.tap('#fe-cm .fe-cm-th.on [data-a="send-agent"]');
  await page.waitForSelector('.fe-cm-send [data-to="bfb"]');
  await page.screenshot({ path: join(SHOTS, 'phone-send.png') });
  await page.tap('.fe-cm-send [data-to="bfb"]');
  for (let i = 0; i < 40 && !existsSync(sent); i++) await sleep(150);
  const msg = existsSync(sent) ? readFileSync(sent, 'utf8') : '';
  check(/^send\n--from\nuser\n--to\nbfb\n/.test(msg) && msg.includes('readme.md') && msg.includes('Read on the phone') && msg.includes('bfb-docs comments reply'),
    `Send hands the thread to the agent with how to reply: ${JSON.stringify(msg.slice(0, 160))}`);
  check(!errors.length, `no page errors: ${errors.join(' | ') || 'none'}`);
} finally {
  console.log(results.join('\n'));
  await browser.close();
  server.kill();
}
