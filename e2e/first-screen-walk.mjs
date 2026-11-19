// Big folders draw their first screen first. A folder of 3000 files in the
// Tiles view shows its first tiles before the rest are built, then fills in to
// every file. A filter typed while it fills leaves only the matching tiles, with
// nothing from the old fill added after. A small folder is drawn in one go.
//
//   node e2e/first-screen-walk.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const h = await launch();
let failed = 0;
const check = (ok, msg, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${ok || got === undefined ? '' : `  got: ${JSON.stringify(got)}`}`); if (!ok) failed++; };
const N = 3000;

try {
  const big = join(h.fixture, 'big');
  mkdirSync(big);
  for (let i = 0; i < N; i++) writeFileSync(join(big, `file-${String(i).padStart(4, '0')}.txt`), 'x');
  await h.store.set('bfb-view', 'tiles');
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1300, height: 900 });
  page.on('pageerror', e => check(false, `no page error (${e.message})`));

  // Count the tiles at the first moment any exist, from inside the page.
  await page.evaluateOnNewDocument(() => {
    const seen = () => {
      const box = document.getElementById('fe-tiles');
      const n = box?.querySelectorAll('.fe-tile').length ?? 0;
      if (n) { window.__first = { n, busy: box.getAttribute('aria-busy') }; return; }
      requestAnimationFrame(seen);
    };
    requestAnimationFrame(seen);
  });
  await page.goto('file://' + big + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__first, { timeout: 15000 });
  const first = await page.evaluate(() => window.__first);
  check(first.n < 1000 && first.busy === 'true', 'the first screen of tiles shows before the rest are built', first);
  await page.waitForFunction(n => document.querySelectorAll('#fe-tiles .fe-tile').length >= n && !document.getElementById('fe-tiles').hasAttribute('aria-busy'), { timeout: 20000 }, N);
  const all = await page.$$eval('#fe-tiles .fe-tile', ts => ts.length);
  check(all === N + 1, 'then every file is drawn, once', all);

  // A filter typed while a fill runs: only matching tiles remain.
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-tiles .fe-tile');
  await page.click('#fe-search');
  await page.keyboard.type('file-29');
  await new Promise(r => setTimeout(r, 1500));
  const names = await page.$$eval('#fe-tiles .fe-tile', ts => ts.map(t => t.dataset.name ?? t.textContent.trim()));
  const nonMatching = names.filter(n => n && !n.includes('file-29') && n !== '..' && !/^\.\.?$/.test(n));
  check(nonMatching.length === 0 && names.filter(n => n.includes('file-29')).length === 100, 'a filter during the fill leaves only its 100 matches, nothing stale added', { total: names.length, stray: nonMatching.slice(0, 3) });

  // A small folder: drawn whole at once.
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tiles .fe-tile');
  check(!await page.$eval('#fe-tiles', t => t.hasAttribute('aria-busy')), 'a small folder is drawn in one go');
} catch (err) {
  console.error(err);
  failed++;
} finally {
  await h.close();
  if (failed) { console.log(`${failed} failed`); process.exitCode = 1; }
}
