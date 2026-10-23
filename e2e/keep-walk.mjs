// The Keep card and renaming, as a person uses them: from a note's file bar,
// put it in Saved under a name, give the note the same title, pin it, and
// rename the file; from the folder list, rename a file with F2 and from its
// right-click menu; from the preview, rename with its button. Each step is
// checked on disk and in Saved, not only on screen.
//
//   node e2e/keep-walk.mjs      (BFB_THEME=light for the light theme)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, shot, applyTheme } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
const saved = async () => { const v = await h.store.get('bfb-saved-v1'); return typeof v === 'string' ? JSON.parse(v) : (v ?? []); };
const fill = async (page, sel, text) => { await page.click(sel); await page.$eval(sel, i => i.select()); await page.keyboard.type(text); };
const until = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(100); } return false; };

try {
  await h.store.set('bfb-settings-v1', { showSidebar: true, notesRoot: h.notesDir });
  const page = await h.open(h.notesDir);
  await page.setViewport({ width: 1400, height: 900 });
  const notePath = join(h.notesDir, 'existing-note.md');
  await page.goto('file://' + notePath, { waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('#fe-fp-keep');

  // The card: name, Saved and Notes in one place.
  await page.click('#fe-fp-keep');
  await page.waitForSelector('#fe-keep');
  const first = await page.evaluate(() => ({
    name: document.querySelector('#fe-keep [data-k="name"]').value,
    saved: document.getElementById('fe-keep-saved').checked,
    pin: !!document.getElementById('fe-keep-pinned'),
    title: document.querySelector('#fe-keep [data-k="title"]')?.value,
    focus: document.activeElement?.dataset?.k,
  }));
  check(first.name === 'existing-note.md' && !first.saved && first.pin && first.title === 'Existing note' && first.focus === 'name',
    `the card shows the file name (focused), Saved off, the note's pin and title: ${JSON.stringify(first)}`);

  await page.click('#fe-keep-saved');
  check(await until(async () => (await saved()).some(p => p.path === notePath)), 'switching Saved on puts the file in Saved');

  // Linked titles: typing the Saved name renames the note too.
  await fill(page, '#fe-keep [data-k="label"]', 'Plan for Q4');
  const mirrored = await page.$eval('#fe-keep [data-k="title"]', i => i.value);
  check(mirrored === 'Plan for Q4', `while linked, the note title box follows the Saved name as it is typed: ${mirrored}`);
  await page.keyboard.press('Enter');
  check(await until(async () => (await saved()).find(p => p.path === notePath)?.label === 'Plan for Q4'), 'Enter sets the name in Saved');
  check(await until(() => /title: "Plan for Q4"/.test(readFileSync(notePath, 'utf8'))), 'and the note title on disk');

  await page.click('#fe-keep-pinned');
  check(await until(() => /pinned: true/.test(readFileSync(notePath, 'utf8'))), 'switching Pinned on pins the note on disk');
  await shot(page, 'keep-card');

  // Unlinked: the Saved name and the note title can differ.
  await page.click('#fe-keep-link');
  await fill(page, '#fe-keep [data-k="title"]', 'Quarter plan');
  await page.keyboard.press('Enter');
  check(await until(() => /title: "Quarter plan"/.test(readFileSync(notePath, 'utf8'))), 'unlinked, the note title changes on its own');
  check((await saved()).find(p => p.path === notePath)?.label === 'Plan for Q4', 'and the name in Saved stays');

  // Rename from the card: the page moves to the new file, Saved follows.
  await fill(page, '#fe-keep [data-k="name"]', 'quarter-plan.md');
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.keyboard.press('Enter')]);
  const moved = join(h.notesDir, 'quarter-plan.md');
  check(existsSync(moved) && !existsSync(notePath), 'Enter in File name renames the file on disk');
  check(decodeURIComponent(page.url()).endsWith('/quarter-plan.md'), `the page follows it: ${page.url()}`);
  const sv = (await saved()).find(p => p.path === moved);
  check(sv?.label === 'Plan for Q4', `its Saved entry follows and keeps its name: ${JSON.stringify(sv)}`);

  await page.waitForSelector('#fe-fp-keep');
  const lit = await page.$eval('#fe-fp-keep', b => b.className);
  check(/\bon\b/.test(lit), `on the renamed file's page, Keep shows it is saved: "${lit}"`);

  // The card in the edit view.
  await page.waitForSelector('#fe-fp-edit');
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-fe textarea, #fe-fe-ta', { timeout: 5000 });
  await page.click('#fe-fp-keep');
  check(!!(await page.waitForSelector('#fe-keep', { timeout: 3000 }).catch(() => null)), 'the Keep card opens while editing');
  await shot(page, 'keep-card-editing');
  await page.keyboard.press('Escape');

  // A file outside Notes says so instead of showing note fields.
  await page.goto('file://' + join(h.fixture, 'readme.md'), { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-keep');
  await page.click('#fe-fp-keep');
  await page.waitForSelector('#fe-keep');
  const outside = await page.$eval('#fe-keep', b => ({ note: b.querySelector('.fe-keep-note')?.textContent, pin: !!b.querySelector('#fe-keep-pinned') }));
  check(/Not in your Notes folder/.test(outside.note ?? '') && !outside.pin, `a file outside Notes says so: ${JSON.stringify(outside)}`);
  await page.keyboard.press('Escape');

  // The folder list: F2 renames the selected file and keeps it selected.
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody [data-name="notes.txt"]');
  await page.click('#fe-tbody [data-name="notes.txt"] .fe-nm');
  await sleep(400);
  await page.keyboard.press('Escape');   // a plain click previews; close it, the row stays selected
  await page.keyboard.press('F2');
  check(!!(await page.waitForSelector('#fe-keep.fe-rename', { timeout: 3000 }).catch(() => null)), 'F2 on a selected file opens a rename box beside it');
  await shot(page, 'keep-rename-row');
  await page.keyboard.type('notes-renamed');   // the box selects the name, not its extension
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.keyboard.press('Enter')]);
  await page.waitForSelector('#fe-tbody [data-name="notes-renamed.txt"]');
  check(existsSync(join(h.fixture, 'notes-renamed.txt')) && !existsSync(join(h.fixture, 'notes.txt')), 'the file is renamed on disk');
  const selName = await page.$eval('#fe-tbody .selected', r => r.dataset.name).catch(() => null);
  check(selName === 'notes-renamed.txt', `the renamed file is still the selected row: ${selName}`);

  // The right-click menu lists Rename for a file.
  const row = await page.$('#fe-tbody [data-name="code.py"]');
  const box = await row.boundingBox();
  await page.mouse.click(box.x + 60, box.y + box.height / 2, { button: 'right' });
  const items = await page.$$eval('.fe-ctx-item', els => els.map(e => e.dataset.act));
  check(items.includes('rename'), 'a file row\'s right-click menu has Rename');
  await page.keyboard.press('Escape');

  // The preview's Rename button.
  await page.click('#fe-tbody [data-name="data.json"] .fe-nm');
  await page.waitForSelector('#fe-ql-rename', { visible: true });
  await page.click('#fe-ql-rename');
  await page.waitForSelector('#fe-keep.fe-rename');
  await page.keyboard.type('data-renamed');
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.keyboard.press('Enter')]);
  check(existsSync(join(h.fixture, 'data-renamed.json')), 'the preview\'s Rename renames the file on disk');
} finally {
  console.log(results.join('\n'));
  await h.close();
}
