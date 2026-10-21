// The path bar: the chevron between folders is also that folder's menu, the
// current folder ends the bar with a down chevron for its own menu, and when the window is too narrow the middle
// folders fold into a "…" menu, measured so a path that fits never folds.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { launch, SHOTS, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sfx = THEME === 'light' ? '-light' : '';
const h = await launch();
const bar = p => p.evaluate(() => {
  const bc = document.getElementById('fe-bc');
  const shown = [...bc.querySelectorAll('.fe-cg')].filter(g => !g.hidden).map(g => g.querySelector('.fe-crumb').textContent);
  return { shown, total: bc.querySelectorAll('.fe-cg').length, more: !document.getElementById('fe-crumb-more').hidden,
    fits: bc.scrollWidth <= bc.clientWidth, seps: bc.querySelectorAll('.fe-sep').length,
    lastHasChevron: !!bc.querySelector('.fe-cg:has(.cur) .fe-crumb-dd path[d^="m2.5 4.5"]'), cur: bc.querySelector('.fe-crumb.cur')?.textContent };
});
try {
  await h.store.set('bfb-theme', THEME);
  const page = await h.open();
  await page.setViewport({ width: 1800, height: 800 });
  await sleep(300);
  const wide = await bar(page);
  wide.moreDrawn = await page.$eval('#fe-crumb-more', b => b.getBoundingClientRect().width > 0);
  check(!wide.more && !wide.moreDrawn && wide.shown.length === wide.total && wide.fits, `a wide window shows every folder and no "…": ${JSON.stringify(wide)}`);
  check(wide.seps === 0 && wide.lastHasChevron && wide.cur === h.fixture.split('/').pop(), `chevrons are the separators and the current folder ends the bar: ${JSON.stringify({ seps: wide.seps, last: wide.lastHasChevron, cur: wide.cur })}`);
  await page.screenshot({ path: join(SHOTS, `path-bar-wide${sfx}.png`), clip: { x: 0, y: 0, width: 1100, height: 44 } });

  await page.setViewport({ width: 600, height: 800 });
  await sleep(400);
  const narrow = await bar(page);
  check(narrow.more && narrow.fits && narrow.shown[0] === '/' && narrow.shown.at(-1) === wide.cur, `a narrow window folds the middle into "…" and still fits: ${JSON.stringify(narrow)}`);
  await page.screenshot({ path: join(SHOTS, `path-bar-narrow${sfx}.png`), clip: { x: 0, y: 0, width: 600, height: 44 } });
  const order = await page.evaluate(() => [...document.getElementById('fe-bc').children].map(c => c.id === 'fe-crumb-more' ? '…' : c.querySelector?.('.fe-crumb')?.textContent).filter((x, i, a) => x && (x === '…' || !document.getElementById('fe-bc').children[i].hidden)));
  check(order.indexOf('…') > 0 && order.indexOf('…') < order.length - 1, `"…" sits where the folded folders were: ${order.join(' ')}`);

  await page.click('#fe-crumb-more');
  await page.waitForSelector('#fe-crumb-menu .fe-dd-item');
  const folded = await page.$$eval('#fe-crumb-menu .fe-dd-item', as => as.map(a => a.textContent.trim()));
  const hidden = wide.shown.filter(n => !narrow.shown.includes(n));
  check(folded.join('/') === hidden.join('/'), `"…" lists the folded folders in order: ${folded.join(' › ')}`);
  await page.screenshot({ path: join(SHOTS, `path-bar-more${sfx}.png`), clip: { x: 0, y: 0, width: 600, height: 300 } });
  const target = await page.$eval('#fe-crumb-menu .fe-dd-item:last-child', a => a.href);
  await Promise.all([page.waitForNavigation({ timeout: 6000 }).catch(() => null), page.click('#fe-crumb-menu .fe-dd-item:last-child')]);
  check(page.url() === target, `a folded folder opens from the menu: ${page.url()}`);

  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.setViewport({ width: 1800, height: 800 });
  await page.waitForSelector('#fe-bc');
  await page.click('#fe-bc .fe-cg:nth-last-of-type(2) .fe-crumb-dd');
  await page.waitForSelector('#fe-crumb-menu .fe-dd-item');
  const inParent = await page.evaluate(name => {
    const items = document.querySelectorAll('#fe-crumb-menu .fe-dd-item');
    return { n: items.length, has: [...items].some(a => a.textContent.trim() === name) };
  }, h.fixture.split('/').pop());
  check(inParent.has, `the chevron after a folder lists what it holds: ${inParent.n} items`);
  await page.keyboard.press('Escape');

  const barH = await page.$eval('#fe-bar', b => b.getBoundingClientRect().height);
  check(barH <= 37, `the bar is slim: ${barH}px`);

  // Click an empty part of the bar to type a path.
  const typeBox = async () => {
    const r = await page.$eval('#fe-bc', b => { const x = b.getBoundingClientRect(); return { x: x.right - 20, y: x.top + x.height / 2 }; });
    await page.mouse.click(r.x, r.y);
    await page.waitForSelector('#fe-bc-edit input', { timeout: 2000 });
    return page.$eval('#fe-bc-edit input', i => ({ value: i.value, focused: document.activeElement === i, selected: i.selectionEnd - i.selectionStart }));
  };
  const box1 = await typeBox();
  check(box1.value.replace(/\/$/, '') === h.fixture && box1.focused && box1.selected === box1.value.length, `an empty part of the bar opens a path box with the path selected: ${JSON.stringify(box1)}`);
  await page.screenshot({ path: join(SHOTS, `path-bar-edit${sfx}.png`), clip: { x: 0, y: 0, width: 1100, height: 44 } });
  await page.keyboard.press('Escape');
  await sleep(150);
  check(await page.$eval('#fe-bc', b => !b.hidden) && !(await page.$('#fe-bc-edit')), 'Esc puts the folders back');

  await typeBox();
  await page.keyboard.type('/no/such/place');
  await page.keyboard.press('Enter');
  await sleep(500);
  check(await page.$eval('#fe-bc-edit input', i => i.hasAttribute('aria-invalid')), 'a path that is not there is marked and the box stays');
  await page.$eval('#fe-bc-edit input', i => { i.value = ''; });
  await page.keyboard.type(h.fixture + '/nested');
  await Promise.all([page.waitForNavigation({ timeout: 6000 }).catch(() => null), page.keyboard.press('Enter')]);
  await page.waitForSelector('#fe-bc');
  check(decodeURIComponent(page.url()).replace(/\/$/, '').endsWith('/nested'), `Enter goes to the typed path in this tab: ${page.url()}`);

  // Inside the home folder the path starts at "~", and "…" still reaches the folders above.
  const home = homedir();
  await page.goto('file://' + home + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-bc');
  await sleep(300);
  const atHome = await bar(page);
  check(atHome.shown[0] === '~' && atHome.shown.length === 1 && !atHome.more, `at home the bar shows just "~": ${JSON.stringify(atHome)}`);
  await page.click('#fe-bc');
  const homeBox = await page.$eval('#fe-bc-edit input', i => i.value).catch(() => null);
  check(homeBox === '~/',`the path box writes home as "~": ${homeBox}`);
  await page.keyboard.press('Escape');

  writeFileSync(join(h.fixture, 'a-rather-long-file-name-that-should-shorten-before-the-path-does.md'), '# Long\n');
  await page.goto('file://' + h.fixture + '/a-rather-long-file-name-that-should-shorten-before-the-path-does.md', { waitUntil: 'load' });
  await page.setViewport({ width: 760, height: 800 });
  await page.waitForSelector('#fe-bc .fe-crumb-file');
  await sleep(400);
  const file = await page.evaluate(() => {
    const bc = document.getElementById('fe-bc'), f = bc.querySelector('.fe-crumb-file');
    return { fits: bc.scrollWidth <= bc.clientWidth, whole: f.scrollWidth <= f.clientWidth || f.getBoundingClientRect().width >= bc.clientWidth * 0.44, folded: !document.getElementById('fe-crumb-more').hidden };
  });
  check(file.fits && file.whole && file.folded, `on a file page the folders fold before the file name shortens: ${JSON.stringify(file)}`);
  check(file.fits, `on a file page the bar still fits with the file name showing: ${JSON.stringify(file)}`);
  await page.screenshot({ path: join(SHOTS, `path-bar-file${sfx}.png`), clip: { x: 0, y: 0, width: 760, height: 44 } });
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'path bar walk passes');
