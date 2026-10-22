// The command palette's tabs: every entry has an icon, Tab and Shift+Tab walk
// the tabs that have entries, and each tab lists only its own kind.
//   node e2e/palette-tabs-walk.mjs   → e2e/shots/palette-tabs-{dark,light}.png
import { launch } from './harness.mjs';

let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  const page = await h.open();
  await page.keyboard.press('t');          // keep this folder as a tab
  await page.keyboard.press('b');          // and save it
  await sleep(200);
  const open = async () => { await page.keyboard.down('Meta'); await page.keyboard.press('k'); await page.keyboard.up('Meta'); await page.waitForSelector('.fe-pal input'); await sleep(150); };
  await open();
  const tabs = await page.$$eval('.fe-pal-tab', ts => ts.map(t => ({ id: t.dataset.tab, empty: t.classList.contains('is-empty'), on: t.classList.contains('on') })));
  check(tabs.length === 9 && tabs[0].id === 'all' && tabs[0].on, `nine tabs, All first and on: ${tabs.map(t => t.id + (t.empty ? '(empty)' : '')).join(' ')}`);
  const noIcon = await page.$$eval('.fe-pal-i', rows => rows.filter(r => !r.querySelector('svg')).map(r => r.textContent));
  check(noIcon.length === 0, `every entry has an icon (${noIcon.length} without: ${noIcon.slice(0, 3).join(' | ')})`);
  for (const theme of ['dark', 'light']) {
    await page.evaluate(t => { document.getElementById('fe').dataset.theme = t; }, theme);
    await sleep(100);
    await page.screenshot({ path: new URL(`./shots/palette-tabs-${theme}.png`, import.meta.url).pathname });
  }
  await page.keyboard.press('Tab');
  const second = await page.$eval('.fe-pal-tab.on', t => t.dataset.tab);
  check(second === 'actions', `Tab moves to the next tab: ${second}`);
  // Walk forward to Saved, skipping empty tabs.
  let at = second;
  for (let i = 0; i < 9 && at !== 'saved'; i++) { await page.keyboard.press('Tab'); at = await page.$eval('.fe-pal-tab.on', t => t.dataset.tab); }
  const savedRows = await page.$$eval('.fe-pal-i', rows => rows.map(r => r.dataset.tab));
  check(at === 'saved' && savedRows.length > 0 && savedRows.every(t => t === 'saved'), `the Saved tab lists only saved places: ${savedRows.length}`);
  await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
  const back = await page.$eval('.fe-pal-tab.on', t => t.dataset.tab);
  check(back === 'tabs', `Shift+Tab goes back one tab: ${back}`);
  await page.click('.fe-pal-tab[data-tab="all"]');
  await page.keyboard.type('saved');
  const typedAll = await page.$$eval('.fe-pal-i', rows => [...new Set(rows.map(r => r.dataset.tab))]);
  check(typedAll.length > 1, `typing in All matches across kinds: ${typedAll.join(',')}`);
  // Keys the listing answers itself are in the palette too.
  const find = async want => {
    await page.$eval('.fe-pal input', i => { i.value = ''; });
    await page.keyboard.type(want.toLowerCase());
    return page.$eval('.fe-pal-i .fe-pal-t', t => t.textContent).catch(() => '');
  };
  for (const want of ['Parent folder', 'Select all']) { const top = await find(want); check(top === want, `typing "${want.toLowerCase()}" finds ${want}: ${top}`); }
  const noLead = await find('Preview');
  check(noLead !== 'Preview', `Preview is not offered with nothing selected: ${noLead || 'none'}`);
  await page.keyboard.press('Escape');
  // With a file selected, Preview is offered and runs.
  await page.keyboard.press('End');
  await open();
  const withLead = await find('Preview');
  check(withLead === 'Preview', `with a file selected, typing "preview" finds Preview: ${withLead}`);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('fe-qlook')?.style.display === 'flex', { timeout: 3000 }).catch(() => null);
  check(await page.$eval('#fe-qlook', q => q.style.display === 'flex'), 'running Preview from the palette opens the preview');
  await page.keyboard.press('Escape');
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
