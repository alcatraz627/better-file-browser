// Home's waiting list covers a missed reminder, a note an agent left and a capture nobody sorted, with
// older items fading after a week and a missed reminder never fading; the Search lens also finds saves.
// (Comment threads and decision pages come from the host and gcc: tests/waiting.test.ts and
// native/test_notes_host.py cover those.)
//
//   node e2e/waiting-walk.mjs      (generated scratch store; BFB_THEME=light for the light shots)
import { makeNotesStore } from './make-notes-store.mjs';
import { launch, shot, applyTheme } from './harness.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

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
  await h.store.set('bfb-waiting-seen-v1', { 'agent:agent-old.md': Date.now() - 8 * DAY, 'reminder:rem-missed.md': Date.now() - 30 * DAY });
  await h.store.set('bfb-saved-v1', [{ path: h.fixture + '/nested/', label: 'Roadmap ideas', tags: ['work'] }, { path: h.fixture + '/readme.md', label: 'Readme file' }]);
  await applyTheme(page);
  await page.goto('file://' + homedir() + '/#home', { waitUntil: 'load' });
  await page.waitForSelector('.fe-hp-card[data-card="waiting"] .fe-hp-wait', { timeout: 15_000 });
  await sleep(500);
  const rows = await page.$$eval('.fe-hp-card[data-card="waiting"] .fe-hp-wait', rs => rs.map(r => ({ kind: r.dataset.kind, faded: r.classList.contains('faded'), t: r.textContent.replace(/\s+/g, ' ').trim() })));
  check(rows.map(r => r.kind).join() === 'reminder,capture,agent,agent', `the list reads missed reminder, capture, agent notes: ${rows.map(r => r.kind)}`);
  check(rows[0].t.includes('Pay the invoice') && /Missed reminder/.test(rows[0].t) && !rows[0].faded, `a reminder missed 30 days ago is still shown and never fades: ${rows[0].t}`);
  check(rows[3].faded && rows[3].t.includes('Older agent note') && !rows[2].faded, `an agent note first seen 8 days ago fades and goes last: ${rows.map(r => r.faded)}`);
  check(await page.$eval('.fe-hp-card[data-card="waiting"] .fe-grp-n', e => e.textContent) === '4', 'the card counts all four');
  await shot(page, 'waiting-home');
  const seen = await h.store.json('bfb-waiting-seen-v1', {});
  check(Object.keys(seen).sort().join() === 'agent:agent-new.md,agent:agent-old.md,capture:capture.md,reminder:rem-missed.md' && seen['agent:agent-old.md'] < Date.now() - 7 * DAY, 'first-seen times are kept, so fading survives a reload');

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
