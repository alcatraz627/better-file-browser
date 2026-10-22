// The consistency-audit screenshot set: the listing toolbar and its panels,
// every view, menus, preview and file pages, in one theme. Pair it with
// BFB_THEME=light to get the light set beside the dark one.
//   node e2e/audit-shots.mjs && BFB_THEME=light node e2e/audit-shots.mjs
import { launch, shot, applyTheme } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  const page = await h.open();
  await applyTheme(page);
  await sleep(400);

  const clip = async (name, sel, pad = 8) => {
    const box = await page.$eval(sel, el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    await page.screenshot({ path: (await shot(page, name)), clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 } });
  };

  await shot(page, 'audit-listing');
  await clip('audit-toolbar', '#fe-toolbar');
  await clip('audit-tabbar', '#fe-tabbar');
  await clip('audit-bar', '#fe-bar');

  await page.click('#fe-sg-btn'); await sleep(300);
  await shot(page, 'audit-sort-panel');
  await page.click('#fe-sg-btn'); await sleep(200);

  await page.click('#fe-filter-btn'); await sleep(300);
  await shot(page, 'audit-filter-bar');
  await page.click('#fe-filter-btn'); await sleep(200);

  for (const v of ['details', 'list', 'tree', 'tiles', 'icons']) {
    await page.$eval(`.fe-view-btn[data-view="${v}"]`, b => b.click()); await sleep(350);
    await shot(page, `audit-view-${v}`);
  }
  // Each view at the two ends of the detail scale and one step in.
  // The control's value property lives in the extension's world; the range input is shared.
  const setDensity = d => page.$eval('#fe-density input', (r, d) => {
    r.value = String(d - 1);
    r.dispatchEvent(new Event('input', { bubbles: true }));
    r.dispatchEvent(new Event('change', { bubbles: true }));
  }, d);
  for (const v of ['details', 'list', 'tiles', 'icons']) {
    await page.$eval(`.fe-view-btn[data-view="${v}"]`, b => b.click());
    for (const d of [1, 2, 4, 5]) { await setDensity(d); await sleep(300); await shot(page, `audit-density-${v}-${d}`); }
    await setDensity(3);
  }
  await page.$eval('.fe-view-btn[data-view="details"]', b => b.click()); await sleep(300);

  await page.click('#fe-tbody tr.fe-row:not(.dir):not(.dotfile):not(.par)', { button: 'right' }); await sleep(300);
  await shot(page, 'audit-context-menu');
  await page.keyboard.press('Escape'); await sleep(200);

  await page.click('#fe-tbody tr.fe-row:not(.dir):not(.dotfile):not(.par)'); await page.keyboard.press('Space'); await sleep(600);
  await shot(page, 'audit-preview');
  await page.keyboard.press('Escape'); await sleep(200);

  await page.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await page.waitForSelector('#fe'); await sleep(800);
  await shot(page, 'audit-file-md');
  await page.goto('file://' + h.fixture + '/code.py', { waitUntil: 'load' });
  await page.waitForSelector('#fe'); await sleep(600);
  await shot(page, 'audit-file-code');
} finally { await h.close(); }
