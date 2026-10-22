// Keyboard journeys (docs/plan/component-system.md, section 18), driven by
// keys alone. Each step says which key did it.
//   node e2e/journeys-walk.mjs
import { launch } from './harness.mjs';

let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  await h.store.set('bfb-saved-v1', [
    { path: h.fixture + '/readme.md', label: 'readme.md', tags: ['work'] },
    { path: h.fixture + '/nested/', label: 'nested', tags: ['code'] },
  ]);
  await h.store.set('bfb-tags-v1', [{ name: 'work', color: '#58a6ff' }, { name: 'code', color: '#3fb950' }]);
  const page = await h.open();
  const key = async (...ks) => { for (const k of ks) { await page.keyboard.press(k); await sleep(60); } };
  const active = () => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.className || a.tagName) + '|' + (a.textContent || '').trim().slice(0, 30) : ''; });
  const savedRows = () => page.$$eval('#fe-lens-saved .fe-pl-item', rows => rows.filter(r => r.offsetParent).map(r => r.querySelector('.fe-pl-label')?.textContent.trim()));

  // Journey 2: Saved by tag.
  await key('g', '2');
  await sleep(200);
  check((await active()).includes('readme.md') || (await active()).includes('nested'), `g 2 lands on a Saved row: ${await active()}`);
  await key('/');
  check((await active()).startsWith('fe-lens-filter'), `/ in the sidebar focuses its filter: ${await active()}`);
  await page.keyboard.type('read');
  await sleep(150);
  check((await savedRows()).join() === 'readme.md', `typing filters the list: ${(await savedRows()).join()}`);
  await key('Escape');
  await sleep(150);
  await key('g', '#');
  await sleep(150);
  const chip = await active();
  check(/chip|tag/i.test(chip), `g # reaches the tag chips: ${chip}`);
  await key('ArrowRight');
  const next = await active();
  check(next !== chip && /chip|tag/i.test(next), `→ moves to the next chip: ${next}`);
  await key('Enter');
  await sleep(150);
  const byTag = await savedRows();
  check(byTag.length === 1, `Enter on a chip shows only that tag's places: ${byTag.join()}`);
  await key('Enter');
  await sleep(150);
  check((await savedRows()).length === 2, `Enter again clears the tag: ${(await savedRows()).join()}`);

  // Preview and a Chrome tab from a Saved row.
  await page.$eval('#fe-lens-saved .fe-pl-item a', a => a.focus());
  const rowName = await active();
  await key(' ');
  await sleep(400);
  const pv = await page.$eval('#fe-qlook', q => q.style.display === 'flex');
  check(pv || rowName.includes('nested'), `Space on a file row previews it: ${rowName} → ${pv}`);
  if (pv) {
    // Tab walks the floating preview's own controls and never leaves it.
    let outside = 0;
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      if (!(await page.evaluate(() => !!document.activeElement?.closest('#fe-qlook')))) outside++;
    }
    await page.keyboard.down('Shift');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      if (!(await page.evaluate(() => !!document.activeElement?.closest('#fe-qlook')))) outside++;
    }
    await page.keyboard.up('Shift');
    check(outside === 0, `Tab and Shift+Tab stay inside the floating preview (${outside} steps outside)`);
    await key('Escape');
  }
  await sleep(150);
  const before = (await h.browser.pages()).length;
  await page.$eval('#fe-lens-saved .fe-pl-item a', a => a.focus());
  await page.keyboard.down('Meta'); await page.keyboard.press('Enter'); await page.keyboard.up('Meta');
  await sleep(600);
  check((await h.browser.pages()).length === before + 1, `⌘↩ on a row opens a Chrome tab (${before} → ${(await h.browser.pages()).length})`);
  await page.bringToFront();

  // Journey 3: back to the sidebar row where focus was.
  await page.$$eval('#fe-lens-saved .fe-pl-item a', as => as[as.length - 1].focus());
  const left = await active();
  await key('Escape');                     // hands the keyboard back to the listing
  await key('g', 's');
  await sleep(150);
  check(await active() === left, `g s returns to the row focus left: ${left} → ${await active()}`);

  // Journey 1: Go to a typed path, here or as a background tab.
  await page.evaluate(() => document.activeElement?.blur());
  const tabCount = () => page.$$eval('#fe-tabs .fe-tab[data-id]:not([data-id=""])', ts => ts.length);
  const url = page.url();
  const tabsBefore = await tabCount();
  await key('l');
  await page.waitForSelector('#fe-goto input', { timeout: 3000 });
  await page.$eval('#fe-goto input', i => { i.value = ''; });
  await page.keyboard.type(h.fixture + '/nested/');
  await page.keyboard.down('Alt'); await page.keyboard.press('Enter'); await page.keyboard.up('Alt');
  await page.waitForFunction(() => !document.getElementById('fe-goto'), { timeout: 3000 }).catch(() => null);
  await sleep(300);
  check(page.url() === url && await tabCount() === tabsBefore + 1, `⌥↩ in Go to keeps the page and adds a tab (${tabsBefore} → ${await tabCount()})`);
  await key('l');
  await page.waitForSelector('#fe-goto input', { timeout: 3000 });
  await page.$eval('#fe-goto input', i => { i.value = ''; });
  await page.keyboard.type(h.fixture + '/nested/');
  await Promise.all([page.waitForNavigation({ timeout: 5000 }).catch(() => null), page.keyboard.press('Enter')]);
  check(page.url().includes('/nested'), `↩ in Go to goes there: ${page.url()}`);

  // A narrow window: the sidebar opens over the page, and Esc closes it.
  await page.setViewport({ width: 500, height: 800 });
  await sleep(300);
  const sideOpen = () => page.$eval('#fe-side', s => s.classList.contains('open'));
  await page.click('#fe-side .fe-rail-btn:not([hidden])');
  await sleep(300);
  check(await sideOpen(), 'a lens button opens the sidebar over the page');
  await page.screenshot({ path: new URL('./shots/journeys-narrow-side.png', import.meta.url).pathname });
  await page.evaluate(() => document.activeElement?.blur());
  await key('Escape');
  check(!(await sideOpen()), 'Esc closes it');
  await page.click('#fe-side .fe-rail-btn:not([hidden])');
  await sleep(300);
  await page.$eval('#fe-lenses a, #fe-lenses button', x => x.focus());
  await key('Escape');
  const after = await page.evaluate(() => ({ open: document.getElementById('fe-side').classList.contains('open'), inSide: !!document.activeElement?.closest('#fe-side') }));
  check(!after.open && !after.inSide, `Esc from inside closes it and hands the keyboard back: ${JSON.stringify(after)}`);
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
