// Walks the notes sidebar ergonomics on a scratch copy of a notes store: the filter box,
// the right-click menu, keyboard rename and delete, previous and next, the folder picker,
// and one-line middle-truncated titles with the click-to-edit box.
//
//   BFB_NOTES_SRC=<store made by fuzz_notes.py> node e2e/notes-ergonomics-walk.mjs
//   BFB_THEME=light ...   (same checks on the light theme, screenshots get a -light suffix)
//
// The source folder is copied, never written.
import { launch, shot, applyTheme } from './harness.mjs';
import { cpSync, rmSync, readdirSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = process.env.BFB_NOTES_SRC;
if (!SRC) throw new Error('set BFB_NOTES_SRC to a scratch notes store (never the real ~/Notes)');
if (/\/Notes\/?$/.test(SRC) && !/scratch|fuzz/.test(SRC)) throw new Error('refusing to copy a real Notes folder');
const store = process.env.BFB_NOTES_SCRATCH || '/private/tmp/claude-501/laneD/walk-store';
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
  await page.evaluate(nd => localStorage.setItem('bfb-settings-v1',
    JSON.stringify({ showSidebar: true, tooltips: true, notesRoot: nd })), store);
  await page.reload({ waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 10_000 });

  // Row 1: the filter box.
  const all = await rowsOf(page);
  check(all.length > 10, `the sidebar lists the store: ${all.length} notes`);
  check(await page.$eval('#fe-nt-filter', e => getComputedStyle(e).display !== 'none'), 'the filter box is visible once a notes folder is set');
  const firstRel = all[0];
  const probeWord = await page.$eval(`#fe-nt-list .fe-nt-item[data-rel="${firstRel}"] .fe-nt-label`, e => e.textContent.trim().split(/\s+/)[0]);
  await page.click('#fe-nt-filter');
  await page.type('#fe-nt-filter', probeWord);
  await sleep(150);
  const narrowed = await rowsOf(page);
  check(narrowed.length >= 1 && narrowed.length < all.length && narrowed.includes(firstRel), `typing "${probeWord}" narrows ${all.length} to ${narrowed.length} and keeps ${firstRel}`);
  const hint = await page.$eval('#fe-st-notes-hint', e => e.textContent);
  check(new RegExp(`^${narrowed.length} of ${all.length} notes`).test(hint), `the count line reads "${hint}"`);
  await shot(page, 'nt-filter-narrow');
  await page.$eval('#fe-nt-filter', e => { e.value = ''; });
  await page.type('#fe-nt-filter', 'zzzzqqq');
  await sleep(150);
  const none = await page.$eval('#fe-nt-list', e => e.textContent.trim());
  check(/No note matches/.test(none), `no match says so: "${none}"`);
  await shot(page, 'nt-filter-none');
  await page.keyboard.press('Escape');
  await sleep(150);
  const back = await rowsOf(page);
  check(back.length === all.length && await page.$eval('#fe-nt-filter', e => e.value === ''), 'Escape clears the box and the whole list returns');
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
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('bfb-settings-v1') || '{}');
    delete s.notesRoot; localStorage.setItem('bfb-settings-v1', JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-pick', { timeout: 8_000 }).catch(() => null);
  const pickBtn = await page.$eval('#fe-nt-pick', e => ({ text: e.textContent.trim(), icon: !!e.querySelector('svg') })).catch(() => null);
  check(pickBtn && pickBtn.icon && /Choose folder/.test(pickBtn.text), `with no folder set the Notes section offers "Choose folder" with an icon: ${JSON.stringify(pickBtn)}`);
  await shot(page, 'nt-pick-empty');
  await page.click('#fe-nt-pick');
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 8_000 }).catch(() => null);
  const afterPick = await page.evaluate(() => ({ rows: document.querySelectorAll('#fe-nt-list .fe-nt-item').length, saved: JSON.parse(localStorage.getItem('bfb-settings-v1') || '{}').notesRoot }));
  check(afterPick.rows > 0 && afterPick.saved === store, `choosing a folder lists its notes and remembers it: ${JSON.stringify(afterPick)}`);
  await page.click('#fe-settings-btn');
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="notes"]');
  const setBtn = await page.$eval('#fe-st-notes-pick', e => ({ text: e.textContent.trim(), icon: !!e.querySelector('svg') }));
  const fieldVal = await page.$eval('#fe-st-notes-root', e => e.value);
  check(setBtn.icon && /Choose/.test(setBtn.text) && fieldVal === store, `Settings > Notes has a Choose button with an icon and shows the path: ${JSON.stringify(setBtn)}`);
  await sleep(300);
  await shot(page, 'nt-pick-settings');
  await page.$eval('#fe-st-notes-root', e => { e.value = ''; e.dispatchEvent(new Event('change')); });
  await page.click('#fe-st-notes-pick');
  await page.waitForFunction(s => document.getElementById('fe-st-notes-root').value === s, { timeout: 5_000 }, store).catch(() => null);
  check(await page.$eval('#fe-st-notes-root', e => e.value) === store, 'the Settings Choose button fills the folder field');
} finally {
  await h.close();
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall ok');
process.exit(fails.length ? 1 : 0);
