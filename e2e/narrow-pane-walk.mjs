// A wide window with a wide docked preview leaves the file list narrow. The
// list must stay usable there: no sideways scroll, every control reachable,
// and Cmd+F must not shove the columns out of view.
import { launch, shot } from './harness.mjs';

const h = await launch();
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failed++; };

try {
  await h.store.set('bfb-preview-layout-v1', { mode: 'side', sideW: 880 });
  await h.store.set('bfb-zoom', '130');
  const page = await h.open();
  await page.setViewport({ width: 1519, height: 700 });
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td.c-nm')).click();
  await page.waitForSelector('#fe-qlook.side', { timeout: 5_000 });
  await new Promise(r => setTimeout(r, 300));
  const state = () => page.evaluate(() => {
    const main = document.getElementById('fe-main').getBoundingClientRect();
    const inside = id => { const r = document.getElementById(id).getBoundingClientRect(); return r.left >= main.left - 1 && r.right <= main.right + 1; };
    const name = document.querySelector('#fe thead th')?.getBoundingClientRect();
    return {
      mainLeft: document.getElementById('fe-main').scrollLeft,
      toolbarOverflow: document.getElementById('fe-toolbar').scrollWidth - document.getElementById('fe-toolbar').clientWidth,
      filterInside: inside('fe-search'),
      nameVisible: !!name && name.left >= main.left - 1,
      paneW: Math.round(main.width),
    };
  });
  const before = await state();
  check(before.toolbarOverflow <= 1 && before.filterInside, `toolbar fits a ${before.paneW}px pane, Filter reachable: ${JSON.stringify(before)}`);
  await page.keyboard.down('Meta'); await page.keyboard.press('f'); await page.keyboard.up('Meta');
  await new Promise(r => setTimeout(r, 300));
  const after = await state();
  const focused = await page.evaluate(() => document.activeElement?.id);
  check(focused === 'fe-search' && after.mainLeft === 0 && after.nameVisible, `Cmd+F focuses Filter and keeps the columns in place: ${JSON.stringify({ focused, ...after })}`);
  console.log(await shot(page, 'narrow-pane-cmdf'));
} finally {
  await h.close();
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
