// What a note editor should offer on any surface, walked end to end on a generated store:
// very long titles on every surface, Duplicate and Copy text on a row, deleting a note without
// taking a picture another note still uses, Recently deleted (local trash, notes deleted on another
// device, remove for good), and the tag colours page with a rename that reaches every note.
//
//   node e2e/editor-parity-walk.mjs      (BFB_THEME=light for the light shots)
import { makeNotesStore } from './make-notes-store.mjs';
import { launch, shot, applyTheme } from './harness.mjs';
import { writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const store = join(tmpdir(), `bfb-parity-walk-${process.pid}`);
makeNotesStore(store);
const hdr = (fields, body = 'body\n') => `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n${body}`;
const LONG_TOKEN = 'W'.repeat(300);
const LONG_WORDS = Array.from({ length: 60 }, (_, i) => `planning${i}`).join(' ');
writeFileSync(join(store, 'long-token.md'), hdr({ title: JSON.stringify(LONG_TOKEN), created: '2026-10-20T10:00:00Z' }));
writeFileSync(join(store, 'long-words.md'), hdr({ title: JSON.stringify(LONG_WORDS), created: '2026-10-20T11:00:00Z', tags: '"work"' }));
writeFileSync(join(store, 'source.md'), hdr({ title: '"Source note"', created: '2026-10-21T10:00:00Z', tags: '"work", "plan"', color: 'green', pinned: 'true', pos: 'm', expires: '2031-01-01T00:00:00Z', remind_at: '2031-01-02T09:00:00Z' }, 'The body of the source.\nSecond line.\n'));
writeFileSync(join(store, 'tabled.md'), hdr({ title: '"Has a table"', created: '2026-10-21T09:00:00Z' }, 'one\ntwo\nthree\n\n| Name | Count |\n| --- | --- |\n| apples | 3 |\n| pears | 5 |\n'));
writeFileSync(join(store, 'with-pic.md'), hdr({ title: '"Has a picture"', created: '2026-10-21T11:00:00Z' }, '![p](attachments/groceries-photo.png)\n![s](attachments/pic.svg)\n'));
writeFileSync(join(store, 'also-pic.md'), hdr({ title: '"Shares a picture"', created: '2026-10-21T12:00:00Z' }, '![s](attachments/pic.svg)\n'));
writeFileSync(join(store, 'elsewhere.md'), hdr({ title: '"Deleted on the Pi"', created: '2026-10-21T13:00:00Z' }, 'gone elsewhere\n'));
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=T', '-C', store, ...a], { stdio: 'pipe' });
git('add', '-A'); git('commit', '-qm', 'more notes');
git('rm', '-q', 'elsewhere.md'); git('commit', '-qm', 'deleted on the other device');

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const read = f => readFileSync(join(store, f), 'utf8');
const row = rel => `#fe-nt-list .fe-nt-item[data-rel="${rel}"]`;

const h = await launch({ savedFolder: true });
try {
  const page = await h.open();
  await h.store.set('bfb-lens-v1', 'notes');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, showSidebar: true, tooltips: true, notesRoot: store }));
  await applyTheme(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 10_000 });
  await sleep(500);

  // 1. Long titles never push a row, the editor heading, or a tab past its box.
  const overflow = async (sel) => page.$$eval(sel, els => els.filter(e => { const r = e.getBoundingClientRect(); const p = e.closest('[id]')?.getBoundingClientRect(); return e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow === 'visible' || (p && r.right > p.right + 1); }).map(e => e.className));
  const list = await page.$eval('#fe-nt-list', e => ({ sw: e.scrollWidth, cw: e.clientWidth }));
  check(list.sw <= list.cw + 1, `the notes list does not scroll sideways with 300-character titles in it: ${JSON.stringify(list)}`);
  for (const rel of ['long-token.md', 'long-words.md']) {
    const r = await page.$eval(row(rel), e => { const b = e.getBoundingClientRect(), l = document.getElementById('fe-nt-list').getBoundingClientRect(); return { h: Math.round(b.height), right: Math.round(b.right), listRight: Math.round(l.right), kids: [...e.querySelectorAll('button')].every(x => x.getBoundingClientRect().right <= l.right + 1) }; });
    check(r.right <= r.listRight + 1 && r.h < 80 && r.kids, `${rel} stays one tidy row inside the list: ${JSON.stringify(r)}`);
  }
  await shot(page, 'parity-long-rows');
  await page.click(`${row('long-token.md')} .fe-si-link`);
  await page.waitForSelector('#fe-meta-title', { timeout: 8000 }); await sleep(500);
  const head = await page.$eval('#fe-meta-title', e => { const b = e.getBoundingClientRect(), bar = e.parentElement.getBoundingClientRect(); return { h: Math.round(b.height), right: Math.round(b.right), barRight: Math.round(bar.right), barSw: e.parentElement.scrollWidth, barCw: e.parentElement.clientWidth }; });
  check(head.right <= head.barRight + 1 && head.barSw <= head.barCw + 1 && head.h < 60, `the editor heading holds a 300-character unbroken title: ${JSON.stringify(head)}`);
  await shot(page, 'parity-long-editor');
  await page.click('#fe-meta-title'); await sleep(300);
  const box = await page.$eval('#fe-meta-title-edit', e => ({ right: Math.round(e.getBoundingClientRect().right), barRight: Math.round(e.parentElement.getBoundingClientRect().right), sw: e.scrollWidth, cw: e.clientWidth }));
  check(box.right <= box.barRight + 1 && box.sw <= box.cw + 1, `and so does the title box when renaming: ${JSON.stringify(box)}`);
  await page.keyboard.press('Escape'); await sleep(200); await page.keyboard.press('Escape'); await sleep(400);
  await page.click(`${row('long-words.md')} .fe-si-link`, { button: 'right' });
  await page.waitForSelector('.fe-ctx-item[data-act="tab"]');
  await page.click('.fe-ctx-item[data-act="tab"]');
  await sleep(1200);
  const tabs = await page.$$eval('.fe-tab', ts => ts.map(t => { const b = t.getBoundingClientRect(), s = t.parentElement.getBoundingClientRect(); return { w: Math.round(b.width), inside: b.right <= s.right + 1 }; }));
  check(tabs.length > 0 && tabs.every(t => t.inside && t.w < 400), `a tab for a 400-character title stays inside the strip: ${JSON.stringify(tabs)}`);
  await shot(page, 'parity-long-tab');
  await page.goBack().catch(() => undefined); await sleep(800);
  await page.waitForSelector('#fe-nt-list .fe-nt-item');

  // 1b. Reading draws a table, and Option-Up / Option-Down move a line, Option-Shift-Down copies it.
  await page.click(`${row('tabled.md')} .fe-si-link`);
  await page.waitForSelector('#fe-meta-title', { timeout: 8000 }); await sleep(600);
  const tbl = await page.$$eval('#fe-ql-dialog table tr', rs => rs.map(r => [...r.children].map(c => c.textContent.trim()).join('|')));
  check(tbl.join(';') === 'Name|Count;apples|3;pears|5', `reading draws the table as a table: ${tbl}`);
  await shot(page, 'parity-table');
  const ta = '#fe-ql-dialog textarea';
  await page.$eval(ta, e => { e.focus(); e.setSelectionRange(0, 0); });
  const alt = async (key, shift = false) => { await page.keyboard.down('Alt'); if (shift) await page.keyboard.down('Shift'); await page.keyboard.press(key); if (shift) await page.keyboard.up('Shift'); await page.keyboard.up('Alt'); await sleep(150); };
  await alt('ArrowDown');
  check((await page.$eval(ta, e => e.value)).startsWith('two\none\nthree\n'), 'Option-Down moves the line under the cursor down one');
  await alt('ArrowUp');
  check((await page.$eval(ta, e => e.value)).startsWith('one\ntwo\nthree\n'), 'Option-Up moves it back');
  await alt('ArrowDown', true);
  check((await page.$eval(ta, e => e.value)).startsWith('one\none\ntwo\nthree\n'), 'Option-Shift-Down copies the line below');
  await page.keyboard.press('Escape'); await sleep(300); await page.keyboard.press('Escape'); await sleep(500);
  const tabledAfter = read('tabled.md');
  check(tabledAfter.includes('one\none\ntwo\nthree\n'), 'and the change is saved to the note');

  // 2. Duplicate and Copy text from the row menu.
  const menu = async (rel, act) => {
    await page.click(`${row(rel)} .fe-si-link`, { button: 'right' });
    await page.waitForSelector(`.fe-ctx-item[data-act="${act}"]`);
    await shot(page, 'parity-row-menu');
    await page.click(`.fe-ctx-item[data-act="${act}"]`);
  };
  const names = () => readdirSync(store).filter(f => f.endsWith('.md'));
  const before = new Set(names());
  await menu('source.md', 'duplicate');
  await sleep(1500);
  const made = names().filter(f => !before.has(f));
  check(made.length === 1, `Duplicate makes one new file: ${made}`);
  const copy = made[0] ? read(made[0]) : '';
  check(/title: "Source note"/.test(copy) && /tags: "work", "plan"/.test(copy) && /color: green/.test(copy) && copy.includes('The body of the source.\nSecond line.'), 'the copy has the same title, tags, colour and words');
  check(!/pinned|pos:|expires|remind_|reminder_id/.test(copy), 'and it is not pinned, has no place in the order, no expiry and no reminder');
  check(/pinned: true/.test(read('source.md')) && /expires:/.test(read('source.md')), 'while the original is untouched');
  await page.keyboard.press('Escape'); await sleep(500);
  await menu('source.md', 'cp-text'); await sleep(400);
  check((await page.$eval('#fe-toast', e => e.textContent)) === 'Copied text', 'Copy text says it copied the text');
  await menu('source.md', 'cp-all'); await sleep(400);
  check((await page.$eval('#fe-toast', e => e.textContent)) === 'Copied title and text', 'Copy title and text says so');

  // 2b. A new note from the clipboard, from the command palette (the clipboard read is stubbed: headless Chrome has none).
  const fromClip = new Set(names());
  await page.keyboard.down('Meta'); await page.keyboard.press('k'); await page.keyboard.up('Meta');
  await page.waitForSelector('.fe-pal input'); await sleep(200);
  await page.type('.fe-pal input', 'from the clipboard'); await sleep(300);
  await shot(page, 'parity-palette-clip');
  await page.keyboard.press('Enter'); await sleep(1500);
  // UNCONFIRMED here: a real clipboard read (headless Chrome grants no clipboard permission to a file page), so the
  // command is walked on its empty-clipboard branch; the note it would make is unit-tested in tests/editor-parity.test.ts.
  check(!names().some(f => !fromClip.has(f)) && (await page.$eval('#fe-toast', e => e.textContent)) === 'The clipboard has no text to save', 'the palette command runs, and with no text on the clipboard it says so and makes no file');
  await page.keyboard.press('Escape'); await sleep(500);

  // 3. Deleting a note keeps a picture another note still shows, and a restore brings the others back.
  await page.click(`${row('with-pic.md')} .fe-rm-btn`);
  await sleep(1500);
  check(!existsSync(join(store, 'attachments', 'groceries-photo.png')) && existsSync(join(store, '.trash', 'attachments', 'groceries-photo.png')), 'deleting a note sets aside the picture only it used');
  check(existsSync(join(store, 'attachments', 'pic.svg')), 'but a picture another note still shows stays where it is');

  // 4. Recently deleted: local trash, notes deleted on another device, remove for good.
  await page.click('#fe-nt-trash');
  await page.waitForSelector('#fe-nt-list .fe-nt-trashed');
  await sleep(800);
  const trashRows = await page.$$eval('#fe-nt-list .fe-nt-trashed', rs => rs.map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  check(trashRows.some(t => /Has a picture/.test(t)) && trashRows.some(t => /Deleted on the Pi/.test(t) && /elsewhere/.test(t)), `the list holds the note deleted here and the one deleted on another device: ${JSON.stringify(trashRows)}`);
  await shot(page, 'parity-trash');
  await page.click('#fe-nt-list .fe-nt-trashed[data-trashed^="git:"] .fe-nt-restore');
  await sleep(1500);
  check(existsSync(join(store, 'elsewhere.md')), 'restoring a note deleted elsewhere brings its file back from the folder history');
  await page.click('#fe-nt-list .fe-nt-trashed .fe-nt-restore');
  await sleep(1500);
  check(existsSync(join(store, 'with-pic.md')) && existsSync(join(store, 'attachments', 'groceries-photo.png')), 'restoring the local one brings its picture back too');
  await page.click(`#fe-nt-trash`); await sleep(600);
  await page.click(`${row('also-pic.md')} .fe-rm-btn`); await sleep(1200);
  await page.click('#fe-nt-trash'); await page.waitForSelector('#fe-nt-list .fe-nt-trashed'); await sleep(600);
  await page.click('#fe-nt-list .fe-nt-trashed[data-trashed^=".trash/"] .fe-nt-purge'); await sleep(1500);
  const bin = join(tmpdir(), `bfb-profile-${process.pid}`, 'macos-trash');
  check(existsSync(bin) && readdirSync(bin).some(f => /also-pic/.test(f)), `Remove sends the note to the macOS Trash: ${existsSync(bin) ? readdirSync(bin) : '(no trash folder)'}`);
  check(!(await page.$$eval('#fe-nt-list .fe-nt-trashed', r => r.some(x => /Shares a picture/.test(x.textContent)))), 'and it leaves the list');
  await page.click('#fe-nt-trash'); await sleep(600);

  // 5. Tag colours page: change a colour, rename a tag everywhere.
  await page.keyboard.press(',');
  await page.waitForSelector('#fe-settings-modal .fe-dlg-box');
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="notes"]');
  await sleep(1000);
  const tagRows = await page.$$eval('#fe-st-tags .fe-tc-row', rs => rs.map(r => [r.dataset.tag, r.querySelector('.fe-tc-n').textContent]));
  check(tagRows.some(([t, n]) => t === 'work' && /^4 items$/.test(n)), `the tags page counts a tag across notes: ${JSON.stringify(tagRows)}`);
  const dot = () => page.$eval('#fe-st-tags .fe-tc-row[data-tag="work"] .fe-tc-sw i', e => getComputedStyle(e).backgroundColor);
  const c0 = await dot();
  await page.click('#fe-st-tags .fe-tc-row[data-tag="work"] .fe-tc-sw'); await page.waitForSelector('.fe-tc-pop'); await page.click('.fe-tc-pop .fe-rp-c'); await sleep(500);
  const c1 = await dot();
  check(c0 !== c1, `clicking the swatch changes the colour: ${c0} -> ${c1}`);
  await sleep(2500);
  const tagsFile = existsSync(join(store, '.meta', 'tags.json')) ? JSON.parse(readFileSync(join(store, '.meta', 'tags.json'), 'utf8')) : {};
  check(!!tagsFile.work, `and the folder's tag colours hold it for the other devices: ${JSON.stringify(tagsFile)}`);
  await shot(page, 'parity-tags-page');
  await page.$eval('#fe-st-tags .fe-tc-row[data-tag="work"] input', e => { e.value = 'projects'; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(3000);
  check(/tags: "projects, plan"/.test(read(made[0])) && /tags: "projects"/.test(read('long-words.md')) && !/"work"/.test(read('source.md')), `renaming a tag changes it in every note that carries it: ${JSON.stringify(read('long-words.md').split('---')[1])} ${JSON.stringify(read('source.md').split('---')[1])}`);
  check(!/"work"/.test(read('long-words.md')), 'and not a note is left on the old name');
  const after = existsSync(join(store, '.meta', 'tags.json')) ? JSON.parse(readFileSync(join(store, '.meta', 'tags.json'), 'utf8')) : {};
  check(after.projects === tagsFile.work && !('work' in after), `with the colour moved to the new name in the folder: ${JSON.stringify(after)}`);
} finally {
  await h.close();
}
if (fails.length) { console.error(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
