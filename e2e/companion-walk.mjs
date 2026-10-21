// Comment companions in the listing: plan.md.bfb.json is hidden with the
// dotfiles, plan.md's row shows how many threads are open, and the eye button
// brings the companion back.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { launch, SHOTS, THEME } from './harness.mjs';

const CLI = resolve(new URL('..', import.meta.url).pathname, 'native', 'bfb_docs.py');
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sfx = THEME === 'light' ? '-light' : '';
const h = await launch();
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_') && !k.startsWith('BFB_'))), BFB_DOCS_HOME: h.docsHome };
try {
  const doc = join(h.fixture, 'plan.md');
  writeFileSync(doc, '# Plan\n\nShip on Friday.\n\nTest on Thursday.\n');
  for (const [q, t] of [['Ship on Friday', 'Firm?'], ['Test on Thursday', 'Who runs it?']]) {
    const r = spawnSync('python3', [CLI, 'comments', 'new', doc, '--quote', q, t], { env, encoding: 'utf8' });
    check(r.status === 0, `a comment is written from the terminal: ${r.stderr.trim()}`);
  }
  await h.store.set('bfb-theme', THEME);
  await h.store.set('bfb-show-hidden', 'false');
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  await page.waitForSelector('#fe-tbody');
  await page.waitForSelector('.fe-row[data-name="plan.md"] .fe-row-cm', { timeout: 6000 }).catch(() => null);
  const rows = () => page.$$eval('#fe-tbody .fe-row', rs => rs.filter(r => r.offsetParent).map(r => r.dataset.name));
  const shown = await rows();
  check(!shown.includes('plan.md.bfb.json'), `the companion is hidden: ${shown.join(',')}`);
  const badge = await page.$eval('.fe-row[data-name="plan.md"]', r => ({ n: r.querySelector('.fe-row-cm')?.textContent.trim(), tip: r.querySelector('.fe-row-cm')?.title }));
  check(badge.n === '2' && badge.tip === '2 open comments', `plan.md shows its open comment count: ${JSON.stringify(badge)}`);
  const heights = await page.$$eval('#fe-tbody .fe-row', rs => [...new Set(rs.filter(r => r.offsetParent && !r.classList.contains('par')).map(r => Math.round(r.getBoundingClientRect().height)))]);
  check(heights.length === 1, `the row with the count is as tall as the others: ${heights}`);
  const count = await page.$eval('#fe-count', s => s.textContent);
  check(/· 2 hidden/.test(count), `the count names it among the hidden files: ${count}`);
  await page.screenshot({ path: join(SHOTS, `companion-row${sfx}.png`), clip: { x: 280, y: 90, width: 900, height: 420 } });
  await page.click('#fe-hidden-btn');
  check((await rows()).includes('plan.md.bfb.json'), 'the eye button shows the companion');
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'companion walk passes');
