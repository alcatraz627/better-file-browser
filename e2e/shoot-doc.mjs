// Screenshot one document as a file page and in the docked preview, in dark
// and light, for before/after comparisons of reading styles.
// Usage: node e2e/shoot-doc.mjs <absolute file path> <label>
import { dirname, basename } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const [file, label = 'doc'] = process.argv.slice(2);
if (!file) throw new Error('usage: shoot-doc.mjs <file> [label]');
const h = await launch();
try {
  for (const theme of ['dark', 'light']) {
    await h.store.set('bfb-theme', theme);
    const page = await h.browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto('file://' + file, { waitUntil: 'load' });
    await page.waitForSelector('#fe.fe-file-page .fe-md', { timeout: 10_000 });
    await new Promise(r => setTimeout(r, 400));
    const path = `${SHOTS}/${label}-page-${theme}.png`;
    await page.screenshot({ path });
    // Scroll to the middle third too, where lists, code and tables usually sit.
    await page.evaluate(() => { const s = document.querySelector('#fe-page'); if (s) s.scrollTop = s.scrollHeight / 3; });
    await new Promise(r => setTimeout(r, 200));
    await page.screenshot({ path: `${SHOTS}/${label}-page-mid-${theme}.png` });
    console.log(path);
    await h.store.set('bfb-preview-layout-v1', { mode: 'side', sideW: 760 });
    await page.goto('file://' + dirname(file) + '/', { waitUntil: 'load' });
    await page.waitForSelector('#fe');
    const row = await page.$(`#fe-tbody tr[data-idx]:has(a[href$="${encodeURIComponent(basename(file))}"]) td.c-nm`);
    if (row) {
      await row.click();
      await page.waitForSelector('#fe-ql-body .fe-md', { timeout: 8_000 }).catch(() => null);
      await new Promise(r => setTimeout(r, 400));
      await page.screenshot({ path: `${SHOTS}/${label}-preview-${theme}.png` });
    }
    await page.close();
  }
} finally {
  await h.close();
}
