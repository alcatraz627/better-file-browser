// A local service's tab in front, with you at the machine, tells svc a person is
// using it. The same tab in the background, or with you away, does not. Runs a
// throwaway web server and leaves nothing behind. Whether you are at the machine is
// set by the walk, so it gives the same answer whoever is at the keyboard. Takes
// about a minute and a half, because the first check waits for the real alarm.
//
//   node e2e/svc-seen-walk.mjs
import { spawn } from 'node:child_process';
import { statSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const PORT = 6277;
const TOUCH = join(homedir(), '.claude/dev-servers/svc-touch', String(PORT));
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const seenAt = () => { try { return statSync(TOUCH).mtimeMs; } catch { return 0; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

rmSync(TOUCH, { force: true });
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { stdio: 'ignore' });
const h = await launch();
try {
  await sleep(1000);
  const target = await h.browser.waitForTarget(t => t.type() === 'service_worker' && t.url().includes('/background.js'));
  const worker = await target.worker();
  const presence = state => worker.evaluate(s => { chrome.idle.queryState = async () => s; }, state);
  const report = async () => { await worker.evaluate(() => reportActiveService()); await sleep(1500); };

  const svc = await h.browser.newPage();
  await svc.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await svc.bringToFront();

  await presence('idle');
  await report();
  check(seenAt() === 0, 'with you away, a service tab in front is not reported');

  await presence('active');
  // The alarm fires once a minute, so 75 seconds always spans a firing.
  await sleep(75000);
  check(seenAt() > 0, 'with you here, the alarm reports the tab in front');

  const other = await h.browser.newPage();
  await other.goto('about:blank');
  await other.bringToFront();
  const before = seenAt();
  await report();
  check(seenAt() === before, 'the same tab in the background is not reported');

  await svc.bringToFront();
  await report();
  check(seenAt() > before, 'back in front, it is reported again');
} finally {
  await h.browser.close();
  server.kill();
  rmSync(TOUCH, { force: true });
}
console.log(results.join('\n'));
