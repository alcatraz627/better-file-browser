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
  // Every toggle is an icon with a name on hover; the bar ends in raw, copy, download and open large.
  const bar = await filePage.$eval(root, el => ({
    segs: [...el.querySelectorAll('.dl-seg')].map(s => s.getAttribute('aria-label') + ':' + [...s.querySelectorAll('button')].map(b => (b.querySelector('svg') && !b.textContent.trim() && b.title ? 'icon' : 'text')).join('|')),
    acts: [...el.querySelectorAll('.dl-acts > .dl-act:not([disabled]), .dl-acts > .dl-menu')].map(b => b.dataset.act ?? b.dataset.menu),
  }));
  assert.deepEqual(bar, { segs: ['Layout:icon|icon', 'Flow:icon|icon', 'Lines:icon|icon'], acts: ['raw', 'copy', 'export', 'expand'] });
  // The file says flowchart LR, so it opens left to right; ↓ redraws it top to bottom.
  assert.equal(await filePage.$eval(`${root} [data-opt="dir"] [aria-pressed="true"]`, b => b.dataset.v), 'LR');
  const ends = () => filePage.$eval(root, el => {
    const r = id => el.querySelector(`.dl-world g.node[data-node="${id}"]`)?.getBoundingClientRect();
    const a = r('A'), b = r('B');
    return a && b ? (b.left > a.right - 2 ? 'LR' : b.top > a.bottom - 2 ? 'TD' : '?') : 'none';
  });
  assert.equal(await ends(), 'LR');
  await filePage.click(`${root} [data-opt="dir"] [data-v="TD"]`);
  await filePage.waitForFunction(r => { const el = document.querySelector(r); const a = el.querySelector('.dl-world g.node[data-node="A"]')?.getBoundingClientRect(), b = el.querySelector('.dl-world g.node[data-node="B"]')?.getBoundingClientRect(); return a && b && b.top > a.bottom - 2; }, { timeout: 8000 }, root);
  assert.equal(await ends(), 'TD', 'Flow ↓ redraws the diagram top to bottom');
  await shot(filePage, 'mermaid-compact-down');
  await filePage.click(`${root} [data-opt="dir"] [data-v="LR"]`);
  await filePage.waitForFunction(r => { const el = document.querySelector(r); const a = el.querySelector('.dl-world g.node[data-node="A"]')?.getBoundingClientRect(), b = el.querySelector('.dl-world g.node[data-node="B"]')?.getBoundingClientRect(); return a && b && b.left > a.right - 2; }, { timeout: 8000 }, root);
  await sleep(300);

  // Pointing at the arrow lights it and both steps, and names them.
  const hitBox = await (await filePage.$(`${root} .dl-ehit`)).boundingBox();
  await filePage.mouse.move(hitBox.x + hitBox.width / 2, hitBox.y + hitBox.height / 2);
  await sleep(150);
  const hov = await filePage.$eval(root, el => ({ hint: el.querySelector('.dl-hint').textContent, lit: [...el.querySelectorAll('.dl-world g.node.dl-ehov')].map(g => g.dataset.node) }));
  assert.deepEqual(hov, { hint: 'Start → Finish', lit: ['A', 'B'] }, 'hovering the arrow lights it and both ends');
  await shot(filePage, 'mermaid-arrow-hover');
  await filePage.mouse.move(5, 5);
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

  // The raw toggle swaps the picture for the mermaid text, and back.
  await filePage.click(`${root} [data-act="raw"]`);
  const raw = await filePage.$eval(root, el => ({ text: el.querySelector('.dl-raw').textContent, shown: !el.querySelector('.dl-raw').hidden, main: getComputedStyle(el.querySelector('.dl-main')).display, pressed: el.querySelector('[data-act="raw"]').getAttribute('aria-pressed') }));
  assert.deepEqual(raw, { text: 'flowchart LR\n  A[Start] --> B[Finish]', shown: true, main: 'none', pressed: 'true' });
  await shot(filePage, 'mermaid-compact-raw');
  await filePage.click(`${root} [data-act="raw"]`);
  assert.equal(await filePage.$eval(`${root} .dl-main`, el => getComputedStyle(el).display), 'grid');

  // Download is one menu: SVG, PNG, PDF, Markdown and text, each saved with a done toast.
  const downloads = mkdtempSync(join(tmpdir(), 'bfb-mermaid-dl-'));
  const cdp = await filePage.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  const full = f => existsSync(f) && statSync(f).size > 0;
  const waitFile = async f => { for (let i = 0; i < 60 && !full(f); i++) await sleep(100); await sleep(100); return full(f); };
  await filePage.click(`${root} [data-menu="export"] .dl-menu-btn`);
  const items = await filePage.$eval(`${root} [data-menu="export"] .dl-menu-list`, el => [...el.querySelectorAll('[data-export]')].map(b => b.dataset.export + (b.querySelector('svg') ? '+icon' : '')));
  assert.deepEqual(items, ['svg+icon', 'png+icon', 'pdf+icon', 'md+icon', 'txt+icon']);
  await shot(filePage, 'mermaid-download-menu');
  for (const f of ['svg', 'png', 'pdf', 'md', 'txt']) {
    if (f !== 'svg') await filePage.click(`${root} [data-menu="export"] .dl-menu-btn`);
    await filePage.click(`${root} [data-export="${f}"]`);
    assert.ok(await waitFile(join(downloads, `readme.${f}`)), `${f} writes readme.${f}`);
    await filePage.waitForFunction((r, f) => document.querySelector(`${r} .dl-toast`)?.textContent === `Saved readme.${f}`, { timeout: 4000 }, root, f);
  }
  const file = readFileSync(join(downloads, 'readme.svg'), 'utf8');
  assert.match(file, /^<svg[^>]+xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.ok(file.includes('Finish'));
  assert.ok(statSync(join(downloads, 'readme.png')).size > 1000, 'the PNG holds a picture');
  assert.equal(readFileSync(join(downloads, 'readme.pdf')).subarray(0, 8).toString(), '%PDF-1.4');
  assert.match(readFileSync(join(downloads, 'readme.md'), 'utf8'), /^# readme\n\n```mermaid\nflowchart LR\n {2}A\[Start\] --> B\[Finish\]\n```\n$/);
  assert.equal(readFileSync(join(downloads, 'readme.txt'), 'utf8'), 'flowchart LR\n  A[Start] --> B[Finish]');
  await h.browser.defaultBrowserContext().overridePermissions('file://', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']).catch(() => {});
  await filePage.click(`${root} [data-act="copy"]`);
  await sleep(150);
  const copied = await filePage.$eval(`${root} .dl-toast`, el => el.textContent);
  assert.match(copied, /Mermaid copied|blocked/, 'Copy says what happened');

  // Open large: the full viewer with its ways of reading and the side panel; Esc closes.
  await filePage.click(`${root} [data-act="expand"]`);
  await filePage.waitForSelector('.fe-dv-view .fe-dv-diagram[data-ready] .dl-world > svg');
  await sleep(400);
  const large = await filePage.$eval('.fe-dv-view', el => ({
    bars: [...el.querySelectorAll('.fe-dv-view-head, .dl-top')].filter(b => getComputedStyle(b).display !== 'none').length,
    title: el.querySelector('.dl-title b')?.textContent, sub: el.querySelector('.dl-subtitle')?.textContent, icon: !!el.querySelector('.dl-title-icon svg'),
    modes: [...el.querySelectorAll('.dl-modes [data-mode]')].map(b => b.dataset.mode),
    panel: getComputedStyle(el.querySelector('.dl-panel')).display !== 'none',
    segs: [...el.querySelectorAll('.dl-seg')].map(s => s.getAttribute('aria-label')),
    menus: [...el.querySelectorAll('.dl-menu')].map(m => m.dataset.menu),
    close: !!el.querySelector('[data-act="close"]'),
  }));
  assert.deepEqual(large, { bars: 1, title: 'readme', sub: 'readme.md · 2 steps, 1 link', icon: true, modes: ['navigate', 'focus', 'walkthrough'], panel: true, segs: ['Layout', 'Flow', 'Lines'], menus: ['look', 'export'], close: true });
  await filePage.click('.fe-dv-view .dl-world g.node');
  await filePage.waitForFunction(() => document.querySelector('.fe-dv-view .dl-panel h2'));
  await shot(filePage, 'mermaid-large-dark');
  // The panel drags wider and hides with its button.
  const pw = () => filePage.$eval('.fe-dv-view .dl-panel', el => Math.round(el.getBoundingClientRect().width));
  const w0 = await pw();
  const rz = await (await filePage.$('.fe-dv-view .dl-resize')).boundingBox();
  await filePage.mouse.move(rz.x + 3, rz.y + 200);
  await filePage.mouse.down();
  await filePage.mouse.move(rz.x - 120, rz.y + 200, { steps: 5 });
  await filePage.mouse.up();
  const w1 = await pw();
  assert.ok(w1 > w0 + 100, `dragging the edge widens the panel: ${w0} → ${w1}`);
  await filePage.click('.fe-dv-view [data-act="panel"]');
  assert.equal(await filePage.$eval('.fe-dv-view .dl-panel', el => getComputedStyle(el).display), 'none');
  await shot(filePage, 'mermaid-large-nopanel');
  await filePage.click('.fe-dv-view [data-act="panel"]');
  assert.equal(await pw(), w1, 'the panel comes back at the width it was dragged to');
  // Colour and shapes sit in one menu.
  await filePage.click('.fe-dv-view [data-menu="look"] .dl-menu-btn');
  await shot(filePage, 'mermaid-look-menu');
  await filePage.click('.fe-dv-view [data-opt="style"] [data-v="outline"]');
  assert.equal(await filePage.$eval('.fe-dv-view .dl-stage', el => el.dataset.style), 'outline');
  await filePage.click('.fe-dv-view [data-menu="look"] .dl-menu-btn');
  await filePage.click('.fe-dv-view [data-opt="style"] [data-v="soft"]');
  await filePage.click('.fe-dv-view [data-act="close"]');
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
