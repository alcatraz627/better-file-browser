// Keys inside each focus area: rows of the open lens, the lens bar, the tabs,
// the toolbars and the path crumbs. Each step says which key did it.
//   node e2e/areas-walk.mjs
import { launch } from './harness.mjs';

let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  await h.store.set('bfb-saved-v1', [
    { path: h.fixture + '/readme.md', label: 'readme.md', tags: ['work'] },
    { path: h.fixture + '/nested/', label: 'nested', tags: ['code'] },
    { path: h.fixture + '/notes.txt', label: 'notes.txt' },
  ]);
  await h.store.set('bfb-tags-v1', [{ name: 'work', color: '#58a6ff' }, { name: 'code', color: '#3fb950' }]);
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  const key = async (...ks) => { for (const k of ks) { await page.keyboard.press(k); await sleep(80); } };
  const chord = async (mod, k) => { await page.keyboard.down(mod); await page.keyboard.press(k); await page.keyboard.up(mod); await sleep(120); };
  const label = () => page.evaluate(() => { const a = document.activeElement; return a ? (a.closest('.fe-pl-item, .fe-bm-item')?.querySelector('.fe-pl-label')?.textContent.trim() ?? a.id ?? '') : ''; });
  const where = () => page.evaluate(() => { const a = document.activeElement; return a ? a.id || a.className || a.tagName : ''; });

  // Saved rows.
  await key('g', '2');
  await sleep(200);
  const first = await label();
  await page.evaluate(() => { window.__row = document.activeElement; });
  await key('ArrowDown');
  const moved = await page.evaluate(() => { const a = document.activeElement; return a !== window.__row && !!a?.closest('#fe-lenses'); });
  check(moved, `↓ walks the Saved rows (a row or a group header): ${first} → ${await where()}`);
  await key('ArrowUp');
  check(await label() === first, `↑ walks back: ${await label()}`);
  await key('End');
  check(await label() !== first, `End goes to the last row: ${await label()}`);
  await key('Home');
  check(await label() === first, `Home goes to the first row: ${await label()}`);

  await key('F2');
  await sleep(200);
  const editing = await page.evaluate(() => { const a = document.activeElement; return !!a && (a.isContentEditable || a.tagName === 'INPUT'); });
  check(editing, `F2 on a Saved row starts renaming it: ${await where()}`);
  await key('Escape');
  await sleep(200);

  await page.$eval('#fe-lenses .fe-lens:not([hidden]) .fe-pl-item a', a => a.focus());
  const tabsBefore = await page.$$eval('#fe-tabs .fe-tab[data-id]:not([data-id=""])', t => t.length);
  await chord('Alt', 'Enter');
  await sleep(300);
  const tabsAfter = await page.$$eval('#fe-tabs .fe-tab[data-id]:not([data-id=""])', t => t.length);
  check(tabsAfter === tabsBefore + 1, `⌥↩ on a row keeps it as a background tab (${tabsBefore} → ${tabsAfter})`);

  // Chips keep ← and → to themselves.
  await key('g', '#');
  await sleep(150);
  await key('ArrowRight');
  const chipB = await where();
  await key('ArrowLeft');
  const chipA = await where();
  check(/chip/.test(chipA) && /chip/.test(chipB), `← on a tag chip stays on the chips: ${chipA}`);

  // Rows and the lens bar.
  await page.$eval('#fe-lenses .fe-lens:not([hidden]) .fe-pl-item a', a => a.focus());
  await key('ArrowLeft');
  check(await page.evaluate(() => !!document.activeElement?.closest('#fe-rail')), `← from a row goes to the lens bar: ${await where()}`);
  await chord('Alt', 'ArrowDown');
  check(await page.evaluate(() => !!document.activeElement?.closest('#fe-lenses')), `⌥↓ from the bar goes back into the lens: ${await where()}`);
  await key('Escape');

  // Tabs.
  await key('g', 't');
  await sleep(150);
  const tabA = await page.evaluate(() => document.activeElement?.dataset.id ?? '');
  await key('ArrowRight');
  const tabB = await page.evaluate(() => document.activeElement?.dataset.id ?? document.activeElement?.id ?? '');
  check(tabA !== tabB, `→ walks the tabs: ${tabA} → ${tabB}`);
  await key('ArrowLeft');
  check(await page.evaluate(() => document.activeElement?.dataset.id ?? '') === tabA, '← walks back');
  await page.$eval('#fe-tabs .fe-tab[data-id]:not([data-id=""])', t => t.focus());   // a temporary tab has no menu
  await chord('Shift', 'F10');
  const menu = await page.waitForSelector('.fe-tab-menu', { visible: true, timeout: 2000 }).then(() => true).catch(() => false);
  check(menu, '⇧F10 on a tab opens its menu');
  await key('Escape');
  await sleep(150);
  const closable = await page.$$eval('#fe-tabs .fe-tab', ts => ts.filter(t => t.querySelector('.fe-tab-x')).map(t => t.dataset.id));
  if (closable.length) {
    await page.$eval(`#fe-tabs .fe-tab[data-id="${closable[closable.length - 1]}"]`, t => t.focus());
    const n = await page.$$eval('#fe-tabs .fe-tab', t => t.length);
    await key('Backspace');
    await sleep(400);
    const m = await page.$$eval('#fe-tabs .fe-tab', t => t.length);
    check(m === n - 1, `⌫ on a tab closes it (${n} → ${m})`);
  } else check(false, 'a closable tab to try ⌫ on');

  // Toolbar.
  await page.$eval('#fe-toolbar button', b => b.focus());
  const t0 = await where();
  await key('ArrowRight');
  const t1 = await where();
  check(t0 !== t1, `→ walks the toolbar: ${t0} → ${t1}`);
  await page.$eval('#fe-search', s => s.focus());
  await page.keyboard.type('ab');
  await key('ArrowLeft');
  const caret = await page.$eval('#fe-search', s => s.selectionStart);
  check(await where() === 'fe-search' && caret === 1, `← in the filter box moves the caret, not the focus: ${caret}`);
  await page.$eval('#fe-search', s => { s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true })); s.blur(); });

  // Path crumbs.
  const crumb = await page.$('#fe-bc a.fe-crumb, #fe-bc .fe-crumb');
  if (crumb) {
    await crumb.focus();
    await key('ArrowDown');
    const open = await page.waitForSelector('#fe-crumb-menu[data-layer]', { visible: true, timeout: 2000 }).then(() => true).catch(() => false);
    check(open, '↓ on a path crumb opens its folder menu');
    await key('Escape');
  } else check(false, 'a path crumb to focus');
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
