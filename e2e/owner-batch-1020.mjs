// Owner review 2026-10-20: default sort in Settings, and tooltips on icon-only
// buttons. Each check maps to a row in docs/plan/20261020-consistency-pass.md.
import { writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, shot } from './harness.mjs';

const h = await launch();
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failed++; };
const names = p => p.$$eval('#fe-tbody tr[data-idx]:not(.par) .fe-nm', els => els.map(e => e.textContent));

try {
  // R11: Settings sets the order, the current folder re-sorts, and a folder
  // opened later uses it too.
  let page = await h.open();
  await page.click('#fe-settings-btn');
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="appearance"]').catch(() => null);
  await page.select('#fe-st-sort', 'size');
  await page.select('#fe-st-sort-dir', 'desc');
  await page.select('#fe-st-group', 'none');
  await page.keyboard.press('Escape');
  const here = await names(page);
  const stored = await h.store.json('bfb-sort-v1', null);
  check(stored?.col === 'size' && stored?.dir === 'desc', `Settings stores the sort: ${JSON.stringify(stored)}`);
  const sizes = await page.$$eval('#fe-tbody tr[data-idx]:not(.par)', rs => rs.map(r => Number(r.dataset.bytes ?? NaN)));
  check(here[0] === 'readme.md', `the open folder re-sorts largest first: ${JSON.stringify(here.slice(0, 3))}`);
  await page.goto('file://' + h.fixture + '/nested/', { waitUntil: 'load' });
  await page.waitForSelector('#fe');
  const arrow = await page.$eval('th[data-sort="size"] .si', e => e.textContent);
  check(arrow === '↓', `a folder opened later sorts by size descending too (header arrow ${arrow})`);
  await page.close();
  await h.store.remove('bfb-sort-v1');

  // R2: icon-only buttons show a tooltip, in dark and light.
  for (const theme of ['dark', 'light']) {
    await h.store.set('bfb-theme', theme);
    await h.store.set('bfb-preview-layout-v1', { mode: 'side', sideW: 640 });
    page = await h.open();
    await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td.c-nm')).click();
    await page.waitForSelector('#fe-qlook.side #fe-ql-body h1', { timeout: 8_000 });
    await new Promise(r => setTimeout(r, 300));
    for (const id of ['fe-ql-dock', 'fe-ql-copy', 'fe-settings-btn', 'fe-theme-btn']) {
      const box = await page.$eval('#' + id, e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), disp: getComputedStyle(e).display }; });
      if (!box.w || !box.h) { check(false, `${theme}: #${id} is not on screen: ${JSON.stringify(box)}`); continue; }
      const want = await page.$eval('#' + id, e => e.getAttribute('title'));
      await page.hover('#' + id);
      await page.waitForSelector('#fe-hint.on', { timeout: 2_000 }).catch(() => null);
      const tip = await page.evaluate(() => {
        const t = document.getElementById('fe-hint'); const r = t.getBoundingClientRect();
        return { on: t.classList.contains('on'), text: t.textContent, inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight };
      });
      check(tip.on && tip.text === want && tip.inView, `${theme}: hovering #${id} shows "${want}": ${JSON.stringify(tip)}`);
      if (id === 'fe-ql-dock') { await new Promise(r => setTimeout(r, 200)); await shot(page, `tooltip-preview-${theme}`); }
      await page.mouse.move(5, 500);
      await new Promise(r => setTimeout(r, 200));
      const back = await page.$eval('#' + id, e => e.getAttribute('title'));
      check(back === want && !(await page.$('#fe-hint.on')), `${theme}: leaving #${id} hides it and keeps the title`);
    }
    await page.close();
  }

  // R16, R21, R23: reading a markdown page.
  const doc = [
    '# Reading walk', '', 'Intro paragraph.', '',
    '## A section whose heading is long enough that the sidebar contents has to cut it off', '',
    '- tight one', '- tight two', '- tight three', '',
    '## Loose list', '',
    '- loose one', '', '- loose two', '', '- loose three', '',
    '```', '## a heading inside text', '- item', '```', '',
    ...Array.from({ length: 6 }, (_, i) => [`## Part ${i + 1}`, '', 'Body text. '.repeat(60), '']).flat(),
  ].join('\n');
  writeFileSync(join(h.fixture, 'reading.md'), doc);
  await h.store.set('bfb-theme', 'light');
  page = await h.browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file://' + h.fixture + '/reading.md', { waitUntil: 'load' });
  await page.waitForSelector('#fe-toc a');

  const gaps = await page.evaluate(() => {
    const gap = ul => { const li = [...ul.children].map(e => e.getBoundingClientRect()); return Math.round(li[1].top - li[0].bottom); };
    const lists = [...document.querySelectorAll('#fe-page .fe-md > ul')];
    return { tight: gap(lists[0]), loose: gap(lists[1]) };
  });
  check(gaps.tight === gaps.loose && gaps.tight > 0 && gaps.tight < 12, `loose and tight lists space their items the same: ${JSON.stringify(gaps)}`);

  const colours = await page.evaluate(() => {
    const bg = getComputedStyle(document.querySelector('.fe-md-code')).backgroundColor;
    const tokens = document.querySelectorAll('.fe-md-code .fe-md-pre span').length;
    return { bg, tokens };
  });
  check(colours.bg === 'rgb(246, 248, 250)' && colours.tokens > 0, `unlabelled code block is light and coloured: ${JSON.stringify(colours)}`);

  await page.click('.fe-md-copy');
  await page.waitForSelector('.fe-md-copy.copied', { timeout: 2_000 }).catch(() => null);
  await new Promise(r => setTimeout(r, 250));
  const copied = await page.$eval('.fe-md-copy', b => ({ copied: b.classList.contains('copied'), colour: getComputedStyle(b).color, check: !!b.querySelector('path[d^="m2.5 7.5"]') }));
  await shot(page, 'reading-copied');
  await new Promise(r => setTimeout(r, 3200));
  const after = await page.$eval('.fe-md-copy', b => b.classList.contains('copied'));
  check(copied.copied && copied.check && copied.colour === 'rgb(63, 185, 80)' && !after, `copy turns into a check, then back after 3s: ${JSON.stringify({ ...copied, after })}`);

  const tocTop = await page.evaluate(() => {
    const on = document.querySelector('#fe-toc a.on');
    const h2s = [...document.querySelectorAll('#fe-toc a.fe-toc-h2')].map(a => getComputedStyle(a).paddingLeft);
    return { on: on?.textContent, pads: [...new Set(h2s)] };
  });
  check(tocTop.on === 'Reading walk', `at the top the first heading is marked: ${JSON.stringify(tocTop)}`);

  await page.hover('#fe-toc a.fe-toc-h2');
  await page.waitForSelector('#fe-hint.on', { timeout: 1_500 }).catch(() => null);
  const longTip = await page.$eval('#fe-hint', t => t.classList.contains('on') ? t.textContent : '');
  await page.mouse.move(700, 500);
  await new Promise(r => setTimeout(r, 200));
  await page.hover('#fe-toc a.fe-toc-h1');
  await new Promise(r => setTimeout(r, 600));
  const shortTip = await page.$eval('#fe-hint', t => t.classList.contains('on'));
  check(/cut it off/.test(longTip) && !shortTip, `a cut-off entry shows its full text; a short one shows nothing: ${JSON.stringify({ longTip, shortTip })}`);

  const target = await page.$$('#fe-toc a.fe-toc-h2');
  await target[target.length - 2].click();
  await new Promise(r => setTimeout(r, 60));
  const mid = await page.$eval('#fe-page', p => p.scrollTop);
  await new Promise(r => setTimeout(r, 900));
  const end = await page.evaluate(() => {
    const p = document.getElementById('fe-page');
    const on = document.querySelector('#fe-toc a.on');
    return { top: p.scrollTop, on: on?.textContent, pad: on && getComputedStyle(on).paddingLeft, sibling: getComputedStyle(document.querySelector('#fe-toc a.fe-toc-h2:not(.on)')).paddingLeft, hash: location.hash };
  });
  check(mid > 0 && mid < end.top && end.on === 'Part 5' && end.pad === end.sibling && end.hash === '#part-5',
    `a contents click glides to the heading and marks it in place: ${JSON.stringify({ mid, ...end })}`);
  await shot(page, 'reading-toc');
  // R20, R25: one set of facts in the status bar, and the path copies on click.
  const bar = await page.evaluate(() => ({
    chips: [...document.querySelectorAll('#fe-status-meta .fe-meta-item')].map(e => e.textContent.trim()),
    status: document.getElementById('fe-status-text').textContent.trim(),
    kind: document.getElementById('fe-fp-meta').textContent.trim(),
  }));
  await page.click('#fe-status-path');
  await page.waitForFunction(() => /Copied the path/.test(document.getElementById('fe-toast').textContent), { timeout: 2_000 }).catch(() => null);
  const toast = await page.$eval('#fe-toast', t => t.textContent);
  check(bar.chips.some(c => /lines$/.test(c)) && bar.chips.some(c => /headings$/.test(c)) && bar.status === '' && bar.kind === 'Markdown' && /Copied the path/.test(toast),
    `status bar carries the file facts once, path copies: ${JSON.stringify({ ...bar, toast })}`);
  await page.close();

  // HTML preview: the page loads its own relative images and keeps standards mode.
  const site = join(h.fixture, 'site');
  mkdirSync(join(site, 'img'), { recursive: true });
  copyFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'icon48.png'), join(site, 'img', 'a.png'));
  writeFileSync(join(site, 'index.html'), '<!doctype html><html><head><style>h1{margin:0}</style></head><body><h1>Sheet</h1><img id="i" src="img/a.png"></body></html>');
  await h.store.set('bfb-preview-layout-v1', { mode: 'side', sideW: 700 });
  page = await h.open(site);
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="index.html"]) td.c-nm')).click();
  await page.waitForSelector('#fe-ql-body iframe.fe-ql-html', { timeout: 5_000 });
  const hf = await (await page.$('#fe-ql-body iframe.fe-ql-html')).contentFrame();
  await hf.waitForFunction(() => document.getElementById('i')?.complete, { timeout: 5_000 }).catch(() => null);
  const htmlPv = await hf.evaluate(() => ({ img: document.getElementById('i').naturalWidth, mode: document.compatMode }));
  check(htmlPv.img === 48 && htmlPv.mode === 'CSS1Compat', `an HTML preview loads its relative images in standards mode: ${JSON.stringify(htmlPv)}`);
  await page.close();
} finally {
  await h.close();
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
