// Adversarial probe 3: why Back rebuilds the page (back/forward cache
// blockers), where scroll goes on Back and on a strip tab switch, and the
// caret after a sidebar toggle in the tab editor.
//
//   node e2e/adv-jank-probe3.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch({ lmStub: true });
const out = [];
const log = s => { out.push(s); console.log(s); };

try {
  const F = 'file://' + h.fixture;
  const big = join(h.fixture, 'big');
  mkdirSync(big, { recursive: true });
  for (let i = 0; i < 200; i++) writeFileSync(join(big, `f${String(i).padStart(3, '0')}.txt`), 'x');
  await h.store.set('bfb-settings-v1', { showSidebar: true, notesRoot: h.notesDir });
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  const cdp = await page.createCDPSession();
  await cdp.send('Page.enable');
  const notUsed = [];
  cdp.on('Page.backForwardCacheNotUsed', e => notUsed.push(e));

  await page.goto(F + '/big/', { waitUntil: 'load' });
  await sleep(800);
  await page.goto(F + '/notes.txt', { waitUntil: 'load' });
  await sleep(800);
  await page.goBack({ waitUntil: 'load' });
  await sleep(1000);
  log('## bfcache not used on Back:');
  for (const e of notUsed) {
    log('  reasons: ' + e.notRestoredExplanations.map(x => `${x.type}:${x.reason}${x.context ? '(' + x.context + ')' : ''}`).join(', '));
  }
  if (!notUsed.length) log('  (no event: restored from bfcache, or event not sent)');

  // Strip tab switch: scroll a long folder, open another place as a tab, come back by its tab.
  await page.evaluate(() => { document.querySelector('#fe-scroll').scrollTop = 1800; });
  await sleep(300);
  const tabsBefore = await page.$$eval('#fe-tabs > *', t => t.map(x => x.textContent.trim().slice(0, 20)));
  log(`## strip tabs: ${JSON.stringify(tabsBefore)}`);
  const clicked = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('#fe-tabs > *')];
    const other = tabs.find(t => !/big/.test(t.textContent));
    if (!other) return false;
    (other.querySelector('a,button') || other).click();
    return other.textContent.trim().slice(0, 20);
  });
  log(`## switched to tab: ${clicked}`);
  await sleep(1500);
  await page.evaluate(() => { const t = [...document.querySelectorAll('#fe-tabs > *')].find(t => /big/.test(t.textContent)); (t?.querySelector('a,button') || t)?.click(); });
  await sleep(1500);
  log(`## back on the big tab: url=${page.url().split('/').slice(-2).join('/')} scrollTop=${await page.evaluate(() => document.querySelector('#fe-scroll')?.scrollTop)}`);

  // Selection survives Back? Select a row, go into a file, come back.
  await page.evaluate(() => { document.querySelector('#fe-scroll').scrollTop = 0; });
  await page.click('#fe-tbody tr:nth-child(5)');
  const sel = await page.evaluate(() => document.querySelector('#fe-tbody tr.selected, #fe-tbody tr[aria-selected="true"]')?.textContent.trim().slice(0, 12));
  await page.goto(F + '/notes.txt', { waitUntil: 'load' });
  await sleep(500);
  await page.goBack({ waitUntil: 'load' });
  await sleep(1000);
  const selAfter = await page.evaluate(() => document.querySelector('#fe-tbody tr.selected, #fe-tbody tr[aria-selected="true"]')?.textContent.trim().slice(0, 12) ?? null);
  log(`## selection on Back: before=${sel} after=${selAfter}`);
} finally {
  writeFileSync('/tmp/adv-jank/probe3.txt', out.join('\n'));
  await h.close();
}
