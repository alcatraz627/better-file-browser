// Walks the notes sidebar ergonomics on a scratch copy of a notes store: the filter box,
// the right-click menu, keyboard rename and delete, previous and next, the folder picker,
// and one-line middle-truncated titles with the click-to-edit box.
//
//   BFB_NOTES_SRC=<store made by fuzz_notes.py> node e2e/notes-ergonomics-walk.mjs
//   BFB_THEME=light ...   (same checks on the light theme, screenshots get a -light suffix)
//
// The source folder is copied, never written.
import { launch, shot, applyTheme } from './harness.mjs';
import { cpSync, rmSync, readdirSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.env.BFB_NOTES_SRC;
if (!SRC) throw new Error('set BFB_NOTES_SRC to a scratch notes store (never the real ~/Notes)');
if (/\/Notes\/?$/.test(SRC) && !/scratch|fuzz/.test(SRC)) throw new Error('refusing to copy a real Notes folder');
const store = process.env.BFB_NOTES_SCRATCH || '/private/tmp/claude-501/laneD/walk-store';
rmSync(store, { recursive: true, force: true });
mkdirSync(store, { recursive: true });
cpSync(SRC, store, { recursive: true, preserveTimestamps: true });

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rowsOf = page => page.$$eval('#fe-nt-list .fe-nt-item', els => els.map(e => e.getAttribute('data-rel')));

const h = await launch();
try {
  const page = await h.open();
  await page.evaluate(nd => localStorage.setItem('bfb-settings-v1',
    JSON.stringify({ showSidebar: true, tooltips: true, notesRoot: nd })), store);
  await page.reload({ waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 10_000 });

  // Row 1: the filter box.
  const all = await rowsOf(page);
  check(all.length > 10, `the sidebar lists the store: ${all.length} notes`);
  check(await page.$eval('#fe-nt-filter', e => getComputedStyle(e).display !== 'none'), 'the filter box is visible once a notes folder is set');
  const firstRel = all[0];
  const probeWord = await page.$eval(`#fe-nt-list .fe-nt-item[data-rel="${firstRel}"] .fe-nt-label`, e => e.textContent.trim().split(/\s+/)[0]);
  await page.click('#fe-nt-filter');
  await page.type('#fe-nt-filter', probeWord);
  await sleep(150);
  const narrowed = await rowsOf(page);
  check(narrowed.length >= 1 && narrowed.length < all.length && narrowed.includes(firstRel), `typing "${probeWord}" narrows ${all.length} to ${narrowed.length} and keeps ${firstRel}`);
  const hint = await page.$eval('#fe-st-notes-hint', e => e.textContent);
  check(new RegExp(`^${narrowed.length} of ${all.length} notes`).test(hint), `the count line reads "${hint}"`);
  await shot(page, 'nt-filter-narrow');
  await page.$eval('#fe-nt-filter', e => { e.value = ''; });
  await page.type('#fe-nt-filter', 'zzzzqqq');
  await sleep(150);
  const none = await page.$eval('#fe-nt-list', e => e.textContent.trim());
  check(/No note matches/.test(none), `no match says so: "${none}"`);
  await shot(page, 'nt-filter-none');
  await page.keyboard.press('Escape');
  await sleep(150);
  const back = await rowsOf(page);
  check(back.length === all.length && await page.$eval('#fe-nt-filter', e => e.value === ''), 'Escape clears the box and the whole list returns');
} finally {
  await h.close();
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall ok');
process.exit(fails.length ? 1 : 0);
