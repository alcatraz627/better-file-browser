// The Contents card on a markdown page never sits on text the reader did not
// ask it to cover. At every reading width and window width it either docks in
// room right of the text column, or folds to its button and opens over the
// text only when asked. Docking must still happen where there is room.
//
//   node e2e/toc-cover-walk.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const para = 'A long line of ordinary prose that runs well past the middle of the page so that any card laid over the right side would sit on it. ';
const doc = ['# Plan', '', ...Array.from({ length: 8 }, (_, i) => [`## Section ${i + 1}`, '', para.repeat(4), '', '| Name | What it does | If you say nothing |', '|---|---|---|', `| row ${i} | ${para} | ${para} |`, '']).flat()].join('\n');

let failed = 0;
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failed++; };
const h = await launch();
try {
  const file = join(h.fixture, 'plan.md');
  writeFileSync(file, doc);
  await h.store.set('bfb-page-toc-v1', '1');
  const seen = {};
  for (const mode of ['unset', 'xl', 'lg', 'md']) {
    await h.store.set('bfb-page-column-v2', mode);
    for (const width of [1000, 1400, 1920, 2560]) {
      const page = await h.browser.newPage();
      await page.setViewport({ width, height: 900 });
      await page.goto('file://' + file, { waitUntil: 'load' });
      await page.waitForSelector('#fe-page .fe-md h2', { timeout: 8000 });
      await new Promise(r => setTimeout(r, 300));
      const m = await page.evaluate(async () => {
        const rail = document.getElementById('fe-toc-rail');
        const scroller = document.getElementById('fe-page');
        let covered = 0;
        for (const y of [0, 700, 1400]) {
          scroller.scrollTop = y;
          await new Promise(r => setTimeout(r, 80));
          if (rail.hidden) continue;
          const R = rail.getBoundingClientRect();
          covered += [...document.querySelectorAll('#fe-page .fe-md p, #fe-page .fe-md td, #fe-page .fe-md li')].filter(e => {
            const r = e.getBoundingClientRect();
            return r.height && r.bottom > R.top && r.top < R.bottom && r.right > R.left + 4 && r.left < R.right;
          }).length;
        }
        return { shown: !rail.hidden, peek: rail.classList.contains('peek'), covered, button: !document.getElementById('fe-fp-toc').hidden };
      });
      seen[`${mode} ${width}`] = m;
      if (m.shown && !m.peek) check(m.covered === 0, `${mode} at ${width}: the docked card covers no text: ${JSON.stringify(m)}`);
      else check(!m.shown && m.button, `${mode} at ${width}: no room, so the card folds to its button: ${JSON.stringify(m)}`);
      // Asked for, a folded card opens over the text and Esc-free click on its button folds it again.
      if (!m.shown && mode === 'unset' && width === 1400) {
        await page.click('#fe-fp-toc');
        const opened = await page.evaluate(() => ({ shown: !document.getElementById('fe-toc-rail').hidden, peek: document.getElementById('fe-toc-rail').classList.contains('peek') }));
        check(opened.shown && opened.peek, `full width at 1400: the Contents button opens the card over the text: ${JSON.stringify(opened)}`);
        await page.click('#fe-fp-toc');
        check(await page.$eval('#fe-toc-rail', e => e.hidden), 'full width at 1400: the button folds it again');
      }
      await page.close();
    }
  }
  check(seen['md 1920'].shown && !seen['md 1920'].peek && seen['xl 2560'].shown && !seen['xl 2560'].peek, `the card still docks where there is room: ${JSON.stringify([seen['md 1920'], seen['xl 2560']])}`);
} finally {
  await h.close();
  if (failed) process.exitCode = 1;
}
