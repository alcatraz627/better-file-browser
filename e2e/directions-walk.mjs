// A directions doc reads as a plan: a bar counts each state mark and narrows
// every table to one mark on a click, each section shows a meter of its rows,
// and each row's edge takes its state's tone. Runs on a copy of a real doc.
//
//   node e2e/directions-walk.mjs      (BFB_THEME=light for the light theme)
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, shot, applyTheme, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const h = await launch();
try {
  const real = '/Users/alcatraz627/Code/Versable/slack-automation/docs/plan/DIRECTIONS.md';
  const doc = join(h.fixture, 'DIRECTIONS.md');
  if (existsSync(real)) copyFileSync(real, doc);
  else writeFileSync(doc, '# Directions\n\n## Now\n\n| id | state | task |\n| --- | --- | --- |\n| a | 🔴 | one |\n| b | 🟢 | two |\n| c | ✅ | three |\n');
  await h.store.set('bfb-theme', THEME);
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('.fe-dir-sum', { timeout: 8000 });
  const sum = await page.evaluate(() => ({
    chips: [...document.querySelectorAll('.fe-dir-chip')].map(c => [c.dataset.state, Number(c.querySelector('b').textContent)]),
    rows: document.querySelectorAll('.fe-md tbody tr[data-state]').length,
    meters: document.querySelectorAll('.fe-md h2 .fe-dir-meter, .fe-md h3 .fe-dir-meter').length,
    edge: getComputedStyle(document.querySelector('.fe-md tbody tr[data-state] td')).boxShadow,
  }));
  const counted = sum.chips.reduce((n, [, c]) => n + c, 0);
  check(sum.chips.length >= 2 && counted === sum.rows, `the bar counts every marked row by state: ${JSON.stringify(sum.chips)} over ${sum.rows} rows`);
  check(sum.meters >= 2, `sections carry a meter of their rows: ${sum.meters}`);
  check(/inset/.test(sum.edge), `a marked row has a coloured edge: ${sum.edge}`);
  await shot(page, 'directions');
  const linked = await page.$$eval('.fe-md tbody td a[href^="#"] + .fe-dir-meter', els => els.length);
  check(linked >= 2, `the overview's direction names link to their sections, each with a meter: ${linked}`);
  await page.evaluate(() => document.querySelectorAll('.fe-md h3')[0]?.scrollIntoView({ block: 'start' }));
  await shot(page, 'directions-section');

  await page.click('.fe-dir-chip[data-state="needs"]');
  const narrowed = await page.evaluate(() => ({
    shown: [...document.querySelectorAll('.fe-md tbody tr')].filter(r => !r.hidden).map(r => r.dataset.state),
    pressed: document.querySelector('.fe-dir-chip[data-state="needs"]').getAttribute('aria-pressed'),
  }));
  check(narrowed.pressed === 'true' && narrowed.shown.length > 0 && narrowed.shown.every(s => s === 'needs'), `a chip narrows every table to its mark: ${narrowed.shown.length} rows`);
  await shot(page, 'directions-needs');
  await page.click('.fe-dir-chip[data-state="needs"]');
  const back = await page.evaluate(() => [...document.querySelectorAll('.fe-md tbody tr')].filter(r => r.hidden).length);
  check(back === 0, `clicking it again shows every row: ${back} hidden`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
