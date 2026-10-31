// Home's Local tools card: each tool shows running or stopped, the end button
// stops a running one, and clicking a stopped one starts it and opens it in a
// new tab. This walk drives the real ghostty-settings pm2 service on this Mac
// (the tool stops itself when idle, so starting it is harmless) and leaves it
// stopped at the end.
//
//   node e2e/tools-card-walk.mjs      (BFB_THEME=light for the light theme)
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { launch, shot, applyTheme } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const HOME = homedir();
const row = '.fe-hp-card[data-card="tools"] [data-tool="ghostty-settings"]';
const state = tab => tab.$eval(row, a => ({ up: a.dataset.up === '1', tag: a.querySelector('.fe-hp-link-tags i')?.textContent }));
const pm2 = (...args) => execFileSync('pm2', [...args, '-s'], { stdio: 'ignore' });

pm2('start', 'ghostty-settings');
const h = await launch();
try {
  await h.store.set('bfb-home-v1', HOME);
  const tab = await h.browser.newPage();
  await tab.setViewport({ width: 1400, height: 900 });
  await tab.goto('file://' + HOME + '/#home', { waitUntil: 'load' });
  await applyTheme(tab);
  await tab.waitForSelector(row, { timeout: 15000 });
  await tab.waitForFunction(r => document.querySelector(r)?.dataset.up === '1', { timeout: 10000 }, row).catch(() => null);
  let s = await state(tab);
  check(s.up && s.tag === 'running', `a running tool says so: ${JSON.stringify(s)}`);
  const card = await tab.$('.fe-hp-card[data-card="tools"]');
  await card.scrollIntoView();
  await tab.hover(row);
  await shot(tab, 'home-tools-running');

  await tab.click('.fe-hp-card[data-card="tools"] [data-tool-stop="ghostty-settings"]');
  await tab.waitForFunction(r => document.querySelector(r)?.dataset.up === '', { timeout: 15000 }, row).catch(() => null);
  s = await state(tab);
  check(!s.up && s.tag === 'stopped', `the stop button stops it: ${JSON.stringify(s)}`);
  check(!await tab.$('.fe-hp-card[data-card="tools"] [data-tool-stop]'), 'a stopped tool has no stop button');
  await (await tab.$('.fe-hp-card[data-card="tools"]')).scrollIntoView();
  await shot(tab, 'home-tools-stopped');

  const opened = new Promise(res => h.browser.once('targetcreated', t => res(t.url())));
  await tab.click(row);
  const url = await Promise.race([opened, new Promise(res => setTimeout(() => res(''), 15000))]);
  check(/^http:\/\/127\.0\.0\.1:5124\//.test(url), `clicking a stopped tool starts it and opens it in a new tab: ${url}`);
  await tab.waitForFunction(r => document.querySelector(r)?.dataset.up === '1', { timeout: 15000 }, row).catch(() => null);
  s = await state(tab);
  check(s.up && s.tag === 'running', `after starting, the row says running: ${JSON.stringify(s)}`);
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  pm2('stop', 'ghostty-settings');
  console.log(results.join('\n'));
}
