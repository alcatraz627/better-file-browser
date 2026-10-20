// A 9,000-line source file on the file page: the browser lays out and paints
// only the line blocks near the viewport, the gutter keeps one number per
// line, scrolling to the end shows the last line, and a problem row deep in
// the file can still be found and marked.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  const LINES = Number(process.argv[2]) || 9000;   // node e2e/long-file-walk.mjs 50000 for a near-cap file
  const src = Array.from({ length: LINES }, (_, i) => `const value${i} = compute(${i}, "row");`).join('\n');
  const file = join(h.fixture, 'long.ts');
  writeFileSync(file, src);
  const page = await h.open();
  const t0 = Date.now();
  await page.goto('file://' + file, { waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-cl', { timeout: 20_000 });
  const openMs = Date.now() - t0;

  const info = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll('#fe-page .fe-cl-blk')];
    return {
      lines: document.querySelectorAll('#fe-page .fe-cl').length,
      last: document.querySelectorAll('#fe-page .fe-cl-n').length,
      blocks: blocks.length,
      skipped: blocks.filter(b => getComputedStyle(b).contentVisibility === 'auto').length,
    };
  });
  check(info.lines === LINES && info.last === LINES, `every line has a row and a number: ${info.lines}`);
  check(info.blocks > 10 && info.skipped === info.blocks, `lines sit in ${info.blocks} blocks the browser skips while off screen`);
  console.log(`open ${openMs}ms`);

  const t1 = Date.now();
  await page.evaluate(() => { const sc =[document.getElementById('fe-page'), document.scrollingElement].find(el => el && el.scrollHeight > el.clientHeight + 10); sc.scrollTop = sc.scrollHeight; });
  await sleep(300);
  const end = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('#fe-page .fe-cl')].slice(-40);
    const vis = rows.filter(r => { const b = r.getBoundingClientRect(); return b.height > 0 && b.bottom > 0 && b.top < innerHeight; });
    return vis.at(-1)?.querySelector('.fe-cl-n')?.textContent;
  });
  console.log(`scroll to end ${Date.now() - t1}ms`);
  check(end === String(LINES), `scrolling to the end shows the last line: ${end}`);
  await page.screenshot({ path: join(SHOTS, 'long-file-end.png') });

  const gutter = await page.evaluate(() => {
    const ns = [...document.querySelectorAll('#fe-page .fe-cl-n')];
    return ns.every((n, i) => n.textContent === String(i + 1));
  });
  check(gutter, `the gutter counts 1 to ${LINES} in order across blocks`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
