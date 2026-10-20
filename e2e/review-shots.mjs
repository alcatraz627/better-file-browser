// The review screenshot set: every major surface in one theme, written to
// e2e/shots/review-*.png for a person or a vision model to read.
//   BFB_THEME=light node e2e/review-shots.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, shot, applyTheme } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  const long = ['# Adversarial review: a long title that wraps', 'Opening paragraph with enough words to fill a reading column. '.repeat(6)];
  for (let i = 1; i <= 6; i++) long.push(`## Section ${i} heading`, 'Body text. '.repeat(40), `### Sub point ${i}.1`, 'More text. '.repeat(20), `#### Detail ${i}.1.1`, 'Detail. '.repeat(10));
  writeFileSync(join(h.fixture, 'long.md'), long.join('\n\n'));
  await h.store.set('bfb-saved-v1', [
    { path: h.fixture + '/notes.txt', label: 'paint like work', tags: [] },
    { path: h.fixture + '/', label: 'gcp directions', tags: ['docs'] },
    { path: h.fixture + '/nested/', label: 'speedway plan', tags: ['docs'] },
    { path: h.fixture + '/nested/deeper/', label: 'skills-ui', tags: ['gcc'] },
  ]);
  await h.store.set('bfb-tags-v1', [{ name: 'docs', color: '#22b8cf' }, { name: 'gcc', color: '#3fb950' }]);
  await h.store.set('bfb-recents-v1', [
    { path: h.fixture + '/nested/', ts: Date.now() - 3e5 }, { path: h.fixture + '/readme.md', ts: Date.now() - 4e6 },
    { path: h.fixture + '/code.py', ts: Date.now() - 9e7 }, { path: h.fixture + '/nested/deeper/', ts: Date.now() - 2e8 },
  ]);
  const page = await h.open();
  await applyTheme(page);

  await page.click('#fe-rail-places'); await sleep(300); await shot(page, 'review-places');
  await page.click('#fe-rail-notes'); await sleep(300); await shot(page, 'review-notes');
  await page.click('#fe-rail-history'); await sleep(300); await shot(page, 'review-history');

  await page.keyboard.press(',');
  await page.waitForSelector('#fe-settings-modal .fe-dlg-tab');
  for (const tab of await page.$$eval('#fe-settings-modal .fe-dlg-tab', ts => ts.map(t => t.dataset.tab))) {
    await page.click(`#fe-settings-modal .fe-dlg-tab[data-tab="${tab}"]`); await sleep(250);
    await shot(page, `review-settings-${tab}`);
  }
  await page.keyboard.press('Escape');

  await page.setViewport({ width: 1200, height: 800 });
  await page.goto('file://' + h.fixture + '/long.md', { waitUntil: 'load' });
  await page.waitForSelector('#fe-toc a'); await sleep(400);
  await shot(page, 'review-contents');
  const geo = await page.evaluate(() => {
    const md = document.querySelector('#fe-page .fe-md').getBoundingClientRect(), toc = document.getElementById('fe-toc-rail').getBoundingClientRect();
    return { text: Math.round(md.width), gap: Math.round(toc.left - md.right) };
  });
  console.log('contents geometry', JSON.stringify(geo));
} finally { await h.close(); }
