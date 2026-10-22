// Save and Open in terminal wherever file and folder actions are offered:
// the item menu, the tab menu and the preview header.
//   node e2e/file-actions-walk.mjs   → e2e/shots/file-actions-{menu,preview}-{dark,light}.png
import { launch } from './harness.mjs';

let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shotPath = name => new URL(`./shots/${name}.png`, import.meta.url).pathname;
const h = await launch();
try {
  const page = await h.open();
  const savedLabels = async () => (await h.store.json('bfb-saved-v1', [])).map(p => p.label);
  const menuItems = sel => page.$$eval(`${sel} .fe-ctx-item`, items => items.map(i => i.querySelector('span')?.textContent ?? i.textContent));
  const rightClick = async name => {
    const row = await page.evaluateHandle(n => [...document.querySelectorAll('#fe-tbody tr')].find(r => r.textContent.includes(n)), name);
    const b = await row.asElement().boundingBox();
    await page.mouse.click(b.x + 60, b.y + b.height / 2, { button: 'right' });
    await sleep(200);
  };

  // Item menu on a folder and on a file.
  await rightClick('nested');
  await sleep(700);
  check(!(await page.$eval('#fe-tip', t => t.classList.contains('show'))), 'the row card stays hidden while the item menu is open');
  const folderItems = await menuItems('#fe-ctx');
  check(folderItems.includes('Save') && folderItems.includes('Open in terminal'), `the item menu on a folder offers Save and Open in terminal: ${folderItems.join(', ')}`);
  for (const theme of ['dark', 'light']) {
    await page.evaluate(t => { document.getElementById('fe').dataset.theme = t; }, theme);
    await sleep(400);
    const b = await page.$eval('#fe-ctx', m => { const r = m.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await page.screenshot({ path: shotPath(`file-actions-menu-${theme}`), clip: { x: Math.max(0, b.x - 40), y: Math.max(0, b.y - 40), width: b.w + 80, height: b.h + 80 } });
  }
  await page.$$eval('#fe-ctx .fe-ctx-item', items => items.find(i => i.dataset.act === 'save').click());
  await sleep(200);
  check((await savedLabels()).includes('nested'), 'Save in the item menu saves the folder');
  await rightClick('nested');
  check((await menuItems('#fe-ctx')).includes('Unsave'), 'the item menu then offers Unsave');
  await page.keyboard.press('Escape');
  await rightClick('readme.md');
  const fileItems = await menuItems('#fe-ctx');
  check(fileItems.includes('Save') && fileItems.includes('Open in terminal'), `the item menu on a file offers Save and Open in terminal: ${fileItems.join(', ')}`);
  await page.keyboard.press('Escape');

  // Tab menu.
  await page.keyboard.press('t');
  await sleep(200);
  await page.$eval('#fe-tabs .fe-tab[data-id]:not([data-id=""]) .fe-tab-more', b => b.click());
  await sleep(200);
  const tabItems = await menuItems('.fe-tab-menu');
  check(tabItems.includes('Open in terminal') && tabItems.some(t => t === 'Save' || t === 'Unsave'), `the tab menu offers Save and Open in terminal: ${tabItems.join(', ')}`);
  await page.keyboard.press('Escape');

  // Preview header.
  await page.$eval('#fe-tbody tr:not(.dir):not(.dotfile):not(.par) a', a => a.click());
  await page.waitForFunction(() => document.getElementById('fe-qlook')?.style.display === 'flex', { timeout: 4000 });
  const btns = await page.$$eval('#fe-ql-save, #fe-ql-term', bs => bs.map(b => b.id));
  check(btns.length === 2, `the preview header has Save and terminal buttons: ${btns.join(', ')}`);
  await page.$eval('#fe-ql-save', b => b.click());
  await sleep(150);
  const on = await page.$eval('#fe-ql-save', b => b.classList.contains('on'));
  check(on && (await savedLabels()).some(l => /\.(py|json|txt|md|tsv|sh)$/.test(l)), 'the preview Save button saves the file and shows it is saved');
  for (const theme of ['dark', 'light']) {
    await page.evaluate(t => { document.getElementById('fe').dataset.theme = t; }, theme);
    await sleep(400);
    const b = await page.$eval('#fe-ql-hdr', m => { const r = m.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    await page.screenshot({ path: shotPath(`file-actions-preview-${theme}`), clip: { x: b.x, y: b.y, width: b.w, height: b.h } });
  }
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
