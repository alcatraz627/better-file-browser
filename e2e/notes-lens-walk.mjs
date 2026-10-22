// The Saved lens has one filter and one tag row (shared with Notes). The filter shows once the
// lens holds more than eight rows; #tag matches tags only and Esc clears it.
// Tag groups fold on a card and stay folded after a reload.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const labels = p => p.$$eval('#fe-sv-list .fe-pl-label', es => es.map(e => e.textContent));
try {
  const saved = Array.from({ length: 10 }, (_, i) => ({ path: `/tmp/place-${i}/`, label: `Place ${i}`, tags: i < 3 ? ['alpha'] : i < 5 ? ['beta'] : [] }));
  await h.store.set('bfb-saved-v1', saved);
  await h.store.set('bfb-lens-v1', 'saved');
  await h.store.set('bfb-tags-v1', [{ name: 'alpha', color: '#3fb950' }, { name: 'beta', color: '#d29922' }]);
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-lens-filter');

  check(!(await page.$eval('#fe-lens-filter', e => e.hidden)), 'ten saved rows show the one filter box');
  const chips = await page.$$eval('#fe-lens-tags .fe-lens-tag', cs => cs.map(c => c.dataset.tag));
  check(chips.join() === 'alpha,beta', `the tag row lists every tag once: ${chips}`);

  await page.type('#fe-lens-filter', '#beta');
  const beta = await labels(page);
  check(beta.join() === 'Place 3,Place 4', `#beta keeps only items tagged beta: ${beta}`);
  check(await page.$eval('#fe-lens-tags .fe-lens-tag[data-tag="beta"]', c => c.classList.contains('on')), 'the beta chip shows as on while #beta is typed');
  await page.keyboard.press('Escape');
  check((await labels(page)).length === 10 && await page.$eval('#fe-lens-filter', e => e.value) === '', 'Esc clears the box and all ten return');

  await page.type('#fe-lens-filter', 'place 7');
  check((await labels(page)).join() === 'Place 7', 'plain words match the label');
  await page.keyboard.press('Escape');

  await page.click('#fe-sv-list details.fe-grp[data-tag="alpha"] > summary');
  // A closing group stays open while it shrinks, then folds (motion.ts foldTo).
  const folded = await page.waitForFunction(() => !document.querySelector('details.fe-grp[data-tag="alpha"]').open, { timeout: 1500 }).then(() => true, () => false);
  check(folded, 'clicking a group header folds it');
  await page.screenshot({ path: join(SHOTS, 'notes-lens-folded.png'), clip: { x: 0, y: 0, width: 700, height: 600 } });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-sv-list details.fe-grp');
  const after = await page.$$eval('#fe-sv-list details.fe-grp', ds => ds.map(d => `${d.dataset.tag}:${d.open}`));
  check(after.join() === 'alpha:false,beta:true', `the fold survives a reload: ${after}`);
  await page.type('#fe-lens-filter', 'place 1');
  check(await page.$eval('details.fe-grp[data-tag="alpha"]', d => d.open), 'a filter opens a folded group so its match shows');
  await new Promise(r => setTimeout(r, 400));
  const kept = await h.store.json('bfb-saved-folded-v1', []);
  check(kept.includes('alpha'), `the filter's own opening does not unfold the group in storage: ${JSON.stringify(kept)}`);
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 150));
  check(!(await page.$eval('details.fe-grp[data-tag="alpha"]', d => d.open)), 'clearing the filter folds the group back as it was');
  await page.click('#fe-theme-btn'); await page.mouse.move(1000, 800); await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: join(SHOTS, 'notes-lens-light.png'), clip: { x: 0, y: 0, width: 700, height: 600 } });
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'notes lens walk passes');
