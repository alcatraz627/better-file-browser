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
} finally { await h.close(); }
