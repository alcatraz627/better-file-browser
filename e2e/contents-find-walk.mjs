// A markdown file page: Contents sits in a rail to the right, headings step
// in by depth and shrink a little, the button above folds and unfolds it and
// the choice is remembered. Find in file sits at the right of the file bar,
// counts matches, steps with Enter and clears with Esc.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
try {
  const md = join(h.fixture, 'guide.md');
  writeFileSync(md, ['# Guide', '', 'Intro about apples.', '', '## Setup', '', 'Install apples and pears.', '', '### Details', '', 'More apples here.', '', '#### Fine print', '', 'No apples.', '', '## Usage', '', 'Use the apples.'].join('\n'));
  // The card docks only where it fits beside the text column, so this uses a
  // reading column on a wide window (e2e/toc-cover-walk.mjs covers the rest).
  await h.store.set('bfb-page-column-v2', 'md');
  for (const theme of ['dark', 'light']) {
    const page = await h.browser.newPage();
    await page.setViewport({ width: 1920, height: 800 });
    page.on('pageerror', e => console.error('[pageerror]', e.message));
    await page.goto('file://' + md, { waitUntil: 'load' });
    await page.waitForSelector('#fe-toc a');
    if (theme === 'light') { await page.click('#fe-theme-btn'); await page.mouse.move(700, 700); await new Promise(r => setTimeout(r, 400)); }

    const rail = await page.evaluate(() => {
      const r = document.getElementById('fe-toc-rail').getBoundingClientRect(), p = document.getElementById('fe-page').getBoundingClientRect();
      const rows = [...document.querySelectorAll('#fe-toc a')].map(a => { const s = getComputedStyle(a); return { t: a.textContent, pad: parseFloat(s.paddingLeft), size: parseFloat(s.fontSize) }; });
      const el = document.getElementById('fe-toc-rail');
      return { floats: getComputedStyle(el).position === 'absolute' && r.left > p.left && r.right <= p.right + 1, title: document.querySelector('.fe-rail-name')?.textContent, rows };
    });
    const pads = rail.rows.map(r => r.pad), sizes = rail.rows.map(r => r.size);
    check(rail.floats && rail.title === 'On this page' && rail.rows.length === 5, `${theme}: contents floats over the page's right side: ${JSON.stringify({ floats: rail.floats, title: rail.title, n: rail.rows.length })}`);
    // Order: h1, h2, h3, h4, h2. Deeper means more indent and no larger text.
    check(pads[0] < pads[1] && pads[1] < pads[2] && pads[2] < pads[3] && pads[4] === pads[1] && sizes[0] >= sizes[1] && sizes[1] >= sizes[2] && sizes[2] >= sizes[3] && sizes[0] > sizes[3],
      `${theme}: depth shows by indent and a small size step: ${JSON.stringify({ pads, sizes })}`);

    // Find in file.
    const bar = await page.evaluate(() => {
      const f = document.getElementById('fe-ff').getBoundingClientRect(), c = document.getElementById('fe-fp-copy').getBoundingClientRect();
      return { rightOfCopy: f.left > c.right };
    });
    check(bar.rightOfCopy, `${theme}: find sits in the file bar right of Copy`);
    await page.keyboard.press('/');
    const focused = await page.evaluate(() => document.activeElement?.id);
    await page.keyboard.type('apples');
    const found = await page.evaluate(() => ({ n: document.getElementById('fe-ff-n').textContent, marks: document.querySelectorAll('#fe-page mark.fe-ff-hit').length, on: document.querySelectorAll('#fe-page mark.fe-ff-hit.on').length }));
    check(focused === 'fe-ff-q' && found.marks === 5 && found.on === 1 && found.n === '1 of 5', `${theme}: / focuses find and typing marks every match: ${JSON.stringify({ focused, ...found })}`);
    await page.keyboard.press('Enter');
    const second = await page.$eval('#fe-ff-n', el => el.textContent);
    await page.keyboard.down('Shift'); await page.keyboard.press('Enter'); await page.keyboard.up('Shift');
    const back = await page.$eval('#fe-ff-n', el => el.textContent);
    check(second === '2 of 5' && back === '1 of 5', `${theme}: Enter steps forward, Shift+Enter back: ${second}, ${back}`);
    await page.screenshot({ path: join(SHOTS, `contents-find-${theme}.png`), clip: { x: 0, y: 0, width: 1400, height: 460 } });
    await page.keyboard.type('zzz');
    const none = await page.$eval('#fe-ff-n', el => ({ t: el.textContent, cls: el.className }));
    check(none.t === 'No match' && none.cls === 'none', `${theme}: no match says so: ${JSON.stringify(none)}`);
    await page.keyboard.press('Escape');
    const cleared = await page.evaluate(() => ({ marks: document.querySelectorAll('#fe-page mark.fe-ff-hit').length, q: document.getElementById('fe-ff-q').value, text: document.querySelector('#fe-page .fe-md p').textContent }));
    check(cleared.marks === 0 && cleared.q === '' && cleared.text === 'Intro about apples.', `${theme}: Esc clears the marks and leaves the text whole: ${JSON.stringify(cleared)}`);

    if (theme === 'dark') {
      await page.click('#fe-fp-toc');
      const hidden = await page.evaluate(() => ({ rail: document.getElementById('fe-toc-rail').hidden, pressed: document.getElementById('fe-fp-toc').getAttribute('aria-pressed') }));
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('#fe-fp-toc');
      const kept = await page.$eval('#fe-toc-rail', el => el.hidden);
      await page.screenshot({ path: join(SHOTS, 'contents-hidden-dark.png'), clip: { x: 0, y: 0, width: 1400, height: 300 } });
      await page.click('#fe-fp-toc');
      const open = await page.$eval('#fe-toc-rail', el => !el.hidden && el.dataset.tab === 'toc');
      check(hidden.rail && hidden.pressed === 'false' && kept && open, `the contents button right of find hides the rail, remembered across reload, and shows it again: ${JSON.stringify({ ...hidden, kept, open })}`);
    }
    await page.close();
  }
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'contents and find walk passes');
