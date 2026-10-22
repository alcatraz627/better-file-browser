// Screenshots of each floating part opened through the layer service, in dark
// and light, so a change to how layers open can be judged by eye.
//   node e2e/layer-shots.mjs   → e2e/shots/layer-<part>-<theme>.png
import { launch } from './harness.mjs';

const h = await launch();
try {
  const page = await h.open();
  for (const theme of ['dark', 'light']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; document.getElementById('fe').dataset.theme = t; }, theme);
    const row = await page.$('#fe-tbody tr:not(.dir):not(.dotfile):not(.par)');
    const r = await row.boundingBox();
    await page.mouse.click(r.x + 60, r.y + r.height / 2, { button: 'right' });
    await new Promise(res => setTimeout(res, 250));
    const box = await page.$eval('#fe-ctx', m => { const b = m.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, bg: getComputedStyle(m).backgroundColor, inset: getComputedStyle(m).inset }; });
    console.log(theme, JSON.stringify(box));
    await page.screenshot({ path: new URL(`./shots/layer-ctx-${theme}.png`, import.meta.url).pathname, clip: { x: Math.max(0, box.x - 80), y: Math.max(0, box.y - 60), width: box.w + 160, height: box.h + 120 } });
    await page.keyboard.press('Escape');
  }

  // The palette opened while a menu is open takes focus, and the menu closes.
  const row2 = await page.$('#fe-tbody tr:not(.dir):not(.dotfile):not(.par)');
  const r2 = await row2.boundingBox();
  await page.mouse.click(r2.x + 60, r2.y + r2.height / 2, { button: 'right' });
  await new Promise(res => setTimeout(res, 150));
  await page.keyboard.down('Meta'); await page.keyboard.press('k'); await page.keyboard.up('Meta');
  await new Promise(res => setTimeout(res, 200));
  const onTop = await page.evaluate(() => {
    const hit = document.elementFromPoint(innerWidth / 2, innerHeight * 0.2);
    return { menu: !!document.getElementById('fe-ctx'), hitPalette: !!hit?.closest('.fe-pal-wrap'), focus: document.activeElement?.closest('.fe-pal') != null };
  });
  const palOk = !onTop.menu && onTop.hitPalette && onTop.focus;
  console.log(`${palOk ? 'ok  ' : 'FAIL'} the palette opened with a menu open takes focus and the menu closes: ${JSON.stringify(onTop)}`);
  if (!palOk) process.exitCode = 1;
  const wrap = await page.$eval('.fe-pal-wrap', w => { const r = w.getBoundingClientRect(); return { w: r.width, h: r.height, bg: getComputedStyle(w).backgroundColor }; });
  console.log('palette scrim', JSON.stringify(wrap));
  await page.screenshot({ path: new URL('./shots/layer-palette-light.png', import.meta.url).pathname });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // The floating preview sits in the top layer, the palette opens over it,
  // and the docked preview leaves the top layer for the page's own layout.
  await page.$eval('#fe-tbody tr:not(.dir):not(.dotfile):not(.par) .fe-name, #fe-tbody tr:not(.dir):not(.dotfile):not(.par) a', a => a.click());
  await page.waitForFunction(() => document.getElementById('fe-qlook')?.style.display === 'flex', { timeout: 4000 });
  const floatTop = await page.$eval('#fe-qlook', q => q.matches(':popover-open'));
  await page.keyboard.down('Meta'); await page.keyboard.press('k'); await page.keyboard.up('Meta');
  await new Promise(res => setTimeout(res, 200));
  const palOver = await page.evaluate(() => !!document.elementFromPoint(innerWidth / 2, innerHeight * 0.2)?.closest('.fe-pal-wrap'));
  await page.keyboard.press('Escape');
  const stillOpen = await page.$eval('#fe-qlook', q => q.style.display === 'flex');
  await page.$eval('#fe-ql-dock', b => b.click());
  await new Promise(res => setTimeout(res, 300));
  const docked = await page.$eval('#fe-qlook', q => ({ side: q.classList.contains('side'), top: q.matches(':popover-open'), pos: getComputedStyle(q).position }));
  await page.$eval('#fe-ql-dock', b => b.click());
  await new Promise(res => setTimeout(res, 300));
  const back = await page.$eval('#fe-qlook', q => q.matches(':popover-open'));
  const pvOk = floatTop && palOver && stillOpen && docked.side && !docked.top && docked.pos === 'relative' && back;
  console.log(`${pvOk ? 'ok  ' : 'FAIL'} the floating preview is a top-layer part, the palette opens over it and Esc closes only the palette, docking leaves the top layer: ${JSON.stringify({ floatTop, palOver, stillOpen, docked, back })}`);
  if (!pvOk) process.exitCode = 1;
  await page.keyboard.press('Escape');
  await new Promise(res => setTimeout(res, 200));

  // Resting on a Saved row shows its card beside the sidebar.
  await page.keyboard.press('b');
  await page.keyboard.press('g'); await page.keyboard.press('2');
  await new Promise(res => setTimeout(res, 1500));
  const saved = await page.$('#fe-lens-saved .fe-pl-item');
  if (saved) {
    await saved.hover();
    await new Promise(res => setTimeout(res, 700));
    const card = await page.$eval('#fe-sv-card', c => ({ shown: !c.hidden, top: c.matches(':popover-open'), text: c.querySelector('b')?.textContent}));
    console.log(`${card.shown && card.top ? 'ok  ' : 'FAIL'} a Saved row shows its card in the top layer: ${JSON.stringify(card)}`);
    if (!(card.shown && card.top)) process.exitCode = 1;
    await page.screenshot({ path: new URL('./shots/layer-saved-card-light.png', import.meta.url).pathname, clip: { x: 0, y: 40, width: 640, height: 200 } });
    await page.mouse.move(900, 600);
  } else { console.log('FAIL no Saved row to hover'); process.exitCode = 1; }

  // The tab's "…" button, pressed with a real mouse: open, then shut, then open.
  await page.keyboard.press('t');
  await new Promise(res => setTimeout(res, 200));
  const tab = await page.$('#fe-tabs .fe-tab[data-id]:not([data-id=""])');
  await tab.hover();
  const more = await tab.$('.fe-tab-more');
  const states = [];
  for (let i = 0; i < 3; i++) {
    await more.click();
    await new Promise(res => setTimeout(res, 150));
    states.push(!!(await page.$('.fe-tab-menu')));
  }
  const ok = states.join() === 'true,false,true';
  console.log(`${ok ? 'ok  ' : 'FAIL'} the tab menu button toggles with a real mouse: ${states.join(' → ')}`);
  if (!ok) process.exitCode = 1;
  const b = await page.$eval('.fe-tab-menu', m => { const r = m.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.screenshot({ path: new URL('./shots/layer-tabmenu-light.png', import.meta.url).pathname, clip: { x: Math.max(0, b.x - 120), y: Math.max(0, b.y - 60), width: b.w + 240, height: b.h + 100 } });

  // A tooltip shown while the menu is open draws over it.
  const near = await page.$$('#fe-tabs-end button[title]');
  for (const btn of near) if (await btn.isVisible()) { await btn.hover(); break; }
  await new Promise(res => setTimeout(res, 600));
  const tipOn = await page.$eval('#fe-hint', t => t.classList.contains('on') && t.matches(':popover-open'));
  const menuStill = !!(await page.$('.fe-tab-menu'));
  console.log(`${tipOn && menuStill ? 'ok  ' : 'FAIL'} a tooltip shows in the top layer while the menu is open: ${JSON.stringify({ tipOn, menuStill })}`);
  if (!(tipOn && menuStill)) process.exitCode = 1;
  await page.screenshot({ path: new URL('./shots/layer-tip-over-menu-light.png', import.meta.url).pathname, clip: { x: Math.max(0, b.x - 120), y: Math.max(0, b.y - 60), width: b.w + 240, height: b.h + 100 } });
} finally { await h.close(); }
