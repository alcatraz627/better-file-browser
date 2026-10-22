// Everything that folds shows one chevron: down while open, turned right
// when folded, measured on the History sections, a tree folder and a JSON
// tree. List group labels share the section-title group look. One theme per
// run; BFB_THEME=light for the other.
//   node e2e/disclosure-walk.mjs   → e2e/shots/disclosure-*.png
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, shot, applyTheme } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
const turn = (page, sel) => page.$eval(sel, e => getComputedStyle(e).transform).catch(() => null);
const TURNED = 'matrix(0, -1, 1, 0, 0, 0)';   // rotate(-90deg)
const settle = () => sleep(450);              // past the turn and fold transitions
try {
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  await applyTheme(page);
  const seen = [];

  // History: a section header folds its rows.
  await page.click('#fe-rail-history'); await sleep(300);
  const sec = '#fe-sec-toggle-recent';
  seen.push(['history section open', await turn(page, `${sec} .chev`)]);
  await page.click(sec); await settle();
  seen.push(['history section folded', await turn(page, `${sec} .chev`)]);
  await page.screenshot({ path: await shot(page, 'disclosure-history') });
  await page.click(sec); await settle();

  // Tree: a folder's toggle.
  for (let i = 0; i < 3 && !(await page.$('.fe-tree-toggle')); i++) { await page.click('#fe-view-group [data-v="tree"]'); await sleep(400); }
  const tg = '.fe-tree-row:has(a[href$="/nested/"]) .fe-tree-toggle';
  seen.push(['tree folded', await turn(page, `${tg} .chev`)]);
  await page.click(tg); await settle();
  seen.push(['tree open', await turn(page, `${tg} .chev`)]);
  await page.screenshot({ path: await shot(page, 'disclosure-tree') });
  await page.click('#fe-view-group [data-v="details"]'); await sleep(300);

  // JSON tree: nested objects fold as <details>.
  const json = join(h.fixture, 'fold.json');
  writeFileSync(json, JSON.stringify({ a: { b: { c: 1 } }, list: [1, 2, 3] }, null, 2));
  await page.goto('file://' + json, { waitUntil: 'load' });
  await page.waitForSelector('#fe', { timeout: 10_000 }); await sleep(500);
  const tree = await page.$('details.fe-jt');
  if (tree) {
    const first = 'details.fe-jt > summary > .chev';
    const wasOpen = await page.$eval('details.fe-jt', d => d.open);
    seen.push([`json ${wasOpen ? 'open' : 'folded'}`, await turn(page, first)]);
    await page.click('details.fe-jt > summary'); await settle();
    seen.push([`json ${wasOpen ? 'folded' : 'open'}`, await turn(page, first)]);
    await page.screenshot({ path: await shot(page, 'disclosure-json') });
  } else console.log('     (this JSON shows as text, not a tree; skipped)');

  for (const [n, t] of seen) console.log(`     ${n.padEnd(24)} ${t}`);
  const bad = seen.filter(([n, t]) => /folded/.test(n) ? t !== TURNED : t !== 'none');
  check(seen.length >= 4 && bad.length === 0, `every chevron points down open and right folded: ${JSON.stringify(bad)}`);
  // A button that opens a menu also says aria-expanded; its chevron does not turn.
  const kinds = await page.evaluate(() => [...document.querySelectorAll('svg')]
    .filter(s => s.closest('summary,[aria-expanded]:not([aria-haspopup])') && /m2\.5 4\.5/.test(s.innerHTML) && !s.classList.contains('chev'))
    .map(s => s.closest('summary,[aria-expanded]').className || s.closest('summary,[aria-expanded]').tagName));
  check(kinds.length === 0, `no folding chevron is left outside the one rule: ${JSON.stringify(kinds)}`);
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
