import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const h = await launch();
try {
  writeFileSync(join(h.fixture, 'a'.repeat(30) + '!.txt'), 'x');
  const slow = await h.open();
  const other = await h.open();
  const eventMs = await slow.evaluate(() => {
    document.querySelector('#fe-regex-btn').click();
    const input = document.querySelector('#fe-filter-q');
    const start = performance.now();
    input.value = '(a+)+$';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return performance.now() - start;
  });
  assert.ok(eventMs < 100, `regex input blocked the page for ${eventMs} ms`);
  const otherTabResponsive = await Promise.race([
    other.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve(true)))),
    new Promise(resolve => setTimeout(() => resolve(false), 500)),
  ]);
  assert.equal(otherTabResponsive, true);
  await slow.waitForFunction(() => document.querySelector('#fe-count').textContent.includes('took too long'), { polling: 100, timeout: 5000 }).catch(async error => {
    console.log('name filter state:', await slow.$eval('#fe-count', el => el.textContent));
    throw error;
  });
  await slow.$eval('#fe-filter-q', input => {
    input.value = '^readme\\.md$';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await slow.waitForFunction(() => document.querySelector('#fe-count').textContent.includes('1 of'), { polling: 100, timeout: 5000 });
  assert.equal(await slow.$$eval('#fe-tbody .fe-nm', nodes => nodes.some(node => node.textContent === 'readme.md')), true);
  console.log(`Name regex stayed responsive (${eventMs.toFixed(1)} ms input), timed out, and recovered after a changed term; other tab responded`);
} finally { await h.close(); }
