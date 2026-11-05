// Comments across the ways of viewing a doc: the panel sits beside Split without
// covering it, a comment can start from the rendered side while editing, Raw says
// what to do, each doc opens on its open threads, and the panel survives a reload.
//
//   node e2e/comments-views-walk.mjs [folder for screenshots]
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, THEME } from './harness.mjs';

const CLI = resolve(new URL('..', import.meta.url).pathname, 'native', 'bfb_docs.py');
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const shots = process.argv[2];
const h = await launch();
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_') && !k.startsWith('BFB_'))), BFB_DOCS_HOME: h.docsHome };
const cli = (...args) => {
  const r = spawnSync('python3', [CLI, '--json', ...args], { env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`bfb-docs ${args.join(' ')}: ${r.stderr}`);
  return JSON.parse(r.stdout);
};
try {
  const doc = join(h.fixture, 'plan.md');
  const other = join(h.fixture, 'other.md');
  writeFileSync(doc, '# Plan\n\nThe first paragraph has some words.\n\n## Later\n\nThe second paragraph has other words.\n');
  writeFileSync(other, '# Other\n\nAnother doc with an open thread here.\n');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture] }));
  await h.store.set('bfb-theme', THEME);
  cli('--as', 'bfb', 'comments', 'new', doc, '--quote', 'first paragraph', 'About the first');
  cli('--as', 'bfb', 'comments', 'new', other, '--quote', 'open thread', 'About the other');
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  const snap = async name => { if (shots) { await wait(400); await page.screenshot({ path: join(shots, `${name}-${THEME}.png`) }); } };
  const openDoc = async file => {
    await page.goto('file://' + file, { waitUntil: 'load' });
    await page.waitForSelector('#fe-fp-cm');
    await wait(400);
  };
  const railShown = () => page.$eval('#fe-cm', e => e.checkVisibility());

  await openDoc(doc);
  if (!(await railShown())) await page.click('#fe-fp-cm');
  await page.waitForSelector('#fe-cm .fe-cm-th', { timeout: 8000 });

  // The panel stays through a reload.
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-cm');
  await wait(500);
  check(await railShown(), 'the panel is still open after a reload');
  await page.goBack().catch(() => null);
  await openDoc(doc);

  // A filter left on Done does not hide the next doc's open thread.
  await page.waitForSelector('#fe-cm [data-f="done"], #fe-cm [data-filter="done"]', { timeout: 4000 }).catch(() => null);
  await page.evaluate(() => document.querySelector('#fe-cm [data-f="done"], #fe-cm [data-filter="done"]')?.click());
  await wait(200);
  await openDoc(other);
  await wait(400);
  check(/About the other/.test(await page.$eval('#fe-cm', e => e.textContent)), 'another doc opens on its open threads, not the last filter');

  // Raw says why nothing happens.
  await openDoc(doc);
  await page.click('#fe-fp-raw');
  await wait(200);
  check(await page.$eval('#fe-fp-cm', b => b.disabled && !b.hidden), 'in Raw the comments button stays where it is, dimmed');
  await page.keyboard.press('c');
  await wait(200);
  check(/leave Raw/.test(await page.$eval('#fe-toast', e => e.textContent)), 'the comment key says to leave Raw');
  await page.click('#fe-fp-raw');
  await wait(200);

  // In Split the panel sits beside the rendered side.
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-fe-ta');
  await wait(300);
  await page.click('[data-mode="split"]');
  await wait(400);
  if (!(await railShown())) await page.click('#fe-fp-cm');
  await wait(400);
  const geo = await page.evaluate(() => ({ view: document.getElementById('fe-fe-view').getBoundingClientRect().right, rail: document.getElementById('fe-toc-rail').getBoundingClientRect().left }));
  check(geo.view <= geo.rail + 1, `the panel covers none of the rendered side: ${JSON.stringify(geo)}`);
  await snap('comments-split');

  // Words selected on the rendered side can take a comment, by button and by key.
  const select = () => page.evaluate(() => {
    const p = [...document.querySelectorAll('#fe-fe-view p')].find(x => x.textContent.includes('second paragraph'));
    const r = document.createRange(); r.selectNodeContents(p);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await select();
  await wait(300);
  check(await page.$eval('#fe-cm-add', b => !b.hidden), 'selecting on the rendered side offers Comment');
  await page.click('#fe-cm-add');
  await wait(300);
  const draft = () => page.$eval('#fe-cm', e => /second paragraph/.test(e.textContent) && !!e.querySelector('textarea'));
  check(await draft(), 'the button starts a comment on those words');
  await page.keyboard.press('Escape');
  await wait(200);
  await page.focus('#fe-fe-ta');
  const before = await page.$eval('#fe-fe-ta', t => t.value);
  await select();
  await wait(200);
  await page.keyboard.press('c');
  await wait(300);
  check(await page.$eval('#fe-fe-ta', t => t.value) === before, 'c with words selected there adds nothing to the text');
  check(await draft(), 'and starts a comment');
  await page.keyboard.press('Escape');
} finally {
  for (const r of results) console.log(r);
  console.log(`${results.filter(r => r.startsWith('PASS')).length} pass, ${results.filter(r => r.startsWith('FAIL')).length} fail`);
  await h.close();
}
