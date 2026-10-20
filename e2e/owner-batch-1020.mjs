// Owner review 2026-10-20: default sort in Settings, and tooltips on icon-only
// buttons. Each check maps to a row in docs/plan/20261020-consistency-pass.md.
import { launch, shot } from './harness.mjs';

const h = await launch();
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failed++; };
const names = p => p.$$eval('#fe-tbody tr[data-idx]:not(.par) .fe-nm', els => els.map(e => e.textContent));

try {
  // R11: Settings sets the order, the current folder re-sorts, and a folder
  // opened later uses it too.
  let page = await h.open();
  await page.click('#fe-settings-btn');
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="appearance"]').catch(() => null);
  await page.select('#fe-st-sort', 'size');
  await page.select('#fe-st-sort-dir', 'desc');
  await page.select('#fe-st-group', 'none');
  await page.keyboard.press('Escape');
  const here = await names(page);
  const stored = await h.store.json('bfb-sort-v1', null);
  check(stored?.col === 'size' && stored?.dir === 'desc', `Settings stores the sort: ${JSON.stringify(stored)}`);
  const sizes = await page.$$eval('#fe-tbody tr[data-idx]:not(.par)', rs => rs.map(r => Number(r.dataset.bytes ?? NaN)));
  check(here[0] === 'readme.md', `the open folder re-sorts largest first: ${JSON.stringify(here.slice(0, 3))}`);
  await page.goto('file://' + h.fixture + '/nested/', { waitUntil: 'load' });
  await page.waitForSelector('#fe');
  const arrow = await page.$eval('th[data-sort="size"] .si', e => e.textContent);
  check(arrow === '↓', `a folder opened later sorts by size descending too (header arrow ${arrow})`);
  await page.close();
  await h.store.remove('bfb-sort-v1');

  // R2: icon-only buttons show a tooltip, in dark and light.
  for (const theme of ['dark', 'light']) {
    await h.store.set('bfb-theme', theme);
    await h.store.set('bfb-preview-layout-v1', { mode: 'side', sideW: 640 });
    page = await h.open();
    await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td.c-nm')).click();
    await page.waitForSelector('#fe-qlook.side #fe-ql-body h1', { timeout: 8_000 });
    await new Promise(r => setTimeout(r, 300));
    for (const id of ['fe-ql-dock', 'fe-ql-copy', 'fe-settings-btn', 'fe-theme-btn']) {
      const box = await page.$eval('#' + id, e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), disp: getComputedStyle(e).display }; });
      if (!box.w || !box.h) { check(false, `${theme}: #${id} is not on screen: ${JSON.stringify(box)}`); continue; }
      const want = await page.$eval('#' + id, e => e.getAttribute('title'));
      await page.hover('#' + id);
      await page.waitForSelector('#fe-hint.on', { timeout: 2_000 }).catch(() => null);
      const tip = await page.evaluate(() => {
        const t = document.getElementById('fe-hint'); const r = t.getBoundingClientRect();
        return { on: t.classList.contains('on'), text: t.textContent, inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight };
      });
      check(tip.on && tip.text === want && tip.inView, `${theme}: hovering #${id} shows "${want}": ${JSON.stringify(tip)}`);
      if (id === 'fe-ql-dock') { await new Promise(r => setTimeout(r, 200)); await shot(page, `tooltip-preview-${theme}`); }
      await page.mouse.move(5, 500);
      await new Promise(r => setTimeout(r, 200));
      const back = await page.$eval('#' + id, e => e.getAttribute('title'));
      check(back === want && !(await page.$('#fe-hint.on')), `${theme}: leaving #${id} hides it and keeps the title`);
    }
    await page.close();
  }
} finally {
  await h.close();
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
