// Seat A walk: a big folder redraws right after a filter, sort or clear while
// scrolled; deep search reads every file; the Search lens leaves focus alone
// as a page loads and keeps its query across Back; names sort by number with
// folders on top on request; the picked row clears the sticky header; today's
// files show a time and the count drops zero parts.
// BFB_THEME=light runs every check on the light theme.
import { mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { launch, applyTheme, shot, THEME } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const exts = ['md', 'json', 'py', 'ts', 'csv', 'log', 'sh'];
try {
  // Fixtures
  const big = join(h.fixture, 'big');
  mkdirSync(big);
  for (let i = 0; i < 1600; i++) writeFileSync(join(big, `file-${String(i).padStart(4, '0')}-${['alpha', 'beta', 'gamma', 'delta'][i % 4]}.${exts[i % 7]}`), `row ${i}\n`);
  for (const n of [0, 1, 2, 10, 11, 3]) mkdirSync(join(big, `sub ${n}`));
  // 1,300 files in one folder, the last ones holding the word, and a file nine levels down.
  const wide = join(h.fixture, 'wide');
  mkdirSync(wide);
  for (let i = 0; i < 1300; i++) writeFileSync(join(wide, `w-${String(i).padStart(4, '0')}.txt`), [1067, 1164, 1261, 1299].includes(i) ? 'a needle here\n' : 'plain\n');
  let deep = join(wide, 'd1');
  for (let d = 1; d <= 9; d++) { mkdirSync(deep); if (d < 9) deep = join(deep, `d${d + 1}`); }
  writeFileSync(join(deep, 'bottom.txt'), 'the needle at the bottom\n');
  // A folder with a recent file and one old one, for the date and the count.
  const mix = join(h.fixture, 'mix');
  mkdirSync(mix);
  writeFileSync(join(mix, 'today.txt'), 'x');
  writeFileSync(join(mix, 'old.txt'), 'x');
  utimesSync(join(mix, 'old.txt'), new Date('2020-03-04T10:00:00'), new Date('2020-03-04T10:00:00'));

  const page = await h.open(big);
  await applyTheme(page);
  await page.waitForSelector('#fe-tbody tr[data-idx]');
  await sleep(300);

  // 1. Big folder: filter, clear and sort while scrolled
  const drawn = () => page.evaluate(() => {
    const sc = document.getElementById('fe-scroll').getBoundingClientRect();
    const rows = [...document.querySelectorAll('#fe-tbody tr[data-idx]')].filter(r => { const b = r.getBoundingClientRect(); return b.bottom > sc.top + 30 && b.top < sc.bottom; });
    return { n: rows.length, first: rows.map(r => r.querySelector('.fe-nm')?.textContent).find(n => n !== 'Parent Directory') ?? '', count: document.getElementById('fe-count').textContent };
  });
  await page.evaluate(() => { const s = document.getElementById('fe-scroll'); s.scrollTop = s.scrollHeight; });
  await sleep(300);
  await page.click('#fe-search');
  await page.keyboard.type('gamma');
  await sleep(500);
  const filtered = await drawn();
  check(filtered.n > 5 && /gamma/.test(filtered.first), `typing a filter while scrolled to the end draws the matches at once: ${JSON.stringify(filtered)}`);
  await shot(page, 'listing-search-filter');
  await page.keyboard.press('Escape');
  await sleep(500);
  const cleared = await drawn();
  check(cleared.n > 5, `clearing the filter with Esc draws the list: ${JSON.stringify(cleared)}`);
  await page.evaluate(() => { const s = document.getElementById('fe-scroll'); s.scrollTop = s.scrollHeight; });
  await sleep(300);
  await page.click('thead th[data-sort="size"]');
  await sleep(500);
  const sorted = await drawn();
  check(sorted.n > 5, `sorting by Size while scrolled to the end draws the list: ${JSON.stringify(sorted)}`);

  // 17. Numeric names, folders on top
  await page.click('thead th[data-sort="name"]');
  await sleep(300);
  const names = () => page.evaluate(() => [...document.querySelectorAll('#fe-tbody tr[data-idx] .fe-nm')].map(n => n.textContent).filter(n => n !== 'Parent Directory'));
  await page.evaluate(() => { const s = document.getElementById('fe-scroll'); s.scrollTop = s.scrollHeight; });
  await sleep(300);
  const order = (await names()).filter(n => n.startsWith('sub '));
  check(order.join() === 'sub 0,sub 1,sub 2,sub 3,sub 10,sub 11', `Name sort puts "sub 2" before "sub 10": ${order.join()}`);
  await page.evaluate(() => { document.getElementById('fe-scroll').scrollTop = 0; });
  await sleep(300);
  const mixed = await names();
  check(mixed[0]?.startsWith('file-'), `without the option, folders sort in among the files: ${mixed.slice(0, 3).join()}`);
  await page.click('#fe-sg-btn');
  await page.click('#fe-sort-dirs').catch(() => {});
  await sleep(400);
  await page.evaluate(() => { document.getElementById('fe-scroll').scrollTop = 0; });
  await sleep(300);
  const top = (await names()).slice(0, 7);
  check(top.slice(0, 6).join() === 'sub 0,sub 1,sub 2,sub 3,sub 10,sub 11' && top[6]?.startsWith('file-'), `Folders on top puts the six folders first, then files: ${top.join()}`);
  await page.click('#fe-sort-dirs').catch(() => {});   // leave the option off for later rows
  await page.click('#fe-sg-btn');

  // 27. The picked row is not hidden under the sticky header
  await page.evaluate(() => { document.getElementById('fe-scroll').scrollTop = 600; });
  await sleep(300);
  const hid = await page.evaluate(async () => {
    const sc = document.getElementById('fe-scroll'), rows = [...document.querySelectorAll('#fe-tbody tr[data-idx]')];
    const head = document.querySelector('thead').getBoundingClientRect().bottom;
    const r = rows.find(x => x.getBoundingClientRect().top > head + 200);
    r.click();
    return rows.indexOf(r);
  });
  void hid;
  await page.keyboard.press('Escape');
  for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowUp');
  await sleep(300);
  const under = await page.evaluate(() => {
    const head = document.querySelector('thead').getBoundingClientRect().bottom;
    const s = document.querySelector('#fe-tbody tr.selected');
    return { rowTop: s ? Math.round(s.getBoundingClientRect().top) : null, headBottom: Math.round(head) };
  });
  check(under.rowTop !== null && under.rowTop >= under.headBottom - 1, `walking up with the arrow keys keeps the picked row below the header: ${JSON.stringify(under)}`);

  // 33. Today's time, no zero counts
  const m = await h.open(mix);
  await applyTheme(m);
  await m.waitForSelector('#fe-tbody tr[data-idx]');
  const dates = await m.evaluate(() => ({
    today: [...document.querySelectorAll('#fe-tbody tr')].find(r => r.querySelector('.fe-nm')?.textContent === 'today.txt')?.querySelector('.c-dt')?.textContent,
    old: [...document.querySelectorAll('#fe-tbody tr')].find(r => r.querySelector('.fe-nm')?.textContent === 'old.txt')?.querySelector('.c-dt')?.textContent,
    count: document.getElementById('fe-count').textContent,
  }));
  check(/^Today \d\d:\d\d$/.test(dates.today ?? '') && /2020/.test(dates.old ?? ''), `today's file shows a time and an old one its date: ${JSON.stringify(dates)}`);
  check(dates.count === '2 files', `a folder with no subfolders reads "2 files": ${dates.count}`);
  await shot(m, 'listing-search-dates');
  await m.close();

  // 3 and 4. Search lens: focus on load, query kept on Back
  const w = await h.open(wide);
  await applyTheme(w);
  await w.waitForSelector('#fe-tbody tr[data-idx]');
  await w.click('#fe-rail-search');
  await w.waitForSelector('#fe-srch-q');
  const focusedOnOpen = await w.evaluate(() => document.activeElement?.id);
  check(focusedOnOpen === 'fe-srch-q', `opening the lens by hand puts the cursor in its box: ${focusedOnOpen}`);
  await w.reload({ waitUntil: 'load' });
  await w.waitForSelector('#fe-tbody tr[data-idx]');
  await sleep(500);
  const afterLoad = await w.evaluate(() => ({ active: document.activeElement?.id || document.activeElement?.tagName, lens: document.querySelector('#fe-rail .fe-rail-btn.on')?.dataset.lens }));
  check(afterLoad.lens === 'search' && afterLoad.active !== 'fe-srch-q', `a page loading with the Search lens open leaves focus alone: ${JSON.stringify(afterLoad)}`);

  // 2. Deep search reads every file
  await w.click('#fe-srch-q');
  await w.keyboard.type('needle');
  const t0 = Date.now();
  await w.keyboard.press('Enter');
  await w.waitForFunction(() => /match/.test(document.getElementById('fe-srch-status').textContent) || /No file/.test(document.getElementById('fe-srch-status').textContent), { timeout: 120000 });
  const ms = Date.now() - t0;
  const found = await w.evaluate(() => ({ status: document.getElementById('fe-srch-status').textContent, hits: [...document.querySelectorAll('#fe-srch-list .fe-sl')].map(n => n.textContent) }));
  check(['w-1067.txt', 'w-1164.txt', 'w-1261.txt', 'w-1299.txt'].every(n => found.hits.includes(n)), `Subfolders search finds the files past the 1,000th in one folder (${ms} ms for 1,310 files): ${found.status}`);
  check(/deeper than 8 levels/.test(found.status) && !found.hits.includes('bottom.txt'), `a tree deeper than the search says so in the status line: ${found.status}`);
  await shot(w, 'listing-search-deep');

  // Back keeps the query and the results, shown from before rather than searched again
  // (a file that gained the word meanwhile shows up only when Enter searches again).
  writeFileSync(join(wide, 'w-late.txt'), 'a needle added later\n');
  await w.goto(`file://${wide}/w-0001.txt`, { waitUntil: 'load' });
  await w.goBack({ waitUntil: 'load' });
  await w.waitForSelector('#fe-srch-q');
  await w.waitForFunction(() => /match|No file/.test(document.getElementById('fe-srch-status').textContent) || document.getElementById('fe-srch-q').value === '', { timeout: 120000 }).catch(() => {});
  const back = await w.evaluate(() => ({ q: document.getElementById('fe-srch-q').value, status: document.getElementById('fe-srch-status').textContent, hits: document.querySelectorAll('#fe-srch-list .fe-srch-hit').length }));
  check(back.q === 'needle' && back.hits >= 1, `Back to the folder brings the search and its results back: ${JSON.stringify(back)}`);
  check(back.hits === 4 && /earlier/i.test(back.status), `coming back shows the earlier results without searching the folder again: ${JSON.stringify(back)}`);
  await w.focus('#fe-srch-q');
  await w.keyboard.press('Enter');
  await w.waitForFunction(() => /match/.test(document.getElementById('fe-srch-status').textContent) && !/earlier/i.test(document.getElementById('fe-srch-status').textContent), { timeout: 120000 }).catch(() => {});
  const again = await w.evaluate(() => document.querySelectorAll('#fe-srch-list .fe-srch-hit').length);
  check(again === 5, `Enter searches again and finds the file that changed: ${again}`);
  await w.close();
} finally {
  console.log(`theme: ${THEME}`);
  console.log(results.join('\n'));
  await h.close();
}
