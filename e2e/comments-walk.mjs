// Comments on a markdown file page: threads written from the terminal show in
// the rail's Comments tab, grouped as open, moved, detached and done; the
// commented words are highlighted and their block shows a count; clicking a
// thread marks its words; a reply from the terminal arrives within a few
// seconds, with the editor closed and open.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { launch, SHOTS, THEME } from './harness.mjs';

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
try {
  const doc = join(h.fixture, 'review.md');
  const text = `# Release review

## Timing

We agreed to ship on **Friday** after the [smoke run](notes.txt), unless the suite is red.

The lens rail landed yesterday and looks good.

## Risks

Parsing large files could still be slow on old machines.

This sentence will be removed before the page opens.
`;
  writeFileSync(doc, text);
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture] }));
  await h.store.set(THEME === 'light' ? 'bfb-theme' : 'bfb-theme', THEME);
  const a = cli('--as', 'bfb', 'comments', 'new', doc, '--quote', 'ship on **Friday** after the [smoke run](notes.txt)', 'Is Friday still realistic? @user #schedule').results[0].thread;
  const b = cli('comments', 'new', doc, '--quote', 'The lens rail landed yesterday', 'Nice work.').results[0].thread;
  cli('comments', 'done', doc, b);
  const c = cli('comments', 'new', doc, '--quote', 'Parsing large files could still be slow', 'How slow? @due 2026-10-30').results[0].thread;
  cli('comments', 'new', doc, '--quote', 'This sentence will be removed', 'Remove this?');
  writeFileSync(doc, text.replace('Parsing large files could still be slow', 'Parsing very large files could be slow').replace('This sentence will be removed before the page opens.\n', ''));

  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-cm');
  await page.click('#fe-fp-cm');
  await page.waitForSelector('#fe-cm .fe-cm-th', { timeout: 8000 }).catch(() => null);
  const panel = await page.evaluate(() => ({
    shown: !document.getElementById('fe-toc-rail').hidden && document.getElementById('fe-toc-rail').dataset.tab === 'cm',
    open: document.querySelectorAll('#fe-cm .fe-cm-list > .fe-cm-th').length,
    groups: [...document.querySelectorAll('#fe-cm .fe-cm-group')].map(g => g.textContent.replace(/\s+/g, ' ').trim()),
    badge: document.getElementById('fe-fp-cm-n').textContent,
    authors: [...document.querySelectorAll('#fe-cm .fe-cm-who b')].map(b => b.textContent.trim()),
    chips: [...document.querySelectorAll('#fe-cm .fe-cm-chip')].map(x => x.textContent.trim()),
  }));
  check(panel.shown && panel.open === 3 && panel.badge === '3', `the Comments tab lists open threads and the button counts them: ${JSON.stringify(panel)}`);
  check(panel.groups.join('|') === 'Moved 1|Detached 1|Done 1', `moved, detached and done threads have their own groups: ${panel.groups.join(' | ')}`);
  check(panel.authors.includes('bfb') && panel.authors.includes('You') && panel.chips.includes('#schedule') && panel.chips.some(x => /Oct 30/.test(x)),
    `authors, tags and the due date show: ${panel.authors.join(',')} ${panel.chips.join(',')}`);

  const marks = await page.evaluate(() => ({
    hl: CSS.highlights.get('bfb-cm')?.size ?? 0,
    counts: [...document.querySelectorAll('#fe-page [data-cm]')].map(b => b.dataset.cm),
  }));
  check(marks.hl === 2 && marks.counts.length === 2, `the open and the moved thread are highlighted, each block counted: ${JSON.stringify(marks)}`);
  await page.click(`#fe-cm .fe-cm-th[data-id="${a}"]`);
  const on = await page.evaluate(() => { const r = [...(CSS.highlights.get('bfb-cm-on') ?? [])][0]; return r ? r.toString() : null; });
  check(on === 'ship on Friday after the smoke run', `clicking a thread marks exactly its words on the page: ${JSON.stringify(on)}`);
  await page.screenshot({ path: join(SHOTS, `comments-panel${THEME === 'light' ? '-light' : ''}.png`) });

  // A click on the commented words opens the thread.
  await page.click(`#fe-cm .fe-cm-filters [data-f="all"]`);
  const cRange = await page.evaluate(id => {
    const r = [...CSS.highlights.get('bfb-cm')].find(x => x.toString().includes('large files'));
    const b = r.getBoundingClientRect();
    return { x: b.left + 10, y: b.top + b.height / 2 };
  }, c);
  await page.mouse.click(cRange.x, cRange.y);
  const opened = await page.$eval('#fe-cm .fe-cm-th.on', el => el.dataset.id).catch(() => null);
  check(opened === c, `clicking highlighted words opens their thread: ${opened === c}`);

  // A reply from the terminal shows without a reload.
  cli('--as', 'bfb', 'comments', 'reply', doc, a, 'Thursday is safer.');
  await page.waitForFunction(() => document.getElementById('fe-cm').textContent.includes('Thursday is safer'), { timeout: 6000 }).catch(() => null);
  const live = await page.evaluate(() => ({ shown: document.getElementById('fe-cm').textContent.includes('Thursday is safer'), status: document.getElementById('fe-status-text')?.textContent }));
  check(live.shown && /New reply from bfb/.test(live.status || ''), `a terminal reply appears within seconds and the status says who: ${JSON.stringify(live)}`);

  // While editing, the panel stays and still updates.
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-fe-ta', { timeout: 6000 });
  cli('--as', 'bfb', 'comments', 'reply', doc, c, 'Measured: 2 s for 100k lines.');
  await page.waitForFunction(() => document.getElementById('fe-cm').textContent.includes('Measured: 2 s'), { timeout: 6000 }).catch(() => null);
  const editing = await page.evaluate(() => ({ rail: !document.getElementById('fe-toc-rail').hidden, got: document.getElementById('fe-cm').textContent.includes('Measured: 2 s') }));
  check(editing.rail && editing.got, `with the editor open the panel stays and a reply still arrives: ${JSON.stringify(editing)}`);
  await page.screenshot({ path: join(SHOTS, `comments-editing${THEME === 'light' ? '-light' : ''}.png`) });
  await page.click('#fe-fe-pill [data-act="done"]');
  await sleep(500);

  // Contents is still one tab away and works.
  const toc = await page.evaluate(() => { document.getElementById('fe-fp-toc').click(); return { links: document.querySelectorAll('#fe-toc a').length, cmHidden: document.getElementById('fe-cm').hidden }; });
  check(toc.links === 3 && toc.cmHidden, `Contents is the other tab and still lists the headings: ${JSON.stringify(toc)}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'comments walk passes');
