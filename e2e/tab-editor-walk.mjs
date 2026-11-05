// The editor on a file's own tab offers what the peek offers: the format bar and its
// keys, pictures pasted in, saved versions, Rename and Delete with Undo. Each is used
// on real files in a real git repository and the result is read back from disk.
//
//   node e2e/tab-editor-walk.mjs [folder for screenshots]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
const shots = process.argv[2];   // a folder to leave screenshots in
try {
  const dir = join(h.fixture, 'tabbed');
  mkdirSync(dir);
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [dir] }));
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  page.on('dialog', d => d.accept());
  if (THEME === 'light') await h.store.set('bfb-theme', 'light');
  const snap = async name => { if (shots) { await wait(400); await page.screenshot({ path: join(shots, `${name}-${THEME}.png`) }); } };

  const openEdit = async file => {
    await page.goto('file://' + file, { waitUntil: 'load' });
    await page.waitForSelector('#fe-fp-edit');
    await wait(400);
    await page.click('#fe-fp-edit');
    await page.waitForSelector('#fe-fe-ta');
    await wait(300);
  };
  const acts = () => page.$$eval('#fe-fe-bar [data-act]', bs => bs.map(b => b.dataset.act));
  const select = (a, b) => page.evaluate((a, b) => { const t = document.querySelector('#fe-fe-ta'); t.focus(); t.setSelectionRange(a, b); }, a, b);
  const value = () => page.$eval('#fe-fe-ta', t => t.value);
  const press = name => page.click(`#fe-fe-bar [data-act="${name}"]`);
  const saved = async file => { await wait(1100); return readFileSync(file, 'utf8'); };

  // What the bar holds, by the kind of file.
  const md = join(dir, 'plan.md');
  writeFileSync(md, 'alpha beta\nsecond\n');
  await openEdit(md);
  const mdActs = await acts();
  check(['bold', 'italic', 'code', 'strike', 'heading', 'link', 'quote', 'olist', 'list', 'task', 'table', 'image'].every(a => mdActs.includes(a)), 'a Markdown file gets every format button');
  check(['versions', 'rename', 'delete'].every(a => mdActs.includes(a)), 'a Markdown file gets Versions, Rename and Delete');
  check(await page.$$eval('#fe-fe-bar .btn', bs => bs.every(b => b.title && b.querySelector('svg') && !b.textContent.trim())), 'every bar button is an icon with a tooltip');
  const overlap = await page.evaluate(() => {
    const a = document.querySelector('#fe-fe-bar').getBoundingClientRect(), b = document.querySelector('#fe-fe-pill').getBoundingClientRect();
    return a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right;
  });
  check(!overlap, 'the pill does not cover the bar');

  // Format buttons change the text and leave the caret in it.
  await select(0, 5);
  await press('bold');
  check((await value()).startsWith('**alpha** beta'), 'Bold wraps the selection');
  check(await page.evaluate(() => document.activeElement?.id === 'fe-fe-ta'), 'the caret stays in the text after a button');
  await press('quote');
  check((await value()).startsWith('> **alpha**'), 'Quote prefixes the line');
  await select(0, 0);
  await page.keyboard.down('Meta'); await page.keyboard.down('Shift'); await page.keyboard.press('KeyH'); await page.keyboard.up('Shift'); await page.keyboard.up('Meta');
  check((await value()).startsWith('# > **alpha**'), '⌘⇧H makes a heading, as in the peek');
  const end = (await value()).length;
  await select(end, end);
  await press('table');
  check((await value()).includes('| Column 1 | Column 2 |'), 'Table inserts a table');
  check((await saved(md)).includes('| Column 1 | Column 2 |'), 'the format changes are saved to disk');
  await snap('tab-editor-md');

  // A picture pasted into the text is stored beside the file and linked.
  await page.evaluate(async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), c => c.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([png], 'shot one.png', { type: 'image/png' }));
    document.querySelector('#fe-fe-ta').dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await wait(600);
  const stored = existsSync(join(dir, 'attachments')) ? readdirSync(join(dir, 'attachments')) : [];
  check(stored.length === 1 && stored[0].endsWith('.png'), `a pasted picture lands in attachments beside the file (${stored})`);
  check((await value()).includes(`![shot one](attachments/${stored[0]})`), 'the text links to the picture by a path that resolves from the file');
  await page.click('[data-act="done"]');
  await wait(500);

  // A folder that is no repository says so instead of showing nothing.
  await openEdit(md);
  await press('versions');
  await wait(400);
  check(/not a git repository/.test(await page.$eval('#fe-ed-hist', e => e.textContent)), 'Versions outside a repository says why it is empty');
  await press('versions');
  check(await page.$eval('#fe-ed-hist', e => e.hidden), 'the Versions button closes the panel');
  await page.click('[data-act="done"]');
  await wait(500);

  // Real history: rows, an old version shown, Back, then Use.
  const git = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=walk', '-c', 'user.email=walk@example.com', ...a], { stdio: 'pipe' });
  git('init', '-q');
  writeFileSync(md, '# First words\n\nolder text\n');
  const code = join(dir, 'tool.js');
  writeFileSync(code, 'const a = 1;\n');
  git('add', '.'); git('commit', '-qm', 'first save');
  writeFileSync(md, '# Second words\n\nnewer text\n');
  writeFileSync(code, 'const a = 2;\n');
  git('add', '.'); git('commit', '-qm', 'second save');
  await openEdit(md);
  await press('versions');
  await page.waitForSelector('.fe-hist-row');
  check((await page.$$('.fe-hist-row')).length === 2, 'Versions lists each save of this file');
  await page.evaluate(() => [...document.querySelectorAll('.fe-hist-row')].find(r => r.textContent.includes('first save')).click());
  await page.waitForSelector('#fe-hist-use');
  check(/First words/.test(await page.$eval('#fe-fe-view', e => e.textContent)), 'a row shows that version rendered');
  check((await value()).includes('Second words'), 'looking at a version leaves the text alone');
  await snap('tab-editor-versions');
  await page.click('#fe-hist-back');
  await wait(400);
  check(!(await page.$('#fe-hist-use')), 'Back to now takes the old version away');
  check(await page.$eval('#fe-fe-view', e => e.hidden), 'and the view goes back to how it was');
  await page.click('[data-mode="split"]');
  await page.evaluate(() => [...document.querySelectorAll('.fe-hist-row')].find(r => r.textContent.includes('first save')).click());
  await page.waitForSelector('#fe-hist-use');
  await page.click('#fe-hist-back');
  await wait(400);
  check(!(await page.$('#fe-hist-use')) && /Second words/.test(await page.$eval('#fe-fe-view', e => e.textContent)), 'in Split, Back to now draws the text as it is');
  await page.click('[data-mode="raw"]');
  await page.evaluate(() => [...document.querySelectorAll('.fe-hist-row')].find(r => r.textContent.includes('first save')).click());
  await page.waitForSelector('#fe-hist-use');
  await page.click('#fe-hist-use');
  await wait(200);
  check((await value()).includes('First words'), 'Use this version puts its words in the editor');
  check((await saved(md)).includes('First words'), 'and they are saved');
  await page.click('[data-act="done"]');
  await wait(500);

  // A file with no rendered view: no format buttons, and a version shows as a difference.
  await openEdit(code);
  const codeActs = await acts();
  check(!codeActs.includes('bold') && codeActs.includes('versions') && codeActs.includes('rename'), 'a code file gets the file buttons without the format ones');
  await select(0, 5);
  await page.keyboard.down('Meta'); await page.keyboard.press('KeyB'); await page.keyboard.up('Meta');
  check(!(await value()).includes('**'), '⌘B does not wrap words in a code file');
  await press('versions');
  await page.waitForSelector('.fe-hist-row');
  await page.evaluate(() => [...document.querySelectorAll('.fe-hist-row')].find(r => r.textContent.includes('first save')).click());
  await page.waitForSelector('#fe-hist-use');
  check(/const a = 1/.test(await page.$eval('#fe-fe-diff', e => e.textContent)), 'an old version of a code file shows as a difference');
  await page.click('#fe-hist-back');
  await wait(200);
  await page.click('[data-act="done"]');
  await wait(500);

  // Rename takes the words typed so far along, and editing carries on under the new name.
  const before = join(dir, 'before.md');
  writeFileSync(before, 'start\n');
  await openEdit(before);
  await select(5, 5);
  await page.keyboard.type(' typed');
  await page.keyboard.press('F2');
  await page.waitForSelector('#fe-keep.fe-rename input');
  await page.evaluate(() => { const i = document.querySelector('#fe-keep.fe-rename input'); i.value = 'after.md'; });
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.keyboard.press('Enter')]);
  await page.waitForSelector('#fe-fe-ta');
  const after = join(dir, 'after.md');
  check(!existsSync(before) && existsSync(after), 'Rename moves the file on disk');
  check(readFileSync(after, 'utf8').includes('typed'), 'words typed just before the rename go with it');
  check(decodeURIComponent(page.url()).endsWith('/after.md'), 'the page follows the file to its new name');
  check((await value()).includes('typed'), 'and it is still open for editing');
  await page.click('[data-act="done"]');
  await wait(500);

  // Delete goes to .trash, takes the last words along, and can be undone from where it lands.
  const doomed = join(dir, 'doomed.md');
  writeFileSync(doomed, 'going\n');
  await openEdit(doomed);
  await select(5, 5);
  await page.keyboard.type(' last');
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), press('delete')]);
  await page.waitForSelector('#fe-toast');
  await wait(400);
  check(!existsSync(doomed), 'Delete takes the file away');
  const trash = readdirSync(join(dir, '.trash')).find(n => n.endsWith('doomed.md'));
  check(!!trash && readFileSync(join(dir, '.trash', trash), 'utf8').includes('last'), 'the last words typed are in .trash with it');
  check(/Moved to \.trash/.test(await page.$eval('#fe-toast', e => e.textContent)), 'the next page says where it went');
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.evaluate(() => [...document.querySelectorAll('#fe-toast button')].find(b => /Undo/.test(b.textContent)).click())]);
  await wait(300);
  check(existsSync(doomed) && readFileSync(doomed, 'utf8').includes('last'), 'Undo puts the file back, words and all');
  check(decodeURIComponent(page.url()).endsWith('/doomed.md'), 'and opens it again');
} finally {
  for (const r of results) console.log(r);
  console.log(`${results.filter(r => r.startsWith('PASS')).length} pass, ${results.filter(r => r.startsWith('FAIL')).length} fail`);
  await h.close();
}
