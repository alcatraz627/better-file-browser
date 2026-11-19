// Rich editing: in the editor's Rich view a click on a rendered block shows that
// block's Markdown in place. The walk edits one block of a file with odd
// formatting and compares the file on disk byte for byte: only that block's
// lines may differ. It also checks the caret lands where the click was, a
// diagram elsewhere is not redrawn, the arrows move between blocks, lists keep
// their own bullet, and undo takes an edit back.
//
//   node e2e/rich-edit-walk.mjs [folder for screenshots]   (BFB_THEME=light for the light theme)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg, got) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}${ok || got === undefined ? '' : `  got: ${JSON.stringify(got)}`}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// Odd on purpose: * bullets, __bold__, a trailing double space (a line break), a
// tab, front matter and a diagram. A save that re-wrote the file would change these.
const DOC = [
  '---',
  'title: Odd file',
  '---',
  '# Heading',
  '',
  'First paragraph stays exactly as it is.  ',
  'With a hard break above and __old bold__.',
  '',
  'Second paragraph with *odd* formatting\tand a tab.',
  '',
  '* one',
  '* two',
  '',
  '```mermaid',
  'graph LR; A-->B',
  '```',
  '',
  '| a | b |',
  '|---|---|',
  '| 1 | 2 |',
  '',
  'Last line.',
  '',
].join('\n');

const h = await launch();
const shots = process.argv[2];
try {
  const dir = join(h.fixture, 'rich');
  mkdirSync(dir);
  const file = join(dir, 'odd.md');
  writeFileSync(file, DOC);
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [dir] }));
  await h.store.set('bfb-edit-mode-v1', 'rich');
  if (THEME === 'light') await h.store.set('bfb-theme', 'light');
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1300, height: 900 });
  page.on('pageerror', e => check(false, `no page error (${e.message})`));
  page.on('dialog', d => d.accept());
  await page.goto('file://' + file, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-edit');
  await wait(400);
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-fe-view:not([hidden]) [data-sl]');
  await page.waitForSelector('#fe-fe-view svg', { timeout: 8000 });
  check(await page.$eval('#fe-fe', b => b.dataset.mode).catch(() => null) === 'rich' || await page.evaluate(() => document.querySelector('[data-mode="rich"]') !== null), 'the editor opens in Rich');

  // Mark the drawn diagram, so a redraw (which makes a new one) shows.
  await page.evaluate(() => document.querySelector('#fe-fe-view svg').setAttribute('data-probe', 'kept'));

  // Click on the word "odd" in the second paragraph.
  const odd = await page.evaluate(() => {
    const p = [...document.querySelectorAll('#fe-fe-view p')].find(x => x.textContent.startsWith('Second'));
    const em = p.querySelector('em');
    const r = em.getBoundingClientRect();
    return { x: r.left + 4, y: r.top + r.height / 2 };
  });
  await page.mouse.click(odd.x, odd.y);
  await page.waitForSelector('.fe-fe-block');
  const opened = await page.$eval('.fe-fe-block', t => ({ value: t.value, at: t.selectionStart, focused: document.activeElement === t }));
  check(opened.value === 'Second paragraph with *odd* formatting\tand a tab.', 'a click shows exactly that block\'s Markdown', opened.value);
  const want = opened.value.indexOf('odd');
  check(opened.focused && Math.abs(opened.at - want) <= 2, 'the caret lands at the clicked word', { at: opened.at, want });
  await page.evaluate(() => document.querySelector('.fe-fe-block').setSelectionRange(10_000, 10_000));
  await page.keyboard.type(' EDITED');
  await shot('rich-edit-open');

  // Esc ends the block but stays in Rich.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.fe-fe-block'));
  check(await page.evaluate(() => !!document.querySelector('[data-mode="rich"]') && [...document.querySelectorAll('#fe-fe-view p')].some(p => p.textContent.includes('EDITED'))), 'Esc renders the block again with the edit, and Rich stays');
  await wait(1300);
  const disk = readFileSync(file, 'utf8');
  const before = DOC.split('\n'), after = disk.split('\n');
  const changed = before.map((l, i) => (l === after[i] ? null : i)).filter(i => i !== null);
  check(after.length === before.length && changed.length === 1 && changed[0] === 8 && after[8] === before[8] + ' EDITED', 'on disk only the edited line differs, byte for byte', { changed, line: after[8] });
  check(await page.evaluate(() => document.querySelector('#fe-fe-view svg')?.getAttribute('data-probe') === 'kept'), 'the diagram elsewhere was not redrawn');

  // Undo with no block open takes the edit back.
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.down('Meta'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Meta');
  await wait(1300);
  check(readFileSync(file, 'utf8') === DOC, 'undo takes the edit back, and the file is as it was', readFileSync(file, 'utf8').split('\n')[8]);

  // Lists open with their own bullet, and Enter continues it.
  const item = await page.evaluate(() => { const li = document.querySelector('#fe-fe-view ul li'); const r = li.getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; });
  await page.mouse.click(item.x, item.y);
  await page.waitForSelector('.fe-fe-block');
  check(await page.$eval('.fe-fe-block', t => t.value) === '* one\n* two', 'a list opens with its own * bullets');
  await page.evaluate(() => document.querySelector('.fe-fe-block').setSelectionRange(10_000, 10_000));
  await page.keyboard.press('Enter');
  await page.keyboard.type('three');
  check(await page.$eval('.fe-fe-block', t => t.value) === '* one\n* two\n* three', 'Enter continues the list with the same bullet');

  // ArrowDown at the end moves into the next block (the diagram's source).
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => document.querySelector('.fe-fe-block')?.value.startsWith('```mermaid'));
  check(true, 'ArrowDown at a block\'s end opens the block below');
  // ArrowUp at its start goes back to the list.
  await page.evaluate(() => document.querySelector('.fe-fe-block').setSelectionRange(0, 0));
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => document.querySelector('.fe-fe-block')?.value.startsWith('* one'));
  check(true, 'ArrowUp at a block\'s start opens the block above');
  await page.keyboard.press('Escape');
  await wait(1300);
  const final = readFileSync(file, 'utf8').split('\n');
  check(final.slice(0, 12).join('\n') + '\n' + final.slice(13).join('\n') === DOC.split('\n').slice(0, 12).join('\n') + '\n' + DOC.split('\n').slice(12).join('\n') && final[12] === '* three', 'the list edit added one line and touched nothing else', final.slice(10, 14));

  // Front matter is not a block here, and a ⌘-click on a link would still follow it.
  check(await page.evaluate(() => ![...document.querySelectorAll('#fe-fe-view [data-sl]')].some(el => el.textContent.includes('title: Odd file'))), 'front matter is not offered as a block');

  async function shot(name) {
    if (!shots) return;
    await wait(300);
    await page.screenshot({ path: join(shots, `${name}-${THEME}.png`) });
  }
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  console.log(results.join('\n'));
  await h.close();
}
