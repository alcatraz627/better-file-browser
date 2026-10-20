// Every rendered table has resizable columns: a markdown table on its file
// page and a TSV preview. Dragging a header edge widens that column alone,
// a click on the edge does not sort, and a double-click puts it back.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const widths = (page, sel) => page.$$eval(`${sel} thead th`, ths => ths.map(t => Math.round(t.getBoundingClientRect().width)));
const drag = async (page, sel, col, dx) => {
  const box = await page.$eval(`${sel} thead th:nth-child(${col}) .fe-col-rz`, el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x + dx, box.y, { steps: 6 });
  await page.mouse.up();
};
try {
  const md = join(h.fixture, 'table.md');
  writeFileSync(md, '# Table\n\n| Name | Kind | Notes |\n|---|---|---|\n| alpha | one | short |\n| beta | two | a longer note that wraps |\n');
  const tsv = join(h.fixture, 'wide.tsv');
  writeFileSync(tsv, 'id\tname\tcity\n1\tAda\tLondon\n2\tGrace\tArlington\n');
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));

  for (const theme of ['dark', 'light']) {
    await page.goto('file://' + md, { waitUntil: 'load' });
    await page.waitForSelector('.fe-md-table');
    if (theme === 'light') await page.click('#fe-theme-btn');
    const sel = '#fe-page .fe-md-table';
    const before = await widths(page, sel);
    await drag(page, sel, 1, 80);
    const after = await widths(page, sel);
    check(Math.abs(after[0] - before[0] - 80) <= 2 && after[1] === before[1] && after[2] === before[2],
      `${theme}: dragging the Name edge widens Name alone: ${JSON.stringify({ before, after })}`);
    await page.screenshot({ path: join(SHOTS, `table-resize-md-${theme}.png`), clip: { x: 0, y: 0, width: 1400, height: 420 } });
    const box = await page.$eval(`${sel} thead th:nth-child(1) .fe-col-rz`, el => { const r = el.getBoundingClientRect(); return { x: r.left + 3, y: r.top + 5 }; });
    await page.mouse.click(box.x, box.y, { count: 2 });
    const reset = await widths(page, sel);
    check(JSON.stringify(reset) === JSON.stringify(before), `${theme}: a double-click on the edge resets: ${JSON.stringify(reset)}`);
  }

  // Chrome downloads a .tsv, so it opens in its folder's view.
  await page.goto('file://' + h.fixture + '/#view=wide.tsv', { waitUntil: 'load' });
  await page.waitForSelector('.fe-ql-table', { timeout: 5000 }).catch(() => null);
  const sel = '.fe-ql-table';
  if (await page.$(sel)) {
    const before = await widths(page, sel);
    await drag(page, sel, 2, 60);
    const after = await widths(page, sel);
    check(Math.abs(after[1] - before[1] - 60) <= 2 && after[0] === before[0], `TSV: dragging the name edge widens it alone: ${JSON.stringify({ before, after })}`);
    await page.screenshot({ path: join(SHOTS, 'table-resize-tsv.png'), clip: { x: 0, y: 0, width: 1400, height: 360 } });

    // In the preview panel a header click sorts; a click on its edge must not.
    await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
    await page.click('#fe-tbody a[href$="wide.tsv"]');
    const psel = '#fe-ql-body .fe-ql-table';
    await page.waitForSelector(psel, { timeout: 5000 });
    const hb = await page.$eval(`${psel} thead th:nth-child(2) .fe-col-rz`, el => { const r = el.getBoundingClientRect(); return { x: r.left + 3, y: r.top + 5 }; });
    await page.mouse.click(hb.x, hb.y);
    check(await page.$$eval(`${psel} thead th.sorted`, t => t.length) === 0, 'preview: a click on the edge does not sort the column');
    await page.click(`${psel} thead th:nth-child(2)`);
    check(await page.$$eval(`${psel} thead th.sorted`, t => t.length) === 1, 'preview: a click on the header itself still sorts');
  } else {
    check(false, 'TSV file page shows a table');
  }
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'table resize walk passes');
