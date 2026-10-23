// "Open with" reaches a file from bfb: a row's menu lists Zed, VS Code, Cursor,
// Finder and the person's own commands from Settings, and the palette offers
// the same for the page. The host side is tested in native/test_launcher.py.
//
//   node e2e/open-with-walk.mjs
import { join } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const h = await launch();
try {
  await h.store.set('bfb-settings-v1', { showSidebar: true, openWithCmds: 'Show contents: cat\nAdd to VS Code: & code --add' });
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
  await page.waitForSelector('#fe-st-open-with', { timeout: 3000 });
  const field = await page.$eval('#fe-st-open-with', t => t.value);
  check(/Show contents: cat/.test(field) && /& code --add/.test(field), `Settings shows the commands to edit: ${JSON.stringify(field)}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
