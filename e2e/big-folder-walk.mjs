// A big folder and a folder full of screenshots: the page does not freeze drawing rows
// it will throw away, and pictures load as they come near the view, not all at once.
// Counts and the longest freeze are compared to a wide limit, since timings move with
// how busy the machine is.
//
//   node e2e/big-folder-walk.mjs
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  const png = join(homedir(), '.claude/assets/decision-pages/bfb-design-directions/listing.png');
  const files = join(h.fixture, 'files'), images = join(h.fixture, 'images');
  mkdirSync(files); mkdirSync(images);
  for (let i = 0; i < 3000; i++) writeFileSync(join(files, `file-${String(i).padStart(4, '0')}.txt`), 'x');
  for (let i = 0; i < 407; i++) copyFileSync(png, join(images, `shot-${String(i).padStart(3, '0')}.png`));
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.evaluateOnNewDocument(() => {
    window.__long = [];
    new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
    // Rows that exist at the first moment the listing script could see them.
    window.__firstRows = null;
    const look = () => { const t = document.getElementById('fe-tbody'); if (t && window.__firstRows === null) window.__firstRows = t.children.length + document.getElementById('fe-tiles').children.length; };
    new MutationObserver(look).observe(document, { childList: true, subtree: true });
  });
  const open = async (dir, view) => {
    await h.store.set('bfb-view', view);
    await page.goto('about:blank');
    await page.goto('file://' + dir + '/', { waitUntil: 'load' });
    await page.waitForSelector('#fe-scroll [data-idx]', { timeout: 60000 });
    await wait(1200);
  };
  const pictures = () => page.evaluate(() => {
    const all = [...document.querySelectorAll('#fe-tiles .fe-tile-thumb')];
    const box = document.getElementById('fe-scroll').getBoundingClientRect();
    const seen = all.filter(i => { const r = i.getBoundingClientRect(); return r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom && r.width > 0; });
    return { total: all.length, asked: all.filter(i => i.getAttribute('src')).length, seen: seen.length, seenLoaded: seen.filter(i => i.complete && i.naturalWidth).length };
  });

  await open(files, 'details');
  const big = await page.evaluate(() => ({ longest: Math.max(0, ...window.__long), rows: document.querySelectorAll('#fe-tbody tr[data-idx]').length }));
  check(big.longest < 1500 && big.rows < 300, `3,000 files open with no long freeze and a window of rows: ${JSON.stringify(big)}`);

  for (const view of ['tiles', 'gallery']) {
    await open(images, view);
    await wait(800);
    const p = await pictures();
    check(p.total === 407 && p.asked < 150 && p.seen > 0 && p.seenLoaded === p.seen, `${view}: only pictures near the view load: ${JSON.stringify(p)}`);
    await page.evaluate(v => { const s = document.getElementById('fe-scroll'); if (v === 'gallery') s.scrollLeft = s.scrollWidth; else s.scrollTop = s.scrollHeight; }, view);
    await wait(1500);
    const after = await pictures();
    check(after.seen > 0 && after.seenLoaded === after.seen, `${view}: scrolling to the end loads what comes into view: ${JSON.stringify(after)}`);
  }
} finally {
  console.log(results.join('\n'));
  await h.close();
}
