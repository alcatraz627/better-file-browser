// bfb on a phone: the phone server (native/web_server.py) on a free port,
// opened in a phone-sized, touch Chrome with no extension. Folders, files and
// diagrams draw; the sidebar is a drawer; a comment made by touch is written
// beside the doc; Send hands the thread to an agent (a stub claude-ipc here).
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
writeFileSync(seed, JSON.stringify({ kv: { 'bfb-settings-v1': JSON.stringify({ editableFolders: [fixture], notesRoot: notesDir }) } }));
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
const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-first-run'] });
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

  // The sidebar is a drawer from the bottom: closed at first, opened by its button, closed by the scrim.
  const sideTop = () => page.$eval('#fe-side', s => Math.round(s.getBoundingClientRect().top));
  check(await sideTop() >= 844, 'the sidebar starts as a closed drawer below the screen');
  await page.tap('#fe-side-toggle');
  await sleep(400);
  const open = await sideTop();
  const drawerBox = await page.$eval('#fe-side', s => { const r = s.getBoundingClientRect(), l = document.getElementById('fe-lenses').getBoundingClientRect(); return { w: Math.round(r.width), lensW: Math.round(l.width), lensH: Math.round(l.height) }; });
  check(open > 100 && open < 844 && drawerBox.w > 360 && drawerBox.lensW > 300 && drawerBox.lensH > 200, `the sidebar button raises a full-width drawer with its panel: top ${open}, ${JSON.stringify(drawerBox)}`);
  await page.screenshot({ path: join(SHOTS, 'phone-drawer.png') });
  await page.tap('.fe-drawer-scrim');
  await sleep(400);
  check(await sideTop() >= 844, 'a tap on the scrim lowers it');

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
  check(/^send\n--to\nbfb\n/.test(msg) && msg.includes('readme.md') && msg.includes('Read on the phone') && msg.includes('bfb-docs comments reply'),
    `Send hands the thread to the agent with how to reply: ${JSON.stringify(msg.slice(0, 160))}`);
  check(!errors.length, `no page errors: ${errors.join(' | ') || 'none'}`);
} finally {
  console.log(results.join('\n'));
  await browser.close();
  server.kill();
}
