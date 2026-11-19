// "Open with" reaches a file from bfb: a row's menu lists Zed, VS Code, Cursor,
// Finder and the person's own commands from Settings, and the palette offers
// the same for the page. Settings shows the commands as rows: older text is
// carried over, each command is checked as it is typed (its shape at once, and
// whether its program exists through the launcher's check, which this walk runs
// for real with every other launcher action refused), and a colour picked for a
// command shows as a dot in the menu. The host side is tested in native/test_launcher.py.
//
//   node e2e/open-with-walk.mjs [folder for screenshots]   (BFB_THEME=light for the light theme)
import { join } from 'node:path';
import { launch, SHOTS, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const h = await launch({ cmdCheck: true });
const shots = process.argv[2];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async (page, name) => { if (shots) { await sleep(250); await page.screenshot({ path: join(shots, `${name}-${THEME}.png`) }); } };
try {
  await h.store.set('bfb-settings-v1', { showSidebar: true, openWithCmds: 'Show contents: cat\nAdd to VS Code: & code --add' });
  if (THEME === 'light') await h.store.set('bfb-theme', 'light');
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr');
  const row = await page.$('#fe-tbody tr[data-name="readme.md"], #fe-tbody [data-name="readme.md"]');
  const box = await row.boundingBox();
  await page.mouse.click(box.x + 60, box.y + box.height / 2, { button: 'right' });
  await page.waitForSelector('.fe-ctx-item[data-act^="ow:"]', { timeout: 3000 }).catch(() => null);
  const items = await page.$$eval('.fe-ctx-item[data-act^="ow:"]', els => els.map(e => e.textContent.trim()));
  check(['Open in Zed', 'Open in VS Code', 'Open in Cursor', 'Show in Finder', 'Show contents', 'Add to VS Code'].every(t => items.includes(t)), `a row's menu lists the apps and the commands from Settings: ${JSON.stringify(items)}`);
  await page.screenshot({ path: join(SHOTS, 'open-with-menu.png') });
  await page.keyboard.press('Escape');

  await page.keyboard.down('Meta'); await page.keyboard.press('KeyK'); await page.keyboard.up('Meta');
  await page.keyboard.type('Open in Zed');
  const palette = await page.evaluate(() => document.body.innerText.includes('Open in Zed'));
  check(palette, 'the palette offers Open in Zed for this page');
  await page.keyboard.press('Escape');

  await page.keyboard.press(',');
  await page.waitForFunction(() => !document.getElementById('fe-settings-modal').hidden);
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="tools"]');
  await page.waitForSelector('.fe-ow-row');
  const rows = () => page.$$eval('.fe-ow-row', rs => rs.map(r => ({
    name: r.querySelector('.fe-ow-name').value, cmd: r.querySelector('.fe-ow-cmd').value,
    files: r.querySelector('.fe-ow-files').checked, win: r.querySelector('.fe-ow-win').checked,
    st: r.querySelector('.fe-ow-st').textContent, tone: r.querySelector('.fe-ow-st').dataset.tone || '' })));
  let got = await rows();
  check(JSON.stringify(got.map(r => [r.name, r.cmd, r.files, r.win])) === JSON.stringify([['Show contents', 'cat', false, true], ['Add to VS Code', 'code --add', false, false]]),
    `the older text shows as rows; & became the Window switch off: ${JSON.stringify(got)}`);
  await page.waitForFunction(() => /Found .*\/cat$/.test(document.querySelector('.fe-ow-row .fe-ow-st')?.textContent ?? ''), { timeout: 8000 }).catch(() => null);
  got = await rows();
  check(/^Found .*\/cat$/.test(got[0].st) && got[0].tone === 'ok', `the launcher's check finds cat: ${JSON.stringify(got[0].st)}`);

  // A new command: a missing program, then an open quote, then a fix.
  await page.click('#fe-st-ow-add');
  await page.keyboard.type('Lint');
  await page.click('.fe-ow-row[data-idx="2"] .fe-ow-cmd');
  await page.keyboard.type('no-such-prog-bfb --fix');
  await page.waitForFunction(() => /not installed/.test(document.querySelector('.fe-ow-row[data-idx="2"] .fe-ow-st')?.textContent ?? ''), { timeout: 8000 }).catch(() => null);
  got = await rows();
  check(got[2].tone === 'bad' && /no-such-prog-bfb is not installed/.test(got[2].st), `a program that is not there is named: ${JSON.stringify(got[2].st)}`);
  await shot(page, 'open-with-rows');
  await page.$eval('.fe-ow-row[data-idx="2"] .fe-ow-cmd', i => { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.keyboard.type("echo 'half");
  await sleep(150);
  got = await rows();
  check(got[2].st === 'A quote is left open' && got[2].tone === 'bad', `an open quote is caught as it is typed: ${JSON.stringify(got[2].st)}`);
  await page.keyboard.type("'");
  await page.waitForFunction(() => /^Found/.test(document.querySelector('.fe-ow-row[data-idx="2"] .fe-ow-st')?.textContent ?? ''), { timeout: 8000 }).catch(() => null);
  got = await rows();
  check(got[2].tone === 'ok', `closing the quote clears it: ${JSON.stringify(got[2].st)}`);
  // The same name twice is caught on both rows' side.
  await page.$eval('.fe-ow-row[data-idx="2"] .fe-ow-name', i => { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('.fe-ow-row[data-idx="2"] .fe-ow-name');
  await page.keyboard.type('show contents');
  await sleep(150);
  got = await rows();
  check(/Another command has this name/.test(got[2].st), `a repeated name is caught: ${JSON.stringify(got[2].st)}`);
  await page.keyboard.type(' twice');
  await sleep(150);

  // A colour for the first command.
  await page.click('.fe-ow-row[data-idx="0"] .fe-ow-color');
  await page.waitForSelector('.fe-ow-pop .fe-rp-c[data-c="#40c057"]');
  await shot(page, 'open-with-colour');
  await page.click('.fe-ow-pop .fe-rp-c[data-c="#40c057"]');
  await sleep(150);
  const saved = JSON.parse(await h.store.get('bfb-settings-v1'));
  check(saved.openWith?.[0]?.color === '#40c057' && saved.openWith?.[1]?.terminal === false && saved.openWith?.length === 3, `the rows are saved with the colour: ${JSON.stringify(saved.openWith)}`);
  await page.keyboard.press('Escape');

  // Delete with Undo.
  await page.click('.fe-ow-row[data-idx="1"] .fe-ow-del');
  await sleep(150);
  check((await rows()).length === 2, 'delete takes the row away');
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Undo'), { timeout: 5000 }).catch(() => null);
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Undo')?.click());
  await sleep(150);
  got = await rows();
  check(got.length === 3 && got[1].name === 'Add to VS Code', `Undo puts it back in its place: ${JSON.stringify(got.map(r => r.name))}`);

  // The menu shows the colour as a dot, by the command's name.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await sleep(300);
  const row2 = await page.$('#fe-tbody tr[data-name="readme.md"], #fe-tbody [data-name="readme.md"]');
  const b2 = await row2.boundingBox();
  await page.mouse.click(b2.x + 60, b2.y + b2.height / 2, { button: 'right' });
  await page.waitForSelector('.fe-ctx-item[data-act^="ow:#"]');
  const menu = await page.$$eval('.fe-ctx-item[data-act^="ow:#"]', els => els.map(e => ({ t: e.textContent.trim(), dot: e.querySelector('.fe-ow-dot')?.style.getPropertyValue('--c') ?? null })));
  check(menu[0]?.t === 'Show contents' && menu[0].dot === '#40c057' && menu.slice(1).every(m => m.dot === null), `the menu shows the picked colour as a dot: ${JSON.stringify(menu)}`);
  check(menu.some(m => m.t === 'show contents twice'), 'a fixed new command is in the menu');
  await shot(page, 'open-with-menu-dot');
  await page.keyboard.press('Escape');
} finally {
  console.log(results.join('\n'));
  await h.close();
}
