// The Settings additions of 2026-11-20: view tiles, Follow changes on disk,
// Only on this Mac, what Export holds (dark mode and marks included, and back in
// through Import), and the Editable folders list.
//
//   node e2e/settings-extras-walk.mjs [folder for screenshots]   (BFB_THEME=light for the light theme)
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, store, THEME } from './harness.mjs';

const h = await launch();
if (THEME === 'light') await store.set('bfb-theme', 'light');
// Chrome asks before a site's second automatic download; the walk exports twice.
await (await h.browser.target().createCDPSession()).send('Browser.setPermission', { permission: { name: 'automatic-downloads' }, setting: 'granted' }).catch(() => {});
const shots = process.argv[2];
let failed = 0;
const check = (ok, msg, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${ok || got === undefined ? '' : `  got: ${JSON.stringify(got)}`}`); if (!ok) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const settings = async () => JSON.parse((await store.get('bfb-settings-v1')) ?? '{}');
const shot = async (page, name) => { if (shots) await page.screenshot({ path: join(shots, `${name}-${THEME}.png`) }); };

try {
  let page = await h.open();
  await page.setViewport({ width: 1200, height: 860 });
  const openTab = async tab => {
    if (await page.evaluate(() => document.getElementById('fe-settings-modal').hidden)) await page.click('#fe-settings-btn');
    await page.waitForFunction(() => !document.getElementById('fe-settings-modal').hidden);
    await page.click(`#fe-settings-modal .fe-dlg-tab[data-tab="${tab}"]`);
    await sleep(250);
  };

  // View tiles: each view drawn small; a click picks it.
  await openTab('folders');
  const tiles = await page.$$eval('#fe-st-defview .fe-seg-b', bs => bs.map(b => ({ v: b.dataset.v, mini: !!b.querySelector('.fe-st-mini i'), label: b.textContent.trim() })));
  check(tiles.length === 6 && tiles.every(t => t.mini && t.label), 'View shows six drawn views, each named', tiles);
  await page.click('#fe-st-defview .fe-seg-b[data-v="tiles"]');
  await sleep(200);
  check(await page.$eval('#fe-st-defview .fe-seg-b[data-v="tiles"]', b => b.getAttribute('aria-checked')) === 'true', 'clicking a drawn view picks it');
  check(await store.get('bfb-view') === 'tiles' || (await page.evaluate(() => document.getElementById('fe')?.dataset.view)) === 'tiles', 'and the choice is saved', await store.get('bfb-view'));
  await shot(page, 'extras-view');
  await page.click('#fe-st-defview .fe-seg-b[data-v="details"]');

  // Only on this Mac: the switch is saved.
  await openTab('ai');
  await page.click('#fe-st-local-only');
  await sleep(150);
  check((await settings()).localOnly === true, 'Only on this Mac is saved on');
  await page.click('#fe-st-local-only');
  await sleep(150);
  check((await settings()).localOnly === false, 'and off again');

  // Export: chats off by default, dark mode and marks in; switching chats on adds them.
  await store.set('bfb-ask-history-v1', JSON.stringify({ x: [{ q: 'hello' }] }));
  await h.sw.evaluate(() => chrome.storage.local.set({ 'bfb-lights-v1': { default: 'off', sites: { 'example.com': 'smart' } }, 'bfb-marks-v1:https://example.com/': [{ id: 'm1', kind: 'pin', note: 'n' }] }));
  await openTab('data');
  const parts = await page.$$eval('#fe-st-export-parts [data-part]', s => s.map(x => [x.dataset.part, x.checked]));
  check(JSON.stringify(parts) === JSON.stringify([['settings', true], ['saved', true], ['history', true], ['chats', false], ['web', true]]), 'Export shows a switch per part, Ask chats off by default', parts);
  // The test browser overwrites a download of the same name, so a new export shows as a newer file time.
  const mtime = n => statSync(join(h.downloads, n)).mtimeMs;
  const exported = async () => {
    const before = new Map(readdirSync(h.downloads).map(n => [n, mtime(n)]));
    await page.click('#fe-st-export');
    for (let i = 0; i < 40; i++) {
      await sleep(150);
      const f = readdirSync(h.downloads).find(n => n.endsWith('.json') && n.startsWith('bfb-settings') && (!before.has(n) || mtime(n) > before.get(n)));
      if (f) { await sleep(150); return JSON.parse(readFileSync(join(h.downloads, f), 'utf8')); }
    }
    return null;
  };
  let data = await exported();
  check(!!data && 'bfb-settings-v1' in data && !('bfb-ask-history-v1' in data), 'the export leaves Ask chats out while their switch is off', data && Object.keys(data));
  check(!!data && data['bfb-lights-v1']?.sites?.['example.com'] === 'smart' && Array.isArray(data['bfb-marks-v1:https://example.com/']), 'and carries dark mode choices and marks as they are', data && data['bfb-lights-v1']);
  await page.click('#fe-st-export-parts [data-part="chats"]');
  await sleep(150);
  // Chrome holds a page's second automatic download for permission, so the next export comes from a fresh page.
  page = await h.open();
  await page.setViewport({ width: 1200, height: 860 });
  await openTab('data');
  data = await exported();
  check(!!data && 'bfb-ask-history-v1' in data, 'switching Ask chats on puts them in', data ? Object.keys(data) : readdirSync(h.downloads));
  check(JSON.stringify((await settings()).exportParts) === JSON.stringify({ chats: true }), 'the switches are remembered', (await settings()).exportParts);
  await shot(page, 'extras-export');

  // Import brings dark mode and marks back as objects, not text.
  await h.sw.evaluate(() => chrome.storage.local.remove(['bfb-lights-v1', 'bfb-marks-v1:https://example.com/']));
  const file = join(h.downloads, 'import-test.json');
  writeFileSync(file, JSON.stringify({ 'bfb-lights-v1': { default: 'auto', sites: { 'a.com': 'invert' } }, 'bfb-marks-v1:https://a.com/': [{ id: 'z', kind: 'pin', note: 'back' }] }));
  const input = await page.$('#fe-st-import-file');
  await input.uploadFile(file);
  await page.waitForFunction(() => !document.getElementById('fe-st-import-plan').hidden, { timeout: 4000 });
  check(/dark mode choices and marks \(2 entries\)/.test(await page.$eval('#fe-st-import-plan-tx', e => e.textContent)), 'Import says it brings dark mode and marks', await page.$eval('#fe-st-import-plan-tx', e => e.textContent));
  await page.click('#fe-st-import-apply');
  await sleep(1500);
  const back = await h.sw.evaluate(() => chrome.storage.local.get(['bfb-lights-v1', 'bfb-marks-v1:https://a.com/']));
  check(typeof back['bfb-lights-v1'] === 'object' && back['bfb-lights-v1'].sites['a.com'] === 'invert' && back['bfb-marks-v1:https://a.com/']?.[0]?.note === 'back', 'and they arrive as the objects Lights and Marks read', back);

  // Editable folders: a list, each row edited, removed with Undo, or added.
  page = await h.open();
  await page.setViewport({ width: 1200, height: 860 });
  await openTab('files');
  await page.type('#fe-st-edit-add', '~/Code/one');
  await page.keyboard.press('Enter');
  await page.click('#fe-st-edit-add');
  await page.keyboard.type('/tmp/two/');
  await page.click('#fe-st-edit-addbtn');
  await sleep(150);
  check(JSON.stringify((await settings()).editableFolders) === JSON.stringify(['~/Code/one', '/tmp/two']), 'adding folders lists each on its own row, trailing slash trimmed', (await settings()).editableFolders);
  check(await page.$$eval('#fe-st-edit-list .fe-st-folder', rows => rows.every(r => r.querySelector('[data-act="copy"]') && r.querySelector('[data-act="finder"]') && r.querySelector('[data-act="remove"]'))), 'each row has copy, Show in Finder and remove');
  await page.$eval('#fe-st-edit-list .fe-st-folder[data-i="1"] input', i => { i.value = '/tmp/renamed'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(150);
  check((await settings()).editableFolders[1] === '/tmp/renamed', 'editing a row changes that folder only', (await settings()).editableFolders);
  await shot(page, 'extras-folders');
  await page.click('#fe-st-edit-list .fe-st-folder[data-i="0"] [data-act="remove"]');
  await sleep(150);
  check(JSON.stringify((await settings()).editableFolders) === JSON.stringify(['/tmp/renamed']), 'remove takes that row away');
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Undo')?.click());
  await sleep(150);
  check(JSON.stringify((await settings()).editableFolders) === JSON.stringify(['~/Code/one', '/tmp/renamed']), 'Undo puts it back where it was', (await settings()).editableFolders);
  await page.type('#fe-st-edit-add', '/tmp/renamed');
  await page.keyboard.press('Enter');
  await sleep(150);
  check((await settings()).editableFolders.length === 2, 'adding a folder already listed is refused');

  // Follow changes on disk, off: a change waits behind Reload.
  await openTab('files');
  await page.click('#fe-st-follow');
  await sleep(150);
  check((await settings()).followDisk === false, 'Follow changes on disk is saved off');
  const md = join(h.fixture, 'readme.md');
  const orig = readFileSync(md, 'utf8');
  const fp = await h.browser.newPage();
  await fp.goto('file://' + md, { waitUntil: 'load' });
  await fp.waitForSelector('#fe-fp-reload', { timeout: 8000 });
  await sleep(500);
  writeFileSync(md, orig + '\n\n## Added elsewhere\n');
  await fp.waitForFunction(() => document.getElementById('fe-fp-reload')?.classList.contains('waiting'), { timeout: 8000 });
  check(!(await fp.evaluate(() => document.body.innerText.includes('Added elsewhere'))), 'off: the page does not move when the file changes');
  check((await fp.$eval('#fe-fp-reload', e => e.textContent)) === 'Changed on disk · Reload', 'it offers Reload instead');
  await fp.click('#fe-fp-reload');
  await fp.waitForFunction(() => document.body.innerText.includes('Added elsewhere'), { timeout: 4000 });
  check(true, 'Reload shows the new text');
  await store.edit('bfb-settings-v1', s => ({ ...s, followDisk: true }));
  await fp.reload({ waitUntil: 'load' });
  await sleep(600);
  writeFileSync(md, orig + '\n\n## Second change\n');
  await fp.waitForFunction(() => document.body.innerText.includes('Second change'), { timeout: 8000 });
  check(true, 'on: the page takes the change by itself, as before');
  writeFileSync(md, orig);
} catch (err) {
  console.error(err);
  failed++;
} finally {
  await h.close();
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll Settings additions pass');
process.exit(failed ? 1 : 0);
