// Two small promises not walked anywhere else: undo in the note editor leaves the
// caret where the change was, and F2 on a note row hands focus back to the row.
//
//   node e2e/closeout-walk.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, applyTheme } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  const body = Array.from({ length: 40 }, (_, i) => `Line ${i + 1} of the note`).join('\n');
  writeFileSync(join(h.notesDir, 'undo-me.md'), `---\ntitle: Undo me\n---\n\n${body}\n`);
  writeFileSync(join(h.notesDir, 'name-me.md'), `---\ntitle: Name me\n---\n\nWords\n`);
  await h.store.edit('bfb-settings-v1', s => ({ ...s, notesRoot: h.notesDir }));
  const page = await h.open();
  await applyTheme(page);
  await page.waitForSelector('#fe-nt-list .fe-nt-item[data-rel="undo-me.md"]', { timeout: 10000 });

  // Undo in the note editor.
  await page.click('#fe-nt-list .fe-nt-item[data-rel="undo-me.md"] .fe-si-link');
  await page.waitForSelector('#fe-ed-src', { timeout: 8000 });
  await sleep(400);
  const at = await page.$eval('#fe-ed-src', ta => { const i = ta.value.indexOf('Line 5 of'); ta.focus(); ta.setSelectionRange(i, i); return i; });
  await page.keyboard.type('xyz');
  await sleep(100);
  await page.keyboard.down('Meta'); await page.keyboard.press('z'); await page.keyboard.up('Meta');
  await sleep(200);
  const undone = await page.$eval('#fe-ed-src', ta => ({ caret: ta.selectionStart, has: ta.value.includes('xyz'), len: ta.value.length }));
  check(!undone.has && Math.abs(undone.caret - at) <= 3, `undo in the note editor leaves the caret at the change: ${JSON.stringify({ ...undone, at })}`);
  await page.keyboard.press('Escape');
  await sleep(400);

  // F2 on a note row, then Esc or Enter.
  const rowFocus = () => page.evaluate(() => !!document.activeElement?.closest('#fe-nt-list .fe-nt-item'));
  const focusRow = () => page.$eval('#fe-nt-list .fe-nt-item[data-rel="name-me.md"] .fe-si-link', a => a.focus());
  await focusRow();
  await page.keyboard.press('F2');
  await sleep(200);
  check(await page.evaluate(() => !!document.querySelector('#fe-nt-list .fe-nt-label.editing')), 'F2 on a note row opens its name box');
  await page.keyboard.press('Escape');
  await sleep(300);
  check(await rowFocus(), 'Esc from F2 leaves the note row in focus');
  await focusRow();
  await page.keyboard.press('F2');
  await sleep(200);
  await page.keyboard.type('Named again');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('#fe-nt-list .fe-nt-label')].some(l => l.textContent === 'Named again'), { timeout: 8000 }).catch(() => null);
  await sleep(400);
  check(await rowFocus(), 'Enter from F2 leaves the note row in focus');
} finally {
  for (const r of results) console.log(r);
  console.log(`${results.filter(r => r.startsWith('PASS')).length} pass, ${results.filter(r => r.startsWith('FAIL')).length} fail`);
  await h.close();
}
