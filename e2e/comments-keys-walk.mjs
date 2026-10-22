// Commenting with the keyboard alone: c with nothing selected starts a comment
// on the paragraph being read, ⇧R jumps to the open thread's reply box, and
// the palette offers and runs both.
//   node e2e/comments-keys-walk.mjs   → e2e/shots/comments-keys.png
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const CLI = resolve(new URL('..', import.meta.url).pathname, 'native', 'bfb_docs.py');
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_') && !k.startsWith('BFB_'))), BFB_DOCS_HOME: h.docsHome };
const cli = (...args) => spawnSync('python3', [CLI, '--json', ...args], { env, encoding: 'utf8' });
try {
  const doc = join(h.fixture, 'keys.md');
  writeFileSync(doc, '# Keys\n\nThe first paragraph sits at the top.\n\nA second paragraph follows it.\n');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture] }));
  await h.store.set('bfb-comments-filter-v1', 'open');
  cli('--as', 'bfb', 'comments', 'new', doc, '--quote', 'second paragraph', 'Seeded thread');
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-cm .fe-cm-th', { timeout: 8000 });
  await page.evaluate(() => { window.getSelection()?.removeAllRanges(); document.activeElement?.blur(); });
  const focusFor = () => page.evaluate(() => document.activeElement?.getAttribute('data-for') ?? document.activeElement?.tagName);

  await page.keyboard.press('c');
  await page.waitForSelector('#fe-cm .fe-cm-new', { timeout: 3000 }).catch(() => null);
  const quote = await page.$eval('#fe-cm .fe-cm-new', n => n.textContent).catch(() => '');
  check(/^\s*Keys\b/.test(quote) && !/paragraph/.test(quote), `c with nothing selected quotes the block at the top (the heading): ${quote.trim().slice(0, 40)}`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement?.blur());
  await sleep(150);
  // Focus inside a paragraph wins over the top of the page.
  await page.evaluate(() => {
    const p = [...document.querySelectorAll('#fe-page [data-sl]')].find(b => b.textContent.includes('second paragraph'));
    p.tabIndex = -1; p.focus();
  });
  await page.keyboard.press('c');
  await sleep(250);
  const q2 = await page.$eval('#fe-cm .fe-cm-new', n => n.textContent).catch(() => '');
  check(/second paragraph/.test(q2), `c quotes the paragraph holding focus: ${q2.trim().slice(0, 40)}`);
  check(await focusFor() === 'new', `the new comment's box has focus: ${await focusFor()}`);
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement?.blur());
  await sleep(150);

  await page.keyboard.down('Shift'); await page.keyboard.press('R'); await page.keyboard.up('Shift');
  await sleep(200);
  const f = await focusFor();
  check(!!f && f !== 'new' && f !== 'BODY', `⇧R focuses a thread's reply box: ${f}`);
  await page.screenshot({ path: join(SHOTS, 'comments-keys.png') });
  await page.evaluate(() => document.activeElement?.blur());

  const open = async () => { await page.keyboard.down('Meta'); await page.keyboard.press('k'); await page.keyboard.up('Meta'); await page.waitForSelector('.fe-pal input'); await sleep(150); };
  await open();
  await page.keyboard.type('reply to');
  const top = await page.$eval('.fe-pal-i .fe-pal-t', t => t.textContent).catch(() => '');
  check(top === 'Reply to the comment', `the palette offers Reply: ${top}`);
  await page.keyboard.press('Enter');
  await sleep(250);
  const g = await focusFor();
  check(!!g && g !== 'new' && g !== 'BODY', `running it from the palette focuses the reply box: ${g}`);
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
