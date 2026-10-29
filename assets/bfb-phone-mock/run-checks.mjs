// Opens the mock in headless Chrome through the phone server and prints
// runChecks() and crawl(). Usage: node run-checks.mjs [base-url]
import { createRequire } from 'node:module';
import { findChrome } from '../../e2e/harness.mjs';
const puppeteer = createRequire(import.meta.url)('puppeteer-core');

const base = process.argv[2] || 'http://127.0.0.1:5123' + new URL('.', import.meta.url).pathname;
const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewport({ width: 1400, height: 1000 });
  await page.goto(base + 'index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof KIT_AUDIT !== 'undefined' && KIT_AUDIT !== null, { timeout: 5000 }).catch(() => {
    console.log('the mock did not finish loading:\n  ' + errors.join('\n  '));
    process.exit(1);
  });
  const checks = await page.evaluate(() => runChecks());
  const walk = await page.evaluate(() => crawl());
  console.log(`checks: ${checks.drawn} of ${checks.of} frames drawn, ${checks.problems.length} problems`);
  for (const p of checks.problems) console.log('  ' + p);
  console.log(`crawl: ${walk.states} states, ${walk.problems.length} problems`);
  for (const p of walk.problems.slice(0, 40)) console.log('  ' + p);
  if (errors.length) console.log('page errors:\n  ' + errors.join('\n  '));
  if (checks.problems.length || walk.problems.length || errors.length) process.exitCode = 1;
} finally { await browser.close(); }
