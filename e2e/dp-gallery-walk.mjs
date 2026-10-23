// The decision page's pictures and mock pages, walked on a made-up page: four
// options that are live mock pages, three that are pictures, an item with a
// strip of two. Pictures grow in place without picking their option, Esc
// shrinks them, the large view steps with ← →, and compare shows two options
// side by side with one zoom and one scroll. Rows are named for the hub's
// parity ledger (A14, A16, A23, D1 to D3, B13).
//
//   node e2e/dp-gallery-walk.mjs      (BFB_THEME=light for the light theme)
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { launch, shot, applyTheme } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(res => setTimeout(res, ms));
const h = await launch();
try {
  const dir = join(h.fixture, 'dp-gallery');
  mkdirSync(dir);
  const src = join(homedir(), '.claude/assets/decision-pages/bfb-design-directions');
  cpSync(join(src, 'listing.png'), join(dir, 'a.png'));
  cpSync(join(src, 'listing-light.png'), join(dir, 'b.png'));
  const colours = ['#e8f0fe', '#fde8e8', '#e6f6ea', '#fff4d6'];
  colours.forEach((c, i) => writeFileSync(join(dir, `mock${i + 1}.html`), `<!doctype html><html><body style="margin:0;font:48px sans-serif;background:${c};height:2400px">
<h1 id="t" style="margin:0;padding:40px">Variant ${i + 1}</h1>
<script>document.getElementById('t').textContent = 'Variant ${i + 1} live';
try { void parent.document.title; document.body.dataset.parent = 'open'; } catch { document.body.dataset.parent = 'blocked'; }
document.body.dataset.width = String(innerWidth);</script></body></html>`));
  writeFileSync(join(dir, 'config.json'), JSON.stringify({
    title: 'Gallery walk', storageKey: 'gallery-walk',
    decisions: [
      { id: 'D1', question: 'Which mock?', none: true, options: [1, 2, 3, 4].map(n => ({ code: 'abcd'[n - 1], label: `Mock ${n}`, images: [`mock${n}.html`], rec: n === 1 })) },
      { id: 'D2', question: 'Which picture?', options: [{ code: 'a', label: 'Dark', images: ['a.png'], rec: true }, { code: 'b', label: 'Light', images: ['b.png'] }, { code: 'c', label: 'Dark again', images: ['a.png'] }] },
    ],
    sections: [{ id: 's1', title: 'Two shots', images: ['a.png', 'b.png', '../escape.png'] }],
  }));

  const page = await h.open(dir);
  await page.setViewport({ width: 1400, height: 900 });
  await applyTheme(page);
  await page.waitForSelector('#fe-dp:not([hidden]) .fe-dp-media', { timeout: 8000 });
  await wait(1200);

  // Four live mock pages, each laid out at desktop width and scaled into its tile.
  const tiles = await page.evaluate(() => [...document.querySelectorAll('.fe-dp-card[data-id="D1"] .fe-dp-frame')].map(f => {
    const fr = f.getBoundingClientRect(), ir = f.querySelector('iframe').getBoundingClientRect();
    return { top: Math.round(fr.top), tile: Math.round(fr.width), shown: Math.round(ir.width), sandbox: f.querySelector('iframe').getAttribute('sandbox') };
  }));
  check(tiles.length === 4 && new Set(tiles.map(t => t.top)).size === 1 && tiles.every(t => Math.abs(t.tile - t.shown) <= 2 && t.sandbox === 'allow-scripts'),
    `D4 four mock pages show as four tiles in a row, scaled to fit, script-only sandbox: ${JSON.stringify(tiles)}`);
  const frames = [];
  for (const f of page.frames()) {
    if (!/mock\d\.html$/.test(f.url())) continue;
    frames.push(await f.evaluate(() => ({ text: document.getElementById('t').textContent, parent: document.body.dataset.parent, width: document.body.dataset.width })).catch(e => ({ err: String(e) })));
  }
  check(frames.length === 4 && frames.every(f => / live$/.test(f.text) && f.parent === 'blocked' && f.width === '1280'),
    `D5 each mock runs its own script at 1280 wide and cannot reach the page: ${JSON.stringify(frames)}`);

  const picTops = await page.evaluate(() => [...document.querySelectorAll('.fe-dp-card[data-id="D2"] .fe-dp-opt.tile')].map(t => Math.round(t.getBoundingClientRect().top)));
  check(picTops.length === 3 && new Set(picTops).size === 1, `A14 picture options sit side by side: ${JSON.stringify(picTops)}`);
  check(await page.$$eval('.fe-dp-card[data-id="s1"] .fe-dp-media', m => m.length) === 2, 'D1 A23 an item strip shows its two pictures and refuses the ../ one');
  await shot(page, 'dp-gallery');

  // Clicking a picture grows it to the full row and never picks its option.
  const before = await page.$eval('.fe-dp-card[data-id="D2"] input:checked', i => i.value);
  await page.click('.fe-dp-card[data-id="D2"] .fe-dp-opt[data-code="b"] img');
  await wait(400);
  const grown = await page.evaluate(() => {
    const o = document.querySelector('.fe-dp-card[data-id="D2"] .fe-dp-opt[data-code="b"]'), g = o.parentElement;
    return { picked: document.querySelector('.fe-dp-card[data-id="D2"] input:checked').value, zoomed: o.classList.contains('zoomed'), full: Math.abs(o.getBoundingClientRect().width - g.getBoundingClientRect().width) < 2 };
  });
  check(grown.picked === before && grown.zoomed && grown.full, `D2 clicking a picture in an option grows it to the full row and keeps the pick: ${JSON.stringify({ before, ...grown })}`);

  // Several at once; a grown lower picture comes into view.
  await page.evaluate(() => document.getElementById('fe-dp').scrollTo(0, 0));
  await page.evaluate(() => document.querySelectorAll('.fe-dp-card[data-id="s1"] .fe-dp-media img')[1].click());
  await wait(900);
  const lower = await page.evaluate(() => {
    const f = document.querySelectorAll('.fe-dp-card[data-id="s1"] .fe-dp-media')[1], r = f.getBoundingClientRect(), s = document.getElementById('fe-dp').getBoundingClientRect();
    return { zoomed: f.classList.contains('zoomed'), inView: r.top >= s.top - 2 && r.top < s.bottom, count: document.querySelectorAll('#fe-dp .zoomed.fe-dp-media').length };
  });
  check(lower.zoomed && lower.inView && lower.count === 2, `D2 D3 two pictures can be grown at once and a lower one scrolls into view: ${JSON.stringify(lower)}`);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => document.querySelectorAll('#fe-dp .zoomed').length) === 0, 'B13 Esc shrinks every grown picture');

  // The large view: ← → step through the strip, keys behind it stay still, Esc closes.
  await page.hover('.fe-dp-card[data-id="s1"] .fe-dp-media');
  await page.click('.fe-dp-card[data-id="s1"] .fe-dp-media [data-media="focus"]');
  await page.waitForSelector('.fe-dp-view .fe-ql-img', { timeout: 4000 });
  const title = () => page.$eval('.fe-dp-view-title', t => t.textContent);
  const t1 = await title();
  await page.keyboard.press('ArrowRight');
  const t2 = await title();
  await page.keyboard.press('ArrowRight');
  const t3 = await title();
  await page.keyboard.press('ArrowLeft');
  const t4 = await title();
  const curBefore = await page.evaluate(() => document.querySelector('.fe-dp-card.current')?.dataset.id ?? null);
  await page.keyboard.press('j');
  const curAfter = await page.evaluate(() => document.querySelector('.fe-dp-card.current')?.dataset.id ?? null);
  check(t1 === 'a.png · 1 of 2' && t2 === 'b.png · 2 of 2' && t3 === 'a.png · 1 of 2' && t4 === 'b.png · 2 of 2' && curBefore === curAfter,
    `focus-one: ← → step through the strip and wrap; page keys stay still: ${JSON.stringify([t1, t2, t3, t4, curBefore, curAfter])}`);
  await wait(600);
  const opaque = await page.evaluate(() => {
    const b = document.querySelector('.fe-dp-view-box'), cs = getComputedStyle(b);
    return { bg: cs.backgroundColor, opacity: cs.opacity };
  });
  check(opaque.opacity === '1' && !/rgba\(.*, 0\)|transparent/.test(opaque.bg), `the large view is solid over the page: ${JSON.stringify(opaque)}`);
  await shot(page, 'dp-focus');
  await page.keyboard.press('Escape');
  await wait(200);
  check(await page.$('.fe-dp-view') === null, 'Esc closes the large view');

  // A mock page opens large live.
  await page.hover('.fe-dp-card[data-id="D1"] .fe-dp-media');
  await page.click('.fe-dp-card[data-id="D1"] .fe-dp-media [data-media="focus"]');
  await page.waitForSelector('.fe-dp-view iframe.fe-dp-view-frame', { timeout: 4000 });
  const bigMock = await page.evaluate(() => ({ title: document.querySelector('.fe-dp-view-title').textContent, sandbox: document.querySelector('.fe-dp-view-frame').getAttribute('sandbox'), w: Math.round(document.querySelector('.fe-dp-view-frame').getBoundingClientRect().width) }));
  check(bigMock.title === 'mock1.html · 1 of 4' && bigMock.sandbox === 'allow-scripts' && bigMock.w > 1000, `a mock page opens large, live and sandboxed: ${JSON.stringify(bigMock)}`);
  await page.keyboard.press('Escape');
  await wait(200);

  // Compare two picture options: one zoom, one scroll.
  for (const code of ['a', 'b']) {
    await page.hover(`.fe-dp-card[data-id="D2"] .fe-dp-opt[data-code="${code}"] .fe-dp-media`);
    await page.click(`.fe-dp-card[data-id="D2"] .fe-dp-opt[data-code="${code}"] [data-media="compare"]`);
  }
  await page.waitForSelector('.fe-dp-compare img', { timeout: 4000 });
  await wait(500);
  await page.click('.fe-dp-view [data-media="in"]');
  await page.click('.fe-dp-view [data-media="in"]');
  await wait(300);
  const cmp = await page.evaluate(async () => {
    const panes = [...document.querySelectorAll('.fe-dp-cmp-scroll')];
    const widths = panes.map(p => Math.round(p.querySelector('img').getBoundingClientRect().width / p.clientWidth * 100));
    panes[0].scrollTop = (panes[0].scrollHeight - panes[0].clientHeight) / 2;
    panes[0].scrollLeft = (panes[0].scrollWidth - panes[0].clientWidth) / 2;
    await new Promise(r => setTimeout(r, 200));
    const f = p => [p.scrollTop / Math.max(1, p.scrollHeight - p.clientHeight), p.scrollLeft / Math.max(1, p.scrollWidth - p.clientWidth)].map(x => Math.round(x * 100));
    return { labels: [...document.querySelectorAll('.fe-dp-cmp-label')].map(l => l.textContent), widths, a: f(panes[0]), b: f(panes[1]) };
  });
  check(cmp.labels.join('|') === 'a · Dark|b · Light' && cmp.widths[0] === cmp.widths[1] && cmp.widths[0] >= 200 && cmp.a.join() === cmp.b.join() && cmp.a[0] === 50,
    `compare two pictures: one zoom for both and one scroll position: ${JSON.stringify(cmp)}`);
  await shot(page, 'dp-compare');
  await page.keyboard.press('Escape');
  await wait(200);
  const reset = await page.$$eval('[data-media="compare"][aria-pressed="true"]', b => b.length);
  check(reset === 0, `closing compare clears the two picks: ${reset}`);

  // Compare two mock pages: they scroll together.
  for (const code of ['b', 'c']) {
    await page.hover(`.fe-dp-card[data-id="D1"] .fe-dp-opt[data-code="${code}"] .fe-dp-media`);
    await page.click(`.fe-dp-card[data-id="D1"] .fe-dp-opt[data-code="${code}"] [data-media="compare"]`);
  }
  await page.waitForSelector('.fe-dp-compare iframe', { timeout: 4000 });
  const mockCmp = await page.evaluate(async () => {
    const panes = [...document.querySelectorAll('.fe-dp-cmp-scroll')];
    panes[1].scrollTop = 600;
    await new Promise(r => setTimeout(r, 200));
    return panes.map(p => Math.round(p.scrollTop));
  });
  check(mockCmp[0] === 600 && mockCmp[1] === 600, `compare two mock pages: scrolling one scrolls the other: ${JSON.stringify(mockCmp)}`);
  await page.keyboard.press('Escape');
} finally {
  console.log(results.join('\n'));
  await h.close();
}
