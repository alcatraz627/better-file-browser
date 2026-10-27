// A narrow window folds the sidebar away so the page keeps its room, without
// touching the saved setting; widening brings it back, and the hamburger still
// opens it while narrow. BFB_THEME=light runs it on the light theme.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, applyTheme, shot } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  writeFileSync(join(h.fixture, 'readme.md'), '# Readme\n\nSome words to read.\n');
  const page = await h.open(h.fixture);
  await applyTheme(page);
  const state = () => page.evaluate(() => ({ side: getComputedStyle(document.getElementById('fe-side')).display !== 'none', w: innerWidth }));
  check((await state()).side, 'at 1400px the sidebar shows');

  await page.setViewport({ width: 900, height: 900 });
  await sleep(500);
  const narrow = await state();
  check(!narrow.side, `at 900px the sidebar folds away: ${JSON.stringify(narrow)}`);
  const saved = JSON.parse(await h.store.get('bfb-settings-v1') ?? '{}');
  check(saved.showSidebar !== false, `folding for width leaves the saved setting alone: ${saved.showSidebar}`);
  await shot(page, 'narrow-side-900');

  await page.click('#fe-side-toggle');
  await sleep(400);
  check((await state()).side, 'the hamburger still opens it while narrow');
  await page.click('#fe-side-toggle');
  await sleep(400);

  await page.setViewport({ width: 1400, height: 900 });
  await sleep(500);
  check((await state()).side, 'widening brings the sidebar back');

  // A page opened narrow starts folded.
  await page.setViewport({ width: 900, height: 900 });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-side', { timeout: 5000 });
  await sleep(300);
  check(!(await state()).side, 'a page opened in a narrow window starts with the sidebar folded');

  // Narrower still, the lens rail takes over: the sidebar is not folded away.
  await page.setViewport({ width: 500, height: 800 });
  await sleep(500);
  check((await state()).side, 'at 500px the lens rail shows instead of folding away');
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
