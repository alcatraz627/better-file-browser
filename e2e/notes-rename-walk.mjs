// Renaming notes without losing writing: a note whose first line is a
// paragraph or a task keeps that line and gains a heading; a title whose file
// name is taken changes nothing and says so; and rename from the editor's bar
// works at a person's pace, not only at a robot's.
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { launch, SHOTS, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sfx = THEME === 'light' ? '-light' : '';
const store = join(tmpdir(), `bfb-rename-${process.pid}`);
rmSync(store, { recursive: true, force: true });
mkdirSync(store, { recursive: true });
const files = {
  'para.md': 'Call the bank about the refinance before Friday.\n\nMore text.\n',
  'todo.md': '- [ ] buy milk\n- [ ] eggs\n',
  'alpha.md': '# Alpha\n\nalpha body\n',
  'beta.md': '# Beta\n\nbeta body\n',
  'edit-me.md': '# Edit me\n\nsome text\n',
};
for (const [n, t] of Object.entries(files)) writeFileSync(join(store, n), t);
const read = n => readFileSync(join(store, n), 'utf8');

const h = await launch({ pickReply: store });
try {
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  await h.store.set('bfb-settings-v1', { showSidebar: true, tooltips: true, notesRoot: store });
  await h.store.set('bfb-theme', THEME);
  await h.store.set('bfb-lens-v1', 'notes');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 10_000 });
  const row = rel => `#fe-nt-list .fe-nt-item[data-rel="${rel}"]`;
  // Rename through the row menu, typing like a person.
  const rename = async (rel, title) => {
    await page.click(`${row(rel)} .fe-si-link`, { button: 'right' });
    await page.waitForSelector('#fe-nt-ctx', { visible: true, timeout: 3000 });
    await page.click('#fe-nt-ctx [data-act="rename"]');
    await page.waitForSelector('#fe-nt-list .fe-nt-label.editing', { timeout: 3000 });
    await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta');
    await page.keyboard.type(title, { delay: 40 });
    await page.keyboard.press('Enter');
    await sleep(1200);
  };

  await rename('para.md', 'Bank');
  const bank = existsSync(join(store, 'bank.md')) ? read('bank.md') : '';
  check(bank.startsWith('# Bank\n\n') && bank.includes('Call the bank about the refinance before Friday.') && bank.includes('More text.'),
    `a note that starts with a paragraph keeps it and gains a heading: ${JSON.stringify(bank)}`);
  await rename('todo.md', 'Groceries');
  const groc = existsSync(join(store, 'groceries.md')) ? read('groceries.md') : '';
  check(groc.includes('- [ ] buy milk') && groc.includes('- [ ] eggs') && groc.startsWith('# Groceries'), `a note that starts with a task keeps the task: ${JSON.stringify(groc)}`);

  await rename('alpha.md', 'Beta');
  const toast = await page.evaluate(() => document.getElementById('fe-toast')?.textContent ?? '');
  check(read('alpha.md') === files['alpha.md'] && read('beta.md') === files['beta.md'] && /already exists/.test(toast),
    `a title whose file name is taken changes nothing and says why: "${toast}"`);
  const titles = await page.$$eval('#fe-nt-list .fe-nt-label', ls => ls.map(l => l.textContent));
  check(titles.filter(t => t === 'Beta').length === 1, `the list still shows one Beta: ${titles.join(', ')}`);

  // From the editor's bar, at a person's pace: wait a beat before typing.
  await page.click(`${row('edit-me.md')} .fe-si-link`);
  await page.waitForSelector('#fe-ed-src', { timeout: 8000 });
  await sleep(400);
  await page.click('#fe-ed-bar [data-act="rename"]');
  await sleep(700);
  const box = await page.evaluate(() => { const l = document.querySelector('#fe-nt-list .fe-nt-label.editing'); return { open: !!l, focused: !!l && l.contains(document.activeElement) }; });
  check(box.open && box.focused, `rename from the editor bar opens a focused box that stays open: ${JSON.stringify(box)}`);
  await page.screenshot({ path: join(SHOTS, `notes-rename-bar${sfx}.png`), clip: { x: 0, y: 0, width: 700, height: 500 } });
  await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta');
  await page.keyboard.type('Renamed slowly', { delay: 60 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('fe-ed-src'), { timeout: 8000 }).catch(() => null);
  await sleep(1200);
  const after = readdirSync(store).filter(f => f.endsWith('.md'));
  const meta = await page.$eval('#fe-ql-meta', e => e.textContent).catch(() => '');
  check(after.includes('renamed-slowly.md') && /^# Renamed slowly/.test(read('renamed-slowly.md')) && meta.startsWith('renamed-slowly.md'),
    `the note is renamed and opens again in the editor: ${after.join(', ')} · ${meta}`);

  // The same two actions by key while typing in the editor.
  await page.focus('#fe-ed-src');
  await page.keyboard.press('F2');
  await sleep(700);
  const byKey = await page.evaluate(() => { const l = document.querySelector('#fe-nt-list .fe-nt-label.editing'); return { open: !!l, focused: !!l && l.contains(document.activeElement) }; });
  check(byKey.open && byKey.focused, `F2 in the editor opens the rename box: ${JSON.stringify(byKey)}`);
  await page.keyboard.press('Escape');
  await sleep(400);
  await page.waitForSelector('#fe-ed-src', { timeout: 5000 }).catch(() => null);
  await page.focus('#fe-ed-src');
  await page.keyboard.down('Meta'); await page.keyboard.down('Shift'); await page.keyboard.press('Backspace'); await page.keyboard.up('Shift'); await page.keyboard.up('Meta');
  await sleep(1200);
  const gone = !existsSync(join(store, 'renamed-slowly.md')) && existsSync(join(store, '.trash'));
  check(gone, `⌘⇧⌫ in the editor moves the note to .trash: ${readdirSync(store).join(', ')}`);} finally {
  console.log(results.join('\n'));
  await h.close();
  rmSync(store, { recursive: true, force: true });
}
assert.ok(results.length && results.every(r => !r.startsWith('FAIL')), 'notes rename walk passes');
