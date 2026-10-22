import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, shot } from './harness.mjs';

const h = await launch();
try {
  writeFileSync(join(h.fixture, 'nested', 'regex.txt'), 'before <script> & "alpha-42" after\nalpha-43\n');
  writeFileSync(join(h.fixture, 'pathological.txt'), 'a'.repeat(5000) + '!');
  const a = await h.open();
  a.on('console', message => console.log('browser:', message.text()));
  const b = await h.open();
  async function run(page, text, regex = false) {
    await page.$eval('#fe-filter-btn', button => button.click());
    await page.$eval('#fe-find-text', (input, value) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, text);
    if (regex) await page.$eval('#fe-find-text-regex', input => input.click());
    await page.$eval('#fe-find-run', button => button.click());
  }
  await Promise.all([run(a, 'plain text'), run(b, 'inner')]);
  console.log('search started', await a.$eval('#fe-find-error', el => el.textContent), await b.$eval('#fe-find-error', el => el.textContent));
  assert.equal(await a.$eval('#fe-find-error', el => el.textContent), '');
  await Promise.all([a.waitForFunction(() => document.getElementById('fe-find-status').textContent.includes('scanned'), { polling: 100 }),
    b.waitForFunction(() => document.getElementById('fe-find-status').textContent.includes('scanned'), { polling: 100 })]);
  assert.match(await a.$eval('#fe-find-status', el => el.textContent), /1 matching file/);
  assert.match(await b.$eval('#fe-find-status', el => el.textContent), /0 matching files/);
  assert.equal(await a.$$eval('#fe-tbody .fe-find-snippet', nodes => nodes.length), 1);
  await a.$eval('#fe-filter-btn', button => { if (document.getElementById('fe-filter-bar').style.display === 'none') button.click(); });
  await a.$eval('#fe-deep-btn', button => button.click());   // the depth control shows with Subfolders on
  // DOM clicks: page a sits behind page b, where mouse clicks wait on frames that never come.
  await a.$eval('#fe-find-depth .fe-dd-btn', button => button.click());
  await a.$eval('.fe-dd-list .fe-dd-opt[data-v="1"]', option => option.click());
  await a.$eval('#fe-deep-btn', button => button.click());
  await a.$eval('#fe-deep-btn', button => button.click());
  await a.waitForFunction(() => !document.getElementById('fe-count').textContent.startsWith('Scanning'), { polling: 100, timeout: 5000 }).catch(async error => {
    console.log('crawl wait state', await a.$eval('#fe-count', el => el.textContent), await a.$eval('#fe-find-error', el => el.textContent));
    throw error;
  });
  console.log('crawl', await a.$eval('#fe-count', el => el.textContent), await a.$eval('#fe-find-error', el => el.textContent));
  await run(a, 'alpha-4[23]', true);
  await a.waitForFunction(() => document.getElementById('fe-find-status').textContent.includes('scanned'), { polling: 100 });
  const results = await a.$$eval('#fe-tbody .fe-find-snippet', nodes => nodes.map(el => el.innerHTML));
  console.log('deep search', await a.$eval('#fe-count', el => el.textContent), await a.$eval('#fe-find-status', el => el.textContent), await a.$eval('#fe-find-error', el => el.textContent));
  assert.equal(results.length, 1);
  assert.match(results[0], /&lt;script&gt;/);
  assert.match(results[0], /<mark>alpha-42<\/mark>/);
  await a.$eval('#fe-filter-btn', button => {
    if (document.getElementById('fe-filter-bar').style.display === 'none') button.click();
  });
  await shot(a, 'find-regex-dark');
  await a.evaluate(() => document.getElementById('fe-theme-btn').click());
  await shot(a, 'find-regex-light');
  await a.$eval('#fe-find-save', button => button.click());
  const saved = await a.$eval('#fe-sv-list .fe-view a', el => el.href);
  assert.match(saved, /#find=/);
  const restored = await h.browser.newPage();
  await restored.goto(saved, { waitUntil: 'load' });
  await restored.waitForFunction(() => document.getElementById('fe-find-status')?.textContent.includes('scanned'), { polling: 100 });
  assert.equal(await restored.$eval('#fe-find-text-regex', input => input.checked), true);
  assert.equal(await restored.$eval('#fe-find-depth', host => host.dataset.value), '1');
  assert.equal(await restored.$$eval('#fe-tbody .fe-find-snippet', nodes => nodes.length), 1);
  await b.$eval('#fe-find-text', input => { input.value = 'plain'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await b.$eval('#fe-find-run', button => button.click());
  await b.$eval('#fe-find-text', input => { input.value = 'absent'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await b.$eval('#fe-find-run', button => button.click());
  await b.waitForFunction(() => document.getElementById('fe-find-status').textContent.includes('scanned'), { polling: 100 });
  assert.equal(await b.$$eval('#fe-tbody .fe-find-snippet', nodes => nodes.length), 0);
  assert.match(await b.$eval('#fe-find-status', el => el.textContent), /0 matching files/);

  await b.$eval('#fe-filter-q', input => { input.value = 'pathological'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await b.$eval('#fe-find-text-regex', input => input.click());
  await b.$eval('#fe-find-text', input => { input.value = '('; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await b.$eval('#fe-find-run', button => button.click());
  assert.equal(await b.$eval('#fe-find-error', el => el.textContent), 'Invalid text regex');
  assert.equal(await b.$eval('#fe-find-cancel', el => el.style.display), 'none');
  await b.$eval('#fe-find-text', input => { input.value = '(a+)+$'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await b.$eval('#fe-find-run', button => button.click());
  await new Promise(resolve => setTimeout(resolve, 200));
  const responsive = await Promise.race([
    b.evaluate(() => { document.getElementById('fe-find-cancel').click(); return true; }),
    new Promise(resolve => setTimeout(() => resolve(false), 1000)),
  ]);
  assert.equal(responsive, true, 'pathological regex must not block the page thread');
  await b.waitForFunction(() => document.getElementById('fe-find-status').textContent.includes('partial'), { polling: 100 });
  assert.equal(await b.$$eval('#fe-tbody .fe-find-snippet', nodes => nodes.length), 0);
  await b.$eval('#fe-find-run', button => button.click());
  await b.waitForFunction(() => document.getElementById('fe-find-error').textContent === 'Text matching timed out', { polling: 100, timeout: 5000 });
  assert.match(await b.$eval('#fe-find-status', el => el.textContent), /partial/);
  await b.$eval('#fe-find-run', button => button.click());
  await b.close();
  const afterClose = await h.open();
  await run(afterClose, 'plain text');
  await afterClose.waitForFunction(() => document.getElementById('fe-find-status').textContent.includes('scanned'), { polling: 100, timeout: 5000 });
  assert.match(await afterClose.$eval('#fe-find-status', el => el.textContent), /1 matching file/);
  console.log('Independent tabs, content regex, escaped snippet, depth, saved view, stale query, regex cancellation, timeout, and tab-close recovery passed');
} finally {
  await h.close();
}
