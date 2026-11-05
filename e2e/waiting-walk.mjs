// Home's waiting list covers a missed reminder, a note an agent left and a capture nobody sorted, with
// older items fading after a week and a missed reminder never fading; the Search lens also finds saves.
// (Comment threads and decision pages come from the host and gcc: tests/waiting.test.ts and
// native/test_notes_host.py cover those.)
//
//   node e2e/waiting-walk.mjs      (generated scratch store; BFB_THEME=light for the light shots)
import { makeNotesStore } from './make-notes-store.mjs';
import { launch, shot, applyTheme } from './harness.mjs';
import { writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const store = join(tmpdir(), `bfb-waiting-walk-${process.pid}`);
makeNotesStore(store);
const hdr = (fields, body = 'body\n') => `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n${body}`;
writeFileSync(join(store, 'agent-new.md'), hdr({ title: '"From the agent"', created: '2026-10-30T10:00:00Z', agent: '"claude-1"' }));
writeFileSync(join(store, 'agent-old.md'), hdr({ title: '"Older agent note"', created: '2026-10-01T10:00:00Z', agent: '"claude-2"' }));
writeFileSync(join(store, 'rem-missed.md'), hdr({ title: '"Pay the invoice"', created: '2026-10-01T10:00:00Z', remind_at: '2026-10-02T09:00:00Z' }));
writeFileSync(join(store, 'capture.md'), hdr({ title: '"Shared article"', created: '2026-10-31T10:00:00Z', source: '"Share sheet"' }));

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DAY = 86400_000;

const h = await launch();
try {
  const page = await h.open();
  await h.store.edit('bfb-settings-v1', s => ({ ...s, showSidebar: true, notesRoot: store }));
  // A comment addressed to the owner, written by the real comments CLI into the harness's own docs home,
  // and a decision page waiting in the harness's own registry.
  const doc = join(realpathSync(h.fixture), 'review-me.md');
  writeFileSync(doc, '# Review me\n\nShip on Friday if the suite is green.\n');
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_') && !k.startsWith('BFB_'))), BFB_DOCS_HOME: h.docsHome };
  const made = spawnSync('python3', [join(ROOT, 'native', 'bfb_docs.py'), '--json', '--as', 'bfb', 'comments', 'new', doc, '--quote', 'Ship on Friday', 'Is Friday still right? @user'], { env, encoding: 'utf8' });
  check(made.status === 0, `a comment for the owner was written: ${made.status} ${made.stderr.slice(0, 120)}`);
  const pg = join(h.dpRegistry, 'pick-a-plan');
  mkdirSync(pg, { recursive: true });
  writeFileSync(join(pg, 'config.json'), JSON.stringify({ title: 'Pick a plan', decisions: [{ id: 'D1', question: 'Which?', options: [{ code: 'a', label: 'A', rec: true }] }] }));
  await h.store.set('bfb-waiting-seen-v1', { 'agent:agent-old.md': Date.now() - 8 * DAY, 'reminder:rem-missed.md': Date.now() - 30 * DAY });
  await h.store.set('bfb-saved-v1', [{ path: h.fixture + '/nested/', label: 'Roadmap ideas', tags: ['work'] }, { path: h.fixture + '/readme.md', label: 'Readme file' }]);
  await applyTheme(page);
  await page.goto('file://' + homedir() + '/#home', { waitUntil: 'load' });
  await page.waitForSelector('.fe-hp-card[data-card="waiting"] .fe-hp-wait', { timeout: 15_000 });
  await sleep(500);
  const rows = await page.$$eval('.fe-hp-card[data-card="waiting"] .fe-hp-wait', rs => rs.map(r => ({ kind: r.dataset.kind, faded: r.classList.contains('faded'), t: r.textContent.replace(/\s+/g, ' ').trim() })));
  check(rows.map(r => r.kind).join() === 'reminder,comment,capture,agent,agent', `the list reads missed reminder, comment, capture, agent notes: ${rows.map(r => r.kind)}`);
  check(rows[0].t.includes('Pay the invoice') && /Missed reminder/.test(rows[0].t) && !rows[0].faded, `a reminder missed 30 days ago is still shown and never fades: ${rows[0].t}`);
  check(rows[4].faded && rows[4].t.includes('Older agent note') && !rows[3].faded, `an agent note first seen 8 days ago fades and goes last: ${rows.map(r => r.faded)}`);
  check(rows[1].t.includes('review-me') && /1 open comment for you/.test(rows[1].t), `the comment row names the document and says how many comments wait: ${rows[1].t}`);
  const decide = await page.$$eval('.fe-hp-card[data-card="decide"] .fe-home-t', ts => ts.map(t => t.textContent));
  check(decide.join() === 'Pick a plan' && !rows.some(r => r.t.includes('Pick a plan')), `the decision is listed once, in Decisions: ${decide}`);
  check(await page.$eval('.fe-hp-card[data-card="waiting"] .fe-grp-n', e => e.textContent) === '5', 'the card counts the five it lists');
  await shot(page, 'waiting-home');
  const seen = await h.store.json('bfb-waiting-seen-v1', {});
  check(Object.keys(seen).sort().join() === `agent:agent-new.md,agent:agent-old.md,capture:capture.md,comment:${doc},decision:pick-a-plan,reminder:rem-missed.md` && seen['agent:agent-old.md'] < Date.now() - 7 * DAY, 'first-seen times are kept, so fading survives a reload');
  // The comment row opens the document it is about.
  const href = await page.$eval('.fe-hp-wait[data-kind="comment"] a', a => a.getAttribute('data-link'));
  check(href === doc, `the comment row points at the document: ${href}`);
  await page.goto(await page.$eval('.fe-hp-wait[data-kind="comment"] a', a => a.href), { waitUntil: 'load' });
  check(decodeURIComponent(page.url()).includes('review-me.md'), `and following it opens that document: ${decodeURIComponent(page.url()).slice(-40)}`);
  await page.goto('file://' + homedir() + '/#home', { waitUntil: 'load' });
  await page.waitForSelector('.fe-hp-card[data-card="waiting"] .fe-hp-wait');
  // A comment answered (done) leaves the list.
  const thread = JSON.parse(made.stdout).results[0].thread;
  spawnSync('python3', [join(ROOT, 'native', 'bfb_docs.py'), '--json', 'comments', 'done', doc, thread], { env, encoding: 'utf8' });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.fe-hp-card[data-card="waiting"] .fe-hp-wait');
  await sleep(500);
  const left = await page.$$eval('.fe-hp-card[data-card="waiting"] .fe-hp-wait', rs => rs.map(r => r.dataset.kind));
  check(!left.includes('comment') && left.includes('capture'), `once the comment is done its row goes and the rest stay: ${left}`);

  // Search reaches saves.
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe');
  await page.click('#fe-rail-search');
  await page.waitForSelector('#fe-srch-q');
  await page.type('#fe-srch-q', 'roadmap');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.fe-srch-save'), { timeout: 10_000 }).catch(() => null);
  const save = await page.$eval('.fe-srch-save .fe-sl', e => e.textContent).catch(() => null);
  const status = await page.$eval('#fe-srch-status', e => e.textContent);
  check(save === 'Roadmap ideas' && /also 1 saved/.test(status), `Search lists a matching save after the files: ${save} / ${status}`);
  await shot(page, 'waiting-search');
} finally {
  await h.close();
}
if (fails.length) { console.error(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
