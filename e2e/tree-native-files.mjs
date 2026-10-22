import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, shot } from './harness.mjs';

const h = await launch();
try {
  const htmlPath = join(h.fixture, 'live page.html');
  writeFileSync(htmlPath, '<!doctype html><title>Native example</title><h1>Rendered heading</h1><script>document.body.dataset.executed = "yes"</script>');
  const native = await h.browser.newPage();
  await native.goto('file://' + htmlPath, { waitUntil: 'load' });
  console.log('native HTML opened');
  assert.equal(await native.$eval('body', body => body.dataset.executed), 'yes');
  assert.equal(await native.$('#fe'), null);

  const page = await h.open();
  await page.click('#fe-settings-btn');
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="files"]');
  const original = await page.$eval('#fe-st-excluded-exts', host => host.dataset.value);
  assert.match(original, /\.html/);
  assert.match(original, /\.pdf/);
  await shot(page, 'settings-exclusions-dark');
  await page.evaluate(() => document.getElementById('fe-theme-btn').click());
  await shot(page, 'settings-exclusions-light');
  await page.evaluate(() => document.getElementById('fe-theme-btn').click());
  // Leave only .pdf: remove every other chip with its × button.
  for (let i = 0; i < 6; i++) {
    const other = await page.$$eval('#fe-st-excluded-exts .chip', chips => chips.findIndex(c => !c.textContent.startsWith('.pdf')));
    if (other < 0) break;
    await page.$$eval('#fe-st-excluded-exts .chip button', (bs, j) => bs[j].click(), other);
  }
  assert.equal(await page.$eval('#fe-st-excluded-exts', host => host.dataset.value), '.pdf');
  const source = await h.browser.newPage();
  await source.goto('file://' + htmlPath, { waitUntil: 'load' });
  await source.waitForSelector('#fe-page .fe-code');
  console.log('HTML source opened');
  const sourceText = await source.$eval('#fe-page', el => el.textContent);
  console.log('HTML source read', sourceText.length);
  assert.match(sourceText, /<h1>Rendered heading<\/h1>/);
  await source.close();
  await page.$eval('#fe-st-excluded-reset', button => button.click());
  console.log('reset clicked');
  assert.match(await page.$eval('#fe-st-excluded-exts', host => host.dataset.value), /\.html/);
  await page.$eval('#fe-settings-modal .fe-dlg-close', button => button.click());
  console.log('settings reset');

  await page.$eval('#fe-view-group [data-v="tree"]', button => button.click());
  console.log('tree selected');
  assert.ok(await page.$('#fe-tree [data-idx] .fe-nm'));
  assert.equal(await page.$('#fe-tree .fe-nm[data-name="inner.txt"]'), null);
  writeFileSync(join(h.fixture, 'nested', 'added after open.txt'), 'one');
  await page.$eval('#fe-tree .fe-tree-row', () => {});
  const toggle = name => page.evaluate(name => {
    const row = [...document.querySelectorAll('#fe-tree .fe-tree-row')]
      .find(row => row.querySelector('.fe-nm')?.textContent === name);
    assertRow(row, name);
    row.querySelector('.fe-tree-toggle').click();
    function assertRow(row, label) { if (!row) throw new Error('missing tree row: ' + label); }
  }, name);
  await toggle('nested');
  console.log('nested toggled');
  await page.waitForFunction(() => [...document.querySelectorAll('#fe-tree .fe-nm')]
    .some(el => el.textContent === 'added after open.txt'), { timeout: 5000 }).catch(async error => {
    console.log('tree after expansion:', await page.$eval('#fe-tree', el => el.textContent));
    throw error;
  });
  await toggle('deeper');
  await page.waitForFunction(() => [...document.querySelectorAll('#fe-tree .fe-nm')]
    .some(el => el.textContent === 'deepest.md'));
  const paths = await page.$$eval('#fe-tree .fe-tree-row', rows => rows.map(row => ({
    name: row.querySelector('.fe-nm').textContent,
    href: row.querySelector('a').href,
    indent: parseInt(row.style.paddingLeft),
  })));
  assert.ok(paths.find(row => row.name === 'nested').indent < paths.find(row => row.name === 'deeper').indent);
  assert.ok(paths.find(row => row.name === 'deeper').indent < paths.find(row => row.name === 'deepest.md').indent);
  assert.equal(paths.find(row => row.name === 'deepest.md').href, 'file://' + h.fixture + '/nested/deeper/deepest.md');
  await shot(page, 'tree-expanded-dark');
  await toggle('nested');
  assert.equal(await page.$$eval('#fe-tree .fe-nm', nodes => nodes.some(el => el.textContent === 'deepest.md')), false);
  writeFileSync(join(h.fixture, 'nested', 'added after cache.txt'), 'two');
  await toggle('nested');
  assert.equal(await page.$$eval('#fe-tree .fe-nm', nodes => nodes.some(el => el.textContent === 'added after cache.txt')), false);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-tree');
  await page.evaluate(() => {
    const clickNested = () => [...document.querySelectorAll('#fe-tree .fe-tree-row')]
      .find(el => el.querySelector('.fe-nm')?.textContent === 'nested')
      .querySelector('.fe-tree-toggle').click();
    clickNested();
    clickNested();
  });
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll('#fe-tree .fe-tree-row')]
      .find(el => el.querySelector('.fe-nm')?.textContent === 'nested');
    return row.querySelector('.fe-tree-toggle')?.getAttribute('aria-expanded') === 'false' && !/Could not read folder|Loading/.test(row.nextElementSibling?.textContent ?? '');
  });
  await toggle('nested');
  await page.waitForFunction(() => [...document.querySelectorAll('#fe-tree .fe-nm')]
    .some(el => el.textContent === 'added after cache.txt'));
  await page.evaluate(() => document.getElementById('fe-theme-btn').click());
  await shot(page, 'tree-expanded-light');
  console.log('Native HTML default, source opt-in, reset, lazy tree expansion, nested paths, collapse, cache, and reload passed');
} finally {
  await h.close();
}
