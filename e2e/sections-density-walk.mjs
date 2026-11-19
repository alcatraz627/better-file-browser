// One Detail scale, and the sidebar's sections. An old Row spacing of Compact
// becomes Detail 4 on load and is dropped. Settings, Sidebar lists each lens with
// a switch and a handle: a switch takes a lens off the rail, Alt+arrow and a drag
// reorder it, the order survives a reload, and the last lens on stays on.
//
//   node e2e/sections-density-walk.mjs [folder for screenshots]   (BFB_THEME=light for the light theme)
import { join } from 'node:path';
import { launch, THEME } from './harness.mjs';

const h = await launch();
const shots = process.argv[2];
let failed = 0;
const check = (ok, msg, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${ok || got === undefined ? '' : `  got: ${JSON.stringify(got)}`}`); if (!ok) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const settings = async () => JSON.parse((await h.store.get('bfb-settings-v1')) ?? '{}');

try {
  await h.store.set('bfb-settings-v1', JSON.stringify({ showSidebar: true, compactMode: true }));
  if (THEME === 'light') await h.store.set('bfb-theme', 'light');
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1300, height: 900 });
  page.on('pageerror', e => check(false, `no page error (${e.message})`));
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr');
  await sleep(300);

  // An old Compact choice is read once into Detail.
  const d = await page.evaluate(() => [document.getElementById('fe').dataset.density, document.getElementById('fe').classList.contains('compact'), document.querySelector('#fe-density output')?.textContent]);
  check(d[0] === '4' && d[1] === false && d[2] === 'Detailed', 'an old Compact choice shows as Detailed on the one scale', d);
  check(!('compactMode' in await settings()), 'and the old setting is dropped', await settings());

  const rail = () => page.$$eval('#fe-rail .fe-rail-btn', bs => bs.filter(b => !b.hidden).map(b => b.dataset.lens));
  const openSidebarTab = async () => {
    await page.click('#fe-settings-btn');
    await page.waitForFunction(() => !document.getElementById('fe-settings-modal').hidden);
    await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="sidebar"]');
    await page.waitForSelector('.fe-lens-row');
  };
  await openSidebarTab();
  const rows = await page.$$eval('.fe-lens-row', rs => rs.map(r => [r.dataset.lens, r.querySelector('.fe-st-lens-on').checked]));
  check(rows.length === 9 && rows.every(r => r[1]), 'Sections lists every lens, all on', rows);

  // A switch takes a lens off the rail at once.
  await page.click('.fe-lens-row[data-lens="ask"] .fe-st-lens-on');
  await sleep(150);
  check(!(await rail()).includes('ask') && JSON.stringify((await settings()).lensOff) === '["ask"]', 'switching Ask off takes it off the rail', await rail());

  // Alt+Down on Home's handle moves it below Places.
  await page.focus('.fe-lens-row[data-lens="home"] .fe-lens-grip');
  await page.keyboard.down('Alt'); await page.keyboard.press('ArrowDown'); await page.keyboard.up('Alt');
  await sleep(150);
  check((await rail()).slice(0, 2).join() === 'places,home', 'Alt+Down moves a lens down the rail', await rail());
  check(await page.evaluate(() => document.activeElement?.closest('.fe-lens-row')?.dataset.lens) === 'home', 'focus stays on the moved row');

  // A drag moves Decisions to the top.
  const from = await page.$('.fe-lens-row[data-lens="decisions"]');
  const to = await page.$('.fe-lens-row[data-lens="places"]');
  const tb = await to.boundingBox();
  await from.dragAndDrop(to, { delay: 50 }).catch(() => null);
  await sleep(200);
  let order = await rail();
  if (order[0] !== 'decisions') {
    // Headless Chrome can skip native drag events; send them as a browser would.
    await page.evaluate(y => {
      const src = document.querySelector('.fe-lens-row[data-lens="decisions"]'), dst = document.querySelector('.fe-lens-row[data-lens="places"]');
      const dt = new DataTransfer();
      src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: y }));
      src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    }, tb.y + 2);
    await sleep(200);
    order = await rail();
  }
  check(order[0] === 'decisions', 'a drag moves a lens to the top of the rail', order);
  if (shots) await page.screenshot({ path: join(shots, `sections-${THEME}.png`) });

  // The last lens on stays on.
  for (const id of order.slice(1)) await page.click(`.fe-lens-row[data-lens="${id}"] .fe-st-lens-on`);
  await sleep(150);
  check((await rail()).join() === 'decisions', 'every lens but one switched off', await rail());
  await page.click('.fe-lens-row[data-lens="decisions"] .fe-st-lens-on');
  await sleep(150);
  check((await rail()).join() === 'decisions' && await page.$eval('.fe-lens-row[data-lens="decisions"] .fe-st-lens-on', s => s.checked), 'the last lens on cannot be switched off');
  check(await page.evaluate(() => document.body.innerText.includes('One section has to stay on')), 'and a toast says why');
  for (const id of order.slice(1)) await page.click(`.fe-lens-row[data-lens="${id}"] .fe-st-lens-on`);
  await page.click('.fe-lens-row[data-lens="ask"] .fe-st-lens-on');
  await sleep(150);

  // The order survives a reload; Ask is back on.
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr');
  await sleep(300);
  const after = await rail();
  check(after.slice(0, 3).join() === 'decisions,places,home' && after.length === 9, 'the order survives a reload', after);

  // A lens asked for by name still opens when it is off the rail.
  await openSidebarTab();
  await page.click('.fe-lens-row[data-lens="ask"] .fe-st-lens-on');
  await page.keyboard.press('Escape');
  await sleep(200);
  await page.evaluate(() => document.getElementById('fe-rail-ask').click());
  check(await page.$eval('#fe-lens-ask', l => l.hidden), 'a lens switched off is not opened from its hidden rail button');
} catch (err) {
  console.error(err);
  failed++;
} finally {
  await h.close();
  if (failed) { console.log(`${failed} failed`); process.exitCode = 1; }
}
