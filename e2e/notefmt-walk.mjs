// Walks the shared notes format in the app: a file holding a clash reads as its file
// name and offers the settle buttons (header clashes included), and a picture added
// to a note is named <id>-<stamp>.<ext>, with no tie to the note's title.
//
//   node e2e/notefmt-walk.mjs      (a generated scratch store; never the real Notes folder)
import { makeNotesStore } from './make-notes-store.mjs';
import { launch, shot, applyTheme } from './harness.mjs';
import { writeFileSync, readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const store = join(tmpdir(), `bfb-notefmt-walk-${process.pid}`);
makeNotesStore(store);
// A clash that opens inside the header, across the closing fence.
writeFileSync(join(store, 'in-header.md'), '---\ntitle: "Hidden title"\n<<<<<<< HEAD\npos: c\n=======\npos: b\n>>>>>>> origin/main\n---\nBody text\n');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const pic = join(tmpdir(), `bfb-notefmt-pic-${process.pid}.png`);
writeFileSync(pic, png);

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const h = await launch();
try {
  const page = await h.open();
  await h.store.set('bfb-settings-v1', { showSidebar: true, tooltips: true, notesRoot: store });
  await page.reload({ waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 10_000 });
  const label = rel => page.$eval(`#fe-nt-list .fe-nt-item[data-rel="${rel}"] .fe-nt-label`, e => e.textContent);

  // 1. A clash anywhere makes the file its own name, header included.
  check(await label('in-header.md') === 'in-header', `a clash across the header reads as the file name, not the hidden title: ${await label('in-header.md')}`);
  check(await label('20261009-203134.md') === '20261009-203134', 'a body clash reads as the file name too');
  check(await label('20260929-195411.md') === 'Groceries for Sunday', 'a clean note keeps its title');
  await page.click('#fe-nt-list .fe-nt-item[data-rel="in-header.md"] .fe-si-link');
  await page.waitForSelector('#fe-ed-src', { timeout: 8_000 });
  await sleep(400);
  const src = await page.$eval('#fe-ed-src', e => e.value);
  check(/^---\ntitle: "Hidden title"\n<<<<<<< HEAD/.test(src), 'the editor holds the whole file as text, header and all');
  check(await page.$('#fe-ed-clash') !== null, 'the settle buttons show');
  await shot(page, 'notefmt-clash');
  await page.click('#fe-ed-clash [data-keep="second"]');
  await sleep(2000);
  const settled = readFileSync(join(store, 'in-header.md'), 'utf8');
  check(settled.replace(/^updated: .*\n/m, '') === '---\ntitle: "Hidden title"\npos: b\n---\nBody text\n', `keeping the second side leaves a normal note on disk: ${JSON.stringify(settled)}`);
  await page.waitForFunction(() => document.querySelector('#fe-nt-list .fe-nt-item[data-rel="in-header.md"] .fe-nt-label')?.textContent === 'Hidden title', { timeout: 6_000 }).catch(() => null);
  check(await label('in-header.md') === 'Hidden title', `once settled the file is parsed again and shows its title: ${await label('in-header.md')}`);

  // 2. A picture is named <id>-<stamp>.<ext>.
  // The editor is a modal with a scrim over the sidebar, so a click on another row while it is open
  // lands on the scrim and closes it (checked below); with it closed, the next note opens at once.
  const scrim = await page.evaluate(() => { const r = document.querySelector('#fe-nt-list .fe-nt-item[data-rel="20261010-203425-f574.md"] .fe-si-link').getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.id; });
  check(scrim === 'fe-ql-bg', `with the editor open the sidebar row sits under the scrim, so a click there closes the editor: ${scrim}`);
  await page.keyboard.press('Escape'); await sleep(400);
  await page.click('#fe-nt-list .fe-nt-item[data-rel="20261010-203425-f574.md"] .fe-si-link');
  await page.waitForFunction(() => document.getElementById('fe-ed-src')?.value.includes('from the phone'), { timeout: 8_000 });
  const before = new Set(readdirSync(join(store, 'attachments')));
  const input = await page.$('#fe-ed-file');
  await input.uploadFile(pic);
  await sleep(1500);
  const added = readdirSync(join(store, 'attachments')).filter(f => !before.has(f));
  check(added.length === 1 && /^20261010-203425-f574-[0-9a-z]+\.png$/.test(added[0]), `the new picture is named <id>-<stamp>.png: ${added.join(',')}`);
  const text = await page.$eval('#fe-ed-src', e => e.value);
  check(added.length === 1 && text.includes(`](attachments/${added[0]})`), 'the note links it by relative path');
} finally {
  await h.close();
}
if (fails.length) { console.error(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
