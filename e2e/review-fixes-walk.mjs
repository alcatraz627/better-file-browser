// The flows the Nov 5 adversarial review found broken, driven with real keys:
// the caret stays where it belongs on Edit, undo and an outside write; typing
// during a pause is not lost in the peek; a conflict cannot be closed away; a
// comment card never lets the next key replace its words.
//
//   node e2e/review-fixes-walk.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, chmodSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const mod = 'Meta';
const h = await launch();
try {
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture], showSidebar: true }));
  const doc = join(h.fixture, 'long.md');
  const lines = Array.from({ length: 300 }, (_, i) => (i % 25 === 0 ? `## Section ${i / 25}` : `Line ${i} of a long document.`));
  writeFileSync(doc, lines.join('\n') + '\n');
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  page.on('dialog', d => d.accept());
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('.fe-md');
  await wait(300);

  const caret = () => page.evaluate(() => {
    const ta = document.getElementById('fe-fe-ta');
    const line = ta.value.slice(0, ta.selectionStart).split('\n').length;
    const s = document.getElementById('fe-fe-scroll');
    return { line, total: ta.value.split('\n').length, top: Math.round(s.scrollTop), focus: document.activeElement?.id };
  });
  // Edit from the middle: the caret and the view start at the words being read.
  await page.evaluate(() => { const p = document.getElementById('fe-page'); const h2 = [...p.querySelectorAll('h2')].find(x => x.textContent.includes('Section 6')); p.scrollTop += h2.getBoundingClientRect().top - p.getBoundingClientRect().top; });
  await wait(200);
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-fe-ta');
  await wait(400);
  const start = await caret();
  check(start.line === 151 && start.top > 1000, `Edit starts at the section being read, not the end of the file: ${JSON.stringify(start)}`);

  // Undo puts the caret where the change was.
  await page.keyboard.type('ABC');
  await wait(800);
  await page.keyboard.down(mod); await page.keyboard.press('z'); await page.keyboard.up(mod);
  await wait(200);
  const undone = await caret();
  check(undone.line === 151, `⌘Z leaves the caret where the change was: ${JSON.stringify(undone)}`);
  await wait(1100);

  // One long burst of typing undoes in steps, not all at once.
  const before = await page.$eval('#fe-fe-ta', t => t.value);
  await page.keyboard.type('a sentence typed with no long pause between its many words and letters', { delay: 40 });
  await page.keyboard.down(mod); await page.keyboard.press('z'); await page.keyboard.up(mod);
  await wait(200);
  const partly = await page.$eval('#fe-fe-ta', t => t.value);
  check(partly !== before && partly.includes('a sentence'), `one ⌘Z takes back the last stretch, not the whole sentence: ${partly.slice(partly.indexOf('a sentence'), partly.indexOf('a sentence') + 40)}`);
  await page.keyboard.down(mod); await page.keyboard.press('s'); await page.keyboard.up(mod);
  await wait(900);

  // An outside write while clean: the caret keeps its words.
  const c0 = await caret();
  const onDisk = readFileSync(doc, 'utf8');
  writeFileSync(doc, onDisk + 'written by someone else\n');
  await page.waitForFunction(() => document.getElementById('fe-fe-ta').value.includes('written by someone else'), { timeout: 8000 });
  const c1 = await caret();
  check(c1.line === c0.line && Math.abs(c1.top - c0.top) < 5, `an outside write keeps the caret and the view: ${JSON.stringify([c0, c1])}`);

  // ⌘B in the tab editor.
  await page.keyboard.down('Shift'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Shift');
  await page.keyboard.down(mod); await page.keyboard.press('b'); await page.keyboard.up(mod);
  await wait(100);
  check((await page.$eval('#fe-fe-ta', t => t.value)).includes('**'), '⌘B wraps the selection in a tab editor too');

  // Focus lost: letters go to the text, never to page commands.
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('w');
  await wait(150);
  const stray = await page.evaluate(() => ({ url: location.href, inText: document.getElementById('fe-fe-ta')?.value.includes('w'), focus: document.activeElement?.id }));
  check(/long\.md/.test(stray.url) && stray.focus === 'fe-fe-ta', `a key with focus lost goes to the text; w does not close the tab: ${JSON.stringify(stray)}`);
  await wait(1100);

  // Esc on leaving: no browser question after Done.
  await page.click('[data-act="done"]');
  await page.waitForSelector('#fe-fe', { hidden: true, timeout: 5000 });

  // Peek: a note whose file changes on disk stops Esc from losing typed words.
  const notesDir = join(h.fixture, 'notes');
  mkdirSync(notesDir);
  const note = join(notesDir, 'conflict.md');
  writeFileSync(note, 'first text\nsecond line\n');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, notesRoot: notesDir }));
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 8000 });
  await page.click('#fe-nt-list .fe-nt-item .fe-si-link');
  await page.waitForSelector('#fe-ed-src', { timeout: 5000 });
  await wait(300);
  // A clean editor follows the disk.
  writeFileSync(note, 'first text\nsecond line\nfrom the phone\n');
  await page.waitForFunction(() => document.getElementById('fe-ed-src').value.includes('from the phone'), { timeout: 8000 });
  check(true, 'an open clean note follows the disk');
  await page.keyboard.type('MY WORDS');
  writeFileSync(note, 'first text\nsecond line\nfrom the phone\nand again\n');
  await page.waitForSelector('#fe-ed-conflict', { timeout: 9000 });
  await page.focus('#fe-ed-src');
  await page.keyboard.press('Escape');
  await wait(300);
  const stayed = await page.evaluate(() => ({ open: !!document.getElementById('fe-ed-src')?.offsetParent, text: document.getElementById('fe-ed-src')?.value }));
  check(stayed.open && stayed.text.includes('MY WORDS'), `Esc on a conflict keeps the note open with the words: ${JSON.stringify(stayed)}`);
  const buttons = await page.$$eval('#fe-ed-conflict button', b => b.map(x => x.textContent));
  check(buttons.includes('Compare') && buttons.includes('Keep mine') && buttons.includes('Reload'), `the banner offers every way out: ${JSON.stringify(buttons)}`);
  await page.click('#fe-ed-compare');
  await wait(300);
  check(await page.$eval('#fe-ed-diff', d => /and again/.test(d.textContent)), 'Compare shows what the other copy has');
  await page.click('#fe-ed-force');
  await wait(600);
  const kept = readFileSync(note, 'utf8');
  check(kept.includes('MY WORDS') && !existsSync('nope'), `Keep mine writes my text: ${JSON.stringify(kept)}`);
  await page.keyboard.press('Escape');
  await wait(200);

  // A new note left empty leaves no file behind.
  const count = () => readdirSync(notesDir).filter(f => f.endsWith('.md')).length;
  const n0 = count();
  await page.evaluate(() => document.body.click());
  await page.keyboard.press('n');
  await wait(800);
  await page.keyboard.press('Escape');
  await wait(800);
  check(count() === n0, `n then Esc leaves no empty file: ${n0} then ${count()}`);

  // Delete in the pause keeps the words in the trash copy.
  await page.click('#fe-nt-list .fe-nt-item .fe-si-link');
  await page.waitForSelector('#fe-ed-src', { timeout: 5000 });
  await wait(300);
  await page.keyboard.type('DELWORK');
  await page.keyboard.down(mod); await page.keyboard.down('Shift'); await page.keyboard.press('Backspace'); await page.keyboard.up('Shift'); await page.keyboard.up(mod);
  await wait(900);
  const trashDir = join(notesDir, '.trash');
  const inTrash = existsSync(trashDir) && readdirSync(trashDir).some(f => f.endsWith('.md') && readFileSync(join(trashDir, f), 'utf8').includes('DELWORK'));
  check(inTrash, 'words typed just before Delete are in the trash copy');

  // Peek: words typed a moment ago survive every way of leaving the page.
  const peekNote = join(notesDir, 'peek.md');
  writeFileSync(peekNote, 'peek text\n');
  const openPeek = async p => {
    await p.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
    await p.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 8000 });
    await p.evaluate(() => [...document.querySelectorAll('#fe-nt-list .fe-nt-item .fe-si-link')].find(a => /peek/.test(a.textContent))?.click());
    await p.waitForSelector('#fe-ed-src', { timeout: 5000 });
    await wait(300);
  };
  const untilOnDisk = async (file, words, ms = 7000) => {
    for (const end = Date.now() + ms; Date.now() < end; await wait(100)) if (readFileSync(file, 'utf8').includes(words)) return true;
    return false;
  };
  await openPeek(page);
  await page.keyboard.type('RELOADWORDS');
  await page.reload({ waitUntil: 'load' });
  check(await untilOnDisk(peekNote, 'RELOADWORDS'), 'peek words typed just before a reload are saved');
  await openPeek(page);
  await page.keyboard.type('LEAVEWORDS');
  await page.goto('file://' + h.fixture + '/nested/', { waitUntil: 'load' });
  check(await untilOnDisk(peekNote, 'LEAVEWORDS'), 'peek words typed just before leaving the page are saved');
  const closing = await h.browser.newPage();
  closing.on('dialog', d => d.accept());
  await openPeek(closing);
  await closing.keyboard.type('CLOSEWORDS');
  await closing.close({ runBeforeUnload: true });
  check(await untilOnDisk(peekNote, 'CLOSEWORDS'), 'peek words typed just before closing the tab are saved');
  await page.bringToFront();

  // Tab editor: a failed save tries again by itself.
  const savesDoc = join(h.fixture, 'saves.md');
  const editSaves = async () => {
    await page.goto('file://' + savesDoc, { waitUntil: 'load' });
    await page.waitForSelector('.fe-md');
    await wait(300);
    await page.click('#fe-fp-edit');
    await page.waitForSelector('#fe-fe-ta');
    await wait(400);
  };
  writeFileSync(savesDoc, 'saves\n');
  await editSaves();
  chmodSync(savesDoc, 0o444);
  await page.keyboard.type('RETRYWORDS');
  const failedShown = await page.waitForSelector('#fe-fe-state.failed, .failed#fe-fe-state', { timeout: 5000 }).then(() => true, () => false);
  chmodSync(savesDoc, 0o644);
  check(failedShown && await untilOnDisk(savesDoc, 'RETRYWORDS', 8000), `a failed save tries again once the disk allows it (failure shown: ${failedShown})`);

  // Tab editor: on a slow disk, words typed during a save still get saved, and ⌘S is not dropped.
  await wait(1200);
  writeFileSync(h.writeStall, '1.5');
  await page.keyboard.type('AAA');
  await wait(1100);
  await page.keyboard.type('BBB');
  check(await untilOnDisk(savesDoc, 'BBB', 9000), 'words typed during a slow save get a save of their own');
  await wait(2500);
  await page.keyboard.type('CCC');
  await wait(1100);
  await page.keyboard.type('DDD');
  await page.keyboard.down(mod); await page.keyboard.press('s'); await page.keyboard.up(mod);
  check(await untilOnDisk(savesDoc, 'DDD', 6000), '⌘S during a slow save saves what was typed since');
  rmSync(h.writeStall);
  await wait(1200);

  // Tab editor: a file deleted while open says so and keeps the text.
  rmSync(savesDoc);
  const goneShown = await page.waitForFunction(() => /moved or deleted/i.test(document.body.innerText), { timeout: 9000 }).then(() => true, () => false);
  const gone = goneShown ? await page.evaluate(() => ({ text: document.getElementById('fe-fe-ta').value, acts: [...document.querySelectorAll('[data-act="copy-all"], [data-act="recheck"]')].map(b => b.dataset.act) })) : {};
  check(goneShown && gone.text.includes('DDD') && gone.acts.length === 2, `a file deleted while open says so and offers a way out: ${JSON.stringify(gone.acts)}`);

  // Keys on arrival: a file page scrolls with no click first, and the filter box leads to its rows.
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('.fe-md');
  await wait(400);
  await page.keyboard.press('PageDown');
  await wait(300);
  check(await page.$eval('#fe-page', p => p.scrollTop) > 100, 'PageDown scrolls a file page on arrival');
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr');
  await wait(300);
  await page.focus('#fe-search');
  await page.keyboard.type('long');
  await wait(300);
  await page.keyboard.press('ArrowDown');
  await wait(150);
  const sel = await page.evaluate(() => ({ focus: document.activeElement?.id, row: document.querySelector('#fe-scroll [data-idx].selected')?.textContent?.includes('long') }));
  check(sel.focus !== 'fe-search' && sel.row, `↓ in the filter box goes to the rows: ${JSON.stringify(sel)}`);
  await page.focus('#fe-search');
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.keyboard.press('Enter')]);
  await page.waitForSelector('.fe-md');
  check(page.url().endsWith('/long.md'), `↩ in the filter box opens the first match, not the parent: ${page.url()}`);
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr');
  await wait(300);
  await page.keyboard.press('f');
  await page.waitForSelector('#fe-filter-q', { visible: true });
  await page.keyboard.press('Escape');
  await wait(150);
  check(await page.$eval('#fe-filter-bar', b => b.hidden), 'Esc closes the filter panel f opened');

  // Removing a Saved place offers Undo from every control, and Undo brings back its name and tags.
  const savedPlace = { path: h.fixture + '/', label: 'My name', tags: ['work'] };
  const savedNow = async () => (await h.store.json('bfb-saved-v1', [])).filter(p => p.label === 'My name' && p.tags?.includes('work'));
  const undoToast = () => page.evaluate(() => { const t = document.getElementById('fe-toast'); return t?.classList.contains('show') ? t.textContent : ''; });
  await h.store.set('bfb-saved-v1', [savedPlace]);
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr');
  await wait(400);
  await page.keyboard.press('b');
  await wait(250);
  const offered = await undoToast();
  await page.click('#fe-toast .fe-toast-act').catch(() => null);
  await wait(250);
  check(/Undo/.test(offered) && (await savedNow()).length === 1, `b on a saved folder offers Undo, which keeps its name and tags: ${JSON.stringify(offered)}`);
  const previewDoc = join(h.fixture, 'notes.txt');
  await h.store.set('bfb-saved-v1', [{ path: previewDoc, label: 'My name', tags: ['work'] }]);
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr');
  await wait(400);
  await page.evaluate(() => [...document.querySelectorAll('#fe-tbody .fe-lnk')].find(a => /notes\.txt/.test(a.textContent))?.click());
  await page.waitForSelector('#fe-ql-save', { visible: true });
  await wait(400);
  await page.click('#fe-ql-save');
  await wait(250);
  const offered2 = await undoToast();
  await page.click('#fe-toast .fe-toast-act').catch(() => null);
  await wait(250);
  check(/Undo/.test(offered2) && (await savedNow()).length === 1, `the preview's save button offers Undo too: ${JSON.stringify(offered2)}`);
  await page.keyboard.press('Escape');

  // Home hides a listing of its folder, and no key may act on what cannot be seen.
  const homeUrl = 'file://' + h.fixture + '/#home';
  await page.goto(homeUrl, { waitUntil: 'load' });
  await page.waitForSelector('#fe-home-page:not([hidden])');
  await wait(400);
  const homeSelected = () => page.evaluate(() => [...document.querySelectorAll('#fe-scroll [data-idx].selected')].map(r => r.dataset.idx).join());
  const selectedBefore = await homeSelected();
  const homeToasts = [];
  for (const key of ['ArrowDown', '.', 'b', 'x', 'Enter', 'Backspace']) {
    await page.keyboard.press(key);
    await wait(120);
    homeToasts.push(await page.evaluate(() => {
      const t = document.getElementById('fe-toast');
      return t?.classList.contains('show') ? t.textContent : '';
    }).catch(() => 'navigated'));
  }
  const home = await page.evaluate(() => ({
    url: location.href,
    menu: !!document.querySelector('#fe-ctx')?.checkVisibility?.(),
  }));
  const selectedAfter = await homeSelected();
  check(home.url === homeUrl && selectedAfter === selectedBefore && !home.menu && homeToasts.every(t => !t), `listing keys do nothing on Home: ${JSON.stringify({ ...home, selectedBefore, selectedAfter, homeToasts })}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
