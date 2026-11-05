// Small promises kept in the real page: ⌘K closes the palette it opened, a long
// menu fits a short window, a folder's menu holds no file-only commands, Wrap is
// honest about a file too large to wrap.
//
//   node e2e/leftovers-walk.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture], notesRoot: h.notesDir }));
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr');
  await wait(300);

  // The palette key is a toggle.
  const metaK = async () => { await page.keyboard.down('Meta'); await page.keyboard.press('KeyK'); await page.keyboard.up('Meta'); await wait(200); };
  await metaK();
  check(!!(await page.$('.fe-pal')), '⌘K opens the palette');
  await metaK();
  check(!(await page.$('.fe-pal')), '⌘K closes it again');

  // A folder's menu leaves out commands that only work on a file; a file's keeps them.
  const menuFor = async name => {
    await page.evaluate(n => {
      const row = [...document.querySelectorAll('#fe-tbody tr')].find(r => r.textContent.includes(n));
      row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 200 }));
    }, name);
    await wait(200);
    const items = await page.$$eval('#fe-ctx .fe-ctx-item', els => els.map(e => e.textContent));
    return items;
  };
  const dirMenu = await menuFor('nested');
  check(dirMenu.length > 0 && !dirMenu.some(t => t.includes('Run with bash')) && !dirMenu.some(t => t.includes('Show contents')), 'a folder is not offered cat or bash');
  check(dirMenu.some(t => t.includes('Add to VS Code')), 'a folder keeps the commands that take one');
  await page.keyboard.press('Escape');
  await wait(100);
  check((await menuFor('script.sh')).some(t => t.includes('Run with bash')), 'a file is offered bash');
  await page.keyboard.press('Escape');
  await wait(100);

  // A menu taller than the window stays inside it and scrolls.
  await page.setViewport({ width: 1400, height: 400 });
  await wait(200);
  await menuFor('readme.md');
  const fit = await page.$eval('#fe-ctx', e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, scrolls: e.scrollHeight > e.clientHeight, css: getComputedStyle(e).overflowY }; });
  check(fit.top >= 0 && fit.bottom <= 400 && fit.scrolls && fit.css === 'auto', `the row menu fits a 400 px window and scrolls: ${JSON.stringify(fit)}`);
  await page.keyboard.press('Escape');
  await page.setViewport({ width: 1400, height: 900 });

  // Wrap says what is true about a file too large to wrap.
  const big = join(h.fixture, 'big.txt');
  writeFileSync(big, 'some words on a line\n'.repeat(30000));
  await page.goto('file://' + big, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-edit');
  await wait(300);
  const wrapBefore = await page.$eval('#fe-fp-wrap', b => ({ on: b.classList.contains('on'), off: b.disabled }));
  check(wrapBefore.on && !wrapBefore.off, 'Wrap is on while reading');
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-fe-ta');
  await wait(300);
  const wrapBig = await page.$eval('#fe-fp-wrap', b => ({ on: b.classList.contains('on'), off: b.disabled, title: b.title }));
  check(!wrapBig.on && wrapBig.off && /large/.test(wrapBig.title), `Wrap stops claiming to be on while a large file is edited: ${JSON.stringify(wrapBig)}`);
  await page.click('[data-act="done"]');
  await wait(400);
  check(await page.$eval('#fe-fp-wrap', b => b.classList.contains('on') && !b.disabled), 'and comes back after Done');

} finally {
  for (const r of results) console.log(r);
  console.log(`${results.filter(r => r.startsWith('PASS')).length} pass, ${results.filter(r => r.startsWith('FAIL')).length} fail`);
  await h.close();
}
