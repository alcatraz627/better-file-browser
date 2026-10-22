// Panels: dialogs and the floating preview share one skin; the size button
// steps md, lg, xl and each panel remembers its size; a docked preview folds
// the sidebar and closing it brings the sidebar back, unless the setting is
// off; cards share one corner. One theme per run; BFB_THEME=light for the other.
//   node e2e/panels-walk.mjs   → e2e/shots/panels-*.png
import { launch, shot, applyTheme } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
try {
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  await applyTheme(page);
  const skin = sel => page.$eval(sel, b => { const cs = getComputedStyle(b), r = b.getBoundingClientRect();
    return { r: cs.borderTopLeftRadius, sh: cs.boxShadow !== 'none', bd: cs.borderTopWidth, w: Math.round(r.width), h: Math.round(r.height) }; });
  const sideShown = () => page.$eval('#fe-side', s => s.style.display !== 'none' && s.getBoundingClientRect().width > 40);

  // Settings: the skin, then the size button.
  await page.keyboard.press(','); await page.waitForSelector('#fe-settings-modal .fe-dlg-box', { visible: true }); await sleep(300);
  const dlg = await skin('#fe-settings-modal .fe-dlg-box');
  const card = await page.$eval('#fe-settings-modal .fe-set-card', c => getComputedStyle(c).borderTopLeftRadius);
  check(dlg.r === '12px' && dlg.sh && card === '8px', `a dialog is a 12px panel with a shadow and 8px cards: ${JSON.stringify({ dlg, card })}`);
  const sizes = [];
  for (let i = 0; i < 3; i++) {
    await page.click('#fe-settings-modal-size'); await sleep(250);
    sizes.push({ ...(await skin('#fe-settings-modal .fe-dlg-box')), size: await page.$eval('#fe-settings-modal .fe-dlg-box', b => b.dataset.size ?? 'md') });
    if (i === 1) await page.screenshot({ path: await shot(page, 'panels-dialog-xl') });
  }
  check(sizes.map(s => s.size).join() === 'lg,xl,md' && sizes[0].w > dlg.w && sizes[1].w > sizes[0].w && sizes[2].w === dlg.w,
    `the size button steps lg, xl, md: ${JSON.stringify(sizes)}`);
  await page.click('#fe-settings-modal-size'); await sleep(200);   // leave it at lg
  await page.keyboard.press('Escape'); await sleep(200);
  await page.reload({ waitUntil: 'load' }); await sleep(500);
  await page.keyboard.press(','); await page.waitForSelector('#fe-settings-modal .fe-dlg-box', { visible: true }); await sleep(300);
  const kept = await page.$eval('#fe-settings-modal .fe-dlg-box', b => b.dataset.size ?? 'md');
  const help = await page.evaluate(() => document.querySelector('#fe-help-modal .fe-dlg-box')?.dataset.size ?? 'md');
  check(kept === 'lg' && help === 'md', `each dialog remembers its own size: ${JSON.stringify({ settings: kept, help })}`);
  await page.click('#fe-settings-modal-size'); await sleep(100);
  await page.click('#fe-settings-modal-size'); await sleep(100);   // back to md
  await page.keyboard.press('Escape'); await sleep(200);

  // The floating preview wears the same skin, and sizes the same way.
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td.c-nm')).click();
  await page.waitForSelector('#fe-qlook', { visible: true }); await sleep(400);
  const fl = await skin('#fe-ql-dialog');
  check(fl.r === dlg.r && fl.sh, `the floating preview has the dialog's corner and shadow: ${JSON.stringify(fl)}`);
  await page.click('#fe-ql-size'); await sleep(250);
  const lg = await skin('#fe-ql-dialog');
  check(lg.w > fl.w, `the preview's size button makes it larger: ${fl.w} → ${lg.w}`);
  await page.click('#fe-ql-size'); await sleep(100);
  await page.click('#fe-ql-size'); await sleep(100);

  // Docked, it folds the sidebar; floated or closed, the sidebar returns.
  check(await sideShown(), 'the sidebar shows with a floating preview');
  await page.click('#fe-ql-dock'); await sleep(600);
  const dock = await skin('#fe-ql-dialog');
  check(!(await sideShown()) && dock.r === '0px' && !dock.sh, `docking folds the sidebar and drops the panel's corner: ${JSON.stringify(dock)}`);
  await page.screenshot({ path: await shot(page, 'panels-docked') });
  await page.keyboard.press('Escape'); await sleep(600);
  check(await sideShown(), 'closing the docked preview brings the sidebar back');

  // The hamburger shows a folded sidebar on its first press.
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td.c-nm')).click();
  await page.waitForSelector('#fe-qlook', { visible: true }); await sleep(600);
  await page.click('#fe-side-toggle'); await sleep(600);
  check(await sideShown(), 'the hamburger brings a folded sidebar back at once');
  await page.keyboard.press('Escape'); await sleep(600);
  check(await sideShown(), 'and it stays after the preview closes');

  // With the setting off, docking leaves the sidebar alone.
  await page.keyboard.press(','); await page.waitForSelector('#fe-st-dock-fold'); await sleep(200);
  await page.evaluate(() => { const b = document.getElementById('fe-st-dock-fold'); b.checked = false; b.dispatchEvent(new Event('change')); });
  await page.keyboard.press('Escape'); await sleep(200);
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td.c-nm')).click();
  await page.waitForSelector('#fe-qlook', { visible: true }); await sleep(600);
  check(await sideShown(), 'with the setting off, a docked preview leaves the sidebar');
  await page.click('#fe-ql-dock'); await sleep(400);   // float again for the next run
  await page.keyboard.press('Escape'); await sleep(200);
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
