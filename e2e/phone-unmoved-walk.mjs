// A phone that has not moved Saved yet, opened against a notes folder that already holds saves from
// another device, with a save made on the phone that was never sent. Nothing may be lost: the phone's
// save is written beside what the folder has, the folder's own file is left exactly as it was, and the
// Mac's older copy of Saved (the seed) does not replace the phone's unsent row.
//
//   node e2e/phone-unmoved-walk.mjs      (BFB_THEME=light for the light shot)
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { findChrome, makeFixture, makeNotesDir, SHOTS } from './harness.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LIGHT = process.env.BFB_THEME === 'light' || process.argv.includes('--light');

const fixture = makeFixture(), notesDir = makeNotesDir();
const tmp = mkdtempSync(join(tmpdir(), 'bfb-phone-unmoved-'));
const seed = join(tmp, 'seed.json');
const savedDir = join(notesDir, '.saved');
mkdirSync(savedDir, { recursive: true });
const theirs = `---\ntitle: "Already in the folder"\nurl: "file://${fixture}/nested/"\ndevice: "mac"\n---\n`;
writeFileSync(join(savedDir, 'aaaaaaaaaaaa.md'), theirs);
// The Mac's pre-move copy of Saved, which must not replace the phone's unsent row.
writeFileSync(seed, JSON.stringify({ kv: { 'bfb-settings-v1': JSON.stringify({ editableFolders: [fixture], notesRoot: notesDir }), 'bfb-saved-v1': JSON.stringify([{ path: fixture + '/nested/', label: 'Old Mac row' }]), ...(LIGHT ? { 'bfb-theme': 'light' } : {}) } }));

const server = spawn('python3', [join(ROOT, 'native/web_server.py'), '--port', '0'], { env: { ...process.env, BFB_PHONE_SEED: seed } });
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
  // The phone's own storage before the page starts: one save of its own, never sent.
  const mine = [{ path: fixture + '/readme.md', label: 'Saved on the phone' }];
  await page.evaluateOnNewDocument((list) => {
    if (localStorage.getItem('bfbweb:local:bfb-saved-v1') === null) {
      localStorage.setItem('bfbweb:local:bfb-saved-v1', JSON.stringify(JSON.stringify(list)));
      localStorage.setItem('bfbweb:local:bfb-saved-dirty-v1', JSON.stringify('1'));
    }
  }, mine);
  await page.goto(`${BASE}${fixture}/`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#fe-tbody tr');
  for (let i = 0; i < 40 && !(readdirSync(savedDir).filter(f => f.endsWith('.md')).length >= 2); i++) await sleep(150);
  const files = readdirSync(savedDir).filter(f => f.endsWith('.md'));
  const texts = files.map(f => readFileSync(join(savedDir, f), 'utf8'));
  check(files.length === 2 && texts.some(t => t.includes('title: "Saved on the phone"')), `the phone's unsent save is written to the folder beside the existing one: ${files.length} files`);
  check(readFileSync(join(savedDir, 'aaaaaaaaaaaa.md'), 'utf8') === theirs, "and the folder's own file is exactly as it was");
  check(!texts.some(t => t.includes('Old Mac row')), "the Mac's older copy of Saved did not replace the phone's row, so it was not written");
  await page.tap('#fe-rail-saved'); await sleep(900);
  const shown = await page.evaluate(() => document.getElementById('fe-sv-list').textContent);
  check(shown.includes('Already in the folder') && shown.includes('Saved on the phone') && !shown.includes('Old Mac row'), `the drawer lists both the folder's save and the phone's own: ${shown.replace(/\s+/g, ' ').slice(0, 120)}`);
  const flags = await page.evaluate(() => ({ dirty: localStorage.getItem('bfbweb:local:bfb-saved-dirty-v1'), backup: localStorage.getItem('bfbweb:local:bfb-saved-premigration-v1') }));
  check(flags.dirty === null && flags.backup === null, `the unsent mark is cleared, and the phone made no migration of its own (no premigration copy): ${JSON.stringify(flags)}`);
  await page.screenshot({ path: join(SHOTS, `phone-unmoved${LIGHT ? '-light' : ''}.png`) });
  check(!errors.length, `no page errors: ${errors.join(' | ') || 'none'}`);
} finally {
  console.log(results.join('\n'));
  await browser.close();
  server.kill();
}
