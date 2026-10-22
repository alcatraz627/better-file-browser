// Keyboard: the palette, key sequences, areas, menus, tabs and key hints all
// work with no mouse. Screenshots of the palette, a sequence and the hints.
//
//   node e2e/keys-walk.mjs      (BFB_THEME=light for the light theme)
import { launch, shot, applyTheme } from './harness.mjs';

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  await h.store.set('bfb-saved-v1', JSON.stringify([{ path: h.fixture + '/nested/', label: 'Nested place' }]));
  const page = await h.open();
  await applyTheme(page);
  const k = async (...keys) => { for (const key of keys) { await page.keyboard.press(key); await sleep(60); } };
  const view = () => page.$eval('#fe', e => e.dataset.view);
  const active = () => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.className || a.tagName) : ''; });

  // Palette: opens on ⌘K, lists commands with keys, runs one.
  await page.keyboard.down('Meta'); await page.keyboard.press('k'); await page.keyboard.up('Meta');
  await page.waitForSelector('.fe-pal input');
  await sleep(150);
  await shot(page, 'keys-palette');
  const rows = await page.$$eval('.fe-pal-i', r => r.length);
  check(rows > 20, `palette lists commands and places: ${rows}`);
  await page.keyboard.type('list');
  await sleep(80);
  const top = await page.$eval('.fe-pal-i.on .fe-pal-t', e => e.textContent);
  check(top === 'List', `typing ranks the List view first: ${top}`);
  await k('Enter');
  check(await view() === 'list', 'palette Enter switched to the List view');
  check(!(await page.$('.fe-pal')), 'palette closed after running');

  // Palette goes to a saved place.
  await page.keyboard.down('Meta'); await page.keyboard.press('k'); await page.keyboard.up('Meta');
  await page.keyboard.type('nested place');
  await sleep(80);
  const savedTop = await page.$eval('.fe-pal-i.on .fe-pal-t', e => e.textContent);
  check(savedTop === 'Nested place', `palette finds a saved place: ${savedTop}`);
  await k('Escape');
  check(!(await page.$('.fe-pal')), 'Esc closes the palette');

  // Sequences: v t → Tree, v d → Details; the pill shows while waiting.
  await k('v');
  await sleep(100);
  await shot(page, 'keys-chord');
  check(!!(await page.$('.fe-chord')), 'the sequence pill shows after v');
  await k('t');
  check(await view() === 'tree', 'v t switched to Tree');
  await k('v', 'd');
  check(await view() === 'details', 'v d switched to Details');

  // Listing keys.
  await k('Home');
  const first = await page.$eval('#fe-tbody tr.selected', r => r.dataset.idx).catch(() => null);
  await k('End');
  const last = await page.$eval('#fe-tbody tr.selected', r => r.dataset.idx).catch(() => null);
  check(first !== null && last !== null && first !== last, `Home and End select first and last: ${first} → ${last}`);
  await k('Home', 'ArrowDown');
  await page.keyboard.down('Shift'); await k('ArrowDown', 'ArrowDown'); await page.keyboard.up('Shift');
  const many = await page.$$eval('#fe-tbody tr.selected', r => r.length);
  check(many === 3, `⇧↓ grows the selection: ${many}`);
  await k('x');
  await sleep(120);
  const menuOpen = await page.$eval('#fe-ctx', m => m.style.display !== 'none');
  check(menuOpen, 'x opens the item menu');
  await k('ArrowDown');
  const kb = await page.$$eval('#fe-ctx .fe-ctx-item.kb', r => r.length);
  check(kb === 1, 'arrows move in the menu');
  await k('Escape');
  check(await page.$eval('#fe-ctx', m => m.style.display === 'none'), 'Esc closes the menu');
  await k('.');
  check(await page.$eval('#fe', e => e.classList.contains('show-hidden')), '. shows hidden files');
  await k('.');
  await k('/');
  check(await active() === 'fe-search', '/ focuses the filter');
  await k('Escape');

  // Areas: F6 visits the sidebar, tabs, path bar, toolbar, then the listing.
  await page.evaluate(() => document.activeElement?.blur());
  const seen = [];
  for (let i = 0; i < 5; i++) {
    await k('F6');
    seen.push(await page.evaluate(() => { const a = document.activeElement; return a?.closest('#fe-side') ? 'sidebar' : a?.closest('#fe-tabbar') ? 'tabs' : a?.closest('#fe-bar') ? 'path' : a?.closest('#fe-toolbar') ? 'toolbar' : 'listing'; }));
  }
  check(new Set(seen).size >= 4, `F6 walks the areas: ${seen.join(' → ')}`);

  // g 2 opens Saved; arrows walk its rows; Esc returns to the listing.
  await page.evaluate(() => document.activeElement?.blur());
  await k('g', '2');
  await sleep(150);
  const lens = await page.$eval('#fe-rail .fe-rail-btn.on', b => b.dataset.lens);
  check(lens === 'saved', `g 2 opens Saved: ${lens}`);
  await k('g', 's');
  const inSide = await page.evaluate(() => !!document.activeElement?.closest('#fe-side'));
  check(inSide, 'g s focuses the sidebar');
  await k('Escape');
  const back = await page.evaluate(() => !document.activeElement?.closest('#fe-side'));
  check(back, 'Esc leaves the sidebar');

  // Tabs: t keeps, g t focuses the strip, ⇧→ moves the focused tab.
  await k('t');
  await page.evaluate(() => document.querySelectorAll('#fe-sv-list .fe-si-link')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, altKey: true })));
  await sleep(200);
  await k('g', 't');
  const tabFocus = await page.evaluate(() => document.activeElement?.classList.contains('fe-tab'));
  check(tabFocus, 'g t focuses a tab');
  const before = await page.$$eval('#fe-tabs .fe-tab', t => t.map(x => x.textContent.trim()));
  await page.keyboard.down('Shift'); await k('ArrowRight'); await page.keyboard.up('Shift');
  await sleep(100);
  const after = await page.$$eval('#fe-tabs .fe-tab', t => t.map(x => x.textContent.trim()));
  check(before.length > 1 && before.join('|') !== after.join('|'), `⇧→ moves the tab: ${before.join(',')} → ${after.join(',')}`);
  await k('Escape');

  // With a listing row selected, keys in the sidebar act on the sidebar:
  // ⌫ removes the focused saved row and the page stays put.
  await page.evaluate(() => document.activeElement?.blur());
  await k('Home', 'ArrowDown');
  const urlBefore = page.url();
  await k('g', '2');
  await sleep(150);
  await page.focus('#fe-sv-list .fe-si-link');
  await k('Backspace');
  await sleep(200);
  const savedLeft = await page.$$eval('#fe-sv-list .fe-pl-item', r => r.length);
  check(page.url() === urlBefore && savedLeft === 0, `⌫ on a saved row removes it and stays on the page: rows=${savedLeft} url kept=${page.url() === urlBefore}`);

  // Holding ⌥ shows key badges.
  await page.keyboard.down('Alt');
  await sleep(650);
  const badges = await page.$$eval('.fe-hints > kbd', b => b.length);
  await shot(page, 'keys-hints');
  await page.keyboard.up('Alt');
  check(badges >= 8, `holding ⌥ shows key badges: ${badges}`);
  check(!(await page.$('.fe-hints')), 'releasing ⌥ hides them');

  // ? opens the keyboard map.
  await k('?');
  await sleep(200);
  check(await page.$eval('#fe-help-modal', d => d.style.display !== 'none'), '? opens Help');
} finally {
  await h.close();
  process.exitCode = fails.length ? 1 : 0;
}
