// The rail is one titled card that floats over the page and never moves its
// text; every search box carries a magnifier and a short placeholder; the
// tab strip's temporary tab is plain, and its + and path buttons open a file
// or folder from the chooser or from a pasted path that the box remembers.
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { launch, SHOTS, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sfx = THEME === 'light' ? '-light' : '';
let h;
try {
  const dir = join(tmpdir(), `bfb-r3a-${process.pid}`);
  mkdirSync(join(dir, 'picked'), { recursive: true });
  h = await launch({ pickReply: join(dir, 'picked') + '/' });
  await h.store.set('bfb-theme', THEME);
  const doc = join(h.fixture, 'long.md');
  writeFileSync(doc, '# Title\n\n## One\n\n' + 'A long paragraph of words that should wrap at the same place whether or not the side card is open. '.repeat(12) + '\n\n## Two\n\nEnd.\n');
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-toc');
  await sleep(400);

  // One title, no tabs; the text keeps its width with the card open or closed.
  const measure = () => page.evaluate(() => {
    const p = document.querySelector('#fe-page .fe-md p');
    const r = document.createRange(); r.selectNodeContents(p);
    return { width: Math.round(p.getBoundingClientRect().width), lines: r.getClientRects().length, rail: !document.getElementById('fe-toc-rail').hidden };
  });
  const open = await measure();
  const head = await page.evaluate(() => ({ title: document.querySelector('.fe-rail-name')?.textContent, tabs: document.querySelectorAll('#fe-toc-rail [role="tab"]').length }));
  check(open.rail && head.title === 'On this page' && head.tabs === 0, `the card has one title and no tabs: ${JSON.stringify(head)}`);
  await page.screenshot({ path: join(SHOTS, `r3a-rail${sfx}.png`) });
  await page.click('#fe-fp-toc');
  const closed = await measure();
  await page.click('#fe-fp-cm');
  await sleep(300);
  const cm = await measure();
  check(!closed.rail && open.width === closed.width && open.lines === closed.lines && cm.width === closed.width,
    `the text wraps the same with the card open, closed, or on Comments: ${JSON.stringify({ open, closed, cm })}`);
  check(await page.evaluate(() => document.querySelector('.fe-rail-name').textContent === 'Comments'), 'the title follows the pane');

  // Search boxes.
  const finds = await page.evaluate(() => {
    const f = document.getElementById('fe-ff-q');
    return { ph: f.placeholder, icon: !!document.querySelector('#fe-ff svg') };
  });
  check(finds.ph === 'Find' && finds.icon, `find in file has the magnifier and a short placeholder: ${JSON.stringify(finds)}`);

  // The temporary tab, and the + and path buttons.
  const tab = await page.evaluate(() => { const t = document.querySelector('.fe-tab.temp .fe-tab-lbl'); return t ? getComputedStyle(t).fontStyle : 'none'; });
  check(tab !== 'italic', `the temporary tab is not in italics: ${tab}`);
  await page.click('#fe-open-path');
  await page.waitForSelector('#fe-goto input', { timeout: 3000 });
  await page.type('#fe-goto input', h.fixture);
  const list = await page.$$eval('#fe-goto datalist option', o => o.length);
  await page.screenshot({ path: join(SHOTS, `r3a-goto${sfx}.png`) });
  await page.mouse.click(700, 600);
  const gone = await page.evaluate(() => !document.getElementById('fe-goto'));
  await page.click('#fe-open-path');
  const kept = await page.$eval('#fe-goto input', i => i.value);
  check(gone && kept === h.fixture && list >= 1, `a click away closes the path box and it keeps what was typed, with recents offered: ${JSON.stringify({ gone, kept: kept === h.fixture, list })}`);
  await Promise.all([page.waitForNavigation({ timeout: 6000 }).catch(() => null), page.keyboard.press('Enter')]);
  check(decodeURIComponent(page.url()).startsWith('file://' + h.fixture), `Enter goes to the path: ${page.url()}`);
  await page.waitForSelector('#fe-open-pick', { timeout: 6000 });
  await Promise.all([page.waitForNavigation({ timeout: 6000 }).catch(() => null), page.click('#fe-open-pick')]);
  check(decodeURIComponent(page.url()).endsWith('/picked/'), `+ opens what the chooser returns: ${page.url()}`);
  await page.waitForSelector('#fe-tabs .fe-tab');
  const tabsNow = await page.$$eval('#fe-tabs .fe-tab .fe-tab-lbl', ls => ls.map(l => l.textContent.trim()));
  check(tabsNow.length >= 2 && tabsNow.includes('picked') && new Set(tabsNow).size === tabsNow.length, `+ opens it as a new tab and keeps the one you were on: ${tabsNow}`);

  // Search boxes in the listing and the sidebar.
  await page.waitForSelector('#fe-search', { timeout: 6000 });
  const boxes = await page.evaluate(() => ['fe-search', 'fe-lens-filter', 'fe-find-text', 'fe-filter-q'].map(id => {
    const el = document.getElementById(id);
    return el ? { id, ph: el.placeholder, icon: getComputedStyle(el).backgroundImage.includes('svg') } : { id, missing: true };
  }));
  check(boxes.every(b => !b.missing && b.icon && b.ph.length <= 12), `search boxes carry the magnifier and short placeholders: ${JSON.stringify(boxes)}`);
  await page.screenshot({ path: join(SHOTS, `r3a-listing${sfx}.png`) });
} finally {
  console.log(results.join('\n'));
  await h?.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'round 3a walk passes');
