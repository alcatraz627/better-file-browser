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
  if (pv) await key('Escape');
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
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
