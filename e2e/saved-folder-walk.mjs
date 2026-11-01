// Saved lives in the notes folder: one file per save in .saved/, tag colours in .meta/tags.json,
// chrome.storage as the cache the folder overrides. Walks the one-time move of a realistic list
// (17 rows: 12 files, 5 folders, 15 tagged) on a scratch folder, that it can be run twice and undone,
// that the hover tag and remove buttons still work, that dragging reorders, and that a save another
// device added shows up. Made-up paths only; never the owner's rows or Notes folder.
//
//   node e2e/saved-folder-walk.mjs      (BFB_THEME=light for the light screenshots)
import { makeNotesStore } from './make-notes-store.mjs';
import { launch, shot, applyTheme } from './harness.mjs';
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const store = join(tmpdir(), `bfb-saved-walk-${process.pid}`);
makeNotesStore(store);
const savedDir = join(store, '.saved');

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 10_000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(150); } return false; };

// 17 rows: 5 folders (trailing /), 12 files, 15 tagged, 2 untagged.
const H = '/Users/example';
const rows = [
  ['Work', `${H}/Work/`, ['work']], ['Projects', `${H}/Code/projects/`, ['code', 'work']], ['Reading', `${H}/Reading/`, ['books']],
  ['Taxes', `${H}/Documents/Taxes/`, ['money']], ['Photos', `${H}/Pictures/`, []],
  ['plan.md', `${H}/Work/plan.md`, ['work']], ['budget.xlsx', `${H}/Documents/budget.xlsx`, ['money']], ['notes.txt', `${H}/Work/notes.txt`, ['work']],
  ['roadmap.md', `${H}/Code/projects/roadmap.md`, ['code']], ['todo.md', `${H}/todo.md`, ['work', 'home']], ['recipe.md', `${H}/Reading/recipe.md`, ['home']],
  ['invoice.pdf', `${H}/Documents/Taxes/invoice.pdf`, ['money']], ['talk.md', `${H}/Work/talk.md`, ['work']], ['book list.md', `${H}/Reading/book list.md`, ['books']],
  ['draft.md', `${H}/Work/draft.md`, ['work']], ['scratch.txt', `${H}/scratch.txt`, []], ['trip.md', `${H}/Pictures/trip.md`, ['home']],
].map(([label, path, tags]) => ({ path, label, ...(tags.length ? { tags } : {}) }));
const SEED = JSON.stringify(rows), TAGS = JSON.stringify([{ name: 'work', color: '#58a6ff' }, { name: 'code', color: '#3fb950' }, { name: 'books', color: '#d29922' }, { name: 'money', color: '#f778ba' }, { name: 'home', color: '#a371f7' }]);
check(rows.length === 17 && rows.filter(r => r.path.endsWith('/')).length === 5 && rows.filter(r => r.tags).length === 15, 'the seed is 17 rows: 5 folders, 12 files, 15 tagged');

const files = () => (existsSync(savedDir) ? readdirSync(savedDir).filter(f => f.endsWith('.md')) : []);
const text = f => readFileSync(join(savedDir, f), 'utf8');
const ledger = page => page.$$eval('#fe-sv-list .fe-pl-item', els => els.map(e => ({
  label: e.querySelector('.fe-pl-label')?.textContent, tags: e.querySelector('.fe-pl-tags')?.textContent || '', group: e.closest('details')?.dataset.tag ?? '' })));
