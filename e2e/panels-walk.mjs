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

  // A second press during the slide reverses it.
  await page.click('#fe-side-toggle'); await sleep(80);
  await page.click('#fe-side-toggle'); await sleep(600);
  check(await sideShown(), 'two quick hamburger presses end with the sidebar shown');

  // A lens key unfolds a sidebar the docked preview folded.
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td.c-nm')).click();
  await page.waitForSelector('#fe-qlook', { visible: true }); await sleep(600);
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="notes.txt"]) td.c-nm')).click(); await sleep(300);
  await page.keyboard.press('g'); await page.keyboard.press('2'); await sleep(600);
  const lens = await page.evaluate(() => ({ vis: !!document.getElementById('fe-lens-saved')?.checkVisibility(), hidden: document.getElementById('fe-lens-saved')?.hidden, side: document.getElementById('fe-side').style.display, act: document.activeElement?.id || document.activeElement?.className, docked: !!document.querySelector('#fe-qlook.side') }));
  check(await sideShown() && lens.vis, `g 2 brings back a folded sidebar on Saved: ${JSON.stringify({ lens })}`);
  await page.keyboard.press('Escape'); await sleep(200);
  await page.keyboard.press('Escape'); await sleep(600);

  // Settings in the sidebar: the same dialog, moved into a pane over the
  // lenses, its tabs across the top; remembered; Esc closes it.
  await page.keyboard.press(','); await page.waitForSelector('#fe-settings-modal .fe-dlg-box', { visible: true }); await sleep(300);
  await page.click('#fe-settings-modal .fe-dlg-place'); await sleep(400);
  const pane = () => page.evaluate(() => {
    const box = document.querySelector('#fe-settings-modal .fe-dlg-box') ?? document.querySelector('#fe-side-pane .fe-dlg-box');
    const tabs = box?.querySelector('.fe-dlg-tabs');
    return { inPane: !!box?.closest('#fe-side-pane'), paneShown: !!document.getElementById('fe-side-pane')?.checkVisibility(),
      scrim: document.getElementById('fe-settings-modal').style.display, tabsDir: tabs ? getComputedStyle(tabs).flexDirection : null,
      radius: box ? getComputedStyle(box).borderTopLeftRadius : null, w: Math.round(box?.getBoundingClientRect().width ?? 0) };
  });
  const sp = await pane();
  check(sp.inPane && sp.paneShown && sp.scrim === 'none' && sp.tabsDir === 'row' && sp.radius === '0px', `Settings opens in the sidebar with its tabs across the top: ${JSON.stringify(sp)}`);
  await page.screenshot({ path: await shot(page, 'panels-settings-side') });
  await page.focus('#fe-side-pane .fe-dlg-tab.on'); await page.keyboard.press('Escape'); await sleep(300);
  const shut = await pane();
  check(!shut.inPane && !shut.paneShown, `Esc in the pane closes it: ${JSON.stringify(shut)}`);
  await page.keyboard.press(','); await sleep(400);
  const again = await pane();
  check(again.inPane && again.paneShown, `Settings reopens in the sidebar: ${JSON.stringify(again)}`);
  await page.click('#fe-side-pane .fe-dlg-place'); await sleep(400);
  const win = await pane();
  check(!win.inPane && win.scrim === 'flex' && win.tabsDir === 'column', `and goes back to a window: ${JSON.stringify(win)}`);
  await page.keyboard.press('Escape'); await sleep(200);

  // Help in the sidebar: nothing in it is wider than the pane.
  await page.keyboard.press('?'); await page.waitForSelector('#fe-help-modal .fe-dlg-box', { visible: true }); await sleep(300);
  await page.click('#fe-help-modal .fe-dlg-place'); await sleep(400);
  const over = [];
  for (const t of ['keys', 'start', 'mouse']) {
    await page.click(`#fe-side-pane .fe-dlg-tab[data-tab="${t}"]`); await sleep(250);
    over.push(await page.$eval(`#fe-side-pane .fe-dlg-pane[data-tab="${t}"]`, p => ({ t: p.dataset.tab, wide: p.scrollWidth - p.clientWidth })));
    if (t !== 'mouse') await page.screenshot({ path: await shot(page, `panels-help-side-${t}`) });
  }
  check(over.every(o => o.wide <= 1), `Help pages fit the sidebar: ${JSON.stringify(over)}`);
  await page.click('#fe-side-pane .fe-dlg-place'); await sleep(300);
  await page.keyboard.press('Escape'); await sleep(200);

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
