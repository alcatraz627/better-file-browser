// Every folder view against every page that replaces the listing. A view picked in
// one folder is remembered everywhere, so none of them may reach Home, a file page
// or a decision page, and each of those must fill the main pane whatever is picked.
//
//   node e2e/main-surface-walk.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const VIEWS = ['details', 'list', 'tree', 'tiles', 'icons', 'gallery'];
const h = await launch();
try {
  const dp = join(h.fixture, 'a-decision');
  mkdirSync(dp);
  writeFileSync(join(dp, 'config.json'), JSON.stringify({ title: 'Surface walk', storageKey: 'surface-walk', decisions: [{ id: 'D1', question: 'Which?', options: [{ code: 'a', label: 'One', rec: true }, { code: 'b', label: 'Two' }] }] }));
  writeFileSync(join(h.fixture, 'surface.md'), '# A file page\n\nSome words.\n');
  const SURFACES = [
    { name: 'Home', url: 'file://' + h.fixture + '/#home', body: '#fe-home-page' },
    { name: 'a decision page', url: 'file://' + dp + '/', body: '#fe-dp' },
    { name: 'a file page', url: 'file://' + join(h.fixture, 'surface.md'), body: '#fe-page' },
  ];
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const pick = async v => {
    await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
    await page.waitForSelector('#fe-view-group');
    await page.click(`#fe-view-group [data-v="${v}"]`);
    await wait(150);
  };

  for (const view of VIEWS) {
    await pick(view);
    for (const s of SURFACES) {
      await page.goto('about:blank');
      await page.goto(s.url, { waitUntil: 'load' });
      await page.waitForSelector(`${s.body}:not([hidden])`, { timeout: 8000 });
      await wait(400);
      const got = await page.evaluate(body => {
        const seen = id => !!document.getElementById(id)?.checkVisibility();
        const el = document.querySelector(body).getBoundingClientRect();
        const main = document.getElementById('fe-main').getBoundingClientRect();
        const bar = document.getElementById('fe-statusbar');
        const end = bar?.checkVisibility() ? bar.getBoundingClientRect().top : main.bottom;
        return {
          leaked: ['fe-gal', 'fe-gal-rz', 'fe-scroll', 'fe-toolbar', 'fe-sg-panel', 'fe-filter-bar', 'fe-empty'].filter(seen),
          words: /Nothing to show/.test(document.body.innerText),
          gap: Math.round(end - el.bottom),
          preview: !!document.querySelector('.fe-ql-imgwrap')?.checkVisibility(),
        };
      }, s.body);
      check(!got.leaked.length && !got.words && !got.preview && Math.abs(got.gap) <= 2, `${view} stays out of ${s.name}, which fills the pane: ${JSON.stringify(got)}`);
    }
  }

  // Gallery on a real folder still works, and swaps with a decision page's own page.
  await pick('gallery');
  check(await page.$eval('#fe-gal', g => g.checkVisibility()), 'Gallery shows its stage on a plain folder');
  await page.goto('file://' + dp + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-dp:not([hidden])');
  await wait(300);
  const before = await page.evaluate(() => document.querySelectorAll('#fe-scroll [data-idx].selected').length);
  await page.keyboard.press('ArrowDown');
  await wait(100);
  check(before === await page.evaluate(() => document.querySelectorAll('#fe-scroll [data-idx].selected').length), 'listing keys do not reach the hidden listing under a decision page');
  await page.click('[data-docview-files]');
  await wait(300);
  check(await page.$eval('#fe-gal', g => g.checkVisibility()), 'Files on a decision page brings Gallery back');
  await page.click('#fe-dp-back');
  await wait(300);
  check(!(await page.$eval('#fe-gal', g => g.checkVisibility())), 'back to the page puts Gallery away');
} finally {
  console.log(results.join('\n'));
  await h.close();
}
