import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, shot } from './harness.mjs';

const h = await launch();
try {
  const page = await h.open();
  await page.click('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td.c-nm');
  await page.waitForSelector('#fe-ql-body .fe-md-mermaid-view > svg');
  const diagram = () => page.$eval('#fe-ql-body .fe-md-mermaid', el => ({
    id: el.querySelector('.fe-md-mermaid-view > svg')?.id,
    labels: ['Start', 'Finish'].map(label => el.querySelector('.fe-md-mermaid-view > svg')?.textContent?.includes(label)),
    fill: getComputedStyle(el.querySelector('svg .node rect')).fill,
    sourceHidden: el.querySelector('.fe-md-mermaid-source').hidden,
  }));
  const dark = await diagram();
  assert.deepEqual(dark.labels, [true, true]);
  assert.equal(dark.sourceHidden, true);
  await shot(page, 'mermaid-dark');

  await page.evaluate(() => document.getElementById('fe-theme-btn').click());
  await page.waitForFunction(id => {
    const svg = document.querySelector('#fe-ql-body .fe-md-mermaid-view > svg');
    return svg && svg.id !== id;
  }, {}, dark.id);
  const light = await diagram();
  assert.deepEqual(light.labels, dark.labels);
  assert.notEqual(light.fill, dark.fill);
  await shot(page, 'mermaid-light');

  const filePage = await h.browser.newPage();
  filePage.setDefaultTimeout(10_000);
  await filePage.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await filePage.waitForSelector('#fe-page .fe-md-mermaid-view > svg');
  assert.equal(await filePage.$eval('#fe-page .fe-md-mermaid-view > svg', el => el.textContent.includes('Start')), true);

  // Moving around the diagram: the toolbar zooms, a drag pans once zoomed, a double-click fits again.
  const view = () => filePage.$eval('#fe-page .fe-md-mermaid-view', el => ({
    zoom: Number(el.dataset.zoom), transform: el.querySelector(':scope > svg').style.transform,
  }));
  assert.equal((await view()).zoom, 100);
  await filePage.click('#fe-page [data-mm="in"]');
  await filePage.click('#fe-page [data-mm="in"]');
  const zoomed = await view();
  assert.ok(zoomed.zoom > 150, `two zoom-ins grow the diagram: ${zoomed.zoom}`);
  assert.match(zoomed.transform, /scale\(/);
  await shot(filePage, 'mermaid-zoomed');
  const box = await (await filePage.$('#fe-page .fe-md-mermaid-view')).boundingBox();
  await filePage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await filePage.mouse.down();
  await filePage.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 - 20, { steps: 4 });
  await filePage.mouse.up();
  const panned = await view();
  assert.notEqual(panned.transform, zoomed.transform, 'a drag moves the zoomed diagram');
  assert.equal(panned.zoom, zoomed.zoom);
  await filePage.click('#fe-page .fe-md-mermaid-view', { count: 2 });
  assert.deepEqual(await view(), { zoom: 100, transform: '' });
  // ⌘ or ⌃ with the wheel zooms; the wheel alone leaves the page to scroll.
  const wheel = ctrlKey => filePage.$eval('#fe-page .fe-md-mermaid-view', (el, ctrlKey) => {
    const r = el.getBoundingClientRect();
    return el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey, clientX: r.x + 40, clientY: r.y + 40, bubbles: true, cancelable: true }));
  }, ctrlKey);
  assert.equal(await wheel(false), true, 'a plain wheel is not taken');
  assert.equal((await view()).zoom, 100);
  assert.equal(await wheel(true), false, 'a ⌃ wheel is taken');
  assert.ok((await view()).zoom > 100);
  await filePage.click('#fe-page [data-mm="fit"]');
  assert.equal((await view()).zoom, 100);

  // The source shows under the diagram and hides again.
  await filePage.click('#fe-page [data-mm="source"]');
  assert.deepEqual(await filePage.$eval('#fe-page .fe-md-mermaid', el => [el.querySelector('.fe-md-mermaid-source').hidden, el.querySelector('[data-mm="source"]').getAttribute('aria-pressed')]), [false, 'true']);
  await filePage.click('#fe-page [data-mm="source"]');
  assert.equal(await filePage.$eval('#fe-page .fe-md-mermaid-source', el => el.hidden), true);

  // Save hands the browser an .svg file.
  const downloads = mkdtempSync(join(tmpdir(), 'bfb-mermaid-dl-'));
  const cdp = await filePage.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await filePage.click('#fe-page [data-mm="save"]');
  const saved = join(downloads, 'diagram.svg');
  for (let i = 0; i < 50 && !existsSync(saved); i++) await new Promise(r => setTimeout(r, 100));
  assert.ok(existsSync(saved), 'Save writes diagram.svg');
  const file = readFileSync(saved, 'utf8');
  assert.match(file, /^<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.ok(file.includes('Finish') && !/transform: ?translate/.test(file.slice(0, 400)));

  // The large view fills the window and zooms the same way; Esc closes it.
  const inline = await (await filePage.$('#fe-page .fe-md-mermaid-view > svg')).boundingBox();
  await filePage.click('#fe-page [data-mm="large"]');
  await filePage.waitForSelector('.fe-dv-view .fe-dv-diagram > svg');
  await new Promise(r => setTimeout(r, 400));
  await shot(filePage, 'mermaid-large-fit');
  const large = await (await filePage.$('.fe-dv-view .fe-dv-diagram > svg')).boundingBox();
  assert.ok(large.width > inline.width && large.height > inline.height * 1.5, `large view is bigger: ${JSON.stringify({ inline, large })}`);
  assert.equal(await filePage.$eval('.fe-dv-diagram > svg', el => el.textContent.includes('Finish')), true);
  await filePage.click('.fe-dv-view [data-mm="in"]');
  assert.ok(await filePage.$eval('.fe-dv-diagram', el => Number(el.dataset.zoom) > 100));
  await shot(filePage, 'mermaid-large-dark');
  await filePage.keyboard.press('Escape');
  await filePage.waitForFunction(() => !document.querySelector('.fe-dv-view'));
  // Once more in the other theme: the large view takes the redrawn diagram.
  const before = await filePage.$eval('#fe-page .fe-md-mermaid-view > svg', el => el.id);
  await filePage.evaluate(() => document.getElementById('fe-theme-btn').click());
  await filePage.waitForFunction(id => document.querySelector('#fe-page .fe-md-mermaid-view > svg')?.id !== id, {}, before);
  await filePage.click('#fe-page [data-mm="large"]');
  await filePage.waitForSelector('.fe-dv-view .fe-dv-diagram > svg');
  await new Promise(r => setTimeout(r, 400));
  await shot(filePage, 'mermaid-large-other-theme');
  await filePage.keyboard.press('Escape');
  await filePage.waitForFunction(() => !document.querySelector('.fe-dv-view'));

  writeFileSync(join(h.fixture, 'invalid.md'), '```mermaid\nnot a diagram\n```\n');
  await filePage.goto('file://' + h.fixture + '/invalid.md', { waitUntil: 'load' });
  await filePage.waitForFunction(() => document.querySelector('#fe-page .fe-md-mermaid-source')?.hidden === false);
  const invalid = await filePage.$eval('#fe-page .fe-md-mermaid', el => ({
    message: el.querySelector('.fe-md-mermaid-view').textContent,
    source: el.querySelector('.fe-md-mermaid-source').textContent,
    svg: !!el.querySelector('.fe-md-mermaid-view > svg'),
  }));
  assert.match(invalid.message, /Could not render/);
  assert.equal(invalid.source, 'not a diagram');
  assert.equal(invalid.svg, false);
  console.log('Mermaid preview, theme change, file page, and invalid source passed');
} finally {
  await h.close();
}
