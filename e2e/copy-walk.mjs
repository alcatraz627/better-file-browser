// Every copy control answers the same way: a short tooltip that names its key,
// and a green check in place of its icon for three seconds, whether it was
// clicked or its key was pressed. Covers the file page, a code block, the
// floating preview, a listing row, and the comments.
// BFB_THEME=light runs it on the light theme.
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { launch, applyTheme, shot } from './harness.mjs';

const CLI = resolve(new URL('..', import.meta.url).pathname, 'native', 'bfb_docs.py');
const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_') && !k.startsWith('BFB_'))), BFB_DOCS_HOME: h.docsHome };
const cli = (...args) => {
  const r = spawnSync('python3', [CLI, '--json', ...args], { env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`bfb-docs ${args.join(' ')}: ${r.stderr}`);
  return JSON.parse(r.stdout);
};
const state = (page, sel) => page.$eval(sel, b => ({ done: b.hasAttribute('data-done'), check: !!b.querySelector('svg path[d="M20 6 9 17l-5-5"]'), w: Math.round(b.getBoundingClientRect().width) }))
  .catch(() => ({ done: false, check: false, w: -1 }));
const tip = async (page, sel) => {
  await page.mouse.move(0, 0);
  await sleep(100);
  await page.hover(sel);
  await page.waitForSelector('#fe-hint.on', { timeout: 2000 }).catch(() => null);
  const t = await page.$eval('#fe-hint', e => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
  await page.mouse.move(0, 0);
  return t;
};
// The check shows now, is still there at 2.5s, and the icon is back by 3.5s.
const lasts = async (page, sel, label, fire) => {
  const before = await state(page, sel);
  await fire();
  await sleep(150);
  const on = await state(page, sel);
  await sleep(2350);
  const mid = await state(page, sel);
  await sleep(1100);
  const off = await state(page, sel);
  check(on.done && on.check && mid.check && !off.check && !off.done && on.w === before.w,
    `${label}: check for 3s, then the icon, same width: ${JSON.stringify({ before: before.w, on, mid: mid.check, off })}`);
};

try {
  await h.browser.defaultBrowserContext().overridePermissions('file://', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']).catch(() => null);
  const doc = join(h.fixture, 'copy.md');
  writeFileSync(doc, '# Copy\n\nThe first paragraph has words to comment on.\n\n```js\nconst a = 1;\n```\n');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture], tooltips: true }));
  cli('comments', 'new', doc, '--quote', 'words to comment on', 'A thread to copy.');

  const page = await h.open(h.fixture);
  await applyTheme(page);
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-md');
  await sleep(400);
  const clip = () => page.evaluate(() => navigator.clipboard.readText()).catch(() => '');

  // The file page's Copy.
  const fpTip = await tip(page, '#fe-fp-copy');
  check(/Copy the file/.test(fpTip) && /\by\b/.test(fpTip), `the file page's Copy names its key: "${fpTip}"`);
  await lasts(page, '#fe-fp-copy', 'file page Copy by click', () => page.click('#fe-fp-copy'));
  check((await clip()).startsWith('# Copy'), 'the file page Copy put the file on the clipboard');
  await page.evaluate(() => navigator.clipboard.writeText('x'));
  await page.focus('#fe-page').catch(() => {});
  await lasts(page, '#fe-fp-copy', 'file page Copy by y', () => page.keyboard.press('y'));
  check((await clip()).startsWith('# Copy'), 'y put the file on the clipboard');

  // A code block's copy.
  await lasts(page, '.fe-md-copy', 'code block copy', () => page.click('.fe-md-copy'));

  // The comments: a link to the thread and the brief of every thread shown.
  await page.click('#fe-fp-cm');
  await page.waitForSelector('#fe-cm .fe-cm-th', { timeout: 8000 }).catch(() => null);
  const briefSel = '#fe-cm [data-a="brief-all"]';
  const bTip = await tip(page, briefSel);
  check(/brief/i.test(bTip) && /⇧\s*B|Shift/.test(bTip), `the brief button names its key: "${bTip}"`);
  await lasts(page, briefSel, 'brief by click', () => page.click(briefSel));
  check(/A thread to copy/.test(await clip()), 'the brief holds the thread');
  await page.focus('#fe-page').catch(() => {});
  await page.mouse.click(5, 450);
  await lasts(page, briefSel, 'brief by ⇧B', () => page.keyboard.down('Shift').then(() => page.keyboard.press('B')).then(() => page.keyboard.up('Shift')));
  await page.click('#fe-cm .fe-cm-th');
  await sleep(300);
  const linkSel = '#fe-cm [data-a="link"]';
  if (await page.$(linkSel)) {
    const lTip = await tip(page, linkSel);
    check(/link/i.test(lTip) && /⇧\s*K|Shift/.test(lTip), `the link button names its key: "${lTip}"`);
    await lasts(page, linkSel, 'thread link by click', () => page.click(linkSel));
    check(/#c=/.test(await clip()), 'the link opens the thread');
  } else check(false, 'an open thread shows its link button');
  await shot(page, 'copy-file-page');
  await page.close();

  // The listing: a row's copy-path button, by click and by y on that row.
  const list = await h.open(h.fixture);
  await applyTheme(list);
  await list.bringToFront();
  await list.waitForSelector('#fe-tbody tr[data-idx]');
  const row = '#fe-tbody tr[data-idx]:has(a[href$="/copy.md"])';
  // Select the row with the keyboard: a click would open its preview over the buttons.
  for (let i = 0; i < 12 && !(await list.$(`${row}.selected`)); i++) await list.keyboard.press('ArrowDown');
  await list.hover(row);
  const rTip = await tip(list, `${row} .fe-act-cp`);
  check(/Copy path/.test(rTip) && /\by\b/.test(rTip), `a row's copy path names its key: "${rTip}"`);
  await list.hover(row);
  await lasts(list, `${row} .fe-act-cp`, 'row copy path by click', () => list.click(`${row} .fe-act-cp`));
  await lasts(list, `${row} .fe-act-cp`, 'row copy path by y', () => list.keyboard.press('y'));

  // The floating preview's Copy, by click and by c.
  await list.click(`${row} td.c-sz`);
  await list.keyboard.press('Space');
  await list.waitForFunction(() => document.getElementById('fe-qlook')?.style.display === 'flex', { timeout: 5000 });
  await list.waitForFunction(() => !document.getElementById('fe-ql-copy').disabled, { timeout: 5000 });
  const pTip = await tip(list, '#fe-ql-copy');
  check(/Copy the file/.test(pTip) && /\bc\b/.test(pTip), `the preview's Copy names its key: "${pTip}"`);
  await lasts(list, '#fe-ql-copy', 'preview Copy by click', () => list.click('#fe-ql-copy'));
  await lasts(list, '#fe-ql-copy', 'preview Copy by c', () => list.keyboard.press('c'));
  await shot(list, 'copy-preview');
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
