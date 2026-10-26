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
    sections: [
      { id: 's1', title: 'Two shots', images: ['a.png', 'b.png', '../escape.png'] },
      { id: 's2', title: 'Marked', images: [
        { src: 'a.png', marks: [{ x: 0.1, y: 0.1, w: 0.3, h: 0.2, label: 'Crumb padding' }, { x: 0.6, y: 0.5, w: 0.2, h: 0.2, label: 'Menu button' }, { x: 0.9, y: 0.9, w: 0.5, h: 0.5, label: 'Off the picture' }] },
        { src: 'b.png', marks: 'not a list' },
      ] },
    ],
  }));

  const page = await h.open(dir);
  await page.setViewport({ width: 1400, height: 900 });
  await applyTheme(page);
  await page.waitForSelector('#fe-dp:not([hidden]) .fe-dv-media', { timeout: 8000 });
  await wait(1200);

  // Four live mock pages, each laid out at desktop width and scaled into its tile.
  const tiles = await page.evaluate(() => [...document.querySelectorAll('.fe-dp-card[data-id="D1"] .fe-dv-frame')].map(f => {
    const fr = f.getBoundingClientRect(), ir = f.querySelector('iframe').getBoundingClientRect();
    return { top: Math.round(fr.top), tile: Math.round(fr.width), shown: Math.round(ir.width), sandbox: f.querySelector('iframe').getAttribute('sandbox') };
  }));
  // D1 also has a None option spanning the row, which once kept empty columns open and shrank every tile.
  const row = await page.evaluate(() => {
    const g = document.querySelector('.fe-dp-card[data-id="D1"] .fe-dp-opts').getBoundingClientRect();
    const t = [...document.querySelectorAll('.fe-dp-card[data-id="D1"] .fe-dp-opt.tile')].map(x => x.getBoundingClientRect());
    return { gallery: Math.round(g.width), rightGap: Math.round(g.right - Math.max(...t.map(x => x.right))) };
  });
  check(tiles.length === 4 && new Set(tiles.map(t => t.top)).size === 2 && tiles.every(t => t.tile >= 300 && Math.abs(t.tile - t.shown) <= 2 && t.sandbox === 'allow-scripts') && row.rightGap <= 2,
    `D4 A14 four mock pages show as two rows of two large tiles filling the row beside a None option, scaled to fit, script-only sandbox: ${JSON.stringify({ tiles, row })}`);
  const frames = [];
  for (const f of page.frames()) {
    if (!/mock\d\.html$/.test(f.url())) continue;
    frames.push(await f.evaluate(() => ({ text: document.getElementById('t').textContent, parent: document.body.dataset.parent, width: document.body.dataset.width })).catch(e => ({ err: String(e) })));
  }
  check(frames.length === 4 && frames.every(f => / live$/.test(f.text) && f.parent === 'blocked' && f.width === '1280'),
    `D5 each mock runs its own script at 1280 wide and cannot reach the page: ${JSON.stringify(frames)}`);

  const picTops = await page.evaluate(() => [...document.querySelectorAll('.fe-dp-card[data-id="D2"] .fe-dp-opt.tile')].map(t => Math.round(t.getBoundingClientRect().top)));
  check(picTops.length === 3 && new Set(picTops).size === 1, `A14 picture options sit side by side: ${JSON.stringify(picTops)}`);
  check(await page.$$eval('.fe-dp-card[data-id="s1"] .fe-dv-media', m => m.length) === 2, 'D1 A23 an item strip shows its two pictures and refuses the ../ one');
  await shot(page, 'dp-gallery');

  // Marks: numbered boxes over the picture's drawn area, a key of their labels, a toggle; a box off the picture is dropped.
  const markGeo = () => page.evaluate(() => {
    const f = document.querySelector('.fe-dp-card[data-id="s2"] .fe-dv-media');
    f.scrollIntoView({ block: 'center' });
    const img = f.querySelector('img'), r = img.getBoundingClientRect();
    const s = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight), dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    const drawn = { left: r.left + (r.width - dw) / 2, top: r.top + (r.height - dh) / 2, w: dw, h: dh };
    const boxes = [...f.querySelectorAll('.fe-dv-mark')].map(m => m.getBoundingClientRect());
    const near = (a, b) => Math.abs(a - b) < 2;
    return {
      n: boxes.length, visible: boxes.length ? boxes[0].width > 0 : false,
      first: boxes[0] && near(boxes[0].left, drawn.left + 0.1 * drawn.w) && near(boxes[0].top, drawn.top + 0.1 * drawn.h) && near(boxes[0].width, 0.3 * drawn.w),
      second: boxes[1] && near(boxes[1].left, drawn.left + 0.6 * drawn.w) && near(boxes[1].height, 0.2 * drawn.h),
      key: [...f.querySelectorAll('.fe-dv-mark-key > span')].map(s => s.textContent),
      plain: !document.querySelectorAll('.fe-dp-card[data-id="s2"] .fe-dv-media')[1].dataset.marks,
    };
  });
  const mk = await markGeo();
  check(mk.n === 2 && mk.first && mk.second && mk.visible, `marks sit on the picture's drawn area, the off-picture box dropped: ${JSON.stringify(mk)}`);
  check(mk.key.join('|') === '1Crumb padding|2Menu button' && mk.plain, `the key lists each mark's number and label; bad marks leave a plain picture: ${JSON.stringify(mk.key)}`);
  await shot(page, 'dp-marks');
  await page.click('.fe-dp-card[data-id="s2"] .fe-dv-media [data-media="marks"]');
  const hidden = await page.$eval('.fe-dp-card[data-id="s2"] .fe-dv-marks', l => getComputedStyle(l).display);
  await page.click('.fe-dp-card[data-id="s2"] .fe-dv-media [data-media="marks"]');
  const shownAgain = await page.$eval('.fe-dp-card[data-id="s2"] .fe-dv-marks', l => getComputedStyle(l).display);
  check(hidden === 'none' && shownAgain !== 'none', `the eye button hides the marks and shows them again: ${hidden} then ${shownAgain}`);
  await page.click('.fe-dp-card[data-id="s2"] .fe-dv-media [data-media="focus"]');
  await page.waitForSelector('.fe-dv-view .fe-ql-img', { timeout: 5000 });
  await wait(500);
  const big = await page.evaluate(() => {
    const img = document.querySelector('.fe-dv-view .fe-ql-img').getBoundingClientRect();
    const m = document.querySelector('.fe-dv-view .fe-dv-mark')?.getBoundingClientRect();
    return { marks: document.querySelectorAll('.fe-dv-view .fe-dv-mark').length, onIt: !!m && Math.abs(m.left - (img.left + 0.1 * img.width)) < 2 && Math.abs(m.width - 0.3 * img.width) < 2 };
  });
  check(big.marks === 2 && big.onIt, `the large view draws the marks on the picture: ${JSON.stringify(big)}`);
  await shot(page, 'dp-marks-large');
  await page.keyboard.press('Escape');
  await wait(300);

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
  await page.evaluate(() => document.querySelectorAll('.fe-dp-card[data-id="s1"] .fe-dv-media img')[1].click());
  await wait(900);
  const lower = await page.evaluate(() => {
    const f = document.querySelectorAll('.fe-dp-card[data-id="s1"] .fe-dv-media')[1], r = f.getBoundingClientRect(), s = document.getElementById('fe-dp').getBoundingClientRect();
    return { zoomed: f.classList.contains('zoomed'), inView: r.top >= s.top - 2 && r.top < s.bottom, count: document.querySelectorAll('#fe-dp .zoomed.fe-dv-media').length };
  });
  check(lower.zoomed && lower.inView && lower.count === 2, `D2 D3 two pictures can be grown at once and a lower one scrolls into view: ${JSON.stringify(lower)}`);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => document.querySelectorAll('#fe-dp .zoomed').length) === 0, 'B13 Esc shrinks every grown picture');

  // A real click on a picture's frame, not its pixels, still grows and shrinks it and never picks the option.
  const edgeOf = () => page.evaluate(() => {
    const f = document.querySelector('.fe-dp-card[data-id="D2"] .fe-dp-opt[data-code="c"] .fe-dv-media');
    f.scrollIntoView({ block: 'center' });
    const r = f.getBoundingClientRect(), x = r.left + r.width / 2, y = r.bottom - 1;
    return { x, y, hit: document.elementFromPoint(x, y)?.tagName };
  });
  const pickedD2 = () => page.$eval('.fe-dp-card[data-id="D2"] input:checked', i => i.value);
  const zoomedC = () => page.$eval('.fe-dp-card[data-id="D2"] .fe-dp-opt[data-code="c"] .fe-dv-media', f => f.classList.contains('zoomed'));
  const e1 = await edgeOf();
  const p0 = await pickedD2();
  await page.mouse.click(e1.x, e1.y); await wait(300);
  const grownEdge = { hit: e1.hit, zoomed: await zoomedC(), picked: await pickedD2() };
  const e2 = await edgeOf();
  await page.mouse.click(e2.x, e2.y); await wait(300);
  const shrunkEdge = { hit: e2.hit, zoomed: await zoomedC(), picked: await pickedD2() };
  check(grownEdge.hit === 'FIGURE' && grownEdge.zoomed && grownEdge.picked === p0 && !shrunkEdge.zoomed && shrunkEdge.picked === p0,
    `a click on a picture's edge grows it, again shrinks it, and never picks: ${JSON.stringify([p0, grownEdge, shrunkEdge])}`);

  // The large view: ← → step through the strip, keys behind it stay still, Esc closes.
  await page.hover('.fe-dp-card[data-id="s1"] .fe-dv-media');
  await page.click('.fe-dp-card[data-id="s1"] .fe-dv-media [data-media="focus"]');
  await page.waitForSelector('.fe-dv-view .fe-ql-img', { timeout: 4000 });
  const title = () => page.$eval('.fe-dv-view-title', t => t.textContent);
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
    const b = document.querySelector('.fe-dv-view-box'), cs = getComputedStyle(b);
    return { bg: cs.backgroundColor, opacity: cs.opacity };
  });
  check(opaque.opacity === '1' && !/rgba\(.*, 0\)|transparent/.test(opaque.bg), `the large view is solid over the page: ${JSON.stringify(opaque)}`);
  await shot(page, 'dp-focus');
  await page.keyboard.press('Escape');
  await wait(200);
  check(await page.$('.fe-dv-view') === null, 'Esc closes the large view');

  // A mock page opens large live.
  await page.hover('.fe-dp-card[data-id="D1"] .fe-dv-media');
  await page.click('.fe-dp-card[data-id="D1"] .fe-dv-media [data-media="focus"]');
  await page.waitForSelector('.fe-dv-view iframe.fe-dv-view-frame', { timeout: 4000 });
  const bigMock = await page.evaluate(() => ({ title: document.querySelector('.fe-dv-view-title').textContent, sandbox: document.querySelector('.fe-dv-view-frame').getAttribute('sandbox'), w: Math.round(document.querySelector('.fe-dv-view-frame').getBoundingClientRect().width) }));
  check(bigMock.title === 'mock1.html · 1 of 4' && bigMock.sandbox === 'allow-scripts' && bigMock.w > 1000, `a mock page opens large, live and sandboxed: ${JSON.stringify(bigMock)}`);
  await page.keyboard.press('Escape');
  await wait(200);

  // Compare two picture options: one zoom, one scroll.
  for (const code of ['a', 'b']) {
    await page.hover(`.fe-dp-card[data-id="D2"] .fe-dp-opt[data-code="${code}"] .fe-dv-media`);
    await page.click(`.fe-dp-card[data-id="D2"] .fe-dp-opt[data-code="${code}"] [data-media="compare"]`);
  }
  await page.waitForSelector('.fe-dv-compare img', { timeout: 4000 });
  await wait(500);
  await page.click('.fe-dv-view [data-media="in"]');
  await page.click('.fe-dv-view [data-media="in"]');
  await wait(300);
  const cmp = await page.evaluate(async () => {
    const panes = [...document.querySelectorAll('.fe-dv-cmp-scroll')];
    const widths = panes.map(p => Math.round(p.querySelector('img').getBoundingClientRect().width / p.clientWidth * 100));
    panes[0].scrollTop = (panes[0].scrollHeight - panes[0].clientHeight) / 2;
    panes[0].scrollLeft = (panes[0].scrollWidth - panes[0].clientWidth) / 2;
    await new Promise(r => setTimeout(r, 200));
    const f = p => [p.scrollTop / Math.max(1, p.scrollHeight - p.clientHeight), p.scrollLeft / Math.max(1, p.scrollWidth - p.clientWidth)].map(x => Math.round(x * 100));
    return { labels: [...document.querySelectorAll('.fe-dv-cmp-label')].map(l => l.textContent), widths, a: f(panes[0]), b: f(panes[1]) };
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
    await page.hover(`.fe-dp-card[data-id="D1"] .fe-dp-opt[data-code="${code}"] .fe-dv-media`);
    await page.click(`.fe-dp-card[data-id="D1"] .fe-dp-opt[data-code="${code}"] [data-media="compare"]`);
  }
  await page.waitForSelector('.fe-dv-compare iframe', { timeout: 4000 });
  const mockCmp = await page.evaluate(async () => {
    const panes = [...document.querySelectorAll('.fe-dv-cmp-scroll')];
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
