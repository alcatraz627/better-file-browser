// A long thread in the comments card: opening it keeps its reply box in
// sight, so there is somewhere to type without hunting for it.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { launch, SHOTS, THEME } from './harness.mjs';

const CLI = resolve(new URL('..', import.meta.url).pathname, 'native', 'bfb_docs.py');
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sfx = THEME === 'light' ? '-light' : '';
const h = await launch();
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_') && !k.startsWith('BFB_'))), BFB_DOCS_HOME: h.docsHome };
const cli = (...args) => {
  const r = spawnSync('python3', [CLI, '--json', ...args], { env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`bfb-docs ${args.join(' ')}: ${r.stderr}`);
  return JSON.parse(r.stdout);
};
try {
  const doc = join(h.fixture, 'long.md');
  writeFileSync(doc, '# Long\n\n' + Array.from({ length: 12 }, (_, i) => `Paragraph ${i} says something worth a comment.`).join('\n\n') + '\n');
  for (let i = 0; i < 8; i++) cli('comments', 'new', doc, '--quote', `Paragraph ${i} says`, `Thread ${i}.`);
  const t = cli('comments', 'new', doc, '--quote', 'Paragraph 9 says', 'The long one.').results[0].thread;
  for (let i = 0; i < 14; i++) cli('comments', 'reply', doc, t, `Reply ${i}: ` + 'a fair amount of text so the thread runs tall. '.repeat(2));
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture] }));
  await h.store.set('bfb-theme', THEME);
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 800 });
  await page.goto('file://' + doc + '#c=' + t, { waitUntil: 'load' });
  await page.waitForSelector('#fe-toc-rail .fe-cm-th.on', { timeout: 8000 }).catch(() => null);
  await sleep(400);
  const box = await page.evaluate(id => {
    const ta = document.querySelector(`#fe-toc-rail textarea[data-for="${id}"]`);
    const list = document.querySelector('#fe-toc-rail .fe-cm-list');
    if (!ta || !list) return null;
    const a = ta.getBoundingClientRect(), l = list.getBoundingClientRect();
    return { top: Math.round(a.top), bottom: Math.round(a.bottom), listTop: Math.round(l.top), listBottom: Math.round(l.bottom), inView: a.top >= l.top - 1 && a.bottom <= l.bottom + 1 };
  }, t);
  check(box?.inView, `opening a long thread keeps its reply box in sight: ${JSON.stringify(box)}`);
  await page.screenshot({ path: join(SHOTS, `long-thread${sfx}.png`) });
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'long thread walk passes');
