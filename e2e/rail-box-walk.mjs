// The comments card on a file page moves by its header and resizes from its
// lower-left corner; both survive a reload, the reset button at its top right
// shows only once it was changed and puts it back, and the header's buttons
// still click instead of starting a move.
// BFB_THEME=light runs it on the light theme.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, applyTheme, shot } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  const doc = join(h.fixture, 'box.md');
  writeFileSync(doc, '# Box\n\n## One\n\nSome text.\n\n## Two\n\nMore text.\n');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture] }));
  const page = await h.open(h.fixture);
  await applyTheme(page);
  await page.setViewport({ width: 1500, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-md');
  await page.click('#fe-fp-cm');
  await page.waitForFunction(() => { const r = document.getElementById('fe-toc-rail'); return !r.hidden && r.dataset.tab === 'cm'; }, { timeout: 5000 });
  await sleep(400);
  const box = () => page.$eval('#fe-toc-rail', r => { const b = r.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), reset: !r.querySelector('.fe-rail-reset').hidden }; });
  const b0 = await box();
  check(!b0.reset, `reset is hidden while the card is where it docks: ${JSON.stringify(b0)}`);

  // Move by the header.
  const head = await page.$eval('#fe-toc-rail .fe-rail-name', e => { const r = e.getBoundingClientRect(); return { x: r.right + 30, y: r.top + r.height / 2 }; });
  await page.mouse.move(head.x, head.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(head.x - 50 * i, head.y + 20 * i);
  await page.mouse.up();
  await sleep(200);
  const b1 = await box();
  check(Math.abs(b1.x - (b0.x - 300)) <= 4 && Math.abs(b1.y - (b0.y + 120)) <= 4 && b1.reset, `dragging the header moves the card 300 left and 120 down, and reset shows: ${JSON.stringify({ b0, b1 })}`);

  // Resize from the lower-left corner.
  const grip = await page.$eval('#fe-toc-rail .fe-rail-rz', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(grip.x - 20 * i, grip.y + 30 * i);
  await page.mouse.up();
  await sleep(200);
  const b2 = await box();
  check(Math.abs(b2.w - (b1.w + 120)) <= 4 && b2.h >= b1.h + 150 && Math.abs((b2.x + b2.w) - (b1.x + b1.w)) <= 4, `the corner grows it 120 wider to the left and taller, the right edge stays: ${JSON.stringify({ b1, b2 })}`);
  await shot(page, 'rail-box-moved');

  // It is kept.
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-md');
  await page.waitForFunction(() => { const r = document.getElementById('fe-toc-rail'); return !r.hidden && r.dataset.tab === 'cm'; }, { timeout: 5000 }).catch(() => null);
  await sleep(400);
  const b3 = await box();
  check(Math.abs(b3.x - b2.x) <= 4 && Math.abs(b3.y - b2.y) <= 4 && Math.abs(b3.w - b2.w) <= 4 && Math.abs(b3.h - b2.h) <= 4, `after a reload the card is where it was left: ${JSON.stringify({ b2, b3 })}`);

  // Contents keeps its own place.
  if (await page.$('#fe-fp-toc:not([hidden])')) {
    await page.click('#fe-fp-toc');
    await sleep(300);
    const t = await box();
    check(Math.abs(t.x + t.w - (b0.x + b0.w)) <= 4 && Math.abs(t.y - b0.y) <= 4 && !t.reset, `Contents still docks at its own place: ${JSON.stringify(t)}`);
    await page.click('#fe-fp-cm');
    await sleep(300);
  }

  // Reset puts it back and hides itself.
  await page.click('#fe-toc-rail .fe-rail-reset');
  await sleep(400);
  const b4 = await box();
  check(Math.abs(b4.x - b0.x) <= 4 && Math.abs(b4.y - b0.y) <= 4 && Math.abs(b4.w - b0.w) <= 4 && !b4.reset, `reset puts the card back where it docks: ${JSON.stringify({ b0, b4 })}`);

  // It cannot be dragged off the page.
  const head2 = await page.$eval('#fe-toc-rail .fe-rail-name', e => { const r = e.getBoundingClientRect(); return { x: r.right + 30, y: r.top + r.height / 2 }; });
  await page.mouse.move(head2.x, head2.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(head2.x + 200 * i, head2.y - 100 * i);
  await page.mouse.up();
  await sleep(200);
  const b5 = await box();
  const fp = await page.$eval('#fe-fp', e => { const r = e.getBoundingClientRect(); return { r: Math.round(r.right), t: Math.round(r.top) }; });
  check(b5.x + b5.w <= fp.r + 1 && b5.y >= fp.t - 1, `the card stays inside the page: ${JSON.stringify({ b5, fp })}`);
  await page.click('#fe-toc-rail .fe-rail-reset');
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
