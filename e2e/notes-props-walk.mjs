// Walks note properties (title, colour, pin, tags) on a scratch copy of a real notes store:
// the chips above the editor, the frontmatter guard, and the sidebar order and menu.
//
//   BFB_NOTES_SRC=~/Notes BFB_NOTES_SCRATCH=/private/tmp/.../scratch node e2e/notes-props-walk.mjs
//   BFB_THEME=light ...   (same checks on the light theme, screenshots get a -light suffix)
//
// The source folder is copied, never written.
import { launch, shot, applyTheme } from './harness.mjs';
import { cpSync, rmSync, readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const SRC = process.env.BFB_NOTES_SRC || join(homedir(), 'Notes');
const store = process.env.BFB_NOTES_SCRATCH || '/private/tmp/claude-501/bfb-notes-scratch';
rmSync(store, { recursive: true, force: true });
mkdirSync(store, { recursive: true });
cpSync(SRC, store, { recursive: true, preserveTimestamps: true });
const OUT = process.env.BFB_WALK_OUT || join(store, '..', 'bfb-notes-walk-out');
mkdirSync(OUT, { recursive: true });

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const read = rel => readFileSync(join(store, rel), 'utf8');
const head = t => (t.match(/^---\n(?:[\s\S]*?\n)?---\n/) || [''])[0];
const headLines = (t, skip = []) => head(t).split('\n').filter(l => l && l !== '---' && !['updated', ...skip].includes(l.split(':')[0].trim()));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const save = async page => {
  await page.keyboard.down('Meta'); await page.keyboard.press('s'); await page.keyboard.up('Meta');
  await page.waitForFunction(() => /saved \d|not saved/.test(document.getElementById('fe-ql-meta').textContent), { timeout: 8_000 }).catch(() => null);
  await sleep(300);
};

// A pinned, coloured, tagged note to open; a plain note without frontmatter for the guard.
const withProps = readdirSync(store).filter(f => f.endsWith('.md')).find(f => /^tags:/m.test(read(f)) && /^pinned: true/m.test(read(f)) && /^color:/m.test(read(f)));
writeFileSync(join(store, 'plain-guard.md'), '# Plain guard\n\nno properties here\n');
check(!!withProps, `the store has a note with tags, pin and colour: ${withProps}`);

const h = await launch();
try {
  const page = await h.open();
  await h.store.set('bfb-settings-v1', { showSidebar: true, tooltips: true, notesRoot: store });
  await page.reload({ waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 10_000 });

  // 1. Sidebar: pinned notes first, then newest; colour dot, pin and tags on the rows.
  const rows = await page.$$eval('#fe-nt-list .fe-nt-item', els => els.map(e => ({
    rel: e.getAttribute('data-rel'), pinned: e.classList.contains('pinned'),
    dot: !!e.querySelector('.fe-cdot'), tags: [...e.querySelectorAll('.fe-nt-tags span')].map(s => s.textContent) })));
  const onDisk = rel => ({ pinned: /^pinned: true$/m.test(read(rel)), mtime: statSync(join(store, rel)).mtimeMs });
  const expect = rows.map(r => ({ ...r, ...onDisk(r.rel) }));
  const firstUnpinned = expect.findIndex(r => !r.pinned);
  check(expect.slice(0, firstUnpinned < 0 ? expect.length : firstUnpinned).every(r => r.pinned)
    && expect.slice(firstUnpinned < 0 ? expect.length : firstUnpinned).every(r => !r.pinned), 'pinned notes come first in the sidebar');
  const sorted = (xs) => xs.every((r, i) => i === 0 || xs[i - 1].mtime >= r.mtime);
  check(sorted(expect.filter(r => r.pinned)) && sorted(expect.filter(r => !r.pinned)), 'within pinned and unpinned, newest first');
  const row = rows.find(r => r.rel === withProps);
  check(row && row.pinned && row.dot && row.tags.length > 0, `the tagged, pinned, coloured note shows all three on its row: ${JSON.stringify(row)}`);
  await shot(page, 'props-sidebar');

  // 2. Editor: chips show title, pin, colour and tags; the properties block is not editable text.
  const before = read(withProps);
  await page.click(`#fe-nt-list .fe-nt-item[data-rel="${withProps}"] .fe-si-link`);
  await page.waitForSelector('#fe-ed-src', { timeout: 8_000 });
  await page.waitForFunction(rel => document.getElementById('fe-ql-meta').textContent.startsWith(rel), { timeout: 5_000 }, withProps);
  await sleep(300);
  const ed = await page.evaluate(() => ({
    src: document.getElementById('fe-ed-src').value,
    title: document.getElementById('fe-meta-title')?.dataset.title,
    chips: document.getElementById('fe-ed-meta').innerText }));
  check(!/^---$/m.test(ed.src.split('\n')[0]) && !/^(title|created|tags|pinned|color|source):/m.test(ed.src.split('\n').slice(0, 8).join('\n')), `the editor text does not start with the properties block: ${JSON.stringify(ed.src.slice(0, 60))}`);
  check(!!ed.title && /pinned/.test(ed.chips) && /\w/.test(ed.chips), `the chip row shows the title, pinned and the rest: ${JSON.stringify(ed.chips)}`);
  await shot(page, 'props-editor');

  // 3. Edit the text only: the properties block saves unchanged (bar `updated`).
  await page.evaluate(() => {
    const ta = document.getElementById('fe-ed-src');
    ta.value = ta.value.replace(/\s*$/, '\n\nAdded by the props walk.\n');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await save(page);
  const afterText = read(withProps);
  check(afterText.includes('Added by the props walk.'), 'the text edit reached the file');
  check(JSON.stringify(headLines(before)) === JSON.stringify(headLines(afterText)), `a text edit leaves every property line unchanged: ${JSON.stringify(headLines(afterText))}`);
  writeFileSync(join(OUT, 'fm-text-edit-before.txt'), head(before));
  writeFileSync(join(OUT, 'fm-text-edit-after.txt'), head(afterText));

  // 4. Chips: colour, pin, tag. Each changes only its own line.
  await page.click('#fe-ed-meta [data-m="color"]');
  await page.waitForSelector('.fe-pmenu', { timeout: 3_000 });
  await shot(page, 'props-menu');
  await page.click('.fe-pmenu [data-pm="color"][data-color="purple"]');
  await page.type('.fe-pmenu .fe-pm-add input', 'walk');
  await page.keyboard.press('Enter');
  await sleep(200);
  await page.keyboard.press('Escape');
  await page.click('#fe-ed-meta [data-m="pin"]');
  await save(page);
  const chipText = read(withProps);
  const fm = headLines(chipText);
  check(fm.includes('color: purple'), `colour chip writes "color: purple": ${JSON.stringify(fm)}`);
  check(!fm.some(l => l.startsWith('pinned')), 'unpinning removes the pinned line');
  check(fm.some(l => /^tags: ".*\bwalk\b.*"$/.test(l)), `adding a tag keeps the JSON-quoted comma list: ${fm.find(l => l.startsWith('tags'))}`);
  const same = headLines(before, ['color', 'pinned', 'tags']).join('|') === headLines(chipText, ['color', 'pinned', 'tags']).join('|');
  check(same, 'every other property line is unchanged by the chips');
  check(chipText.replace(head(chipText), '') === afterText.replace(head(afterText), ''), 'the chips did not touch the body');
  writeFileSync(join(OUT, 'fm-chips-before.txt'), head(before));
  writeFileSync(join(OUT, 'fm-chips-after.txt'), head(chipText));
  await shot(page, 'props-editor-changed');
  await page.keyboard.press('Escape');

  // 5. The guard: text typed in the editor can never become a properties block.
  await page.click(`#fe-nt-list .fe-nt-item[data-rel="plain-guard.md"] .fe-si-link`);
  await page.waitForFunction(() => /Plain guard/.test(document.getElementById('fe-ed-src')?.value || ''), { timeout: 8_000 });
  const plainBefore = read('plain-guard.md');
  await page.evaluate(() => {
    const ta = document.getElementById('fe-ed-src');
    ta.value = '---\ntitle: Oops\npinned: true\ncolor: red\n---\n' + ta.value;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await save(page);
  const plainAfter = read('plain-guard.md');
  check(!/^---\n/.test(plainAfter), `a pasted --- block at the top is not saved as properties: ${JSON.stringify(plainAfter.slice(0, 50))}`);
  check(plainAfter.includes('title: Oops'), 'the pasted text itself is kept');
  const taNow = await page.$eval('#fe-ed-src', el => el.value);
  check(taNow.startsWith('\n---'), 'the editor shows the blank line that was added above it');
  writeFileSync(join(OUT, 'guard-before.txt'), plainBefore);
  writeFileSync(join(OUT, 'guard-after.txt'), plainAfter);
  await shot(page, 'props-guard');
  await page.keyboard.press('Escape');

  // 6. A note with no properties block: setting a colour adds a block holding only that field.
  await page.hover('#fe-nt-list .fe-nt-item[data-rel="plain-guard.md"]');
  await page.click('#fe-nt-list .fe-nt-item[data-rel="plain-guard.md"] .fe-nt-props');
  await page.waitForSelector('.fe-pmenu');
  await page.click('.fe-pmenu [data-pm="color"][data-color="red"]');
  await sleep(600);
  const tinted = read('plain-guard.md');
  check(/^---\ncolor: red\n---\n/.test(tinted), `sidebar colour on a plain note writes only that field: ${JSON.stringify(tinted.slice(0, 40))}`);
  // 7. Sidebar menu: pin it, and it jumps to the top.
  await page.click('.fe-pmenu [data-pm="pin"]');
  await sleep(700);
  const top = await page.$eval('#fe-nt-list .fe-nt-item', e => e.getAttribute('data-rel'));
  check(/^---\npinned: true\ncolor: red\n---\n/.test(read('plain-guard.md')), `pin goes before colour, as Switchboard orders them: ${JSON.stringify(read('plain-guard.md').slice(0, 45))}`);
  check(top === 'plain-guard.md', `a note pinned from the sidebar moves to the top: ${top}`);
  await shot(page, 'props-sidebar-menu');
  await page.keyboard.press('Escape');
} finally {
  await h.close();
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
