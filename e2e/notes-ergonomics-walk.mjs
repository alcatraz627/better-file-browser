// Walks the notes sidebar ergonomics on a scratch copy of a notes store: the filter box,
// the right-click menu, keyboard rename and delete, previous and next, the folder picker,
// and one-line middle-truncated titles with the click-to-edit box.
//
//   node e2e/notes-ergonomics-walk.mjs   (a generated store; BFB_NOTES_SRC names another scratch store, never a real Notes folder)
//   BFB_THEME=light ...   (same checks on the light theme, screenshots get a -light suffix)
//
// The source folder is copied, never written.
import { notesSource, scratchStore } from './make-notes-store.mjs';
import { launch, shot, applyTheme } from './harness.mjs';
import { cpSync, rmSync, readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = notesSource();
const store = scratchStore(SRC, 'ergonomics-walk');
rmSync(store, { recursive: true, force: true });
mkdirSync(store, { recursive: true });
cpSync(SRC, store, { recursive: true, preserveTimestamps: true });

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rowsOf = page => page.$$eval('#fe-nt-list .fe-nt-item', els => els.map(e => e.getAttribute('data-rel')));

const h = await launch({ pickReply: store });
try {
  const page = await h.open();
  await h.store.set('bfb-settings-v1', { showSidebar: true, tooltips: true, notesRoot: store });
  await page.reload({ waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 10_000 });

  // Row 1: the filter box.
  const all = await rowsOf(page);
  check(all.length > 10, `the sidebar lists the store: ${all.length} notes`);
  check(await page.$eval('#fe-lens-filter', e => getComputedStyle(e).display !== 'none'), 'the filter box is visible once a notes folder is set');
  const firstRel = all[0];
  const probeWord = await page.$eval(`#fe-nt-list .fe-nt-item[data-rel="${firstRel}"] .fe-nt-label`, e => e.textContent.trim().split(/\s+/)[0]);
  await page.click('#fe-lens-filter');
  await page.type('#fe-lens-filter', probeWord);
  await sleep(150);
  const narrowed = await rowsOf(page);
  check(narrowed.length >= 1 && narrowed.length < all.length && narrowed.includes(firstRel), `typing "${probeWord}" narrows ${all.length} to ${narrowed.length} and keeps ${firstRel}`);
  const hint = await page.$eval('#fe-st-notes-hint', e => e.textContent);
  check(new RegExp(`^${narrowed.length} of ${all.length} notes`).test(hint), `the count line reads "${hint}"`);
  await shot(page, 'nt-filter-narrow');
  await page.$eval('#fe-lens-filter', e => { e.value = ''; });
  await page.type('#fe-lens-filter', 'zzzzqqq');
  await sleep(150);
  const none = await page.$eval('#fe-nt-list', e => e.textContent.trim());
  check(/No note matches/.test(none), `no match says so: "${none}"`);
  await shot(page, 'nt-filter-none');
  await page.click('#fe-nt-list .empty [data-a="clear"]');
  await sleep(150);
  const cleared = await rowsOf(page);
  check(cleared.length === all.length && await page.$eval('#fe-lens-filter', e => e.value === ''), 'Clear filter empties the box and the whole list returns');
  await page.type('#fe-lens-filter', 'zzzzqqq');
  await sleep(150);
  await page.keyboard.press('Escape');
  await sleep(150);
  const back = await rowsOf(page);
  check(back.length === all.length && await page.$eval('#fe-lens-filter', e => e.value === ''), 'Escape clears the box and the whole list returns');
  // Row 2: right-click menu, keys on a focused row, previous and next, delete from the editor.
  const rowSel = rel => `#fe-nt-list .fe-nt-item[data-rel="${rel}"]`;
  const trashed = () => existsSync(join(store, '.trash')) ? readdirSync(join(store, '.trash')) : [];
  const second = (await rowsOf(page))[1];
  await page.click(`${rowSel(second)} .fe-si-link`, { button: 'right' });
  await page.waitForSelector('#fe-nt-ctx', { visible: true, timeout: 3_000 }).catch(() => null);
  const menu = await page.$$eval('#fe-nt-ctx .fe-ctx-item', els => els.map(e => ({ text: e.textContent.trim(), icon: !!e.querySelector('svg') })));
  check(menu.length === 7 && menu.every(m => m.icon), `right-click shows the note menu with an icon on every item: ${JSON.stringify(menu.map(m => m.text))}`);
  await shot(page, 'nt-context-menu');
  await page.click('#fe-nt-ctx [data-act="rename"]');
  await page.waitForSelector('#fe-nt-list .fe-nt-label.editing', { timeout: 3_000 }).catch(() => null);
  check(!!(await page.$('#fe-nt-list .fe-nt-label.editing')), 'Rename in the menu puts the row title in edit mode');
  await page.keyboard.type('Renamed by the menu');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('#fe-nt-list .fe-nt-label')].some(l => l.textContent === 'Renamed by the menu' && !l.classList.contains('editing')), { timeout: 5_000 }).catch(() => null);
  await sleep(400);
  const afterRename = await page.$$eval('#fe-nt-list .fe-nt-label', els => els.map(e => e.textContent));
  check(afterRename.includes('Renamed by the menu'), 'the new title shows in the list');
  const secondNow = (await rowsOf(page)).find(r => readFileSync(join(store, r), 'utf8').includes('Renamed by the menu'));
  check(!!secondNow, `the title is stored in the note file (${secondNow})`);
  // A note titled by its first heading takes the new title too, in the list and in its heading.
  const headed = (await rowsOf(page)).find(r => /^#+ /.test(readFileSync(join(store, r), 'utf8')));
  if (headed) {
    await page.click(`${rowSel(headed)} .fe-si-link`, { button: 'right' });
    await page.waitForSelector('#fe-nt-ctx', { visible: true, timeout: 3_000 }).catch(() => null);
    await page.click('#fe-nt-ctx [data-act="rename"]');
    await page.waitForSelector('#fe-nt-list .fe-nt-label.editing', { timeout: 3_000 }).catch(() => null);
    await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta');
    await page.keyboard.type('Heading renamed');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#fe-nt-list .fe-nt-item[data-rel="heading-renamed.md"]', { timeout: 5_000 }).catch(() => null);
    await sleep(300);
    const shown = await page.$$eval('#fe-nt-list .fe-nt-label', els => els.map(e => e.textContent));
    const file = (await rowsOf(page)).find(r => existsSync(join(store, r)) && /^#+ Heading renamed$/m.test(readFileSync(join(store, r), 'utf8')));
    check(shown.includes('Heading renamed') && !!file, `a heading-titled note shows its new title and its heading changed (${headed} → ${file})`);
  } else check(false, 'the store has a heading-titled note to rename');
  // Keys on a focused row.
  const rowsBefore = await rowsOf(page);
  await page.$eval(`${rowSel(rowsBefore[2])} .fe-si-link`, e => e.focus());
  await page.keyboard.press('ArrowDown');
  const focusedRel = await page.evaluate(() => document.activeElement?.closest('.fe-nt-item')?.getAttribute('data-rel'));
  check(focusedRel === rowsBefore[3], `ArrowDown moves focus to the next row (${focusedRel})`);
  await page.keyboard.press('F2');
  check(!!(await page.$(`${rowSel(rowsBefore[3])} .fe-nt-label.editing`)), 'F2 on a focused row starts the rename');
  await page.keyboard.press('Escape');
  await page.$eval(`${rowSel(rowsBefore[3])} .fe-si-link`, e => e.focus());
  const trashBefore = trashed().length;
  await page.keyboard.press('Delete');
  await page.waitForFunction(n => document.querySelectorAll('#fe-nt-list .fe-nt-item').length === n, { timeout: 5_000 }, rowsBefore.length - 1).catch(() => null);
  check(trashed().length === trashBefore + 1 && !existsSync(join(store, rowsBefore[3])), 'Delete on a focused row moves the note to .trash');
  await sleep(600);
  const focusAfter = await page.evaluate(() => document.activeElement?.closest('.fe-nt-item')?.getAttribute('data-rel'));
  check(!!focusAfter, `focus moves to a neighbouring row after the delete (${focusAfter})`);
  // The editor: previous, next, and delete.
  const list0 = await rowsOf(page);
  await page.click(`${rowSel(list0[1])} .fe-si-link`);
  await page.waitForSelector('#fe-ed-src', { timeout: 8_000 }).catch(() => null);
  const barBtns = await page.$$eval('#fe-ed-bar [data-act]', els => els.map(e => ({ act: e.dataset.act, icon: !!e.querySelector('svg') })));
  check(['prev', 'next', 'rename', 'delete'].every(a => barBtns.some(b => b.act === a && b.icon)), `the editor bar has prev, next, rename and delete with icons: ${JSON.stringify(barBtns.map(b => b.act))}`);
  const metaOf = () => page.$eval('#fe-ql-meta', e => e.textContent);
  await page.click('#fe-ed-bar [data-act="next"]');
  await page.waitForFunction(r => document.getElementById('fe-ql-meta').textContent.startsWith(r), { timeout: 5_000 }, list0[2]).catch(() => null);
  check((await metaOf()).startsWith(list0[2]), `next opens the following note: ${await metaOf()}`);
  await page.keyboard.down('Alt'); await page.keyboard.down('Meta'); await page.keyboard.press('ArrowUp'); await page.keyboard.up('Meta'); await page.keyboard.up('Alt');
  await page.waitForFunction(r => document.getElementById('fe-ql-meta').textContent.startsWith(r), { timeout: 5_000 }, list0[1]).catch(() => null);
  check((await metaOf()).startsWith(list0[1]), `Alt-Cmd-Up goes back to the previous note: ${await metaOf()}`);
  await shot(page, 'nt-editor-bar');
  await page.click('#fe-ed-bar [data-act="delete"]');
  await page.waitForFunction(() => document.getElementById('fe-qlook').style.display === 'none', { timeout: 5_000 }).catch(() => null);
  await sleep(500);
  check(!existsSync(join(store, list0[1])) && (await rowsOf(page)).length === list0.length - 1, 'Delete in the editor closes it and moves the note to .trash');
  // Row 3: the notes folder picker, from the sidebar and from Settings (the chooser itself is answered by the harness).
  await h.store.edit('bfb-settings-v1', s => { delete s.notesRoot; });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-pick', { timeout: 8_000 }).catch(() => null);
  const pickBtn = await page.$eval('#fe-nt-pick', e => ({ text: e.textContent.trim(), icon: !!e.querySelector('svg') })).catch(() => null);
  check(pickBtn && pickBtn.icon && /Choose folder/.test(pickBtn.text), `with no folder set the Notes section offers "Choose folder" with an icon: ${JSON.stringify(pickBtn)}`);
  await shot(page, 'nt-pick-empty');
  await page.click('#fe-nt-pick');
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 8_000 }).catch(() => null);
  const afterPick = { rows: await page.evaluate(() => document.querySelectorAll('#fe-nt-list .fe-nt-item').length), saved: (await h.store.json('bfb-settings-v1', {})).notesRoot };
  check(afterPick.rows > 0 && afterPick.saved === store, `choosing a folder lists its notes and remembers it: ${JSON.stringify(afterPick)}`);
  await page.click('#fe-settings-btn');
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="notes"]');
  const setBtn = await page.$eval('#fe-st-notes-pick', e => ({ name: e.getAttribute('aria-label') || e.title || e.textContent.trim(), icon: !!e.querySelector('svg') }));
  const fieldVal = await page.$eval('#fe-st-notes-root', e => e.value);
  check(setBtn.icon && /Choose/.test(setBtn.name) && fieldVal === store, `Settings > Notes has a Choose button with an icon and shows the path: ${JSON.stringify(setBtn)}`);
  await sleep(300);
  await shot(page, 'nt-pick-settings');
  await page.$eval('#fe-st-notes-root', e => { e.value = ''; e.dispatchEvent(new Event('change')); });
  await page.click('#fe-st-notes-pick');
  await page.waitForFunction(s => document.getElementById('fe-st-notes-root').value === s, { timeout: 5_000 }, store).catch(() => null);
  check(await page.$eval('#fe-st-notes-root', e => e.value) === store, 'the Settings Choose button fills the folder field');
  // Row 4: long titles stay on one line, cut in the middle; the box shows the whole title.
  await page.keyboard.press('Escape');
  const LONG = 'A very long title that keeps going well past the width of the sidebar, then carries on for a good while longer, until the very last words here';
  writeFileSync(join(store, 'zz-long-title.md'), `---\ntitle: "${LONG}"\npinned: true\n---\nbody of the long note\n`);
  await page.reload({ waitUntil: 'load' });
  await applyTheme(page);
  // The list from the last page shows first; the note written on disk joins it when the host answers.
  await page.waitForSelector('#fe-nt-list .fe-nt-item[data-rel="zz-long-title.md"]', { timeout: 10_000 });
  const geo = await page.$$eval('#fe-nt-list .fe-nt-label', els => els.map(e => ({
    full: e.title.split('\n')[0], h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight),
    cut: (() => { const hd = e.querySelector('.fe-mid-h'); return !!hd && hd.scrollWidth > hd.clientWidth + 1; })(),
    tail: e.querySelector('.fe-mid-t')?.textContent ?? '' })));
  check(geo.every(g => g.h <= g.lh + 2), `no title wraps: tallest label ${Math.max(...geo.map(g => g.h)).toFixed(1)}px for a ${geo[0].lh.toFixed(1)}px line`);
  const longest = [...geo].sort((a, b) => b.full.length - a.full.length)[0];
  check(longest.full === LONG && longest.cut && longest.tail.length === 10 && longest.full.endsWith(longest.tail), `the longest title (${longest.full.length} chars) is cut in the middle and keeps its ending "${longest.tail}"`);
  const short = geo.find(g => g.full.length < 10 && /^[\x20-\x7e]+$/.test(g.full));
  check(!short || (!short.cut && short.tail === ''), 'a short title shows whole, without a cut');
  await shot(page, 'nt-oneline-titles');
  const longRel = await page.$$eval('#fe-nt-list .fe-nt-item', (els, full) => els.find(e => e.querySelector('.fe-nt-label').title.split('\n')[0] === full)?.getAttribute('data-rel'), longest.full);
  await page.$eval(`${rowSel(longRel)} .fe-nt-label`, e => e.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })));
  await page.waitForSelector('#fe-nt-list .fe-nt-label.editing', { timeout: 3_000 }).catch(() => null);
  const box = await page.$eval('#fe-nt-list .fe-nt-label.editing', e => ({ text: e.textContent, h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight) })).catch(() => null);
  check(box && box.text === longest.full && box.h > box.lh * 1.8, `rename opens a box with the whole title over several lines: ${box && box.h.toFixed(0)}px tall`);
  await shot(page, 'nt-title-edit-box');
  await page.keyboard.press('Escape');
  await sleep(200);
  const back1 = await page.$eval(`${rowSel(longRel)} .fe-nt-label`, e => e.getBoundingClientRect().height <= parseFloat(getComputedStyle(e).lineHeight) + 2 && !!e.querySelector('.fe-mid-t'));
  check(back1, 'Escape puts the row back on one line');
  await page.setViewport({ width: 760, height: 900 });
  await page.click(`${rowSel(longRel)} .fe-si-link`);
  await page.waitForSelector('#fe-meta-title', { timeout: 8_000 }).catch(() => null);
  await sleep(300);
  const chip = await page.$eval('#fe-meta-title', e => ({ tag: e.tagName, h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.3, icon: !!e.querySelector('svg'), full: e.dataset.title, cut: (() => { const hd = e.querySelector('.fe-mid-h'); return !!hd && hd.scrollWidth > hd.clientWidth + 1; })() }));
  check(chip.tag === 'BUTTON' && chip.icon && chip.full === longest.full && chip.cut && chip.h < chip.lh * 1.8, `the editor title chip is one line, cut in the middle, with an icon: ${chip.h.toFixed(0)}px tall, cut=${chip.cut}`);
  await shot(page, 'nt-chip-oneline');
  await page.click('#fe-meta-title');
  await page.waitForSelector('#fe-meta-title-edit', { timeout: 3_000 }).catch(() => null);
  const edBox = await page.$eval('#fe-meta-title-edit', e => ({ v: e.value, h: e.getBoundingClientRect().height, sh: e.scrollHeight, active: document.activeElement === e })).catch(() => null);
  check(edBox && edBox.v === longest.full && edBox.active && edBox.h > 33, `clicking the chip opens a focused box with the whole title: ${edBox && edBox.h.toFixed(0)}px tall`);
  await shot(page, 'nt-chip-edit-box');
  await page.keyboard.press('End');
  await page.keyboard.type(' (edited)');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('fe-meta-title')?.dataset.title.endsWith('(edited)'), { timeout: 5_000 }).catch(() => null);
  const chipAfter = await page.$eval('#fe-meta-title', e => e.dataset.title).catch(() => null);
  check(!!chipAfter && chipAfter.endsWith('(edited)'), `after Enter the chip shows the new title: ${chipAfter && chipAfter.slice(-30)}`);
  await sleep(2500);   // the editor autosaves 1.5 s after a change
  check(/^title:.*\(edited\)/m.test(readFileSync(join(store, longRel), 'utf8')), 'Enter in the box saves the new title to the note file');
} finally {
  await h.close();
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall ok');
process.exit(fails.length ? 1 : 0);
