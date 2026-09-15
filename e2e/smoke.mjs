// Smoke run: the explorer renders the fixture, a preview opens and closes,
// and screenshots land in e2e/shots/. Run with `npm run e2e`.
import { launch, shot } from './harness.mjs';

const failures = [];
function check(cond, msg) {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures.push(msg);
}

const h = await launch({ headless: process.env.BFB_HEADED ? false : true });
try {
  const page = await h.open();

  const rows = await page.$$eval('#fe-tbody tr[data-idx]', els => els.length);
  // 7 visible files + nested dir + parent row; .hidden is off by default
  check(rows === 9, `renders ${rows} rows (expected 9)`);

  const count = await page.$eval('#fe-count', el => el.textContent);
  check(/1 folder, 7 files/.test(count), `status count reads "${count}"`);
  await shot(page, 'listing');

  // Select readme.md by clicking its row off the anchor (an anchor click
  // navigates), then open the preview with Space.
  const row = await page.$('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td:last-child');
  check(!!row, 'readme.md row present');
  await row.click();
  await page.keyboard.press('Space');
  await page.waitForSelector('#fe-ql-body h1', { timeout: 5_000 }).catch(() => null);
  const h1 = await page.$eval('#fe-ql-body h1', el => el.textContent).catch(() => null);
  check(h1 === 'Fixture', `markdown preview rendered h1 "${h1}"`);
  await shot(page, 'preview-md');

  await page.keyboard.press('Escape');
  const stillOpen = await page.$eval('#fe-qlook', el => el.style.display !== 'none');
  check(!stillOpen, 'Escape closes preview');
} finally {
  await h.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
