// Every list says why it has no rows, in one shape: the listing when a
// folder is empty, holds only hidden files, or a filter hides everything
// (with a Clear that brings the rows back); the palette with nothing
// matching; the Saved and Notes lenses before anything is in them; a crumb
// menu on an empty folder. One theme per run; BFB_THEME=light for the other.
//   node e2e/empty-walk.mjs   → e2e/shots/empty-*.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, shot, applyTheme } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
const state = (page, sel) => page.$eval(sel, e => ({ state: e.dataset.state, text: e.querySelector('.empty-t')?.textContent, acts: [...e.querySelectorAll('.empty-a button')].map(b => b.textContent.trim()), shown: !!e.checkVisibility?.() })).catch(() => null);
try {
  const voidDir = join(h.fixture, 'void');
  mkdirSync(voidDir, { recursive: true });
  const dotDir = join(h.fixture, 'dots');
  mkdirSync(dotDir, { recursive: true });
  writeFileSync(join(dotDir, '.only'), 'x');

  // Listing: a filter that hides everything, then Clear.
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  await applyTheme(page);
  const rows0 = await page.$$eval('#fe-tbody tr[data-idx]', r => r.length);
  check(await page.$eval('#fe-empty', e => e.hidden), 'a folder with rows shows no empty message');
  await page.click('#fe-search'); await page.keyboard.type('zzzqqq'); await sleep(400);
  const filt = await state(page, '#fe-empty .empty');
  check(filt?.state === 'filtered' && filt.shown && filt.acts.includes('Clear filter'), `a filter that hides everything says so and offers Clear: ${JSON.stringify(filt)}`);
  await page.screenshot({ path: await shot(page, 'empty-filtered') });
  await page.click('#fe-empty [data-a="clear"]'); await sleep(400);
  const rows1 = await page.$$eval('#fe-tbody tr[data-idx]', r => r.length);
  const q = await page.$eval('#fe-search', e => e.value);
  check(rows1 === rows0 && q === '' && await page.$eval('#fe-empty', e => e.hidden), `Clear brings every row back and empties the box (${rows1} of ${rows0} rows, box "${q}")`);

  // Palette: nothing matches.
  await page.keyboard.down('Meta'); await page.keyboard.press('k'); await page.keyboard.up('Meta'); await sleep(300);
  await page.keyboard.type('zzzqqqxx'); await sleep(300);
  const pal = await state(page, '.fe-pal .empty');
  check(pal?.state === 'filtered' && pal.text === 'Nothing matches', `the palette says nothing matches: ${JSON.stringify(pal)}`);
  await page.screenshot({ path: await shot(page, 'empty-palette') });
  await page.keyboard.press('Escape'); await sleep(200);
  await page.keyboard.press('Escape'); await sleep(200);

  // Saved and Notes lenses before anything is in them.
  await page.click('#fe-rail-saved'); await sleep(300);
  const sv = await state(page, '#fe-lens-saved .empty');
  check(sv?.state === 'empty' && sv.shown, `Saved says nothing is saved yet: ${JSON.stringify(sv)}`);
  await page.screenshot({ path: await shot(page, 'empty-saved') });
  const nt = await page.$('#fe-rail-notes');
  if (nt && await nt.evaluate(b => !b.hidden)) {
    await nt.click(); await sleep(400);
    const n = await state(page, '#fe-lens-notes .empty');
    check(!!n && n.shown, `Notes says why its list is empty: ${JSON.stringify(n)}`);
    await page.screenshot({ path: await shot(page, 'empty-notes') });
  }

  // An empty folder, and one holding only hidden files.
  const p2 = await h.open(voidDir);
  await p2.setViewport({ width: 1400, height: 900 });
  await applyTheme(p2);
  await sleep(300);
  const v = await state(p2, '#fe-empty .empty');
  check(v?.state === 'empty' && v.text === 'This folder is empty' && v.shown, `an empty folder says so: ${JSON.stringify(v)}`);
  await p2.screenshot({ path: await shot(p2, 'empty-folder') });
  // Its crumb menu, opened on itself, says the same in a line.
  const dd = await p2.$('.fe-crumb-dd[data-url$="/void/"]');
  if (dd) {
    await dd.click(); await sleep(500);
    const m = await state(p2, '#fe-crumb-menu .empty');
    check(m?.state === 'empty' && m.text === 'Empty folder', `the crumb menu on an empty folder says so: ${JSON.stringify(m)}`);
    await p2.keyboard.press('Escape'); await sleep(200);
  } else console.log('     (no crumb menu button for the folder itself; skipped)');

  const p3 = await h.open(dotDir);
  await p3.setViewport({ width: 1400, height: 900 });
  await applyTheme(p3);
  await sleep(300);
  const shownBefore = await p3.$eval('#fe', e => e.classList.contains('show-hidden'));
  const d = await state(p3, '#fe-empty .empty');
  if (!shownBefore) {
    check(d?.text === 'Only hidden files here' && d.shown, `a folder of hidden files says they are hidden: ${JSON.stringify(d)}`);
    await p3.screenshot({ path: await shot(p3, 'empty-hidden') });
    // A filter whose only match is hidden says so, rather than "nothing matches".
    await p3.click('#fe-search'); await p3.keyboard.type('only'); await sleep(400);
    const hm = await state(p3, '#fe-empty .empty');
    check(hm?.text === 'Only hidden files match' && hm.acts.includes('Clear filter'), `a filter matching only hidden files says so: ${JSON.stringify(hm)}`);
    await p3.click('#fe-empty [data-a="clear"]'); await sleep(300);
    await p3.click('#fe-hidden-btn'); await sleep(300);
    check(await p3.$eval('#fe-empty', e => e.hidden), 'showing hidden files takes the message away');
  } else console.log('     (hidden files shown by default here; skipped)');
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