const reopen = async page => { await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#fe-sv-list'); };

const h = await launch({ savedFolder: true });
try {
  const page = await h.open();
  await h.store.set('bfb-lens-v1', 'saved');
  await h.store.set('bfb-saved-v1', SEED);
  await h.store.set('bfb-tags-v1', TAGS);
  await applyTheme(page);
  await reopen(page);
  await page.waitForSelector('#fe-sv-list .fe-pl-item');
  await sleep(500);

  // 0. Before: the ledger of what the owner reviewed, with no notes folder set.
  const before = await ledger(page);
  check(before.length >= 17, `Saved shows its rows before any folder is set: ${before.length}`);
  const whereBefore = await page.$eval('#fe-sv-where', e => ({ hidden: e.hidden, text: e.textContent }));
  check(/only in this browser/i.test(whereBefore.text) && !whereBefore.hidden, `with no notes folder it says Saved is only in this browser: ${JSON.stringify(whereBefore.text)}`);
  await shot(page, 'saved-folder-before');

  // 1. Set the folder: the list moves into .saved/ once.
  const settings = await h.store.json('bfb-settings-v1', {});
  await h.store.set('bfb-settings-v1', { ...settings, showSidebar: true, notesRoot: store });
  await reopen(page);
  check(await until(() => files().length === 17), `the move writes 17 files into .saved/: ${files().length}`);
  await sleep(600);
  const key = /^[0-9a-f]{12}\.md$/;
  check(files().every(f => key.test(f)), 'each file is named by 12 hex of its url');
  const sample = text(files().find(f => text(f).includes('Work/plan.md')));
  check(/^---\ntitle: "plan\.md"\ncreated: \d{4}-.*Z\ntags: "work"\nurl: "file:\/\/\/Users\/example\/Work\/plan\.md"\ndevice: "mac"\npos: [0-9a-z]+\n---\n$/.test(sample), `a file is in the spec's key order: ${JSON.stringify(sample)}`);
  const poss = files().map(f => text(f).match(/^pos: (.+)$/m)?.[1]);
  check(new Set(poss).size === 17 && poss.every(Boolean), 'every file has its own pos');
  const tagsJson = JSON.parse(readFileSync(join(store, '.meta', 'tags.json'), 'utf8'));
  check(tagsJson.work === '#58a6ff' && tagsJson.money === '#f778ba' && Object.keys(tagsJson).length === 5, `tag colours are in .meta/tags.json: ${JSON.stringify(tagsJson)}`);
  check(await h.store.get('bfb-saved-premigration-v1') === SEED && await h.store.get('bfb-tags-premigration-v1') === TAGS, 'the old rows and tag colours are kept exactly, for undo');
  const toast = await page.$eval('#fe-toast', e => e.textContent).catch(() => '');
  check(/Saved now lives in your notes folder: 17 saves/.test(toast), `the move says what it did: ${JSON.stringify(toast)}`);
  check(await page.$('#fe-toast .fe-toast-act') !== null, 'and offers Undo');
  await shot(page, 'saved-folder-after');

  // 2. Parity: the same rows, in the same order, with the same tags.
  const after = await ledger(page);
  check(JSON.stringify(after) === JSON.stringify(before), `the Saved lens reads the same after the move (labels, order, tags, groups)`);
  const whereAfter = await page.$eval('#fe-sv-where', e => e.textContent);
  check(/Kept in your notes folder/.test(whereAfter), `the lens says it is kept in the notes folder: ${whereAfter}`);

  // 3. Idempotent: reloading changes no file.
  const stamps = () => Object.fromEntries(files().map(f => [f, statSync(join(savedDir, f)).mtimeMs]));
  const s1 = stamps();
  await reopen(page); await sleep(1500); await reopen(page); await sleep(1500);
  check(files().length === 17 && JSON.stringify(stamps()) === JSON.stringify(s1), 'two more loads rewrite nothing and add nothing');

  // 4. The hover buttons the owner reported (2026-10-24): tag and remove, by real hover and click.
  const row = 'Taxes';
  const handleFor = async label => {
    for (const it of await page.$$('#fe-sv-list .fe-pl-item')) if (await it.$eval('.fe-pl-label', e => e.textContent) === label) return it;
    return null;
  };
  let item = await handleFor(row);
  await item.hover(); await sleep(300);
  const tagBtnShown = await item.$eval('.fe-tag-btn', b => getComputedStyle(b).opacity !== '0' && getComputedStyle(b).visibility !== 'hidden');
  check(tagBtnShown, 'hovering a Saved row shows its tag button');
  await (await item.$('.fe-tag-btn')).click(); await sleep(200);
  await page.keyboard.type('money, tax-year'); await page.keyboard.press('Enter');
  await sleep(1200);
  const taxesFile = files().find(f => text(f).includes('Documents/Taxes/"'));
  check(taxesFile && /^tags: "money, tax-year"$/m.test(text(taxesFile)), `the tag typed on hover reached the file: ${taxesFile && text(taxesFile).match(/^tags: .*$/m)}`);
  check(JSON.parse(readFileSync(join(store, '.meta', 'tags.json'), 'utf8'))['tax-year'] !== undefined, 'and its colour reached .meta/tags.json');
  item = await handleFor('Photos');
  await item.hover(); await sleep(300);
  const photos = files().find(f => text(f).includes('/Pictures/"'));
  await (await item.$('.fe-rm-btn')).click(); await sleep(1500);
  check(!files().includes(photos) && files().length === 16, `the hover remove button deletes its file: ${files().length} left`);
  check(existsSync(join(store, '.trash')) && readdirSync(join(store, '.trash')).some(f => f.includes('.saved%2F' + photos.replace('.md', ''))), 'the removed save went to .trash for undo');
  check(!(await ledger(page)).some(r => r.label === 'Photos'), 'the row left the lens');
  await shot(page, 'saved-folder-hover-edit');

  // 5. Dragging: dropping Work above Reading rewrites that row's pos only.
  const posBefore = Object.fromEntries(files().map(f => [f, text(f).match(/^pos: (.+)$/m)[1]]));
  const drag = async (fromLabel, toLabel) => page.evaluate((a, b) => {
    const find = l => [...document.querySelectorAll('#fe-sv-list .fe-pl-item')].find(i => i.querySelector('.fe-pl-label').textContent === l);
    const src = find(a), dst = find(b), dt = new DataTransfer();
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, fromLabel, toLabel);
  const order0 = (await ledger(page)).map(r => r.label);
  await drag('scratch.txt', 'Work');
  await sleep(1500);
  const order1 = (await ledger(page)).map(r => r.label);
  check(order1.indexOf('scratch.txt') < order1.indexOf('Work') && order1.length === order0.length, 'dropping a row on another moves it in the lens');
  const changed = files().filter(f => text(f).match(/^pos: (.+)$/m)[1] !== posBefore[f]);
  check(changed.length >= 1 && changed.length <= 2, `only the moved row's file changed (${changed.length} file)`);
  await reopen(page); await sleep(800);
  check(JSON.stringify((await ledger(page)).map(r => r.label)) === JSON.stringify(order1), 'the dragged order survives a reload, read back from the folder');

  // 6. Another device adds a save and a web save; the Mac shows its own and leaves the web one alone.
  writeFileSync(join(savedDir, 'aaaaaaaaaaaa.md'), '---\ntitle: "From the other Mac"\ncreated: 2026-11-01T09:00:00Z\ntags: "work"\nurl: "file:///Users/example/Other/"\ndevice: "mac"\n---\n');
  writeFileSync(join(savedDir, 'bbbbbbbbbbbb.md'), '---\ntitle: "A web page"\nurl: "https://example.com/a"\n---\n');
  await reopen(page); await sleep(1200);
  const labels = (await ledger(page)).map(r => r.label);
  check(labels.includes('From the other Mac') && !labels.includes('A web page'), 'a save another device wrote shows; a web save is not a Mac row');
  const item2 = await handleFor('Reading'); await item2.hover(); await sleep(200);
  await (await item2.$('.fe-rm-btn')).click(); await sleep(1500);
  check(existsSync(join(savedDir, 'bbbbbbbbbbbb.md')) && existsSync(join(savedDir, 'aaaaaaaaaaaa.md')), 'removing a row never touches the other device\'s file or the web save');


  // 7. Undo takes the move back; Saved stays in the browser until it is moved again by choice.
  const store2 = join(tmpdir(), `bfb-saved-walk2-${process.pid}`);
  makeNotesStore(store2);
  const files2 = () => (existsSync(join(store2, '.saved')) ? readdirSync(join(store2, '.saved')).filter(f => f.endsWith('.md')) : []);
  await h.store.remove('bfb-saved-premigration-v1'); await h.store.remove('bfb-tags-premigration-v1'); await h.store.remove('bfb-saved-dirty-v1');
  await h.store.set('bfb-saved-v1', SEED); await h.store.set('bfb-tags-v1', TAGS);
  await h.store.set('bfb-settings-v1', { ...(await h.store.json('bfb-settings-v1', {})), notesRoot: store2 });
  await reopen(page);
  check(await until(() => files2().length === 17), 'a second folder gets its own move of 17 saves');
  await page.waitForSelector('#fe-toast .fe-toast-act', { timeout: 8000 });
  await page.click('#fe-toast .fe-toast-act');
  check(await until(() => files2().length === 0), 'Undo removes the files the move made');
  await sleep(500);
  check(await h.store.get('bfb-saved-v1') === SEED && await h.store.get('bfb-tags-v1') === TAGS, 'and puts the old rows and tag colours back exactly');
  await reopen(page); await sleep(1500);
  check(files2().length === 0 && (await ledger(page)).length === 17, 'after a reload nothing is moved again, and Saved still shows its 17 rows');
  const where2 = await page.$eval('#fe-sv-where', e => e.textContent);
  check(/moved back to this browser/.test(where2), `the lens says where Saved is: ${where2}`);
  await shot(page, 'saved-folder-undone');
  await page.click('#fe-sv-where-on');
  check(await until(() => files2().length === 17), 'Move Saved to the notes folder brings it back, 17 files again');
} finally {
  await h.close();
}
if (fails.length) { console.error(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
