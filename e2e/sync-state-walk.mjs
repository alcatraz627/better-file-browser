// Every note surface says how its copy stands: the Notes lens and the Home Notes card read the
// state file Switchboard writes (<repo>/.git/mnt-sync-state.json) through the host and say, in plain
// words, whether notes are reaching other devices, how far behind, what is wrong, that sync is not
// running once the report is over ten minutes old, and that a folder in no repo stays on this Mac.
//
//   node e2e/sync-state-walk.mjs      (a generated scratch store; BFB_THEME=light for the light shots)
import { makeNotesStore } from './make-notes-store.mjs';
import { launch, shot, applyTheme } from './harness.mjs';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

const store = join(tmpdir(), `bfb-syncstate-walk-${process.pid}`);
makeNotesStore(store);
const stateFile = join(store, '.git', 'mnt-sync-state.json');
const loose = join(tmpdir(), `bfb-syncstate-loose-${process.pid}`);
rmSync(loose, { recursive: true, force: true });
mkdirSync(loose, { recursive: true });
writeFileSync(join(loose, 'one.md'), '# one\n');

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const iso = ago => new Date(Date.now() - ago * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const report = (over = {}, ago = 30) => writeFileSync(stateFile, JSON.stringify({ at: iso(ago), ok: true, problem: null, ahead: 0, behind: 0, clashes: 0, cameBack: [], lastOk: iso(ago), ...over }));

const h = await launch();
try {
  const page = await h.open();
  await h.store.set('bfb-lens-v1', 'notes');
  const setRoot = async root => h.store.edit('bfb-settings-v1', s => ({ ...s, showSidebar: true, tooltips: true, notesRoot: root }));
  await setRoot(store);
  await applyTheme(page);
  const line = async () => {
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 10_000 }).catch(() => null);
    await page.waitForFunction(() => !document.getElementById('fe-nt-where').hidden && document.getElementById('fe-nt-where').textContent.length > 3, { timeout: 8000 }).catch(() => null);
    return page.$eval('#fe-nt-where', e => ({ text: e.textContent, state: e.dataset.state, hidden: e.hidden }));
  };

  let l = await line();
  check(l.state === 'off' && /^Sync is not running: Switchboard has not reported/.test(l.text), `no state file reads as not running: ${l.text}`);
  check(/1 note holds two versions here/.test(l.text), 'a clash note in the folder is counted even when the state file says nothing');
  await shot(page, 'sync-state-notrunning');

  report();
  l = await line();
  check(/Synced less than a minute ago\./.test(l.text), `a fresh clean report reads as synced: ${l.text}`);

  report({ ahead: 2 });
  l = await line();
  check(/2 changes here have not been sent yet/.test(l.text) && l.state === 'waiting', `ahead says what has not been sent: ${l.text}`);

  report({ behind: 3 });
  l = await line();
  check(/3 changes from other devices are waiting here/.test(l.text), `behind says how far: ${l.text}`);

  report({ ok: false, problem: 'GitHub refused the push' });
  l = await line();
  check(/^Sync has a problem: GitHub refused the push\./.test(l.text) && l.state === 'trouble', `a failed round names the problem: ${l.text}`);
  await shot(page, 'sync-state-problem');

  report({ clashes: 2, cameBack: ['20261101-100000-ab12'] });
  l = await line();
  check(/2 notes hold two versions, so settle them; 1 deleted note came back/.test(l.text), `clashes and came-back are named: ${l.text}`);

  report({}, 15 * 60);
  l = await line();
  check(l.state === 'off' && /^Sync is not running\. Its last report was 15 minutes ago/.test(l.text), `a report over ten minutes old is "sync is not running": ${l.text}`);
  report({}, 9 * 60);
  l = await line();
  check(l.state === 'ok', `nine minutes old still counts as fresh: ${l.text}`);

  report({ ahead: 1 });
  await page.goto('file://' + homedir() + '/#home', { waitUntil: 'load' });
  await page.waitForSelector('.fe-hp-card[data-card="notes"]', { timeout: 15_000 });
  await page.waitForFunction(() => /not been sent yet/.test(document.querySelector('.fe-hp-card[data-card="notes"] .fe-hp-card-tx span')?.textContent ?? ''), { timeout: 10_000 }).catch(() => null);
  const home = await page.$eval('.fe-hp-card[data-card="notes"] .fe-hp-card-tx span', e => e.textContent);
  check(/1 change here has not been sent yet/.test(home), `the Home Notes card carries the same line: ${home}`);
  await shot(page, 'sync-state-home');

  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await setRoot(loose);
  l = await line();
  check(l.state === 'off' && /Stays on this Mac/.test(l.text), `a folder in no repo says it stays on this Mac: ${l.text}`);
  await shot(page, 'sync-state-norepo');
} finally {
  await h.close();
  rmSync(loose, { recursive: true, force: true });
}
if (fails.length) { console.error(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
