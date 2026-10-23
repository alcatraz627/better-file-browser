// Adversarial probe: how long the blank cover stays up on a big folder, from
// the first frame of the new page to the first frame with the explorer drawn.
//
//   node e2e/adv-bigcover-probe.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  for (const n of [200, 1500, 4000]) {
    const d = join(h.fixture, `big${n}`);
    mkdirSync(d, { recursive: true });
    for (let i = 0; i < n; i++) writeFileSync(join(d, `file-${i}.txt`), 'x');
  }
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.evaluateOnNewDocument(() => {
    const t0 = performance.now();
    window.__cov = { first: null, shown: null, dcl: null };
    document.addEventListener('DOMContentLoaded', () => { window.__cov.dcl = Math.round(performance.now() - t0); });
    const tick = () => {
      const t = performance.now() - t0;
      if (window.__cov.first === null) window.__cov.first = Math.round(t);
      if (!document.getElementById('bfb-preload') && document.getElementById('fe')) { window.__cov.shown = Math.round(t); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  for (const n of [200, 1500, 4000]) {
    await page.goto('file://' + h.fixture + `/big${n}/`, { waitUntil: 'load' });
    await sleep(1500);
    const c = await page.evaluate(() => window.__cov);
    console.log(`${n} entries: first frame ${c.first}ms, Chrome listing parsed ${c.dcl}ms, explorer drawn ${c.shown}ms, blank for ${c.shown - c.first}ms`);
  }
} finally {
  await h.close();
}
