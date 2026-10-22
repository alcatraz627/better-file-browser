// What every element on every surface ends up looking like, as data: its box
// and the visual properties the stylesheet resolves for it. Two snapshots
// taken around a stylesheet cleanup must match; any difference is a look
// that moved. One theme per run.
//   node e2e/style-snapshot.mjs OUT.json [--light]    take a snapshot
//   node e2e/style-snapshot.mjs --diff A.json B.json   list what moved
import { readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2).filter(a => a !== '--light');
// The harness reads the theme as it loads, so the flag is set before it does.
if (process.argv.includes('--light')) process.env.BFB_THEME = 'light';
const { launch, applyTheme } = await import('./harness.mjs');
if (args[0] === '--diff') {
  const [a, b] = [JSON.parse(readFileSync(args[1], 'utf8')), JSON.parse(readFileSync(args[2], 'utf8'))];
  let moved = 0;
  for (const surface of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[surface] ?? {}, y = b[surface] ?? {};
    for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (JSON.stringify(x[key]) === JSON.stringify(y[key])) continue;
      moved++;
      if (moved <= 12) {
        const before = x[key] ?? {}, after = y[key] ?? {};
        const props = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(p => before[p] !== after[p]);
        console.log(`${surface} ${key}\n    ${props.map(p => `${p}: ${before[p]} → ${after[p]}`).join('\n    ')}`);
      }
    }
  }
  console.log(moved ? `${moved} element(s) moved` : 'no element moved');
  process.exit(moved ? 1 : 0);
}

const OUT = args[0];
if (!OUT) { console.error('usage: node e2e/style-snapshot.mjs OUT.json'); process.exit(2); }
const PROPS = ['display', 'position', 'color', 'background-color', 'background-image', 'opacity', 'visibility',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'border-top-style',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-transform', 'text-decoration-line',
  'gap', 'box-shadow', 'transform', 'z-index', 'outline-style', 'cursor', 'white-space', 'text-overflow', 'filter'];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
const out = {};
// The harness names its fixture after the process, and a name's width moves
// everything beside it; a copy under one fixed name keeps two runs comparable.
const FIX = join(tmpdir(), 'bfb-style-snapshot');
rmSync(FIX, { recursive: true, force: true });
cpSync(h.fixture, FIX, { recursive: true });
// Every element under #fe, keyed by a path that ignores text and fixture names.
const grab = async (page, name) => {
  await sleep(450);   // past every transition
  out[name] = await page.evaluate(props => {
    const key = el => {
      const parts = [];
      for (let e = el; e && e.id !== 'fe' && e !== document.body; e = e.parentElement) {
        const cls = [...e.classList].filter(c => !/^(kb|hover|focus)$/.test(c)).sort().join('.');
        const i = e.parentElement ? [...e.parentElement.children].indexOf(e) : 0;
        parts.unshift(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${cls ? '.' + cls : ''}:${i}`);
      }
      return parts.join('>');
    };
    const res = {};
    const root = document.getElementById('fe') ?? document.body;
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      const v = { box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(',') };
      for (const p of props) v[p] = cs.getPropertyValue(p);
      res[key(el)] = v;
    }
    return res;
  }, PROPS);
};
try {
  const page = await h.open(FIX);
  await page.setViewport({ width: 1400, height: 900 });
  await applyTheme(page);
  await page.mouse.move(2, 890);
  await grab(page, 'listing');
  for (const v of ['list', 'tiles', 'icons', 'tree']) { await page.click(`#fe-view-group [data-v="${v}"]`); await page.mouse.move(2, 890); await grab(page, 'view-' + v); }
  await page.click('#fe-view-group [data-v="details"]');
  await page.click('#fe-sg-btn'); await page.mouse.move(2, 890); await grab(page, 'sort-panel'); await page.click('#fe-sg-btn');
  await page.click('#fe-filter-btn'); await page.mouse.move(2, 890); await grab(page, 'filter-bar'); await page.click('#fe-filter-btn');
  for (const lens of ['places', 'saved', 'notes', 'history', 'search', 'ask', 'comments']) { await page.click(`#fe-rail-${lens}`); await page.mouse.move(2, 890); await grab(page, 'lens-' + lens); }
  await page.keyboard.down('Meta'); await page.keyboard.press('k'); await page.keyboard.up('Meta'); await page.mouse.move(2, 890); await grab(page, 'palette'); await page.keyboard.press('Escape'); await sleep(200);
  await page.click('#fe-tbody tr[data-idx]:has(a[href$="notes.txt"]) td.c-sz'); await page.keyboard.press('x'); await page.mouse.move(2, 890); await grab(page, 'item-menu'); await page.keyboard.press('Escape'); await sleep(200);
  await page.click('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td.c-sz'); await page.keyboard.press('Space'); await page.mouse.move(2, 890); await grab(page, 'preview-md'); await page.keyboard.press('Escape'); await sleep(200);
  await page.keyboard.press(','); await page.waitForSelector('#fe-settings-modal .fe-dlg-box', { visible: true });
  for (const tab of await page.$$eval('#fe-settings-modal .fe-dlg-tab', ts => ts.map(t => t.dataset.tab))) { await page.click(`#fe-settings-modal .fe-dlg-tab[data-tab="${tab}"]`); await page.mouse.move(2, 890); await grab(page, 'settings-' + tab); }
  await page.keyboard.press('Escape'); await sleep(200);
  await page.keyboard.press('?'); await page.waitForSelector('#fe-help-modal .fe-dlg-box', { visible: true }).catch(() => null);
  for (const tab of await page.$$eval('#fe-help-modal .fe-dlg-tab', ts => ts.map(t => t.dataset.tab))) { await page.click(`#fe-help-modal .fe-dlg-tab[data-tab="${tab}"]`); await page.mouse.move(2, 890); await grab(page, 'help-' + tab); }
  await page.keyboard.press('Escape'); await sleep(200);
  for (const f of ['readme.md', 'code.py', 'data.json']) {
    await page.goto('file://' + join(FIX, f), { waitUntil: 'load' }); await page.waitForSelector('#fe-page'); await page.mouse.move(2, 890); await grab(page, 'page-' + f);
  }
} finally { await h.close(); rmSync(FIX, { recursive: true, force: true }); }
writeFileSync(OUT, JSON.stringify(out));
console.log(`${Object.keys(out).length} surfaces, ${Object.values(out).reduce((n, s) => n + Object.keys(s).length, 0)} elements → ${OUT}`);
