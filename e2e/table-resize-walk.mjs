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

  // A column's edge works from any cell down the column, not only the header.
  await page.goto('file://' + md, { waitUntil: 'load' });
  await page.waitForSelector('.fe-md-table');
  const msel = '#fe-page .fe-md-table';
  const b0 = await widths(page, msel);
  const cell = await page.$eval(`${msel} tbody tr:nth-child(2) td:nth-child(1)`, el => { const r = el.getBoundingClientRect(); return { x: r.right - 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(cell.x, cell.y);
  const edgeCursor = await page.$eval(msel, t => t.classList.contains('fe-col-edge'));
  await page.mouse.down();
  await page.mouse.move(cell.x + 50, cell.y, { steps: 5 });
  await page.mouse.up();
  const b1 = await widths(page, msel);
  check(edgeCursor && Math.abs(b1[0] - b0[0] - 50) <= 2 && b1[1] === b0[1], `a body cell's edge drags its column: ${JSON.stringify({ edgeCursor, b0, b1 })}`);

  // A data table wider than its box (cells there do not wrap) starts with
  // widths from its content: short columns stay narrow and none takes the row.
  const long = '/Users/someone/Code/project/packages/a-very-long-package-name/src/components/deeply/nested/folder/structure/file.tsx';
  const rows = Array.from({ length: 12 }, (v, i) => `${i}\titem ${i}\t${long}\t${i * 7} KB\t${long}\t${long}`).join('\n');
  writeFileSync(join(h.fixture, 'paths.tsv'), 'ID\tName\tPath\tSize\tFrom\tTo\n' + rows + '\n');
  await page.goto('file://' + h.fixture + '/#view=paths.tsv', { waitUntil: 'load' });
  await page.waitForSelector('.fe-ql-table', { timeout: 5000 }); await new Promise(r => setTimeout(r, 300));
  const fit = await page.$eval('.fe-ql-table', t => ({ fit: t.classList.contains('fe-rz-fit'), w: [...t.querySelectorAll('thead th')].map(th => Math.round(th.getBoundingClientRect().width)) }));
  check(fit.fit && fit.w[0] < 100 && fit.w[3] < 140 && [2, 4, 5].every(i => fit.w[i] <= 440 && fit.w[i] > fit.w[1]), `a wide data table starts with widths from its content: ${JSON.stringify(fit)}`);
  await page.screenshot({ path: join(SHOTS, 'table-fit.png'), clip: { x: 0, y: 0, width: 1400, height: 520 } });
  await page.keyboard.press('Escape');
  await page.goto('file://' + md, { waitUntil: 'load' });
  await page.waitForSelector('#fe-side-rz');

  // The sidebar's handle answers the arrows like every resize handle.
  const side0 = await page.$eval('#fe-side', s => Math.round(s.getBoundingClientRect().width));
  await page.focus('#fe-side-rz');
  await page.keyboard.press('ArrowRight');
  const side1 = await page.$eval('#fe-side', s => Math.round(s.getBoundingClientRect().width));
  const role = await page.$eval('#fe-side-rz', el => [el.getAttribute('role'), el.getAttribute('aria-label')]);
  check(side1 - side0 === 16 && role[0] === 'separator' && !!role[1], `the sidebar handle is a separator the arrows move: ${JSON.stringify({ side0, side1, role })}`);
  await page.keyboard.press('ArrowLeft');
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'table resize walk passes');
