import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, shot } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const DRAWN = '.fe-md-mermaid-view .dl-world > svg';

const h = await launch();
try {
  const page = await h.open();
  await page.click('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td.c-nm');
  await page.waitForSelector(`#fe-ql-body ${DRAWN}`);
  const diagram = () => page.$eval('#fe-ql-body .fe-md-mermaid', (el, DRAWN) => ({
    labels: ['Start', 'Finish'].map(label => el.querySelector(DRAWN)?.textContent?.includes(label)),
    fill: getComputedStyle(el.querySelector('.dl-world g.node rect, .dl-world g.node path')).fill,
    sourceHidden: el.querySelector('.fe-md-mermaid-source').hidden,
  }), DRAWN);
  const dark = await diagram();
  assert.deepEqual(dark.labels, [true, true]);
  assert.equal(dark.sourceHidden, true);
  await shot(page, 'mermaid-dark');

  // The theme switch recolours the same drawing.
  await page.evaluate(() => document.getElementById('fe-theme-btn').click());
  await page.waitForFunction(fill => {
    const n = document.querySelector('#fe-ql-body .dl-world g.node rect, #fe-ql-body .dl-world g.node path');
    return n && getComputedStyle(n).fill !== fill;
  }, {}, dark.fill);
  const light = await diagram();
  assert.deepEqual(light.labels, dark.labels);
  await shot(page, 'mermaid-light');
  await page.evaluate(() => document.getElementById('fe-theme-btn').click());

  const filePage = await h.browser.newPage();
  filePage.setDefaultTimeout(10_000);
  await filePage.setViewport({ width: 1280, height: 900 });
  await filePage.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await filePage.waitForSelector(`#fe-page ${DRAWN}`);
  await filePage.waitForSelector('#fe-page .fe-md-mermaid .dl[data-ready]');
  const root = '#fe-page .fe-md-mermaid .dl';

  // The toolbar offers layout, flow and lines; the page keeps its own wheel.
  const bar = await filePage.$eval(root, el => [...el.querySelectorAll('.dl-seg')].map(s => s.getAttribute('aria-label') + ':' + [...s.querySelectorAll('button')].map(b => b.textContent).join('|')));
  assert.deepEqual(bar, ['Layout:Tidy|Compact', 'Flow:↓|→', 'Lines:Curved|Square']);
  // The file says flowchart LR, so it opens left to right.
  assert.equal(await filePage.$eval(`${root} [data-opt="dir"] [aria-pressed="true"]`, b => b.dataset.v), 'LR');
  const pct = () => filePage.$eval(`${root} .dl-pct`, el => parseInt(el.textContent, 10));
  const worldT = () => filePage.$eval(`${root} .dl-world`, el => el.style.transform);
  const fit0 = await pct();
  await filePage.click(`${root} [data-z="in"]`);
  await filePage.click(`${root} [data-z="in"]`);
  assert.ok(await pct() > fit0 * 1.4, 'two zoom-ins grow the diagram');
  await shot(filePage, 'mermaid-zoomed');
  const box = await (await filePage.$(`${root} .dl-stage`)).boundingBox();
  const zoomedT = await worldT();
  await filePage.mouse.move(box.x + 12, box.y + box.height - 12);
  await filePage.mouse.down();
  await filePage.mouse.move(box.x + 60, box.y + box.height - 40, { steps: 4 });
  await filePage.mouse.up();
  assert.notEqual(await worldT(), zoomedT, 'a drag on the canvas pans');
  await filePage.mouse.click(box.x + 8, box.y + box.height - 8, { count: 2 });
  await sleep(450);
  assert.equal(await pct(), fit0, 'a double-click fits again');
  const wheel = ctrlKey => filePage.$eval(`${root} .dl-stage`, (el, ctrlKey) => {
    const r = el.getBoundingClientRect();
    return el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey, clientX: r.x + 40, clientY: r.y + 40, bubbles: true, cancelable: true }));
  }, ctrlKey);
  assert.equal(await wheel(false), true, 'a plain wheel is left to the page');
  assert.equal(await pct(), fit0);
  assert.equal(await wheel(true), false, 'a ⌃ wheel zooms');
  assert.ok(await pct() > fit0);

  // Square lines redraw with rounded corners; the other layout redraws the steps.
  await filePage.click(`${root} [data-opt="edges"] [data-v="rounded"]`);
  const pressed = await filePage.waitForFunction(r => document.querySelector(`${r} [data-opt="edges"] [data-v="rounded"]`)?.getAttribute('aria-pressed') === 'true', { timeout: 2000 }, root).then(() => true, () => false);
  assert.ok(pressed, `Square stays picked: ${await filePage.$eval(`${root} [data-opt="edges"]`, s => [...s.querySelectorAll('button')].map(b => b.dataset.v + '=' + b.getAttribute('aria-pressed')).join(' '))}`);
  await filePage.click(`${root} [data-opt="layout"] [data-v="dagre"]`);
  await filePage.waitForFunction(r => document.querySelector(`${r} [data-opt="layout"] [data-v="dagre"]`)?.getAttribute('aria-pressed') === 'true', {}, root);
  await filePage.waitForFunction(sel => document.querySelector(sel)?.textContent.includes('Finish'), {}, `#fe-page ${DRAWN}`);
  await sleep(300);
  await shot(filePage, 'mermaid-compact-square');
  await filePage.click(`${root} [data-opt="layout"] [data-v="elk"]`);
  await filePage.click(`${root} [data-opt="edges"] [data-v="curved"]`);
  await sleep(300);

  // The source shows under the diagram and hides again.
  await filePage.click(`${root} [data-act="source"]`);
  assert.deepEqual(await filePage.$eval('#fe-page .fe-md-mermaid', el => [el.querySelector('.fe-md-mermaid-source').hidden, el.querySelector('[data-act="source"]').getAttribute('aria-pressed')]), [false, 'true']);
  await filePage.click(`${root} [data-act="source"]`);
  assert.equal(await filePage.$eval('#fe-page .fe-md-mermaid-source', el => el.hidden), true);

  // SVG and PNG save the picture as it looks; Mermaid copies the source.
  const downloads = mkdtempSync(join(tmpdir(), 'bfb-mermaid-dl-'));
  const cdp = await filePage.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  const full = f => existsSync(f) && statSync(f).size > 0;
  const waitFile = async f => { for (let i = 0; i < 60 && !full(f); i++) await sleep(100); await sleep(100); return full(f); };
  await filePage.click(`${root} [data-act="svg"]`);
  assert.ok(await waitFile(join(downloads, 'readme.svg')), 'SVG writes readme.svg');
  const file = readFileSync(join(downloads, 'readme.svg'), 'utf8');
  assert.match(file, /^<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.ok(file.includes('Finish'));
  await filePage.click(`${root} [data-act="png"]`);
  const pngOk = await waitFile(join(downloads, 'readme.png'));
  const toast = await filePage.$eval(`${root} .dl-toast`, el => el.textContent);
  assert.ok(pngOk && statSync(join(downloads, 'readme.png')).size > 1000, `PNG writes readme.png: ${JSON.stringify({ pngOk, toast })}`);
  await h.browser.defaultBrowserContext().overridePermissions('file://', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']).catch(() => {});
  await filePage.click(`${root} [data-act="copy"]`);
  await sleep(150);
  const copied = await filePage.$eval(`${root} .dl-toast`, el => el.textContent);
  assert.match(copied, /Mermaid copied|blocked/, 'Copy says what happened');

  // Open large: the full viewer with its ways of reading and the side panel; Esc closes.
  await filePage.click(`${root} [data-act="expand"]`);
  await filePage.waitForSelector('.fe-dv-view .fe-dv-diagram[data-ready] .dl-world > svg');
  await sleep(400);
  const large = await filePage.$eval('.fe-dv-view .fe-dv-diagram', el => ({
    modes: [...el.querySelectorAll('.dl-modes [data-mode]')].map(b => b.dataset.mode),
    panel: getComputedStyle(el.querySelector('.dl-panel')).display !== 'none',
    segs: [...el.querySelectorAll('.dl-seg')].map(s => s.getAttribute('aria-label')),
  }));
  assert.deepEqual(large.modes, ['navigate', 'focus', 'walkthrough']);
  assert.ok(large.panel, 'the large view has the side panel');
  assert.deepEqual(large.segs, ['Layout', 'Flow', 'Lines', 'Colour', 'Shapes']);
  await filePage.click('.fe-dv-view .dl-world g.node');
  await filePage.waitForFunction(() => document.querySelector('.fe-dv-view .dl-panel h2'));
  await shot(filePage, 'mermaid-large-dark');
  await filePage.keyboard.press('Escape');
  await sleep(150);
  await filePage.keyboard.press('Escape');
  await filePage.waitForFunction(() => !document.querySelector('.fe-dv-view'));

  // Once more in the other theme.
  await filePage.evaluate(() => document.getElementById('fe-theme-btn').click());
  await sleep(300);
  await filePage.click(`${root} [data-act="expand"]`);
  await filePage.waitForSelector('.fe-dv-view .fe-dv-diagram[data-ready] .dl-world > svg');
  await sleep(400);
  await shot(filePage, 'mermaid-large-light');
  await filePage.keyboard.press('Escape');
  await filePage.waitForFunction(() => !document.querySelector('.fe-dv-view'));
  await shot(filePage, 'mermaid-compact-light');

  // A diagram that is not a flowchart is drawn as mermaid draws it.
  writeFileSync(join(h.fixture, 'seq.md'), '```mermaid\nsequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi\n```\n');
  await filePage.goto('file://' + h.fixture + '/seq.md', { waitUntil: 'load' });
  await filePage.waitForSelector(`#fe-page ${DRAWN}`);
  const seq = await filePage.$eval('#fe-page .fe-md-mermaid .dl', el => ({ plain: el.classList.contains('dl-plain'), text: el.querySelector('.dl-world svg').textContent.includes('Hello') }));
  assert.deepEqual(seq, { plain: true, text: true });
  await shot(filePage, 'mermaid-sequence');

  writeFileSync(join(h.fixture, 'invalid.md'), '```mermaid\nnot a diagram\n```\n');
  await filePage.goto('file://' + h.fixture + '/invalid.md', { waitUntil: 'load' });
  await filePage.waitForFunction(() => document.querySelector('#fe-page .fe-md-mermaid-source')?.hidden === false);
  const invalid = await filePage.$eval('#fe-page .fe-md-mermaid', el => ({
    message: el.querySelector('.fe-md-mermaid-view').textContent,
    source: el.querySelector('.fe-md-mermaid-source').textContent,
    svg: !!el.querySelector('.dl-world svg'),
  }));
  assert.match(invalid.message, /Could not render/);
  assert.equal(invalid.source, 'not a diagram');
  assert.equal(invalid.svg, false);
  console.log('Mermaid viewer: preview, theme, zoom and pan, layout and lines, source, SVG, PNG, copy, large view, sequence and invalid source passed');
} finally {
  await h.close();
}
