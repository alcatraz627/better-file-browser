// New tabs and Home: Settings has a switch that sends every new Chrome tab to
// Home, off by default, and shows Home's address to copy into Chrome's own
// start-up or Home button setting. The home folder's listing is only read.
//
//   node e2e/newtab-home-walk.mjs      (BFB_THEME=light for the light theme)
import { homedir } from 'node:os';
import { launch, shot, applyTheme } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOME = homedir();
const homeUrl = 'file://' + HOME.split('/').map(encodeURIComponent).join('/') + '/#home';
const h = await launch();
try {
  await h.store.set('bfb-home-v1', HOME);
  const page = await h.open();
  await applyTheme(page);
  page.setDefaultTimeout(10_000);

  const openFolders = async () => {
    await page.click('#fe-settings-btn');
    await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="folders"]');
    await page.waitForSelector('#fe-st-newtab-home');
    await sleep(250);
  };
  await openFolders();
  const row = await page.evaluate(() => ({
    on: document.getElementById('fe-st-newtab-home').checked,
    url: document.getElementById('fe-st-home-url').value,
    copy: !!document.getElementById('fe-st-home-copy'),
  }));
  check(!row.on, 'the switch starts off');
  check(row.url === homeUrl, `the Home address is shown: ${row.url}`);
  check(row.copy, 'a copy button sits beside the address');
  await page.$eval('#fe-st-newtab-home', el => el.closest('.fe-set').scrollIntoView({ block: 'center' }));
  await sleep(150);
  await shot(page, 'newtab-home-settings');

  // A new tab made the way Ctrl+T makes one: at chrome://newtab/.
  const newTab = async () => {
    const id = await h.sw.evaluate(() => chrome.tabs.create({ url: 'chrome://newtab/' }).then(t => t.id));
    await sleep(1500);
    return h.sw.evaluate(i => chrome.tabs.get(i).then(t => t.pendingUrl || t.url), id);
  };
  const offUrl = await newTab();
  check(/^chrome:\/\/new/.test(offUrl), `switch off: a new tab stays Chrome's (${offUrl})`);

  await page.bringToFront();
  await page.$eval('#fe-st-newtab-home', el => el.click());
  await sleep(300);
  const stored = await h.store.json('bfb-settings-v1', {});
  check(stored.newTabHome === true, 'turning it on is kept in settings');
  const onUrl = await newTab();
  check(onUrl === homeUrl, `switch on: a new tab opens Home (${onUrl})`);

  await page.bringToFront();
  await page.$eval('#fe-st-newtab-home', el => el.click());
  await sleep(300);
  check((await h.store.json('bfb-settings-v1', {})).newTabHome === false, 'turning it off is kept too');
  const backUrl = await newTab();
  check(/^chrome:\/\/new/.test(backUrl), `switch off again: Chrome's page again (${backUrl})`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
