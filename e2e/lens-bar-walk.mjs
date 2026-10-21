// The sidebar's lens bar: icons in a row above the open lens, the open one
// grown to show its name, the wheel over the bar moving between lenses;
// Saved and Notes are separate lenses sharing one filter; the Comments lens
// lists every document with comments and opens one with its comments showing.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { launch, SHOTS, THEME } from './harness.mjs';

const CLI = resolve(new URL('..', import.meta.url).pathname, 'native', 'bfb_docs.py');
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sfx = THEME === 'light' ? '-light' : '';
const h = await launch();
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_') && !k.startsWith('BFB_'))), BFB_DOCS_HOME: h.docsHome };
try {
  const doc = join(h.fixture, 'plan.md');
  writeFileSync(doc, '# Plan\n\nShip on Friday.\n');
  const r = spawnSync('python3', [CLI, 'comments', 'new', doc, '--quote', 'Ship on Friday', 'Is this firm? @user @due 2026-11-03'], { env, encoding: 'utf8' });
  check(r.status === 0, `a comment is written from the terminal: ${r.stderr.trim()}`);
  await h.store.set('bfb-theme', THEME);
  await h.store.set('bfb-lens-v1', 'places');
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  await page.waitForSelector('#fe-rail');
  await sleep(500);   // the open lens grows in

  const bar = await page.evaluate(() => {
    const rail = document.getElementById('fe-rail').getBoundingClientRect(), lenses = document.getElementById('fe-lenses').getBoundingClientRect();
    const btns = [...document.querySelectorAll('#fe-rail .fe-rail-btn:not([hidden])')];
    const on = btns.find(b => b.classList.contains('on'));
    return { above: rail.bottom <= lenses.top + 1, row: new Set(btns.map(b => Math.round(b.getBoundingClientRect().top))).size === 1,
      lenses: btns.map(b => b.dataset.lens), onWide: on.getBoundingClientRect().width > 2 * btns.find(b => b !== on).getBoundingClientRect().width,
      label: getComputedStyle(on.querySelector('em')).opacity };
  });
  check(bar.above && bar.row && bar.onWide && bar.label === '1', `the lens bar is one row on top and the open lens is wide with its name: ${JSON.stringify(bar)}`);
  check(['places', 'saved', 'notes', 'history', 'search', 'ask', 'comments'].every(l => bar.lenses.includes(l)), `Saved, Notes and Comments are lenses of their own: ${bar.lenses.join(',')}`);
  const title = await page.evaluate(() => { const h = document.querySelector('#fe-lens-places .fe-lens-h'); return { icon: !!h.querySelector('.fe-lens-ico svg'), text: h.textContent.trim() }; });
  check(title.icon && title.text === 'Places', `the lens title has its icon: ${JSON.stringify(title)}`);
  await page.screenshot({ path: join(SHOTS, `lens-bar${sfx}.png`), clip: { x: 0, y: 0, width: 420, height: 500 } });

  // Every lens name fits when its lens is open, even the longest.
  const clipped = [];
  for (const l of bar.lenses) {
    await page.click(`#fe-rail-${l}`);
    await sleep(350);
    const fit = await page.$eval(`#fe-rail-${l} em`, e => ({ t: e.textContent, fits: e.scrollWidth <= e.clientWidth + 1, inBar: e.closest('.fe-rail-btn').getBoundingClientRect().right <= document.getElementById('fe-rail').getBoundingClientRect().right + 1 }));
    if (!fit.fits || !fit.inBar) clipped.push(fit.t);
  }
  check(!clipped.length, `every lens name shows whole when open: ${clipped.join(',') || 'none clipped'}`);
  await page.click('#fe-rail-places');
  await sleep(350);
  const rail = await page.$eval('#fe-rail', el => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.mouse.move(rail.x, rail.y);
  await sleep(150);
  await page.mouse.wheel({ deltaY: 100 });
  await sleep(300);
  const one = await page.$eval('#fe-rail .fe-rail-btn.on', b => b.dataset.lens);
  await page.mouse.wheel({ deltaY: 100 });
  await sleep(300);
  const two = await page.$eval('#fe-rail .fe-rail-btn.on', b => b.dataset.lens);
  await page.mouse.wheel({ deltaY: -100 });
  await sleep(300);
  const back = await page.$eval('#fe-rail .fe-rail-btn.on', b => b.dataset.lens);
  check(one === 'saved' && two === 'notes' && back === 'saved', `the wheel over the bar steps one lens a notch: ${one}, ${two}, ${back}`);
  const filterIn = async lens => page.evaluate(l => !!document.querySelector(`#fe-lens-${l} .fe-lens-find`), lens);
  const inSaved = await filterIn('saved');
  await page.click('#fe-rail-notes');
  check(inSaved && await filterIn('notes'), 'the filter moves to whichever of Saved and Notes is open');

  await page.click('#fe-rail-comments');
  await page.waitForSelector('#fe-docs-list .fe-doc-row', { timeout: 6000 }).catch(() => null);
  const docs = await page.evaluate(() => [...document.querySelectorAll('#fe-docs-list .fe-doc-row')].map(r => ({ name: r.querySelector('.fe-doc-name').textContent, n: r.querySelector('.fe-doc-n').textContent, me: !!r.querySelector('.fe-doc-me'), due: r.querySelector('.fe-doc-due')?.textContent })));
  check(docs.length === 1 && docs[0].name === 'plan.md' && docs[0].n === '1' && docs[0].me && docs[0].due === 'Nov 3', `the Comments lens lists the document, its open count, a mention of you and the due date: ${JSON.stringify(docs)}`);
  await page.screenshot({ path: join(SHOTS, `lens-comments${sfx}.png`), clip: { x: 0, y: 0, width: 420, height: 500 } });
  await Promise.all([page.waitForNavigation({ timeout: 6000 }).catch(() => null), page.click('#fe-docs-list .fe-doc-row')]);
  await page.waitForFunction(() => document.getElementById('fe-toc-rail') && !document.getElementById('fe-toc-rail').hidden && document.getElementById('fe-toc-rail').dataset.tab === 'cm', { timeout: 8000 }).catch(() => null);
  check(await page.evaluate(() => document.getElementById('fe-toc-rail')?.dataset.tab === 'cm' && !document.getElementById('fe-toc-rail').hidden), `a click opens the document with its comments showing: ${page.url()}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'lens bar walk passes');
