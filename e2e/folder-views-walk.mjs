// Per-folder views, only when asked for. The keep button beside the view switch
// keeps the view, sort and grouping shown for that folder alone; other folders
// keep the defaults, and the default in Settings leaves a kept folder alone.
// Settings lists kept folders with a view dropdown each, as a list or grouped
// by view, with a tree switch that indents nested folders.
//
//   node e2e/folder-views-walk.mjs [folder for screenshots]   (BFB_THEME=light for the light theme)
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, THEME } from './harness.mjs';

const h = await launch();
const shots = process.argv[2];
let failed = 0;
const check = (ok, msg, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${ok || got === undefined ? '' : `  got: ${JSON.stringify(got)}`}`); if (!ok) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kept = async () => JSON.parse((await h.store.get('bfb-folder-views-v1')) ?? '{}');
const root = h.fixture.replace(/\/+$/, '');

try {
  if (THEME === 'light') await h.store.set('bfb-theme', 'light');
  mkdirSync(join(root, 'nested', 'deeper', 'keepme'), { recursive: true });
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1300, height: 900 });
  page.on('pageerror', e => check(false, `no page error (${e.message})`));
  const go = async p => { await page.goto('file://' + p + '/', { waitUntil: 'load' }); await page.waitForSelector('#fe'); await sleep(300); };
  const view = () => page.$eval('#fe', f => f.dataset.view);
  const pickView = async v => { await page.click(`#fe-view-group .fe-seg-b[data-v="${v}"]`); await sleep(200); };

  await go(root);
  check(await view() === 'details' && await page.$eval('#fe-keep-view', b => b.getAttribute('aria-pressed')) === 'false', 'a folder starts on the default view, not kept');
  check(Object.keys(await kept()).length === 0, 'nothing is kept until asked');

  // Keep this folder, then change its view and sort: they stay with it.
  await page.click('#fe-keep-view');
  await sleep(150);
  check((await kept())[root]?.view === 'details', 'the keep button keeps this folder', await kept());
  await page.click('th[data-sort="size"]');
  await pickView('tiles');
  const k = (await kept())[root];
  check(k?.view === 'tiles' && k?.sort?.col === 'size', 'a view and sort changed here stay with this folder', k);
  check((await h.store.get('bfb-view')) !== 'tiles' && JSON.parse((await h.store.get('bfb-sort-v1')) ?? 'null')?.col !== 'size', 'and the defaults are untouched', [await h.store.get('bfb-view'), await h.store.get('bfb-sort-v1')]);
  if (shots) await page.screenshot({ path: join(shots, `folder-keep-${THEME}.png`) });

  // Another folder opens on the defaults; the kept one opens on its own.
  await go(join(root, 'nested'));
  check(await view() === 'details' && await page.$eval('#fe-keep-view', b => b.getAttribute('aria-pressed')) === 'false', 'another folder opens on the default view', await view());
  await go(root);
  check(await view() === 'tiles' && await page.$eval('#fe-keep-view', b => b.getAttribute('aria-pressed')) === 'true', 'the kept folder opens on its own view');

  // The default view in Settings leaves this kept folder as it is.
  await page.click('#fe-settings-btn');
  await page.waitForFunction(() => !document.getElementById('fe-settings-modal').hidden);
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="folders"]');
  await page.click('#fe-st-defview .fe-seg-b[data-v="list"]');
  await sleep(200);
  check(await view() === 'tiles' && (await h.store.get('bfb-view')) === 'list', 'changing the default does not change a kept folder', [await view(), await h.store.get('bfb-view')]);

  // The Settings list: two kept folders, one inside another.
  await h.store.set('bfb-folder-views-v1', JSON.stringify({ ...(await kept()), [join(root, 'nested', 'deeper', 'keepme')]: { view: 'icons' }, [join(root, 'nested')]: { view: 'gallery' } }));
  await page.keyboard.press('Escape');
  await page.click('#fe-settings-btn');
  await page.waitForFunction(() => !document.getElementById('fe-settings-modal').hidden);
  await page.waitForSelector('.fe-fv-row');
  const rows = () => page.$$eval('.fe-fv-row', rs => rs.map(r => ({ path: r.dataset.path, label: r.querySelector('.fe-fv-path span').textContent, depth: getComputedStyle(r).getPropertyValue('--depth').trim(), view: r.querySelector('.fe-fv-view .fe-dd-cur').textContent.trim(), here: r.classList.contains('here') })));
  let rs = await rows();
  check(rs.length === 3 && rs[0].here && rs[0].view === 'Tiles', 'Settings lists kept folders, this one marked, each with its view', rs);
  check(rs[0].depth === '0' && rs[1].depth === '1' && rs[1].label === 'nested' && rs[2].depth === '2' && rs[2].label === 'deeper/keepme', 'the tree indents a folder kept inside another, by its path below it', rs);
  await page.click('#fe-st-fv-tree');
  await sleep(150);
  rs = await rows();
  check(rs.every(r => r.depth === '0') && rs[2].label.endsWith('/nested/deeper/keepme'), 'tree off: every folder flush, full paths', rs);
  await page.click('#fe-st-fv-tree');
  await page.click('#fe-st-fv-shape .fe-seg-b[data-v="view"]');
  await sleep(150);
  const groups = await page.$$eval('.fe-fv-group h4', hs => hs.map(x => x.textContent.trim()));
  check(JSON.stringify(groups) === JSON.stringify(['Tiles1', 'Large Icons1', 'Gallery1']), 'By view groups the folders under each view', groups);
  if (shots) await page.screenshot({ path: join(shots, `folder-views-settings-${THEME}.png`) });
  await page.click('#fe-st-fv-shape .fe-seg-b[data-v="list"]');
  await sleep(150);

  // A dropdown changes a folder's view; for this folder it applies at once.
  await page.click(`.fe-fv-row[data-path="${root}"] .fe-dd-btn`);
  await page.waitForSelector('.fe-dd-list .fe-dd-opt[data-v="list"]');
  await page.click('.fe-dd-list .fe-dd-opt[data-v="list"]');
  await sleep(200);
  check((await kept())[root]?.view === 'list' && await view() === 'list', 'a dropdown here changes the folder’s view, and this folder follows', [(await kept())[root], await view()]);

  // Follow the default again, with Undo.
  await page.click(`.fe-fv-row[data-path="${join(root, 'nested')}"] .fe-fv-drop`);
  await sleep(150);
  check(!(join(root, 'nested') in await kept()) && (await rows()).length === 2, 'a folder can follow the default again from the list');
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Undo')?.click());
  await sleep(150);
  check((await kept())[join(root, 'nested')]?.view === 'gallery', 'Undo keeps it again', await kept());
  await page.keyboard.press('Escape');
  await sleep(200);

  // Unkeep from the toolbar: the folder goes back to the defaults.
  await page.click('#fe-keep-view');
  await sleep(200);
  check(!(root in await kept()) && await view() === 'list' && await page.$eval('#fe-keep-view', b => b.getAttribute('aria-pressed')) === 'false', 'the keep button again lets the folder follow the defaults', [await kept(), await view()]);
} catch (err) {
  console.error(err);
  failed++;
} finally {
  await h.close();
  if (failed) { console.log(`${failed} failed`); process.exitCode = 1; }
}
