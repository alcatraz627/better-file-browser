// Screenshots the wall of every frame, six phones to an image, in dark and
// light. Usage: node shoot.mjs <base-url> <out-dir>
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { findChrome } from '../../e2e/harness.mjs';
const puppeteer = createRequire(import.meta.url)('puppeteer-core');

const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true });
try {
  for (const theme of ['dark', 'light']) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1300, height: 1000 });
    await page.goto(`${base}index.html?wall&theme=${theme}`, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 600));
    const figs = await page.$$eval('#wall figure', fs => fs.map(f => { const r = f.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height }; }));
    for (let i = 0; i < figs.length; i += 6) {
      const part = figs.slice(i, i + 6);
      const x = Math.min(...part.map(f => f.x)), y = Math.min(...part.map(f => f.y));
      const w = Math.max(...part.map(f => f.x + f.w)) - x, h = Math.max(...part.map(f => f.y + f.h)) - y;
      const path = `${out}/${theme}-${String(i / 6 + 1).padStart(2, '0')}.png`;
      await page.screenshot({ path, clip: { x, y, width: w, height: h }, captureBeyondViewport: true });
      console.log(path);
    }
    await page.close();
  }
} finally { await browser.close(); }
