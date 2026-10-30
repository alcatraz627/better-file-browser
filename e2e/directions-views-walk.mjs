// A directions doc reads as Overview or Full, narrowed by any mix of state
// chips. A narrowed doc keeps each row's headings above it, Overview or Full
// is kept per doc, and the Contents rail shows each section's open count in
// its most pressing state.
// BFB_THEME=light runs it on the light theme.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, applyTheme, shot } from './harness.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  const doc = join(h.fixture, 'DIRECTIONS.md');
  writeFileSync(doc, readFileSync(join(ROOT, 'tests/fixtures/directions/standard.md'), 'utf8'));
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1500, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('#fe-dir-view', { timeout: 8000 });
  await sleep(300);

  const seen = () => page.evaluate(() => {
    const vis = el => !!el && el.offsetParent !== null && !el.hidden;
    const rows = [...document.querySelectorAll('.fe-md tbody tr')].filter(vis).map(r => (r.cells[0].querySelector('a') ?? r.cells[0]).textContent.trim().replace(/[^\w ]/g, '').trim());
    const heads = [...document.querySelectorAll('.fe-md h2, .fe-md h3')].filter(vis).map(h => h.firstChild.textContent.replace(/[^\w ]/g, '').trim());
    const prose = [...document.querySelectorAll('.fe-md > p, .fe-md > ul, .fe-md > .fe-dir-done')].filter(vis).map(p => p.textContent.trim().slice(0, 30));
    return { rows, heads, prose };
  });
  const pick = async v => { await page.click(`#fe-dir-view [data-v="${v}"]`); await sleep(250); };
  const chip = async s => { await page.click(`.fe-dv-chip[data-state="${s}"]`); await sleep(250); };

  let s = await seen();
  check(s.rows.includes('W1') && s.rows.includes('S4') && s.rows.includes('Seeds'), `All shows every row: ${s.rows.join(',')}`);

  await chip('needs');
  s = await seen();
  check(s.rows.join() === 'W1,W2,A1', `the needs-you chip shows only what waits on you: ${s.rows.join(',')}`);
  check(s.heads.includes('Waiting on you') && s.heads.includes('Watering') && s.heads.includes('A schedule from the sensors') && !s.heads.includes('Seeds'),
    `its rows keep their headings, and empty sections fold: ${s.heads.join(' | ')}`);
  await shot(page, 'directions-view-me');

  await chip('needs'); await chip('ready');
  s = await seen();
  check(s.rows.join() === 'S2,S3,A3', `the ready chip shows only what an agent can pick up: ${s.rows.join(',')}`);
  check(!s.heads.includes('Waiting on you') && s.heads.includes('Import every supplier'), `with their headings: ${s.heads.join(' | ')}`);

  await chip('needs');
  s = await seen();
  check(s.rows.join() === 'W1,W2,S2,S3,A1,A3', `two chips show both states at once: ${s.rows.join(',') || 'none'}`);
  const status = await page.$eval('.fe-dir-status', e => e.textContent.trim());
  check(/^Showing 6 of \d+/.test(status) && /Clear/.test(status), `the bar says what is showing: "${status}"`);
  await page.click('.fe-dir-clear'); await sleep(250);
  s = await seen();
  check(s.rows.includes('S4') && !(await page.$('.fe-dir-clear')), `Clear shows every row again: ${s.rows.length} rows`);

  await page.type('.fe-dir-q input', 'feed'); await sleep(500);
  s = await seen();
  check(s.rows.length > 0 && s.rows.every(r => /^S\d/.test(r)), `the filter box narrows rows by their words: ${s.rows.join(',')}`);
  await page.click('.fe-dir-clear'); await sleep(250);
  const q = await page.$eval('.fe-dir-q input', i => i.value);
  check(q === '', 'Clear empties the filter box too');

  await pick('overview');
  s = await seen();
  check(s.rows.join() === 'Seeds,Watering', `Overview keeps only the shape table: ${s.rows.join(',')}`);
  check(s.heads.length >= 6 && s.prose.some(p => /Seeds import works/.test(p)) && s.prose.some(p => /^Done when/.test(p)) && !s.prose.some(p => /S1: the parser/.test(p)),
    `and every heading, where things stand and the done-when lines, without the detail: ${JSON.stringify(s.prose)}`);
  await shot(page, 'directions-view-overview');

  // Each goal says what done means, tersely, under its heading.
  const done = await page.$$eval('.fe-md .fe-dir-done', ls => ls.map(l => ({ after: l.previousElementSibling?.firstChild.textContent.replace(/[^\w ]/g, '').trim().split(' ').slice(0, 3).join(' '), chips: [...l.querySelectorAll('.fe-dir-done-l')].map(c => c.textContent.trim()) })));
  check(done.length === 2 && done[0].after === 'Import every supplier' && done[0].chips.join() === 'code complete,exercised,reviewed' && done[1].chips.join() === 'tested,deployed',
    `each goal shows its done-when bars under its heading: ${JSON.stringify(done)}`);
  const src = await page.$$eval('.fe-md .fe-dir-done-src', ps => ps.filter(p => p.offsetParent !== null).length);
  check(src === 0, 'the long accepted-when line folds behind the terse one');

  // Kept per doc.
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-dir-view', { timeout: 8000 });
  await sleep(300);
  const kept = await page.$eval('#fe-dir-view [aria-checked="true"]', b => b.dataset.v).catch(() => '');
  s = await seen();
  check(kept === 'overview' && s.rows.join() === 'Seeds,Watering', `the view survives a reload: ${kept}`);

  // A head item for a hidden row brings the whole doc back and lands on it.
  await page.click('.fe-dir-next-g[data-g="ready"] li:first-child .fe-dir-next-i');
  await sleep(600);
  const back = await page.evaluate(() => ({ v: document.querySelector('#fe-dir-view [aria-checked="true"]')?.dataset.v, s2: [...document.querySelectorAll('.fe-md tbody tr')].find(r => r.cells[0].textContent.trim() === 'S2')?.offsetParent !== null }));
  check(back.v === 'full' && back.s2, `jumping to a row the view hides switches to Full: ${JSON.stringify(back)}`);

  // The Contents rail counts what is open per section.
  await page.click('#fe-fp-toc').catch(() => {});
  await sleep(300);
  const toc = await page.$$eval('#fe-toc a', as => as.map(a => ({ t: a.title.replace(/[^\w ]/g, '').trim(), n: a.querySelector('.fe-toc-n')?.textContent ?? '', st: a.querySelector('.fe-toc-n')?.dataset.state ?? '' })).filter(x => x.n));
  const by = Object.fromEntries(toc.map(x => [x.t.split(' ').slice(0, 3).join(' '), `${x.n}:${x.st}`]));
  check(by['Waiting on you'] === '2:needs' && by['Seeds'] === '3:ready' && by['Watering'] === '3:needs', `the rail shows each section's open count in its most pressing state: ${JSON.stringify(by)}`);
  await shot(page, 'directions-outline');
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
