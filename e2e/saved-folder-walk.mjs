// Saved lives in the notes folder: one file per save in .saved/, tag colours in .meta/tags.json,
// chrome.storage as the cache the folder overrides. Walks the one-time move of a realistic list
// (17 rows: 12 files, 5 folders, 15 tagged) on a scratch folder, that it can be run twice and undone,
// that the hover tag and remove buttons still work, that dragging reorders, and that a save another
// device added shows up. Made-up paths only; never the owner's rows or Notes folder.
//
//   node e2e/saved-folder-walk.mjs      (BFB_THEME=light for the light screenshots)
import { makeNotesStore } from './make-notes-store.mjs';
import { launch, shot, applyTheme } from './harness.mjs';
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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

  // 4b. Tag colour cycling: a click on a group's dot moves it to the next colour, in the cache and in .meta/tags.json.
  const dotBefore = await page.$eval('#fe-sv-list .fe-sv-dot[data-tag="work"]', d => getComputedStyle(d).backgroundColor);
  await page.click('#fe-sv-list .fe-sv-dot[data-tag="work"]');
  await sleep(1200);
  const dotAfter = await page.$eval('#fe-sv-list .fe-sv-dot[data-tag="work"]', d => getComputedStyle(d).backgroundColor);
  const reg = await h.store.json('bfb-tags-v1', []);
  const colourOnDisk = JSON.parse(readFileSync(join(store, '.meta', 'tags.json'), 'utf8')).work;
  check(dotAfter !== dotBefore && reg.find(t => t.name === 'work')?.color === '#3fb950' && colourOnDisk === '#3fb950', `clicking a tag dot cycles its colour (blue to green) in the cache and in tags.json: ${dotBefore} -> ${dotAfter}, disk ${colourOnDisk}`);
  await reopen(page); await sleep(800);
  check(await page.$eval('#fe-sv-list .fe-sv-dot[data-tag="work"]', d => getComputedStyle(d).backgroundColor) === dotAfter, 'and the colour survives a reload, read back from the folder');

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
  check(labels.includes('From the other Mac') && labels.includes('A web page'), 'a save another device wrote shows, and so does a web link saved elsewhere');
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

  // 8. First loads and mid-session cases that once lost or deleted saves (review of 2026-11-01). Each starts from
  //    5 rows in this browser and a scratch folder; none has ever been moved.
  const FIVE = ['a', 'b', 'c', 'd', 'e'].map(n => ({ path: `/Users/example/${n}.md`, label: `${n}.md`, tags: ['work'] }));
  const FIVE_J = JSON.stringify(FIVE), WORK = JSON.stringify([{ name: 'work', color: '#58a6ff' }]);
  const STATE = ['bfb-saved-premigration-v1', 'bfb-tags-premigration-v1', 'bfb-saved-dirty-v1', 'bfb-saved-folder-off-v1', 'bfb-saved-moved-v1', 'bfb-saved-known-v1', 'bfb-saved-colours-v1'];
  const fresh = async root => {
    for (const k of STATE) await h.store.remove(k);
    await h.store.set('bfb-saved-v1', FIVE_J); await h.store.set('bfb-tags-v1', WORK);
    await h.store.set('bfb-settings-v1', { ...(await h.store.json('bfb-settings-v1', {})), showSidebar: true, notesRoot: root });
  };
  const rowLabels = () => page.$$eval('#fe-sv-list .fe-pl-item .fe-pl-label', els => els.map(e => e.textContent));
  const scratch = name => { const d = join(tmpdir(), `bfb-saved-${name}-${process.pid}`); rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); return d; };
  const OTHER_MAC = '---\ntitle: "Other Mac row"\ncreated: 2026-11-01T09:00:00Z\nurl: "file:///Users/example/other/"\ndevice: "mac"\n---\n';
  const WEB = '---\ntitle: "From the phone"\ncreated: 2026-11-01T09:00:00Z\nurl: "https://example.com/x"\n---\n';
  const names = dir => readdirSync(dir).filter(f => f.endsWith('.md'));
  const hasLabels = (got, want) => want.every(w => got.includes(w));

  // A. A save from another app is already in .saved/ on this browser's first load: nothing is lost, the two lists join.
  let root = scratch('A'); mkdirSync(join(root, '.saved')); writeFileSync(join(root, '.saved', 'aaaaaaaaaaaa.md'), OTHER_MAC);
  await fresh(root); await reopen(page); await sleep(1500);
  let got = await rowLabels();
  check(hasLabels(got, ['a.md', 'b.md', 'c.md', 'd.md', 'e.md', 'Other Mac row']), `A: first load beside another app's save keeps all 5 rows and adds its row: ${got}`);
  check(names(join(root, '.saved')).length === 6 && await h.store.get('bfb-saved-premigration-v1') !== null, 'A: the 5 rows are written beside it, and the old copy is kept');
  // A lasting way back (not only the 12 second toast): remove a row, then bring the earlier rows back.
  let rm = await (async () => { for (const it of await page.$$('#fe-sv-list .fe-pl-item')) if (await it.$eval('.fe-pl-label', e => e.textContent) === 'b.md') return it; })();
  await rm.hover(); await sleep(200); await (await rm.$('.fe-rm-btn')).click(); await sleep(1200);
  check(!(await rowLabels()).includes('b.md') && await page.$('#fe-sv-where-back') !== null, 'A: the Saved line keeps an offer to bring back the earlier rows');
  await page.click('#fe-sv-where-back'); await sleep(1800);
  check((await rowLabels()).includes('b.md') && names(join(root, '.saved')).length === 6, 'A: it puts the earlier rows back, beside what is there now, in the folder too');
  // A2. The folder holds only a web save: the rows stay, and the web link shows as a row too (it opens in a new tab).
  root = scratch('A2'); mkdirSync(join(root, '.saved')); writeFileSync(join(root, '.saved', 'bbbbbbbbbbbb.md'), WEB);
  await fresh(root); await reopen(page); await sleep(1500);
  got = await rowLabels();
  check(hasLabels(got, ['a.md', 'e.md', 'From the phone']), `A2: a link saved on the phone shows as a row beside the 5: ${got}`);
  check(await page.$eval('#fe-sv-list .fe-pl-item[data-path="https://example.com/x"] a.fe-si-link', a => a.getAttribute('href') === 'https://example.com/x').catch(() => false), 'A2: and its row opens the link itself');
  // B. The folder exists and is empty (a second profile made it): the rows stay and are written.
  root = scratch('B'); mkdirSync(join(root, '.saved'));
  await fresh(root); await reopen(page); await sleep(1500);
  check((await rowLabels()).length === 5 && names(join(root, '.saved')).length === 5, `B: an empty .saved/ does not empty Saved: ${(await rowLabels()).length} rows, ${names(join(root, '.saved')).length} files`);
  // I. The first move was cut short: some files written, the page died. The next load finishes it and loses nothing.
  root = scratch('I'); await fresh(root); await reopen(page); await sleep(1500);
  for (const f of names(join(root, '.saved')).slice(2)) rmSync(join(root, '.saved', f));
  for (const k of ['bfb-saved-moved-v1', 'bfb-saved-known-v1', 'bfb-saved-dirty-v1']) await h.store.remove(k);
  await h.store.set('bfb-saved-v1', FIVE_J);
  await reopen(page); await sleep(1500);
  check((await rowLabels()).length === 5 && names(join(root, '.saved')).length === 5, `I: a cut-short first move is finished on the next load: ${(await rowLabels()).length} rows, ${names(join(root, '.saved')).length} files`);
  check(await h.store.get('bfb-saved-premigration-v1') !== null, 'I: and the old copy is still there to restore');

  // E, F, G on one moved folder (a real clone, so a merge can happen below).
  const bare = scratch('bare'), c1 = scratch('c1'), c2 = scratch('c2');
  const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=T', ...a], { cwd, stdio: 'pipe' }).toString();
  git(bare, 'init', '-q', '--bare', '-b', 'main');
  rmSync(c1, { recursive: true, force: true }); rmSync(c2, { recursive: true, force: true });
  git(tmpdir(), 'clone', '-q', bare, c1);
  mkdirSync(join(c1, 'notes'), { recursive: true }); writeFileSync(join(c1, 'notes', 'README.md'), '# notes\n');
  git(c1, 'add', '-A'); git(c1, 'commit', '-q', '-m', 'start'); git(c1, 'push', '-q', 'origin', 'HEAD:main');
  const dir = join(c1, 'notes', '.saved');
  await fresh(join(c1, 'notes')); await reopen(page); await sleep(1500);
  git(c1, 'add', '-A'); git(c1, 'commit', '-q', '-m', 'saves'); git(c1, 'push', '-q', 'origin', 'HEAD:main');
  const fileOf = rel => names(dir).find(f => readFileSync(join(dir, f), 'utf8').includes(rel));
  // F. Another device's save lands in the folder while this page sits on an old copy; removing a row must not remove it.
  writeFileSync(join(dir, 'cccccccccccc.md'), OTHER_MAC);
  mkdirSync(join(c1, 'notes', '.meta'), { recursive: true }); writeFileSync(join(c1, 'notes', '.meta', 'tags.json'), '{\n  "work": "#ff0000"\n}\n');
  let it1 = await (async () => { for (const it of await page.$$('#fe-sv-list .fe-pl-item')) if (await it.$eval('.fe-pl-label', e => e.textContent) === 'a.md') return it; })();
  await it1.hover(); await sleep(200); await (await it1.$('.fe-rm-btn')).click(); await sleep(1800);
  check(existsSync(join(dir, 'cccccccccccc.md')), `F: a save another device just added survives a local remove`);
  check(JSON.parse(readFileSync(join(c1, 'notes', '.meta', 'tags.json'), 'utf8')).work === '#ff0000', 'F: a tag colour another device just set is not overwritten by an unrelated push');
  check(!fileOf('/a.md"') && names(dir).includes('cccccccccccc.md'), 'F: while the row that was removed is gone');
  // G. A change waits while the folder cannot answer; another device adds a save; the folder comes back.
  const away = join(tmpdir(), `bfb-saved-away-${process.pid}`);
  const cfg = await h.store.json('bfb-settings-v1', {});
  await h.store.set('bfb-settings-v1', { ...cfg, notesRoot: away }); await reopen(page); await sleep(800);
  const it2 = await (async () => { for (const it of await page.$$('#fe-sv-list .fe-pl-item')) if (await it.$eval('.fe-pl-label', e => e.textContent) === 'b.md') return it; })();
  await it2.hover(); await sleep(200); await (await it2.$('.fe-rm-btn')).click(); await sleep(1000);
  writeFileSync(join(dir, 'dddddddddddd.md'), OTHER_MAC.replace('Other Mac row', 'Second other row').replace('/other/', '/other2/'));
  await h.store.set('bfb-settings-v1', { ...cfg, notesRoot: join(c1, 'notes') }); await reopen(page); await sleep(1800);
  check(existsSync(join(dir, 'dddddddddddd.md')), 'G: a save another device added while this change waited is still there after it is sent');
  check(!fileOf('/b.md"'), 'G: and the waiting change (removing b.md) was sent');
  // H. Every save is deleted elsewhere and git drops the empty folder: this browser has moved, so nothing comes back.
  git(c1, 'add', '-A'); git(c1, 'commit', '-q', '-m', 'more');
  rmSync(dir, { recursive: true, force: true });
  await reopen(page); await sleep(1800);
  check((await rowLabels()).length === 0 && !existsSync(dir), `H: a folder emptied elsewhere stays empty, with no fresh move: ${(await rowLabels()).length} rows`);
  await h.store.set('bfb-saved-v1', FIVE_J);   // put rows back for the clash case
  // E. A real merge puts a clash in one save file; the row stays, is marked, counted, and can be settled.
  const bareE = scratch('bareE'), e1 = scratch('e1'), e2 = scratch('e2');
  git(bareE, 'init', '-q', '--bare', '-b', 'main');
  rmSync(e1, { recursive: true, force: true }); rmSync(e2, { recursive: true, force: true });
  git(tmpdir(), 'clone', '-q', bareE, e1);
  mkdirSync(join(e1, 'notes'), { recursive: true }); writeFileSync(join(e1, 'notes', 'README.md'), '# notes\n');
  git(e1, 'add', '-A'); git(e1, 'commit', '-q', '-m', 'start'); git(e1, 'push', '-q', 'origin', 'HEAD:main');
  await fresh(join(e1, 'notes')); await reopen(page); await sleep(1500);
  git(e1, 'add', '-A'); git(e1, 'commit', '-q', '-m', 'saves'); git(e1, 'push', '-q', 'origin', 'HEAD:main');
  git(tmpdir(), 'clone', '-q', bareE, e2);
  const dirE = join(e1, 'notes', '.saved');
  const f2 = join(e2, 'notes', '.saved', names(dirE).find(f => readFileSync(join(dirE, f), 'utf8').includes('/c.md"')));
  writeFileSync(f2, readFileSync(f2, 'utf8').replace('title: "c.md"', 'title: "c renamed on the phone"'));
  git(e2, 'commit', '-q', '-am', 'phone renames c'); git(e2, 'push', '-q', 'origin', 'HEAD:main');
  const f1 = join(dirE, names(dirE).find(f => readFileSync(join(dirE, f), 'utf8').includes('/c.md"')));
  writeFileSync(f1, readFileSync(f1, 'utf8').replace('title: "c.md"', 'title: "c renamed on the Mac"'));
  git(e1, 'commit', '-q', '-am', 'mac renames c');
  try { git(e1, 'pull', '--no-rebase', '-q', 'origin', 'main'); } catch { /* the merge stops on the clash, as it should */ }
  check(/^<<<<<<< /m.test(readFileSync(f1, 'utf8')), 'E: a real git merge left conflict markers in the save file');
  await reopen(page); await sleep(1800);
  got = await rowLabels();
  check(got.length === 5, `E: the row with a clash is still listed, with its 4 neighbours: ${got}`);
  check(await page.$('#fe-sv-list .fe-pl-item.fe-clash') !== null && /two versions/i.test(await page.$eval('#fe-sv-where', e => e.textContent)), 'E: it is marked, and the Saved line counts it');
  await shot(page, 'saved-folder-clash');
  await page.hover('#fe-sv-list .fe-pl-item.fe-clash'); await sleep(200);
  await page.click('#fe-sv-list .fe-pl-item.fe-clash .fe-clash-btn');
  await page.waitForSelector('.fe-clash-menu [data-keep="second"]');
  await page.click('.fe-clash-menu [data-keep="second"]'); await sleep(1800);
  check(!/^<<<<<<< /m.test(readFileSync(f1, 'utf8')) && /title: "c renamed on the phone"/.test(readFileSync(f1, 'utf8')) && await page.$('#fe-sv-list .fe-pl-item.fe-clash') === null, 'E: settling keeps the chosen side, clears the mark, and the row shows that side');
} finally {
  await h.close();
}
if (fails.length) { console.error(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
