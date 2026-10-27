// Directions docs that drift from the standard shape still work: states
// written as words count, numbered buckets act as directions, a doc without a
// Waiting section still says what is on you, and rows with no state show as
// an unmarked count instead of vanishing.
// BFB_THEME=light runs it on the light theme.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, applyTheme, shot } from './harness.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const open = async name => {
  const dir = join(h.fixture, name);
  mkdirSync(dir, { recursive: true });
  const doc = join(dir, 'DIRECTIONS.md');
  writeFileSync(doc, readFileSync(join(ROOT, 'tests/fixtures/directions', `${name}.md`), 'utf8'));
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('.fe-dir-sum', { timeout: 8000 });
  await sleep(300);
  return page;
};
const facts = page => page.evaluate(() => ({
  chips: Object.fromEntries([...document.querySelectorAll('.fe-dv-chip')].map(c => [c.dataset.state, Number(c.querySelector('b').textContent)])),
  unmarked: document.querySelector('.fe-dir-unmarked')?.textContent ?? '',
  you: [...document.querySelectorAll('.fe-dir-next-g[data-g="you"] .fe-dir-next-t')].map(t => t.textContent),
  ready: [...document.querySelectorAll('.fe-dir-next-g[data-g="ready"] .fe-dir-next-t')].map(t => t.textContent),
}));
const visibleRows = page => page.$$eval('.fe-md tbody tr', rs => rs.filter(r => r.offsetParent !== null && !r.hidden).map(r => r.cells[0].textContent.trim()));

try {
  // States written as words in a state column.
  let page = await open('freetext');
  let f = await facts(page);
  check(f.chips.waiting >= 2 && f.chips.ready >= 2, `words in a state column count as states: ${JSON.stringify(f.chips)}`);
  check(f.ready.includes('Mute rules') && f.you.includes('Name the alert channel') && f.you.includes('Which teams get it'), `the head reads them too: ${JSON.stringify({ you: f.you, ready: f.ready })}`);
  await page.click('#fe-dir-view [data-v="agent"]');
  await sleep(200);
  const agent = await visibleRows(page);
  check(agent.join() === 'R1,L2', `Agent can do now finds the worded ready row: ${agent.join(',')}`);
  await page.close();

  // Numbered buckets, no Waiting section, unmarked findings.
  page = await open('buckets');
  f = await facts(page);
  check(f.unmarked === '2 unmarked', `rows with no state show as a count: "${f.unmarked}"`);
  check(f.you.join() === 'Crash on empty page' && f.ready.join() === 'Slow login', `On you and Ready come from the marked rows: ${JSON.stringify({ you: f.you, ready: f.ready })}`);
  await page.click('#fe-dir-view [data-v="me"]');
  await sleep(200);
  const me = await visibleRows(page);
  const heads = await page.$$eval('.fe-md h2', hs => hs.filter(h => h.offsetParent !== null).map(h => h.firstChild.textContent.trim()));
  check(me.join() === 'H1' && heads.includes('1. Hotfixes') && !heads.includes('3. Data quality'), `On me keeps the bucket heading above its row: ${JSON.stringify({ me, heads })}`);
  await page.click('#fe-dir-view [data-v="all"]');
  await sleep(200);
  await shot(page, 'directions-drift-buckets');
  await page.close();
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
