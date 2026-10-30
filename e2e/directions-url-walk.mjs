// A directions doc's filter lives in the page address, so a filtered view can
// be linked and comes back on reload and Back. The address wins over what the
// doc remembers, a plain doc keeps a plain address, a heading or comment
// address is left alone, and an address edited by hand takes over.
//
//   node e2e/directions-url-walk.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch } from './harness.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// What the page shows, read from its controls and rows.
const state = page => page.evaluate(() => {
  const on = sel => document.querySelector(`${sel} [aria-checked="true"]`)?.dataset.v ?? '';
  return {
    hash: location.hash,
    layout: on('#fe-dir-layout'), depth: on('#fe-dir-view'),
    chips: [...document.querySelectorAll('.fe-dv-chip[aria-pressed="true"]')].map(c => c.dataset.state).join(','),
    q: document.querySelector('.fe-dir-q input')?.value ?? '',
    status: document.querySelector('.fe-dir-status')?.textContent.trim() ?? '',
    shownLayout: document.querySelector('#fe-page .fe-md')?.dataset.dirLayout,
  };
});

try {
  const doc = join(h.fixture, 'DIRECTIONS.md');
  writeFileSync(doc, readFileSync(join(ROOT, 'tests/fixtures/directions/standard.md'), 'utf8'));
  const url = 'file://' + doc;
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const open = async (u = url) => { await page.goto(u, { waitUntil: 'load' }); await page.waitForSelector('#fe-dir-layout', { timeout: 8000 }); await sleep(300); };
  await open();

  let s = await state(page);
  check(s.hash === '' && s.layout === 'doc' && s.depth === 'full', `a plain doc keeps a plain address: "${s.hash}"`);

  // Every change lands in the address.
  await page.click('#fe-dir-layout [data-v="list"]'); await sleep(150);
  await page.click('.fe-dv-chip[data-state="needs"]'); await sleep(150);
  await page.click('.fe-dv-chip[data-state="waiting"]'); await sleep(150);
  await page.type('.fe-dir-q input', 'sensor'); await sleep(500);
  s = await state(page);
  check(s.hash === '#dir?layout=list&s=needs,waiting&q=sensor', `the filter is written to the address: "${s.hash}"`);

  // A reload comes back to it.
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#fe-dir-layout'); await sleep(300);
  s = await state(page);
  check(s.layout === 'list' && s.chips === 'needs,waiting' && s.q === 'sensor' && s.shownLayout === 'list' && /^Showing/.test(s.status), `a reload restores the filter: ${JSON.stringify(s)}`);

  // Back from another page comes back to it.
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' }); await sleep(300);
  await page.goBack({ waitUntil: 'load' }); await page.waitForSelector('#fe-dir-layout'); await sleep(300);
  s = await state(page);
  check(s.layout === 'list' && s.chips === 'needs,waiting' && s.q === 'sensor', `Back restores the filter: ${JSON.stringify({ layout: s.layout, chips: s.chips, q: s.q })}`);

  // Clear drops the chips and words; with List remembered, the address keeps only that.
  await page.click('.fe-dir-clear'); await sleep(200);
  s = await state(page);
  check(s.hash === '#dir?layout=list' && s.chips === '' && s.q === '', `Clear leaves only the layout in the address: "${s.hash}"`);
  await page.click('#fe-dir-layout [data-v="doc"]'); await sleep(150);
  s = await state(page);
  check(s.hash === '', `back to the defaults, the address is plain again: "${s.hash}"`);

  // A linked address wins over what the doc remembers.
  await page.click('#fe-dir-layout [data-v="list"]'); await sleep(150);
  await open(url + '#dir?layout=doc&depth=overview&s=ready');
  s = await state(page);
  check(s.layout === 'doc' && s.depth === 'overview' && s.chips === 'ready', `a linked address wins over the remembered List: ${JSON.stringify({ layout: s.layout, depth: s.depth, chips: s.chips })}`);
  // Without a layout in the address, the remembered one stays.
  await page.click('#fe-dir-layout [data-v="list"]'); await sleep(150);
  await open(url + '#dir?s=done');
  s = await state(page);
  check(s.layout === 'list' && s.chips === 'done', `an address without a layout keeps the remembered one: ${JSON.stringify({ layout: s.layout, chips: s.chips })}`);
  await page.click('#fe-dir-layout [data-v="doc"]'); await sleep(150);
  await page.click('.fe-dir-clear'); await sleep(150);

  // An address edited by hand takes over without a reload.
  await page.evaluate(() => { location.hash = '#dir?s=parked'; }); await sleep(300);
  s = await state(page);
  check(s.chips === 'parked' && /^Showing 1 of/.test(s.status), `an address edited by hand applies at once: ${JSON.stringify({ chips: s.chips, status: s.status })}`);
  await page.click('.fe-dir-clear'); await sleep(150);

  // A heading address stays while nothing is filtered; a comment address is never rewritten.
  await open(url + '#seeds');
  s = await state(page);
  check(s.hash === '#seeds', `a heading address is left alone: "${s.hash}"`);
  await open(url + '#c=t-nothing');
  await page.click('.fe-dv-chip[data-state="ready"]'); await sleep(200);
  s = await state(page);
  check(s.hash === '#c=t-nothing' && s.chips === 'ready', `a comment address is not rewritten by a chip: "${s.hash}"`);
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
