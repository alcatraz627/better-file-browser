// Screenshots of the design-system page in dark and light, full length:
// e2e/shots/design-dark.png and design-light.png.
//   node e2e/design-shots.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './harness.mjs';

const SHOTS = join(dirname(fileURLToPath(import.meta.url)), 'shots');
const h = await launch();
try {
  const id = new URL(h.sw.url()).host;
  const page = await h.browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const theme of ['dark', 'light']) {
    await page.goto(`chrome-extension://${id}/design.html?${theme}`, { waitUntil: 'load' });
    await page.waitForSelector('#fe .ds-sec');
    await page.screenshot({ path: join(SHOTS, `design-${theme}.png`), fullPage: true });
  }
  const sections = await page.$$eval('.ds-sec > h2', hs => hs.map(h => h.textContent));
  console.log(errors.length ? `FAIL page errors: ${errors.join(' | ')}` : `ok   design page renders ${sections.length} sections: ${sections.join(', ')}`);
  if (errors.length) process.exitCode = 1;
} finally { await h.close(); }
