import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, shot } from './harness.mjs';

const h = await launch();
try {
  const page = await h.open();
  await page.click('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td.c-nm');
  await page.waitForSelector('#fe-ql-body .fe-md-mermaid svg');
  const diagram = () => page.$eval('#fe-ql-body .fe-md-mermaid', el => ({
    id: el.querySelector('svg')?.id,
    labels: ['Start', 'Finish'].map(label => el.querySelector('svg')?.textContent?.includes(label)),
    fill: getComputedStyle(el.querySelector('svg .node rect')).fill,
    sourceHidden: el.querySelector('.fe-md-mermaid-source').hidden,
  }));
  const dark = await diagram();
  assert.deepEqual(dark.labels, [true, true]);
  assert.equal(dark.sourceHidden, true);
  await shot(page, 'mermaid-dark');

  await page.evaluate(() => document.getElementById('fe-theme-btn').click());
  await page.waitForFunction(id => {
    const svg = document.querySelector('#fe-ql-body .fe-md-mermaid svg');
    return svg && svg.id !== id;
  }, {}, dark.id);
  const light = await diagram();
  assert.deepEqual(light.labels, dark.labels);
  assert.notEqual(light.fill, dark.fill);
  await shot(page, 'mermaid-light');

  const filePage = await h.browser.newPage();
  await filePage.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await filePage.waitForSelector('#fe-page .fe-md-mermaid svg');
  assert.equal(await filePage.$eval('#fe-page .fe-md-mermaid svg', el => el.textContent.includes('Start')), true);

  writeFileSync(join(h.fixture, 'invalid.md'), '```mermaid\nnot a diagram\n```\n');
  await filePage.goto('file://' + h.fixture + '/invalid.md', { waitUntil: 'load' });
  await filePage.waitForFunction(() => document.querySelector('#fe-page .fe-md-mermaid-source')?.hidden === false);
  const invalid = await filePage.$eval('#fe-page .fe-md-mermaid', el => ({
    message: el.querySelector('.fe-md-mermaid-view').textContent,
    source: el.querySelector('.fe-md-mermaid-source').textContent,
    svg: !!el.querySelector('svg'),
  }));
  assert.match(invalid.message, /Could not render/);
  assert.equal(invalid.source, 'not a diagram');
  assert.equal(invalid.svg, false);
  console.log('Mermaid preview, theme change, file page, and invalid source passed');
} finally {
  await h.close();
}
