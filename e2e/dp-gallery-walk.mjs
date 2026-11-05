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
      { id: 'D3', question: 'Which arrangement?', options: [
        { code: 'a', label: 'A. Calm table. Files in reading order.', images: ['a.png', 'b.png', 'a.png', 'b.png'] },
        { code: 'c', label: 'C. Answer first. One line says whether to read it.', rec: true, images: ['b.png', 'a.png', 'b.png', 'a.png'] },
      ] },
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
  check(/^a Mock 1/.test(bigMock.title) && bigMock.sandbox === 'allow-scripts' && bigMock.w > 700, `a mock page opens large, live and sandboxed, under its choice's name: ${JSON.stringify(bigMock)}`);
  await page.keyboard.press('Escape');
  await wait(200);

  // Several pictures in one option: one leads and the rest sit small beneath it, so the option stays short.
  const tile = await page.evaluate(() => {
    const o = document.querySelector('.fe-dp-card[data-id="D3"] .fe-dp-opt[data-code="c"]');
    const f = [...o.querySelectorAll('.fe-dv-media')].map(x => x.getBoundingClientRect());
    return { h: Math.round(o.getBoundingClientRect().height), n: f.length, lead: Math.round(f[0].width), small: f.slice(1).map(x => Math.round(x.width)), sameRow: new Set(f.slice(1).map(x => Math.round(x.top))).size === 1 };
  });
  check(tile.n === 4 && tile.sameRow && tile.small.every(w => w * 2.5 < tile.lead) && tile.h < 760, `an option's four pictures read as one lead and three small, under one screen: ${JSON.stringify(tile)}`);
  await shot(page, 'dp-tile-set');

  // The note: under the options, at the bottom right; it opens and folds, and grows as it is typed in.
  const noteCard = '.fe-dp-card[data-id="D2"]';
  await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), noteCard);
  const place = await page.evaluate(s => {
    const c = document.querySelector(s), b = c.querySelector('.fe-dp-addnote').getBoundingClientRect(), o = c.querySelector('.fe-dp-opts').getBoundingClientRect(), r = c.getBoundingClientRect();
    return { below: b.top >= o.bottom, right: r.right - b.right < 40 };
  }, noteCard);
  check(place.below && place.right, `the note button sits at the bottom right of the card: ${JSON.stringify(place)}`);
  await page.click(`${noteCard} .fe-dp-addnote`);
  await wait(100);
  const open = await page.$eval(`${noteCard} .fe-dp-note`, n => !n.hidden);
  const h0 = await page.$eval(`${noteCard} textarea[data-note]`, t => t.offsetHeight);
  await page.keyboard.type('one\ntwo\nthree\nfour\nfive\nsix');
  await wait(100);
  const h1 = await page.$eval(`${noteCard} textarea[data-note]`, t => t.offsetHeight);
  check(open && h1 > h0, `the box opens and grows as it is typed in: ${h0} to ${h1}`);
  await shot(page, 'dp-note-open');
  await page.click(`${noteCard} .fe-dp-addnote`);
  await wait(100);
  check(await page.$eval(`${noteCard} .fe-dp-note`, n => n.hidden) && await page.$eval(`${noteCard} textarea[data-note]`, t => t.value.startsWith('one')), 'it folds with the words kept');
  await page.$eval(`${noteCard} textarea[data-note]`, t => { t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); });

  // The large view of a set: the choice's name, a rail of the whole set, jumps from the rail.
  const lead = '.fe-dp-card[data-id="D3"] .fe-dp-opt[data-code="c"] .fe-dv-media';
  await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), lead);
  await page.hover(lead);
  await page.click(`${lead} [data-media="focus"]`);
  await page.waitForSelector('.fe-dv-view .fe-dv-rail', { timeout: 4000 });
  await wait(600);
  const heading = () => page.evaluate(() => ({ title: document.querySelector('.fe-dv-view-title').textContent.trim().replace(/\s+/g, ' '), sub: document.querySelector('.fe-dv-view-sub').textContent }));
  const cat = await heading();
  check(cat.title === 'c Answer first. One line says whether to read it. Recommended' && cat.sub === 'b.png · 1 of 4 in this choice · 5 of 8',
    `the large view names the choice, whether it is recommended, and the place in the set: ${JSON.stringify(cat)}`);
  const rail = await page.evaluate(() => ({
    groups: [...document.querySelectorAll('.fe-dv-rail-grp')].map(g => [g.querySelector('.fe-dv-rail-name').textContent, g.querySelectorAll('.fe-dv-thumb img').length]),
    current: document.querySelector('.fe-dv-thumb[aria-current]').dataset.at,
    painted: [...document.querySelectorAll('.fe-dv-thumb img')].every(i => i.complete && i.naturalWidth > 0),
  }));
  check(rail.groups.length === 2 && rail.groups[0][0].startsWith('Calm table') && rail.groups.every(g => g[1] === 4) && rail.current === '4' && rail.painted,
    `the rail shows every picture under its choice with the open one marked: ${JSON.stringify(rail)}`);
  await shot(page, 'dp-focus-rail');

  // The rail names an option on one line, cut in the middle, with all of it in the tooltip.
  const name = await page.evaluate(() => {
    const head = [...document.querySelectorAll('.fe-dv-rail-head')].find(h => h.textContent.includes('Answer first'));
    const n = head.querySelector('.fe-dv-rail-name');
    return { tip: head.title, mid: !!n.querySelector('.fe-mid'), oneLine: n.getBoundingClientRect().height < 30, tail: n.querySelector('.fe-mid-t')?.getBoundingClientRect().width > 0 };
  });
  check(name.tip === 'Answer first. One line says whether to read it.' && name.mid && name.oneLine && name.tail, `a long option name is cut in the middle, whole in its tooltip: ${JSON.stringify(name)}`);

  // Choosing and noting from the large view is the page's own choice and note.
  const pagePick = () => page.evaluate(() => document.querySelector('.fe-dp-card[data-id="D3"] input:checked')?.value ?? null);
  const pickBefore = await pagePick();
  await page.click('.fe-dv-rail-pick[data-pick="a"]');
  await wait(150);
  check(await pagePick() === 'a' && pickBefore !== 'a', `choosing in the rail chooses on the page: ${pickBefore} to a`);
  check(await page.$eval('.fe-dv-rail-pick[data-pick="a"]', b => b.getAttribute('aria-checked') === 'true') && await page.$eval('.fe-dv-rail-pick[data-pick="c"]', b => b.getAttribute('aria-checked') === 'false'), 'and the rail shows which is chosen');
  await page.evaluate(() => { const r = document.querySelector('.fe-dp-card[data-id="D3"] input[value="c"]'); r.click(); });
  await wait(150);
  check(await page.$eval('.fe-dv-rail-pick[data-pick="c"]', b => b.getAttribute('aria-checked') === 'true'), 'a choice made on the page shows in the rail at once');
  await page.click('.fe-dv-rail-note textarea');
  await page.keyboard.type('Prefer this one');
  await wait(150);
  const noted = await page.evaluate(() => { const c = document.querySelector('.fe-dp-card[data-id="D3"]'); return { text: c.querySelector('textarea[data-note]').value, shown: !c.querySelector('.fe-dp-note').hidden, marked: c.classList.contains('has-note'), meter: document.getElementById('fe-dp-progress').textContent }; });
  check(noted.text === 'Prefer this one' && noted.shown && noted.marked, `a note typed in the rail is the card's note: ${JSON.stringify(noted)}`);
  await shot(page, 'dp-focus-pick');
  await page.evaluate(() => { const t = document.querySelector('.fe-dv-rail-note textarea'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('.fe-dv-thumb[data-at="1"]');
  await wait(300);
  const jumped = await heading();
  await page.keyboard.press('ArrowRight');
  await wait(300);
  const afterKey = await heading();
  check(jumped.title.startsWith('a Calm table') && jumped.sub.endsWith('2 of 8') && afterKey.sub.endsWith('3 of 8'), `a click on the rail jumps there and ← → carry on from it: ${JSON.stringify([jumped, afterKey])}`);

  // Zooming: a pinch moves smoothly, keeps the spot under the pointer, the picture drags, and the next picture opens at the same place.
  const zoomed = () => page.evaluate(() => {
    const w = document.querySelector('.fe-ql-imgwrap'), s = w.querySelector('.fe-ql-imgstage'), r = s.getBoundingClientRect();
    return { zoom: +w.dataset.zoom, left: Math.round(s.scrollLeft), top: Math.round(s.scrollTop), cx: r.left + r.width * 0.75, cy: r.top + r.height * 0.75 };
  });
  await page.click('.fe-dv-view [data-img="actual"]');
  await page.click('.fe-dv-view [data-img="in"]');
  await page.click('.fe-dv-view [data-img="in"]');
  await wait(200);
  const z0 = await zoomed();
  const spot = () => page.evaluate((x, y) => {
    const i = document.querySelector('.fe-ql-img').getBoundingClientRect();
    return [(x - i.left) / i.width, (y - i.top) / i.height];
  }, z0.cx, z0.cy);
  const s0 = await spot();
  await page.mouse.move(z0.cx, z0.cy);
  await page.keyboard.down('Control');
  for (let n = 0; n < 12; n++) { await page.mouse.wheel({ deltaY: -3 }); await wait(16); }
  await page.keyboard.up('Control');
  await wait(150);
  const z1 = await zoomed();
  const s1 = await spot();
  check(z1.zoom > z0.zoom && z1.zoom < z0.zoom * 1.6 && Math.abs(s1[0] - s0[0]) < 0.01 && Math.abs(s1[1] - s0[1]) < 0.01,
    `twelve small pinch events zoom gently and the spot under the pointer stays: ${JSON.stringify({ z0: z0.zoom, z1: z1.zoom, s0, s1 })}`);
  await page.mouse.down();
  await page.mouse.move(z0.cx - 150, z0.cy - 100, { steps: 5 });
  await page.mouse.up();
  await wait(100);
  const z2 = await zoomed();
  check(Math.abs(z2.left - z1.left - 150) <= 2 && Math.abs(z2.top - z1.top - 100) <= 2, `a zoomed picture drags with the pointer: ${JSON.stringify([z1, z2])}`);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('.fe-ql-imgwrap')?.dataset.zoom, { timeout: 4000 });
  await wait(300);
  const z3 = await zoomed();
  check(z3.zoom === z2.zoom && Math.abs(z3.left - z2.left) <= 2 && Math.abs(z3.top - z2.top) <= 2, `the next picture opens at the same zoom and place: ${JSON.stringify([z2, z3])}`);
  await page.evaluate(() => document.querySelector('.fe-ql-imgstage').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
  await wait(150);
  const fitted = await page.evaluate(() => { const s = document.querySelector('.fe-ql-imgstage'); return { over: s.scrollWidth > s.clientWidth, pan: s.classList.contains('can-pan') }; });
  check(!fitted.over && !fitted.pan, `a double click returns a zoomed picture to fit, and it no longer drags: ${JSON.stringify(fitted)}`);
  await page.keyboard.press('Escape');
  await wait(200);

  // Compare two picture options: one zoom, one scroll.
  await page.evaluate(() => document.querySelector('.fe-dp-card[data-id="D2"] .fe-dp-opts').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await wait(300);
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
