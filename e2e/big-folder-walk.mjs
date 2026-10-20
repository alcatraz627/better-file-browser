// A folder of 2,000 files: only the rows near the viewport are drawn, the
// scrollbar still spans the whole list, the arrow keys can walk past the
// drawn rows, a selection survives scrolling away and back, and the
// hidden-files toggle still works on small and big folders.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  const big = join(h.fixture, 'big');
  mkdirSync(big);
  for (let i = 0; i < 2000; i++) writeFileSync(join(big, `f-${String(i).padStart(4, '0')}.txt`), 'x');
  for (let i = 0; i < 5; i++) writeFileSync(join(big, `.dot-${i}`), 'x');
  const page = await h.open(big);
  await page.waitForSelector('#fe-tbody tr[data-idx]');
  await sleep(300);

  const first = await page.evaluate(() => ({ rows: document.querySelectorAll('#fe-tbody tr[data-idx]').length, count: document.getElementById('fe-count').textContent, height: document.getElementById('fe-scroll').scrollHeight }));
  check(first.rows < 250 && /2000 files/.test(first.count) && first.height > 2000 * 30, `2,000 files draw ${first.rows} rows, the list stays ${first.height}px tall: ${first.count}`);

  await page.evaluate(() => { const s = document.getElementById('fe-scroll'); s.scrollTop = s.scrollHeight; });
  await sleep(300);
  const end = await page.evaluate(() => { const rows = [...document.querySelectorAll('#fe-tbody tr[data-idx]')]; const vis = rows.filter(r => { const b = r.getBoundingClientRect(); return b.bottom > 0 && b.top < innerHeight; }); return vis.at(-1)?.querySelector('.fe-nm')?.textContent; });
  check(end === 'f-1999.txt', `scrolling to the end shows the last file: ${end}`);
  await page.screenshot({ path: join(SHOTS, 'big-folder-end.png') });

  await page.evaluate(() => { document.getElementById('fe-scroll').scrollTop = 0; });
  await sleep(200);
  const startIdx = await page.$$eval('#fe-tbody tr[data-idx]', rs => rs.find(r => r.querySelector('.fe-nm')?.textContent === 'f-0002.txt')?.dataset.idx);
  await page.click(`#fe-tbody tr[data-idx="${startIdx}"] td.c-sz`);
  for (let i = 0; i < 150; i++) await page.keyboard.press('ArrowDown');
  await sleep(200);
  const walked = await page.evaluate(() => { const s = document.querySelector('#fe-tbody tr.selected'); const b = s?.getBoundingClientRect(); return { name: s?.querySelector('.fe-nm')?.textContent, inView: !!b && b.top >= 0 && b.bottom <= innerHeight, status: document.getElementById('fe-status-text').textContent }; });
  check(walked.name === 'f-0152.txt' && walked.inView, `150 presses of down walk past the drawn rows and keep the pick in view: ${JSON.stringify(walked)}`);

  await page.evaluate(() => { const s = document.getElementById('fe-scroll'); s.scrollTop = s.scrollHeight; });
  await sleep(250);
  await page.evaluate(() => { document.getElementById('fe-scroll').scrollTop = 0; });
  await sleep(250);
  await page.keyboard.press('ArrowDown');
  await sleep(150);
  const back = await page.evaluate(() => document.querySelector('#fe-tbody tr.selected .fe-nm')?.textContent);
  check(back === 'f-0153.txt', `the pick survives scrolling away and back, and the next key moves on from it: ${back}`);

  await page.keyboard.press('Escape');   // a row click opened the preview, which covers the toolbar
  await sleep(200);
  await page.click('#fe-hidden-btn');
  await sleep(300);
  await page.evaluate(() => { document.getElementById('fe-scroll').scrollTop = 0; });
  await sleep(250);
  const shown = await page.evaluate(() => [...document.querySelectorAll('#fe-tbody tr.dotfile')].length);
  await page.click('#fe-hidden-btn');
  await sleep(300);
  const hidden = await page.evaluate(() => [...document.querySelectorAll('#fe-tbody tr.dotfile')].filter(r => r.offsetParent).length);
  check(shown === 5 && hidden === 0, `hidden files show and hide on a big folder: ${shown} then ${hidden}`);

  const small = await h.open();
  await small.waitForSelector('#fe-tbody tr[data-idx]');
  const before = await small.evaluate(() => [...document.querySelectorAll('#fe-tbody tr.dotfile')].filter(r => r.offsetParent).length);
  await small.click('#fe-hidden-btn');
  await sleep(200);
  const after = await small.evaluate(() => [...document.querySelectorAll('#fe-tbody tr.dotfile')].filter(r => r.offsetParent).length);
  check(before === 0 && after === 1, `hidden files still toggle on a small folder: ${before} then ${after}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
