// Comments, tags, menus and settings behaving like their siblings: Esc backs out
// without changing anything, menus take keys, a picture opens in the viewer, Raw
// holds still, a doc opens on its open threads, settings apply at once.
//
//   node e2e/surfaces-walk.mjs [folder for screenshots]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const shots = process.argv[2];
const h = await launch();
try {
  if (THEME === 'light') await h.store.set('bfb-theme', 'light');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture], notesRoot: h.notesDir }));
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const snap = async name => { if (shots) { await wait(400); await page.screenshot({ path: join(shots, `${name}-${THEME}.png`) }); } };
  const pages = async () => (await h.browser.pages()).length;
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  writeFileSync(join(h.fixture, 'one.png'), Buffer.from(png, 'base64'));
  writeFileSync(join(h.fixture, 'two.png'), Buffer.from(png, 'base64'));
  const doc = join(h.fixture, 'pics.md');
  writeFileSync(doc, '# Pictures\n\n![first](one.png)\n\nWords between.\n\n![second](two.png)\n');

  // A picture in a doc opens in the viewer with its neighbours, not in a new Chrome tab.
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('.fe-md img');
  await wait(300);
  const before = await pages();
  await page.$eval('.fe-md img', i => { i.style.minWidth = '100px'; i.style.minHeight = '100px'; });
  await page.click('.fe-md img');
  await wait(400);
  check(await pages() === before, 'a picture stays in the page');
  check(!!(await page.$('.fe-dv-rail')), 'the viewer opens with the doc\'s other pictures beside it');
  await page.keyboard.press('Escape');
  await wait(200);

  // Raw holds still, so a second click in the same place goes back.
  const rawAt = () => page.$eval('#fe-fp-raw', b => b.getBoundingClientRect().x);
  const x0 = await rawAt();
  await page.click('#fe-fp-raw');
  await wait(200);
  check(await rawAt() === x0, 'Raw does not move when pressed');
  await page.click('#fe-fp-raw');
  await wait(200);
  check(!(await page.$eval('#fe-fp-raw', b => b.classList.contains('on'))), 'a second press in the same place leaves Raw');

  // Esc in a tag name puts it back and keeps Settings open; nothing on disk changes.
  const note = join(h.notesDir, 'tagged.md');
  writeFileSync(note, '---\ntitle: Tagged\ntags: "home"\n---\n\nWords\n');
  writeFileSync(join(h.notesDir, 'other.md'), '---\ntitle: Other\ntags: "todo"\n---\n\nMore\n');
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr');
  await wait(400);
  const openTags = async () => {
    await page.evaluate(() => document.querySelector('#fe-settings-btn, [data-open="settings"], #fe-gear')?.click());
    await page.waitForSelector('#fe-st-tags', { timeout: 4000 }).catch(() => null);
    await page.evaluate(() => [...document.querySelectorAll('.fe-rc-tab,[data-tab]')].find(t => /Notes/.test(t.textContent))?.click());
    await page.waitForSelector('[data-tc="name"]', { timeout: 4000 }).catch(() => null);
    await wait(200);
  };
  await openTags();
  const nameBox = t => `.fe-tc-row[data-tag="${t}"] [data-tc="name"]`;
  await page.click(nameBox('home'));
  await page.keyboard.type('xx');
  await page.keyboard.press('Escape');
  await wait(500);
  check(readFileSync(note, 'utf8').includes('tags: "home"'), 'Esc in a tag name changes nothing on disk');
  check(await page.$eval(nameBox('home'), i => i.value) === 'home', 'and puts the name back');
  check(await page.$eval('#fe-st-tags', e => e.checkVisibility()), 'and Settings stays open');

  // A plain rename can be undone. Renaming onto a tag in use asks first.
  await page.$eval(nameBox('home'), i => { i.focus(); i.select(); });
  await page.keyboard.type('house');
  await page.keyboard.press('Enter');
  await wait(800);
  check(readFileSync(note, 'utf8').includes('tags: "house"'), `Enter renames the tag: ${readFileSync(note, 'utf8').split('\n')[2]}`);
  await page.evaluate(() => [...document.querySelectorAll('#fe-toast button')].find(b => /Undo/.test(b.textContent))?.click());
  await wait(800);
  check(readFileSync(note, 'utf8').includes('tags: "home"'), 'Undo takes the rename back');
  await page.waitForSelector(nameBox('home'));
  await page.$eval(nameBox('home'), i => { i.focus(); i.select(); });
  await page.keyboard.type('todo');
  await page.keyboard.press('Enter');
  await wait(500);
  const asks = await page.evaluate(() => [...document.querySelectorAll('.fe-dlg,[role="dialog"],[role="alertdialog"]')].filter(d => d.checkVisibility()).map(d => d.textContent).join(' '));
  check(/Merge/.test(asks), `renaming onto a tag in use asks first: ${asks.slice(0, 80)}`);
  check(readFileSync(note, 'utf8').includes('tags: "home"'), 'and nothing has changed while it asks');
  await page.keyboard.press('Escape');
  await wait(300);
  check(readFileSync(note, 'utf8').includes('tags: "home"'), 'saying no leaves the tag alone');

  // A view picked in Settings shows at once.
  await page.evaluate(() => document.querySelectorAll('.fe-rc-tab,[data-tab]').forEach(t => { if (/Folders/.test(t.textContent)) t.click(); }));
  await wait(200);
  const viewNow = () => page.$eval('#fe', f => f.dataset.view);
  const wanted = (await viewNow()) === 'tiles' ? 'details' : 'tiles';
  await page.evaluate(w => document.querySelector(`#fe-st-defview [data-v="${w}"]`)?.click(), wanted);
  await wait(200);
  check(await viewNow() === wanted, `the view picked in Settings applies at once: ${await viewNow()}`);
  await page.evaluate(w => document.querySelector(`#fe-st-defview [data-v="${w}"]`)?.click(), 'details');
  await wait(100);

  // Tooltips switch off at once, with no browser label left behind.
  await page.evaluate(() => document.querySelectorAll('.fe-rc-tab,[data-tab]').forEach(t => { if (/Appearance|Look/.test(t.textContent)) t.click(); }));
  await wait(200);
  await page.evaluate(() => { const t = document.getElementById('fe-st-tooltips'); t.checked = false; t.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.keyboard.press('Escape');
  await wait(300);
  await page.hover('#fe-filter-btn');
  await wait(900);
  const off = await page.evaluate(() => ({ tip: !!document.querySelector('#fe-hint.on'), native: document.getElementById('fe-filter-btn').hasAttribute('title') }));
  check(!off.tip && !off.native, `tooltips off applies at once, without a reload: ${JSON.stringify(off)}`);
  await h.store.edit('bfb-settings-v1', s => ({ ...s, tooltips: true }));

  // Docked panels close on Esc; a row menu walks with the keys.
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr');
  await wait(300);
  for (const [btn, box, name] of [['#fe-sg-btn', '#fe-sg-panel', 'Sort'], ['#fe-filter-btn', '#fe-filter-bar', 'Filter']]) {
    await page.click(btn);
    await wait(100);
    check(await page.$eval(box, b => !b.hidden), `${name} opens`);
    await page.keyboard.press('Escape');
    await wait(100);
    check(await page.$eval(box, b => b.hidden), `Esc closes ${name}`);
  }
  await page.evaluate(() => [...document.querySelectorAll('#fe-tbody tr')].find(r => r.textContent.includes('notes.txt')).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 })));
  await wait(200);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const lit = await page.$$eval('#fe-ctx .row.kb', r => r.map(x => x.textContent));
  check(lit.length === 1, `arrow keys walk a row menu: ${lit}`);
  check(await page.$eval('#fe-ctx', e => e.matches(':popover-open') || e.checkVisibility()), 'and the menu stays open');
  await snap('surfaces-menu');
  await page.keyboard.press('Escape');
  await wait(100);

  // The sidebar's colour row shows every colour without a hidden scroll.
  const row = await page.evaluate(() => { const e = document.getElementById('fe-lens-colours'); return e ? { sw: e.scrollWidth, cw: e.clientWidth, shown: e.checkVisibility() } : null; });
  check(!row || !row.shown || row.sw <= row.cw, `the chip rows hold all their contents: ${JSON.stringify(row)}`);
} finally {
  for (const r of results) console.log(r);
  console.log(`${results.filter(r => r.startsWith('PASS')).length} pass, ${results.filter(r => r.startsWith('FAIL')).length} fail`);
  await h.close();
}
