// Adversarial probe: the tab editor's typing box against its painted copy
// after Split, the sidebar toggle and a page zoom, per frame where it matters.
//
//   node e2e/adv-caret-probe.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
const out = [];
const log = s => { out.push(s); console.log(s); };
try {
  const md = join(h.fixture, 'wrap-me.md');
  writeFileSync(md, Array.from({ length: 30 }, (_, i) => 'ab '.repeat(14 + i) + 'end').join('\n') + '\n');
  await h.store.set('bfb-settings-v1', { showSidebar: true, editableFolders: [h.fixture] });
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1300, height: 800 });
  await page.goto('file://' + md, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-edit');
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-fe-ta', { timeout: 5000 }).catch(() => null);
  if (!(await page.$('#fe-fe-ta'))) { log('editor did not open (grant prompt?)'); throw new Error('no editor'); }
  const measure = () => page.evaluate(() => {
    const ta = document.getElementById('fe-fe-ta'), paint = document.getElementById('fe-fe-paint');
    const cell = paint.querySelector('.fe-fe-row > :last-child');
    // Where the 25th line starts in each: the painted row's top vs the textarea's own line wrap count.
    const rows = [...paint.querySelectorAll('.fe-fe-row')];
    // A mirror styled like the textarea gives where the textarea itself puts line 25 (where its caret sits).
    const cs = getComputedStyle(ta);
    const m = document.createElement('div');
    for (const p of ['font-family', 'font-size', 'line-height', 'padding-left', 'padding-right', 'letter-spacing', 'white-space', 'overflow-wrap', 'word-break', 'tab-size', 'box-sizing', 'border-left-width', 'border-right-width']) m.style.setProperty(p, cs.getPropertyValue(p));
    m.style.cssText += `;position:absolute;visibility:hidden;top:0;left:0;width:${ta.offsetWidth}px;white-space:pre-wrap`;
    const lines = ta.value.split('\n');
    m.textContent = lines.slice(0, 25).join('\n') + '\n';
    const mark = document.createElement('span'); mark.textContent = 'L'; m.appendChild(mark);
    document.body.appendChild(m);
    const taRow25 = Math.round(mark.getBoundingClientRect().top - m.getBoundingClientRect().top);
    m.remove();
    return { taRow25, taH: ta.offsetHeight, paintH: paint.offsetHeight, taTop: ta.scrollTop, taTextW: ta.clientWidth - 52, cellW: Math.round(cell.getBoundingClientRect().width), row25: Math.round(rows[25].getBoundingClientRect().top - paint.getBoundingClientRect().top) };
  });
  log('## open: ' + JSON.stringify(await measure()));
  await page.click('#fe-side-toggle'); await sleep(400);
  log('## sidebar hidden: ' + JSON.stringify(await measure()));
  await page.click('#fe-side-toggle'); await sleep(400);
  log('## sidebar back: ' + JSON.stringify(await measure()));
  const split = await page.$('[data-mode="split"]');
  if (split) { await split.click(); await sleep(500); log('## split: ' + JSON.stringify(await measure())); }
  else log('## no Split control on this file');
  // A caret far down: does the textarea scroll itself when typing at the end in Split?
  await page.evaluate(() => { const ta = document.getElementById('fe-fe-ta'); ta.focus(); ta.setSelectionRange(ta.value.length - 5, ta.value.length - 5); });
  await page.keyboard.type('xyz');
  await sleep(300);
  log('## typed at end in split: ' + JSON.stringify(await measure()));
} finally {
  mkdirSync('/tmp/adv-jank', { recursive: true });
  writeFileSync('/tmp/adv-jank/caret.txt', out.join('\n'));
  await h.close();
}
