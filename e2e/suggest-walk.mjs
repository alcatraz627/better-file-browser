// Suggested edits on a markdown file page: an agent suggests new words from
// the terminal, the page shows the change as a small diff, Accept replaces
// only those words in the file (keeping a backup) and closes the thread,
// Reject leaves the file alone, a file changed on disk is refused, and a
// suggestion whose words are gone cannot be accepted.
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { launch, SHOTS, THEME } from './harness.mjs';

const CLI = resolve(new URL('..', import.meta.url).pathname, 'native', 'bfb_docs.py');
const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sfx = THEME === 'light' ? '-light' : '';
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_') && !k.startsWith('BFB_'))), BFB_DOCS_HOME: h.docsHome };
const cli = (...args) => {
  const r = spawnSync('python3', [CLI, '--json', ...args], { env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`bfb-docs ${args.join(' ')}: ${r.stderr}`);
  return JSON.parse(r.stdout);
};
const threadOf = (doc, id) => cli('comments', 'list', doc, '--all').find(t => t.id === id);
try {
  const doc = join(h.fixture, 'suggest.md');
  const text = `# Plan

We ship on Friday after the smoke run.

The lens rail could slip by a week.

Old wording that will vanish.

Drop this sentence entirely.
`;
  writeFileSync(doc, text);
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture] }));
  await h.store.set('bfb-theme', THEME);
  const take = cli('--as', 'bfb', 'comments', 'suggest', doc, '--quote', 'could slip by a week', '--replace', 'might slip a few days', 'softer').results[0].thread;
  const keep = cli('--as', 'bfb', 'comments', 'suggest', doc, '--quote', 'after the smoke run', '--replace', 'once the suite is green', 'clearer').results[0].thread;
  const gone = cli('--as', 'bfb', 'comments', 'suggest', doc, '--quote', 'Old wording that will vanish', '--replace', 'New wording', 'reword').results[0].thread;
  const drop = cli('--as', 'bfb', 'comments', 'suggest', doc, '--quote', 'Drop this sentence entirely.', '--replace', '', 'cut it').results[0].thread;
  writeFileSync(doc, text.replace('Old wording that will vanish.\n', ''));

  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-cm');
  await page.click('#fe-fp-cm');
  await page.waitForSelector(`#fe-cm .fe-cm-th[data-id="${take}"]`, { timeout: 8000 });
  const pick = async id => { await page.click(`#fe-cm .fe-cm-th[data-id="${id}"] .fe-cm-q`); await page.waitForSelector(`#fe-cm .fe-cm-th.on[data-id="${id}"] [data-a="accept"]`, { timeout: 3000 }); await sleep(250); };

  await pick(take);
  const diff = await page.$eval(`#fe-cm .fe-cm-th[data-id="${take}"] .fe-cm-diff`, d => ({ del: d.querySelector('del')?.textContent, ins: d.querySelector('ins')?.textContent }));
  check(diff.del === 'could slip by a week' && diff.ins === 'might slip a few days', `the suggestion shows as a diff of the words now and the new words: ${JSON.stringify(diff)}`);
  await page.screenshot({ path: join(SHOTS, `suggest-pending${sfx}.png`), clip: { x: 900, y: 40, width: 500, height: 520 } });

  // A file changed on disk since the page loaded it is refused, and nothing changes.
  const changed = text.replace('# Plan', '# Plan, edited elsewhere').replace('Old wording that will vanish.\n', '');
  writeFileSync(doc, changed);
  await page.click(`#fe-cm .fe-cm-th[data-id="${take}"] [data-a="accept"]`);
  await sleep(800);
  const refused = await page.$eval('#fe-status-text', s => s.textContent).catch(() => '');
  check(readFileSync(doc, 'utf8') === changed && threadOf(doc, take).comments.some(c => c.suggestion?.state === 'pending'),
    `accepting after the file changed on disk changes nothing: "${refused}"`);
  // Put the file back as the page knows it; the page's autoreload may also have caught up.
  writeFileSync(doc, text.replace('Old wording that will vanish.\n', ''));
  await page.goto('file://' + doc + '#comments', { waitUntil: 'load' });
  await page.waitForSelector(`#fe-cm .fe-cm-th[data-id="${take}"]`, { timeout: 8000 });
  await sleep(1200);   // #comments opens the first open thread once loaded; let that land first
  await pick(take);

  const before = readFileSync(doc, 'utf8');
  await page.click(`#fe-cm .fe-cm-th[data-id="${take}"] [data-a="accept"]`);
  await page.waitForFunction(id => !document.querySelector(`#fe-cm .fe-cm-list > .fe-cm-th[data-id="${id}"] [data-a="accept"]`), { timeout: 5000 }, take).catch(() => null);
  await sleep(500);
  const after = readFileSync(doc, 'utf8');
  check(after === before.replace('could slip by a week', 'might slip a few days'), 'Accept replaces only the suggested words and leaves the rest of the file byte for byte');
  const tk = threadOf(doc, take);
  check(tk.status === 'done' && tk.comments.some(c => c.suggestion?.state === 'accepted') && tk.place.state === 'anchored', `the suggestion is marked accepted, the thread is done and sits on the new words: ${tk.status} ${tk.place.state}`);
  const decided = await page.$eval(`#fe-cm .fe-cm-th[data-id="${take}"] .fe-cm-diff`, d => ({ del: d.querySelector('del')?.textContent, ins: d.querySelector('ins')?.textContent })).catch(() => null);
  check(decided?.del === 'could slip by a week' && decided?.ins === 'might slip a few days', `an accepted suggestion still shows what it replaced: ${JSON.stringify(decided)}`);
  const one = (await page.$$eval(`#fe-cm .fe-cm-th[data-id="${keep}"] .fe-cm-c`, cs => cs.length));
  check(one === 1, `a suggestion opened from the terminal reads as one comment: ${one}`);
  const pageText = await page.$eval('#fe-page', p => p.textContent);
  check(pageText.includes('might slip a few days'), 'the page shows the new words straight away');

  await pick(keep);
  await page.click(`#fe-cm .fe-cm-th[data-id="${keep}"] [data-a="reject"]`);
  await sleep(800);
  const kp = threadOf(doc, keep);
  check(readFileSync(doc, 'utf8') === after && kp.comments.some(c => c.suggestion?.state === 'rejected'), 'Reject records the decision and leaves the file alone');
  const shownState = await page.$eval(`#fe-cm .fe-cm-th[data-id="${keep}"] .fe-cm-sug-state`, s => s.textContent.trim()).catch(() => '');
  check(shownState === 'Rejected', `a decided suggestion says so: "${shownState}"`);

  // An accepted deletion reads as done, not as a lost comment.
  await pick(drop);
  await page.click(`#fe-cm .fe-cm-th[data-id="${drop}"] [data-a="accept"]`);
  await sleep(900);
  await page.click(`#fe-cm [data-f="all"]`).catch(() => {});
  await sleep(300);
  await page.click(`#fe-cm .fe-cm-th[data-id="${drop}"] .fe-cm-q`).catch(() => {});
  await sleep(300);
  const dropped = await page.$eval(`#fe-cm .fe-cm-th[data-id="${drop}"]`, t => ({ text: t.textContent, attach: !!t.querySelector('[data-a="attach"]') })).catch(() => null);
  check(!readFileSync(doc, 'utf8').includes('Drop this sentence') && dropped && !/No longer in the file/.test(dropped.text) && !dropped.attach && /removed/.test(dropped.text),
    `an accepted deletion removes the words and reads as done, with no detached warning: ${dropped && dropped.text.replace(/\s+/g, ' ').slice(0, 160)}`);

  // The detached one: Accept is there but disabled.
  await page.click(`#fe-cm [data-f="all"]`).catch(() => {});
  await page.click(`#fe-cm .fe-cm-th[data-id="${gone}"] .fe-cm-q`);
  await sleep(300);
  const goneBtn = await page.$eval(`#fe-cm .fe-cm-th[data-id="${gone}"] [data-a="accept"]`, b => b.disabled).catch(() => null);
  check(goneBtn === true, 'a suggestion whose words are gone cannot be accepted');
  await page.screenshot({ path: join(SHOTS, `suggest-decided${sfx}.png`), clip: { x: 900, y: 40, width: 500, height: 620 } });
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.length && results.every(r => !r.startsWith('FAIL')), 'suggest walk passes');
