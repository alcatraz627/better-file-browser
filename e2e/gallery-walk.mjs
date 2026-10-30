// The Gallery view: a large preview of the picked file above a one-row strip
// of thumbnails. ← and → walk the strip, a folder shows a card, the grip
// resizes the two and is remembered, and leaving the view gives the preview
// back to its own layout.
//
//   node e2e/gallery-walk.mjs      (--light for the light theme)
import { copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { launch, shot, applyTheme } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROOT = new URL('..', import.meta.url).pathname;

const h = await launch();
try {
  // Pictures and a few more text files, so the strip has every kind of thumbnail.
  copyFileSync(join(homedir(), '.claude/assets/decision-pages/bfb-design-directions/listing.png'), join(h.fixture, 'a-icon.png'));
  copyFileSync(join(ROOT, 'banner.svg'), join(h.fixture, 'b-banner.svg'));
  for (let i = 0; i < 14; i++) writeFileSync(join(h.fixture, `note-${String(i).padStart(2, '0')}.md`), `# Note ${i}\n\nSome words in note ${i}, enough to fill a thumbnail with a few lines of text.\n\n- one\n- two\n`);
  const page = await h.open();
  await applyTheme(page);
  await page.$eval('#fe-view-group [data-v="gallery"]', b => b.click());
  await sleep(700);

  const state = () => page.evaluate(() => {
    const ql = document.getElementById('fe-qlook');
    const tiles = [...document.querySelectorAll('#fe-tiles .fe-tile')].filter(t => t.offsetParent);
    const tops = new Set(tiles.map(t => Math.round(t.getBoundingClientRect().top)));
    const strip = document.getElementById('fe-scroll').getBoundingClientRect();
    const stage = document.getElementById('fe-gal').getBoundingClientRect();
    const card = document.querySelector('.fe-gal-card');
    return {
      inStage: ql?.parentElement?.id === 'fe-gal', shown: ql?.style.display !== 'none', gal: ql?.classList.contains('gal'),
      name: document.getElementById('fe-ql-name')?.textContent ?? '',
      rows: tops.size, tiles: tiles.length, strip: Math.round(strip.height), stage: Math.round(stage.height),
      stageAbove: stage.bottom <= strip.top + 1,
      card: card && !card.hidden ? card.textContent.replace(/\s+/g, ' ').trim() : '',
      lead: document.querySelector('#fe-tiles .fe-tile.selected .fe-tile-nm')?.textContent ?? '',
      side: getComputedStyle(document.getElementById('fe-side')).display,
    };
  });
  let s = await state();
  check(s.inStage && s.shown && s.gal, `the preview sits in the stage: ${JSON.stringify({ inStage: s.inStage, shown: s.shown })}`);
  check(s.rows === 1 && s.tiles > 10 && s.stageAbove, `the thumbnails run in one row under the stage: ${s.rows} row, ${s.tiles} tiles`);
  check(s.lead && s.name === s.lead, `the stage previews the picked thumbnail: "${s.name}" for "${s.lead}"`);
  check(s.side !== 'none', 'the sidebar stays open, unlike a docked preview');
  await shot(page, 'gallery');

  // ← and → walk the strip.
  const first = s.lead;
  await page.keyboard.press('ArrowRight'); await sleep(500);
  s = await state();
  check(s.lead !== first && (s.name === s.lead || s.card), `→ moves to the next thumbnail and the stage follows: ${first} → ${s.lead}`);
  await page.keyboard.press('ArrowLeft'); await sleep(400);
  s = await state();
  check(s.lead === first, `← moves back: ${s.lead}`);

  // A picture previews large.
  await page.$eval('#fe-tiles .fe-tile[data-name="a-icon.png"]', t => t.click()); await sleep(700);
  const img = await page.evaluate(() => { const i = document.querySelector('#fe-ql-body img'); return i ? Math.round(i.getBoundingClientRect().height) : 0; });
  check(img > 150, `a picture shows large in the stage: ${img}px tall`);
  await shot(page, 'gallery-image');

  // A folder shows a card instead of a preview.
  await page.$eval('#fe-tiles .fe-tile.dir:not(.par)', t => t.click()); await sleep(400);
  s = await state();
  check(/Open folder/.test(s.card), `a folder shows a card with Open folder: "${s.card}"`);
  await shot(page, 'gallery-folder');

  // Text files show their first lines once the strip reaches them.
  await page.$eval('#fe-scroll', el => { el.scrollLeft = el.scrollWidth; }); await sleep(900);
  const snips = await page.$$eval('.fe-gal-snip', els => els.map(e => e.textContent.slice(0, 12)));
  check(snips.length >= 3 && snips.some(t => /# Note/.test(t)), `text files show their first lines as thumbnails: ${snips.length}`);
  const moved = await page.$eval('#fe-scroll', el => { el.scrollLeft = 0; el.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, bubbles: true, cancelable: true })); return el.scrollLeft; });
  check(moved > 0, `the wheel scrolls the strip sideways: ${moved}px`);

  // Esc leaves the stage alone.
  await page.$eval('#fe-tiles .fe-tile[data-name="readme.md"]', t => t.click()); await sleep(600);
  await page.keyboard.press('Escape'); await sleep(300);
  s = await state();
  check(s.shown && s.name === 'readme.md', `Esc does not empty the stage: "${s.name}"`);

  // The grip resizes, and the height is remembered.
  const before = s.strip;
  const grip = await page.$eval('#fe-gal-rz', g => { const r = g.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x, grip.y - 90, { steps: 6 });
  await page.mouse.up();
  await sleep(300);
  s = await state();
  check(Math.abs(s.strip - (before + 90)) <= 3, `dragging the grip up grows the strip: ${before} → ${s.strip}`);
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#fe'); await sleep(800);
  const kept = await state();
  check(Math.abs(kept.strip - s.strip) <= 3 && kept.inStage, `the strip height and the view survive a reload: ${kept.strip}`);
  await shot(page, 'gallery-tall-strip');

  // Leaving gives the preview back.
  await page.$eval('#fe-view-group [data-v="details"]', b => b.click()); await sleep(400);
  s = await state();
  check(!s.inStage && !s.shown, `leaving the view closes the stage's preview: ${JSON.stringify({ inStage: s.inStage, shown: s.shown })}`);
  const rows = await page.$$eval('#fe-tbody tr.fe-row', r => r.filter(x => x.offsetParent).length);
  check(rows > 10, `Details draws its rows again: ${rows}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
