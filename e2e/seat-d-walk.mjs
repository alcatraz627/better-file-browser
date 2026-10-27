// Walks the settings and notes fixes: one set of reading-width names and a real narrow column, the
// file bar and Tags column at 900px, comma tags, note delete with Undo and a Trash view, export to a
// file with an import preview and Reset, "Not set" placeholders, list continuation, and moving rows
// with the keyboard. Each row names what it guards.
//
//   node e2e/seat-d-walk.mjs       (BFB_THEME=light for the light theme; screenshots in e2e/shots)
import { launch, shot, applyTheme, THEME } from './harness.mjs';
import { writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const alt = async (page, key) => { await page.keyboard.down('Alt'); await page.keyboard.press(key); await page.keyboard.up('Alt'); };

const h = await launch();
try {
  const note = (rel, body, created) => writeFileSync(join(h.notesDir, rel), `---\ntitle: ${JSON.stringify(rel.replace(/\.md$/, ''))}\ncreated: ${created}\n---\n${body}\n`);
  note('alpha.md', '# alpha', '2026-10-03T10:00:00Z');
  note('bravo.md', '# bravo', '2026-10-02T10:00:00Z');
  note('charlie.md', '# charlie', '2026-10-01T10:00:00Z');
  await h.store.set('bfb-settings-v1', { showSidebar: true, tooltips: true, notesRoot: h.notesDir });
  const savedList = ['one', 'two', 'three'].map(n => ({ path: `/tmp/bfb-seatd-${n}/`, label: n }));
  await h.store.set('bfb-saved-v1', savedList);
  const page = await h.open();
  await applyTheme(page);
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 10_000 });

  // 13: the reading width has four names, in Settings and on the file page, and Narrow is narrow.
  await page.setViewport({ width: 1920, height: 900 });
  const md = join(h.fixture, 'width.md');
  writeFileSync(md, '# Width\n\n## One\n\n' + 'word '.repeat(400) + '\n\n## Two\n\ntext\n');
  await h.store.remove('bfb-page-column-v2');
  await page.goto('file://' + md, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-column');
  const labels = [], widths = [];
  for (let i = 0; i < 4; i++) {
    labels.push(await page.$eval('#fe-fp-column .fe-fp-column-label', e => e.textContent));
    widths.push(await page.$eval('#fe-page .fe-md', e => Math.round(e.getBoundingClientRect().width)));
    await page.click('#fe-fp-column');
  }
  check(labels.join() === 'Full width,Wide width,Medium width,Narrow width', `the button names the widths as Settings does: ${labels.join()}`);
  check(widths[0] > widths[1] && widths[1] > widths[2] && widths[2] > widths[3] && widths[3] < 800, `Narrow is a real narrow column (about 80 characters), not 944px: ${widths.join()}`);
  await page.click('#fe-fp-column'); await page.click('#fe-fp-column'); await page.click('#fe-fp-column');
  check(await h.store.get('bfb-page-column-v2') === 'md', 'Narrow is still stored as md, so an older build reads it');
  await shot(page, 'seatd-narrow');
  await page.setViewport({ width: 1400, height: 900 });
  await page.click('#fe-settings-btn');
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="files"]');
  const seg = await page.$$eval('#fe-st-rd-column .fe-seg-b', bs => bs.map(b => `${b.dataset.v}=${b.textContent.trim()}`));
  check(seg.join() === 'unset=Full,xl=Wide,lg=Medium,md=Narrow' && await page.$eval('#fe-st-rd-column .fe-seg-b[data-v="md"]', b => b.classList.contains('on') || b.getAttribute('aria-checked') === 'true'),
    `Settings names the same four and shows the stored md as Narrow: ${seg.join()}`);
  await page.keyboard.press('Escape');

  // 14: at 900px every file-bar button stays inside the bar, and an untagged folder has no Tags column.
  await page.setViewport({ width: 900, height: 800 });
  await page.goto('file://' + md, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-toc:not([hidden])');
  await sleep(300);
  const bar = await page.evaluate(() => {
    const b = document.getElementById('fe-fp-bar').getBoundingClientRect();
    const ids = ['fe-fp-column', 'fe-fp-edit', 'fe-fp-wrap', 'fe-fp-raw', 'fe-fp-copy', 'fe-ff-q', 'fe-fp-toc', 'fe-fp-cm'];
    return ids.map(id => { const r = document.getElementById(id).getBoundingClientRect(); return [id, r.width > 0 && r.left >= b.left - 1 && r.right <= b.right + 1]; });
  });
  check(bar.every(([, ok]) => ok), `at 900px Find, Contents and Comments are inside the file bar: ${JSON.stringify(bar.filter(([, ok]) => !ok))}`);
  await shot(page, 'seatd-bar-900');
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr[data-idx]');
  const tagsHidden = () => page.$eval('th.c-tg', th => getComputedStyle(th).display === 'none');
  check(await tagsHidden(), 'a folder with nothing tagged shows no Tags column');
  await shot(page, 'seatd-no-tags');
  await h.store.set('bfb-saved-v1', [...savedList, { path: h.fixture + '/notes.txt', label: 'notes', tags: ['work'] }]);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr[data-idx]');
  check(!(await tagsHidden()), 'the Tags column returns once something in the folder is tagged');
  await h.store.set('bfb-saved-v1', savedList);
  await page.setViewport({ width: 1400, height: 900 });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-list .fe-nt-item');

  // 15: a comma ends a tag in the note's Tag box.
  await page.click('#fe-nt-list .fe-nt-item[data-rel="alpha.md"] .fe-si-link');
  await page.waitForSelector('#fe-ed-src');
  await sleep(500);
  await page.click('#fe-ed-meta [data-m="tag"]');
  await page.waitForSelector('.fe-pmenu .fe-pm-add input');
  await page.type('.fe-pmenu .fe-pm-add input', 'work, planning');
  await page.keyboard.press('Enter');
  await sleep(600);
  const chips = await page.$$eval('.fe-pmenu .fe-pm-tags .chip > span', s => s.map(x => x.textContent));
  check(chips.join() === 'work,planning', `"work, planning" makes two tags: ${chips.join('|')}`);
  await shot(page, 'seatd-tags');
  await page.keyboard.press('Escape');

  // 28: typing the marker again after Enter does not double it, and ending a list leaves a blank line.
  await page.evaluate(() => { const t = document.getElementById('fe-ed-src'); t.value = ''; t.focus(); t.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('#fe-ed-src', '1. one');
  await page.keyboard.press('Enter');
  await page.type('#fe-ed-src', '2. two');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.type('#fe-ed-src', '## Friday');
  const typed = await page.$eval('#fe-ed-src', t => t.value);
  check(typed === '1. one\n2. two\n\n## Friday', `a typed "2." is absorbed and the list ends with a blank line: ${JSON.stringify(typed)}`);
  await page.evaluate(() => { const t = document.getElementById('fe-ed-src'); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('#fe-ed-src', '- [ ] task');
  await page.keyboard.press('Enter');
  await page.type('#fe-ed-src', '- [ ] next');
  const task = await page.$eval('#fe-ed-src', t => t.value);
  check(task === '- [ ] task\n- [ ] next', `a typed "- [ ]" is not doubled: ${JSON.stringify(task)}`);
  await shot(page, 'seatd-list');
  await page.evaluate(() => { const t = document.getElementById('fe-ed-src'); t.value = '# alpha'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(1800);
  await page.keyboard.press('Escape');
  await sleep(300);

  // 29: Alt+Up and Alt+Down move a Notes row and a Saved row.
  const order = async () => (await page.$$eval('#fe-nt-list .fe-nt-item', r => r.map(x => x.dataset.rel))).join();
  const before = await order();
  await page.focus('#fe-nt-list .fe-nt-item[data-rel="alpha.md"] .fe-si-link');
  await alt(page, 'ArrowDown');
  await sleep(300);
  await sleep(1200);
  const after = await order();
  check(before === 'existing-note.md,alpha.md,bravo.md,charlie.md' && after === 'existing-note.md,bravo.md,alpha.md,charlie.md', `Alt+Down moves a note down one: ${before} -> ${after}`);
  check(await page.evaluate(() => document.activeElement?.closest('.fe-nt-item')?.dataset.rel) === 'alpha.md', 'focus stays on the moved note');
  await sleep(1200);
  const posOnDisk = readFileSync(join(h.notesDir, 'alpha.md'), 'utf8');
  check(/^pos: /m.test(posOnDisk), 'the new order is written to the note');
  // Two quick presses move it two places, with no write clash.
  await page.focus('#fe-nt-list .fe-nt-item[data-rel="bravo.md"] .fe-si-link');
  await alt(page, 'ArrowDown'); await alt(page, 'ArrowDown');
  await sleep(2500);
  const twice = await order();
  const clash = await page.evaluate(() => document.getElementById('fe-toast')?.textContent ?? '');
  check(twice === 'existing-note.md,alpha.md,charlie.md,bravo.md' && !/Saving the new order|changed on disk/.test(clash), `two quick Alt+Down presses move a note two places with no clash: ${twice} / "${clash}"`);
  await page.click('#fe-rail-saved');
  await page.waitForSelector('#fe-sv-list .fe-pl-item');
  await page.focus('#fe-sv-list .fe-pl-item[data-path$="two/"] .fe-si-link');
  await alt(page, 'ArrowUp');
  await sleep(300);
  const sv = await page.$$eval('#fe-sv-list .fe-pl-item', r => r.map(x => x.dataset.path.replace(/.*bfb-seatd-|\/$/g, '')).join());
  const svStored = JSON.parse(await h.store.get('bfb-saved-v1')).map(p => p.label).join();
  check(sv === 'two,one,three' && svStored === 'two,one,three', `Alt+Up moves a Saved row up one and keeps it: ${sv} / ${svStored}`);
  const svFocus = await page.evaluate(() => document.activeElement?.closest('.fe-pl-item')?.dataset.path ?? '');
  check(svFocus.endsWith('two/'), `focus stays on the moved Saved row: "${svFocus}"`);

  await page.focus('#fe-rail .fe-rail-btn.on');
  await alt(page, 'ArrowDown');
  await sleep(200);
  check(await page.evaluate(() => !!document.activeElement?.closest('#fe-lenses')), 'Alt+Down on the lens bar still goes into the open lens');

  // 16: deleting a note offers Undo; the Trash view lists it and restores it.
  await page.click('#fe-rail-notes');
  await page.hover('#fe-nt-list .fe-nt-item[data-rel="charlie.md"]');
  await page.click('#fe-nt-list .fe-nt-item[data-rel="charlie.md"] .fe-rm-btn');
  await page.waitForSelector('#fe-toast .fe-toast-act');
  const toastText = await page.$eval('#fe-toast', t => t.textContent);
  check(/Moved to \.trash/.test(toastText) && !existsSync(join(h.notesDir, 'charlie.md')), `the delete toast offers Undo: ${toastText}`);
  await shot(page, 'seatd-undo-toast');
  await page.click('#fe-toast .fe-toast-act');
  await sleep(600);
  check(existsSync(join(h.notesDir, 'charlie.md')) && !!(await page.$('#fe-nt-list .fe-nt-item[data-rel="charlie.md"]')), 'Undo puts the note back in the folder and the list');
  await page.hover('#fe-nt-list .fe-nt-item[data-rel="charlie.md"]');
  await page.click('#fe-nt-list .fe-nt-item[data-rel="charlie.md"] .fe-rm-btn');
  await sleep(600);
  await page.click('#fe-nt-trash');
  await page.waitForSelector('#fe-nt-list .fe-nt-trashed');
  const trashRows = await page.$$eval('#fe-nt-list .fe-nt-trashed', r => r.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  check(trashRows.length === 1 && /charlie/.test(trashRows[0]) && /Deleted/.test(trashRows[0]) && /Restore/.test(trashRows[0]), `the Trash view lists the deleted note: ${JSON.stringify(trashRows)}`);
  await shot(page, 'seatd-trash');
  await page.click('#fe-nt-list .fe-nt-restore');
  await sleep(600);
  check(existsSync(join(h.notesDir, 'charlie.md')) && await page.$$eval('#fe-nt-list .fe-nt-trashed', r => r.length) === 0, 'Restore returns it to the notes folder and leaves the trash empty');
  await page.click('#fe-nt-trash');
  await page.waitForSelector('#fe-nt-list .fe-nt-item');
  check(!!(await page.$('#fe-nt-list .fe-nt-item[data-rel="charlie.md"]')), 'leaving the Trash view brings the notes list back with the restored note');

  // 24: an empty folder field says "Not set", not an example that reads as a value.
  await page.click('#fe-settings-btn');
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="notes"]');
  const ph = await page.evaluate(() => [document.getElementById('fe-st-notes-root').placeholder, document.querySelector('#fe-st-edit-roots input').placeholder]);
  check(ph[0] === 'Not set' && /Not set/.test(ph[1]) && !/~\/Code/.test(ph[1]), `the folder placeholders read "Not set": ${JSON.stringify(ph)}`);
  await shot(page, 'seatd-notset');

  // 23: Export saves a dated file without passing state; Import says what changes; Reset has an Undo.
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="data"]');
  await page.click('#fe-st-export');
  let file = '';
  for (let i = 0; i < 40 && !file; i++) { file = readdirSync(h.downloads).find(f => /^bfb-settings-\d{8}\.json$/.test(f)) ?? ''; if (!file) await sleep(150); }
  const exported = file ? JSON.parse(readFileSync(join(h.downloads, file), 'utf8')) : {};
  const keys = Object.keys(exported);
  check(!!file && 'bfb-settings-v1' in exported && 'bfb-saved-v1' in exported, `Export saves a dated .json file with settings and Saved: ${file} (${keys.length} keys)`);
  check(!keys.some(k => /^bfb-(dialog-tab:|page-scroll|lens-v1|goto-last)/.test(k)), `the export carries no passing UI state: ${keys.filter(k => /dialog-tab|scroll|lens-v1/.test(k)).join()}`);
  const plan = join(tmpdir(), `bfb-seatd-import-${process.pid}.json`);
  writeFileSync(plan, JSON.stringify({ 'bfb-settings-v1': { showSidebar: true, tooltips: true, readerSize: 18, notesRoot: h.notesDir }, 'bfb-density': '2', 'bfb-lens-v1': 'ask' }));
  const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 5_000 }), page.click('#fe-st-import')]);
  await chooser.accept([plan]);
  await page.waitForSelector('#fe-st-import-plan:not([hidden])');
  const planText = await page.$eval('#fe-st-import-plan-tx', t => t.textContent);
  const stillOld = await h.store.get('bfb-density');
  check(/changes 1 setting/.test(planText) && /adds 1/.test(planText) && stillOld !== '2', `Import says what it will change before applying: ${planText}`);
  await shot(page, 'seatd-import-plan');
  await page.click('#fe-st-import-cancel');
  check(await page.$eval('#fe-st-import-plan', p => p.hidden) && (await h.store.get('bfb-density')) !== '2', 'Cancel applies nothing');
  const [chooser2] = await Promise.all([page.waitForFileChooser({ timeout: 5_000 }), page.click('#fe-st-import')]);
  await chooser2.accept([plan]);
  await page.waitForSelector('#fe-st-import-plan:not([hidden])');
  const nav = page.waitForNavigation({ waitUntil: 'load', timeout: 8_000 }).catch(() => null);
  await page.click('#fe-st-import-apply');
  await nav;
  await page.waitForSelector('#fe-toast.show .fe-toast-act', { timeout: 8_000 });
  check((await h.store.get('bfb-density')) === '2' && (await h.store.get('bfb-lens-v1')) !== 'ask', 'Apply writes the settings and ignores passing state');
  await page.click('#fe-toast .fe-toast-act');
  await sleep(1500);
  check((await h.store.get('bfb-density')) === null && JSON.parse(await h.store.get('bfb-settings-v1')).readerSize === undefined, 'Undo after an import puts every setting back');
  await page.waitForSelector('#fe');
  await h.store.set('bfb-theme', 'light');
  await h.store.set('bfb-density', '3');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe');
  await page.click('#fe-settings-btn');
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="data"]');
  const nav2 = page.waitForNavigation({ waitUntil: 'load', timeout: 8_000 }).catch(() => null);
  await page.click('#fe-st-reset');
  await nav2;
  await page.waitForSelector('#fe-toast.show .fe-toast-act', { timeout: 8_000 });
  const afterReset = { theme: await h.store.get('bfb-theme'), density: await h.store.get('bfb-density'), saved: await h.store.get('bfb-saved-v1'), settings: JSON.parse(await h.store.get('bfb-settings-v1') ?? '{}') };
  check(afterReset.theme === null && afterReset.density === null && JSON.parse(afterReset.saved).length === 3 && afterReset.settings.notesRoot === h.notesDir && afterReset.settings.showSidebar === undefined,
    `Reset restores defaults but keeps Saved and the notes folder: ${JSON.stringify({ ...afterReset, saved: '3 places' })}`);
  await shot(page, 'seatd-reset-toast');
  await page.click('#fe-toast .fe-toast-act');
  await sleep(1500);
  check((await h.store.get('bfb-theme')) === 'light' && (await h.store.get('bfb-density')) === '3', 'Undo after a reset brings every setting back');
} finally {
  await h.close();
}
console.log(fails.length ? `\n${fails.length} FAILED` : `\nall rows passed (${THEME})`);
process.exit(fails.length ? 1 : 0);
