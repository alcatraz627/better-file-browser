// Every bar on every surface: the same height, side padding and gap, with
// controls one of the part sizes. Bars that run along a page or panel are
// 40px; toolbars inside content (a code block, a comment, a lens) are inset
// and only share the gap. One theme per run; BFB_THEME=light for the other.
//   node e2e/bars-walk.mjs   → e2e/shots/bars-*.png
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { launch, shot } from './harness.mjs';

const CLI = resolve(new URL('..', import.meta.url).pathname, 'native', 'bfb_docs.py');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_') && !k.startsWith('BFB_'))), BFB_DOCS_HOME: h.docsHome };
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
const BARS = ['#fe-bar', '#fe-toolbar', '#fe-statusbar', '#fe-fp-bar', '#fe-ql-hdr', '.fe-ql-imgbar', '.fe-ql-htmlbar', '#fe-ed-bar'];
const INSET = ['.fe-md-code-bar', '.fe-cm-tools', '.fe-lens-tools'];
const CTL = [18, 22, 28, 32];
try {
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture] }));
  await h.store.set('bfb-comments-filter-v1', 'open');
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  // What each visible bar measures: its box, side padding, gap, and the heights of its direct controls.
  const measure = () => page.evaluate((bars, inset) => [...bars.map(s => [s, false]), ...inset.map(s => [s, true])].flatMap(([sel, isInset]) =>
    [...document.querySelectorAll(sel)].filter(b => b.offsetParent && b.getClientRects().length).slice(0, 1).map(b => {
      const cs = getComputedStyle(b);
      const ctl = [...b.querySelectorAll(':scope > .btn, :scope > .tb, :scope > .fe-dd .fe-dd-btn, :scope > .fe-seg, :scope > * > .btn')].filter(c => c.offsetParent).map(c => Math.round(c.getBoundingClientRect().height));
      return { sel, inset: isInset, h: Math.round(b.getBoundingClientRect().height), padL: cs.paddingLeft, padR: cs.paddingRight, gap: cs.columnGap, ctl: [...new Set(ctl)] };
    })), BARS, INSET);
  const seen = new Map();
  const take = async label => { for (const m of await measure()) if (!seen.has(m.sel)) seen.set(m.sel, { ...m, where: label }); };

  await take('listing');
  await page.screenshot({ path: await shot(page, 'bars-listing'), clip: { x: 0, y: 0, width: 1400, height: 140 } });
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td.c-nm')).click();
  await page.waitForSelector('#fe-qlook', { visible: true, timeout: 5000 }); await sleep(300);
  await take('preview');
  await page.keyboard.press('Escape'); await sleep(200);

  const doc = join(h.fixture, 'bars.md');
  writeFileSync(doc, '# Bars\n\nSome words to comment on here.\n\n```js\nconst a = 1;\n```\n');
  spawnSync('python3', [CLI, '--json', '--as', 'bfb', 'comments', 'new', doc, '--quote', 'words to comment', 'A note'], { env, encoding: 'utf8' });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-bar'); await sleep(400);
  await page.click('#fe-cm .fe-cm-th[data-id]').catch(() => null); await sleep(300);
  await take('file page');
  await page.screenshot({ path: await shot(page, 'bars-file'), clip: { x: 0, y: 0, width: 1400, height: 160 } });
  await page.keyboard.press('?'); await sleep(400);
  await take('help');
  await page.keyboard.press('Escape'); await sleep(200);

  const rows = [...seen.values()];
  for (const r of rows) console.log(`     ${r.where.padEnd(10)} ${r.sel.padEnd(16)} h=${r.h} pad=${r.padL}/${r.padR} gap=${r.gap} ctl=${r.ctl.join(',')}`);
  const bars = rows.filter(r => !r.inset);
  const offH = bars.filter(r => r.h !== 40);
  check(bars.length >= 5 && offH.length === 0, `every bar is 40px tall (${bars.length} seen): ${JSON.stringify(offH.map(r => [r.sel, r.h]))}`);
  const offPad = bars.filter(r => r.padL !== '12px' || r.padR !== '12px');
  check(offPad.length === 0, `every bar has 12px side padding: ${JSON.stringify(offPad.map(r => [r.sel, r.padL, r.padR]))}`);
  const offGap = rows.filter(r => r.gap !== '4px');
  check(offGap.length === 0, `every bar and inset toolbar has a 4px gap: ${JSON.stringify(offGap.map(r => [r.sel, r.gap]))}`);
  const offCtl = bars.filter(r => r.ctl.some(c => !CTL.includes(c)));
  check(offCtl.length === 0, `controls in bars are a part size: ${JSON.stringify(offCtl.map(r => [r.sel, r.ctl]))}`);
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
