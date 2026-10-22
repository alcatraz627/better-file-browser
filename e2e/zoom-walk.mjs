// Interface size above 100%: the page zooms, and menus still open under the
// control that opened them (the crumb chevron and the tab list).
import { launch } from './harness.mjs';

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  await h.store.set('bfb-settings-v1', { showSidebar: true, tooltips: true, uiScale: 125 });
  const page = await h.open();
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.fe-crumb-dd');
  await sleep(400);
  const dpr = await page.evaluate(() => devicePixelRatio);
  check(Math.abs(dpr - 1.25) < 0.01, `the tab is zoomed to 125%: devicePixelRatio ${dpr}`);
  await page.click('.fe-crumb-dd');
  await page.waitForSelector('#fe-crumb-menu .fe-dd-item');
  const r = await page.evaluate(() => {
    const a = document.querySelector('.fe-crumb-dd').getBoundingClientRect();
    const m = document.getElementById('fe-crumb-menu').getBoundingClientRect();
    return { a: a.left, ab: a.bottom, m: m.left, mt: m.top };
  });
  check(Math.abs(r.m - r.a) < 12 && r.mt >= r.ab - 2 && r.mt - r.ab < 16, `the crumb menu opens under its chevron: ${JSON.stringify(r)}`);
} finally {
  await h.close();
  process.exitCode = fails.length ? 1 : 0;
}
