// Moving around with keys alone, starting from a page as it arrives: vim keys, where
// focus lands after a dialog, whether a lens picked by key sticks, one current row at
// a time, and Contents neither covering the text nor ignoring Esc.
//
//   node e2e/keys-walk.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  await h.store.edit('bfb-settings-v1', s => ({ ...s, showSidebar: true }));
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const home = 'file://' + h.fixture + '/';
  const arrive = async url => { await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('#fe'); await wait(500); };
  const selected = () => page.$$eval('#fe-scroll [data-idx].selected', r => r.map(x => x.dataset.idx).join());
  const press = async (...keys) => { for (const k of keys) { await page.keyboard.press(k); await wait(80); } };
  const shiftKey = async k => { await page.keyboard.down('Shift'); await page.keyboard.press(k); await page.keyboard.up('Shift'); await wait(80); };

  // j k G gg move in the listing, and h goes up.
  await arrive(home);
  await press('j');
  const a = await selected();
  await press('j');
  const b = await selected();
  await press('k');
  const c = await selected();
  check(a !== b && c === a, `j and k move the selection: ${JSON.stringify([a, b, c])}`);
  await shiftKey('G');
  const last = await page.$$eval('#fe-scroll [data-idx]', r => r.filter(x => x.checkVisibility()).at(-1)?.dataset.idx);
  check(await selected() === last, `G goes to the last row: ${last}`);
  await press('g', 'g');
  const first = Number(await selected());
  check(first < Number(last) && first <= 1, `g g goes to the first row: ${first}`);

  // Dialogs opened by key give the keys back to the page.
  for (const [name, keys] of [['All tabs', ['g', 'a']], ['the path dialog', ['l']]]) {
    await arrive(home);
    await press('j');
    const before = await selected();
    await press(...keys);
    await wait(200);
    await press('Escape');
    await wait(200);
    const focus = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    await press('j');
    check(await selected() !== before, `after Esc from ${name} the arrows work at once: focus ${focus}`);
  }

  // A lens picked by key is still there on the next page.
  await arrive(home);
  await press('g', '2');
  await wait(200);
  await arrive(home + 'nested/');
  check(await page.$eval('#fe-rail .fe-rail-btn.on', b => b.id) === 'fe-rail-saved', 'a lens picked with g 2 is remembered on the next page');
  await page.evaluate(() => document.getElementById('fe-rail-notes')?.click());

  // After a click-to-preview there is one current row.
  await arrive(home);
  await page.evaluate(() => [...document.querySelectorAll('#fe-tbody .fe-lnk')].find(l => /notes\.txt/.test(l.textContent))?.focus());
  await page.evaluate(() => [...document.querySelectorAll('#fe-tbody .fe-lnk')].find(l => /notes\.txt/.test(l.textContent))?.click());
  await page.waitForSelector('#fe-qlook', { visible: true });
  await wait(300);
  await press('Escape');
  await wait(200);
  await page.evaluate(() => [...document.querySelectorAll('#fe-tbody .fe-lnk')].find(l => /notes\.txt/.test(l.textContent))?.focus());
  await press('ArrowDown');
  const inRow = await page.evaluate(() => !!document.activeElement?.closest('#fe-scroll'));
  check(!inRow, 'moving with the keys leaves no second row in focus');

  // ⇧T lands on the reopened tab.
  await arrive(home + 'nested/');
  await press('t');
  await arrive(home);
  await press('t');
  await wait(200);
  await page.evaluate(() => document.querySelector('#fe-tabs .fe-tab[title*="nested"], #fe-tabs .fe-tab')?.blur());
  await press('w');
  await page.waitForFunction(() => true);
  await wait(800);
  const afterClose = page.url();
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 5000 }).catch(() => null), shiftKey('T')]);
  await wait(300);
  check(page.url() !== afterClose, `⇧T goes to the reopened tab: ${afterClose} to ${page.url()}`);

  // The All tabs menu can be scrolled to its last row in a short window.
  await page.setViewport({ width: 1400, height: 230 });
  await arrive(home);
  for (const f of ['readme.md', 'code.py', 'notes.txt', 'data.json', 'nested/', 'nested/deeper/']) {
    await arrive(home + f);
    await press('t');
    await wait(120);
  }
  await page.waitForSelector('#fe-tab-list:not([hidden])', { timeout: 3000 }).catch(() => null);
  await page.click('#fe-tab-list');
  await wait(200);
  const menu = await page.$eval('.fe-tab-menu', m => { const r = m.getBoundingClientRect(); m.scrollTop = m.scrollHeight; const end = m.querySelector('.fe-ctx-item:last-child').getBoundingClientRect(); return { bottom: Math.round(r.bottom), vp: innerHeight, scrolls: m.scrollHeight > m.clientHeight, endSeen: end.bottom <= innerHeight + 1 }; });
  check(menu.bottom <= menu.vp && menu.scrolls && menu.endSeen, `All tabs stays in the window and scrolls to its last row: ${JSON.stringify(menu)}`);
  await press('Escape');

  // Contents on a tight page takes room rather than covering text, and Esc closes it.
  await page.setViewport({ width: 1100, height: 900 });
  const doc = join(h.fixture, 'toc.md');
  writeFileSync(doc, Array.from({ length: 12 }, (_, i) => `## Heading ${i}\n\n${'Some words that run the whole width of the reading column. '.repeat(6)}\n`).join('\n'));
  await arrive('file://' + doc);
  await shiftKey('O');
  await wait(300);
  const toc = await page.evaluate(() => {
    const rail = document.getElementById('fe-toc-rail'), para = document.querySelector('#fe-page .fe-md p');
    return { open: rail.checkVisibility(), peek: rail.classList.contains('peek'), railLeft: Math.round(rail.getBoundingClientRect().left), textRight: Math.round(para.getBoundingClientRect().right) };
  });
  check(toc.open && toc.textRight <= toc.railLeft, `Contents does not cover the text: ${JSON.stringify(toc)}`);
  await press('Escape');
  await wait(200);
  const closed = await page.$eval('#fe-toc-rail', r => !r.checkVisibility());
  check(!toc.peek || closed, `Esc closes Contents when it floats: ${JSON.stringify({ peek: toc.peek, closed })}`);

  // The sidebar's list keeps its place across a page change.
  const many = Array.from({ length: 80 }, (_, i) => ({ path: `${h.fixture}/nested/place-${i}/`, label: `Place ${i}` }));
  await h.store.set('bfb-saved-v1', [{ path: `${h.fixture}/nested/`, label: 'Nested place' }, ...many]);
  await h.store.set('bfb-lens-v1', 'saved');
  await arrive(home);
  await page.waitForSelector('#fe-lens-saved .fe-pl-item');
  await page.evaluate(() => { document.getElementById('fe-lenses').scrollTop = 600; });
  const sideTop = await page.$eval('#fe-lenses', b => b.scrollTop);
  await arrive(home + 'nested/');
  await wait(1000);
  const sideAfter = await page.$eval('#fe-lenses', b => b.scrollTop);
  check(sideTop > 300 && Math.abs(sideAfter - sideTop) < 3, `the sidebar list keeps its place across a page change: ${sideTop} then ${sideAfter}`);

  // F2 and a tag edit hand focus back to the row, so the next key acts on it.
  await page.evaluate(() => { document.getElementById('fe-lenses').scrollTop = 0; document.querySelector('#fe-lens-saved .fe-pl-item .fe-si-link')?.focus(); });
  const rowKey = () => page.evaluate(() => { const a = document.activeElement; return { row: !!a?.closest('#fe-lens-saved .fe-pl-item'), id: a?.tagName }; });
  await press('F2');
  await wait(150);
  await press('Escape');
  await wait(200);
  const afterEsc = await rowKey();
  check(afterEsc.row, `Esc from F2 leaves the row in focus: ${JSON.stringify(afterEsc)}`);
  await press('F2');
  await wait(150);
  await page.keyboard.type('New name');
  await press('Enter');
  await wait(300);
  const afterEnter = await rowKey();
  check(afterEnter.row, `Enter from F2 leaves the row in focus: ${JSON.stringify(afterEnter)}`);
  await h.store.set('bfb-lens-v1', 'notes');

  // ↓ in the Search lens reaches its results.
  writeFileSync(join(h.fixture, 'findme.txt'), 'needle in here\n');
  await arrive(home);
  await press('g', '5');
  await page.waitForSelector('#fe-srch-q', { visible: true });
  await wait(200);
  await page.focus('#fe-srch-q');
  await page.keyboard.type('needle');
  await press('Enter');
  await page.waitForSelector('#fe-srch-list .fe-srch-hit', { timeout: 8000 }).catch(() => null);
  await page.focus('#fe-srch-q');
  await press('ArrowDown');
  check(await page.evaluate(() => !!document.activeElement?.matches('.fe-srch-hit')), '↓ in the Search box goes to the first result');
  await page.evaluate(() => document.getElementById('fe-rail-notes')?.click());

  // j k G gg scroll a file page, and h goes up from it.
  await page.setViewport({ width: 1400, height: 900 });
  await arrive('file://' + doc);
  await press('j', 'j');
  const down = await page.$eval('#fe-page', p => p.scrollTop);
  await press('k');
  const up = await page.$eval('#fe-page', p => p.scrollTop);
  await shiftKey('G');
  const end = await page.$eval('#fe-page', p => p.scrollTop);
  await press('g', 'g');
  const top = await page.$eval('#fe-page', p => p.scrollTop);
  check(down > 0 && up < down && end > down && top === 0, `j k G gg scroll a file page: ${JSON.stringify({ down, up, end, top })}`);
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 5000 }).catch(() => null), press('h')]);
  check(page.url() === home, `h goes to the parent folder: ${page.url()}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
