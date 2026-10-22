// The button part on every surface that uses it as an icon button, in the
// states that show them: a Saved row and a tab under the pointer, the lens
// tools, the Ask lens, Settings with its close and icon buttons, a comment's
// chips and tools, and a details row's actions. One theme per run.
//   node e2e/buttons-shots.mjs   → e2e/shots/buttons-*.png
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
try {
  await h.store.set('bfb-saved-v1', [{ path: h.fixture + '/readme.md', label: 'readme.md', tags: ['work'] }, { path: h.fixture + '/nested/', label: 'nested' }]);
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture] }));
  await h.store.set('bfb-comments-filter-v1', 'open');
  await h.store.set('bfb-preview-layout-v1', { mode: 'side', sideW: 520 });
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  const clip = async (name, sel, pad = 10) => {
    const box = await page.$eval(sel, el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    await page.screenshot({ path: await shot(page, name), clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 } });
  };
  // Every icon button is the part, and none is wider or taller than its size.
  const audit = () => page.evaluate(() => [...document.querySelectorAll('button.btn[data-icon]')].filter(b => b.offsetParent).map(b => {
    const r = b.getBoundingClientRect(), want = { xs: 18, sm: 22, md: 28, lg: 32 }[b.dataset.size || 'md'];
    return { id: b.id || b.className, w: Math.round(r.width), h: Math.round(r.height), want, round: getComputedStyle(b).borderRadius, named: !!(b.getAttribute('aria-label') || b.title) };
  }));

  await page.keyboard.press('g'); await page.keyboard.press('2'); await sleep(300);
  await page.hover('#fe-lenses .fe-lens:not([hidden]) .fe-pl-item');
  await sleep(200);
  await clip('buttons-saved-row', '#fe-lenses .fe-lens:not([hidden])');
  await page.keyboard.press('t'); await sleep(200);
  await page.hover('#fe-tabs .fe-tab');
  await sleep(200);
  await clip('buttons-tabbar', '#fe-tabbar');
  const sizes = await audit();
  const off = sizes.filter(s => s.w !== s.want || s.h !== s.want);
  check(sizes.length > 0 && off.length === 0, `icon buttons are square at their size (${sizes.length} seen): ${JSON.stringify(off.slice(0, 4))}`);
  const mute = sizes.filter(s => !s.named);
  check(mute.length === 0, `every icon button has a name: ${JSON.stringify(mute.slice(0, 4).map(s => s.id))}`);

  // Segmented: every group is one control high and its items 4px shorter.
  const segs = () => page.evaluate(() => [...document.querySelectorAll('.fe-seg')].filter(s => s.offsetParent).map(s => {
    const h = Math.round(s.getBoundingClientRect().height), want = s.dataset.size === 'lg' ? 32 : 28;
    const items = [...s.querySelectorAll('.fe-seg-b')].map(b => Math.round(b.getBoundingClientRect().height));
    return { id: s.id || s.className, h, want, items };
  }));
  const badSeg = list => list.filter(s => s.h !== s.want || s.items.some(i => i !== s.want - 4));
  // TextBox: every single-line field is exactly its size.
  const boxes = () => page.evaluate(() => [...document.querySelectorAll('input.tb')].filter(b => b.offsetParent).map(b => {
    const want = { sm: 22, md: 28, lg: 32 }[b.dataset.size || 'md'];
    return { id: b.id || b.className, h: Math.round(b.getBoundingClientRect().height), want };
  }).filter(b => b.h !== b.want));
  const segs1 = await segs();
  check((await boxes()).length === 0, `text boxes on the listing are their size: ${JSON.stringify(await boxes())}`);
  check(segs1.length > 0 && badSeg(segs1).length === 0, `segmented groups on the listing are 28 with 24 items (${segs1.length} seen): ${JSON.stringify(badSeg(segs1))}`);
  await page.focus('#fe-view-group .fe-seg-b.on');
  await page.keyboard.press('ArrowRight'); await sleep(250);
  const v1 = await page.evaluate(() => ({ view: document.querySelector('#fe').dataset.view, on: document.querySelector('#fe-view-group .fe-seg-b.on')?.dataset.v }));
  check(v1.view !== 'details' && v1.view === v1.on, `an arrow in the view switch changes the view: ${JSON.stringify(v1)}`);
  await clip('buttons-viewswitch', '#fe-toolbar');
  await page.reload({ waitUntil: 'load' }); await sleep(600);
  const v2 = await page.evaluate(() => ({ view: document.querySelector('#fe').dataset.view, on: document.querySelector('#fe-view-group .fe-seg-b.on')?.dataset.v }));
  check(v2.view === v1.view && v2.on === v1.view, `the view and its switch survive a reload: ${JSON.stringify(v2)}`);
  await page.click(`#fe-view-group [data-v="details"]`); await sleep(250);

  // Row actions float over the name, so they are opaque.
  await page.keyboard.press('Escape'); await sleep(150);
  await page.hover('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td.c-nm'); await sleep(250);
  const acts = await page.evaluate(() => [...document.querySelectorAll('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) .fe-act-btn')].map(b => getComputedStyle(b).backgroundColor));
  check(acts.length > 0 && acts.every(c => !/rgba\(0, 0, 0, 0\)|transparent/.test(c)), `row actions sit on a solid fill: ${JSON.stringify(acts)}`);
  await clip('buttons-row-actions', '#fe-tbody tr[data-idx]:has(a[href$="readme.md"])');
  // Docked, the preview header's text buttons become square icon buttons.
  await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td.c-nm')).click();
  await page.waitForSelector('#fe-qlook.side', { timeout: 5000 }); await sleep(300);
  const hdr = await page.evaluate(() => [...document.querySelectorAll('#fe-ql-hdr > .btn')].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return { id: b.id, icon: b.hasAttribute('data-icon'), w: Math.round(r.width), h: Math.round(r.height) }; }));
  check(hdr.length > 0 && hdr.every(b => b.icon && b.w === b.h), `the docked preview header is square icon buttons: ${JSON.stringify(hdr)}`);
  await clip('buttons-docked-header', '#fe-ql-hdr');
  await page.keyboard.press('Escape'); await sleep(250);
  check(await page.evaluate(() => !document.querySelector('#fe-qlook.side') || getComputedStyle(document.getElementById('fe-qlook')).display === 'none'), 'Esc closes the docked preview while focus is in the listing');

  await page.evaluate(() => document.querySelector('#fe-rail-ask')?.click()); await sleep(400);
  await clip('buttons-ask', '#fe-lenses .fe-lens:not([hidden])');
  await page.keyboard.press(','); await sleep(400);
  await page.screenshot({ path: await shot(page, 'buttons-settings') });
  await page.evaluate(() => document.querySelector('#fe-settings-modal .fe-dlg-tab[data-tab="folders"]')?.click()); await sleep(250);
  check((await boxes()).length === 0, `text boxes in Settings are their size: ${JSON.stringify(await boxes())}`);
  const segs2 = await segs();
  check(segs2.length > 0 && badSeg(segs2).length === 0, `segmented groups in Settings are 32 with 28 items (${segs2.length} seen): ${JSON.stringify(badSeg(segs2))}`);
  await page.screenshot({ path: await shot(page, 'buttons-settings-folders') });
  await page.keyboard.press('Escape'); await sleep(200);

  const doc = join(h.fixture, 'btn.md');
  writeFileSync(doc, '# Buttons\n\nSome words to comment on here.\n');
  spawnSync('python3', [CLI, '--json', '--as', 'bfb', 'comments', 'new', doc, '--quote', 'words to comment', 'A note #tag @due 2026-11-03'], { env, encoding: 'utf8' });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-cm .fe-cm-th', { timeout: 8000 });
  await page.click('#fe-cm .fe-cm-th[data-id]'); await sleep(300);
  await clip('buttons-comment', '#fe-cm');
  const sizes2 = await audit();
  const off2 = sizes2.filter(s => s.w !== s.want || s.h !== s.want);
  check(off2.length === 0, `icon buttons on the file page are square at their size (${sizes2.length} seen): ${JSON.stringify(off2.slice(0, 4))}`);
  const mute2 = sizes2.filter(s => !s.named);
  check(mute2.length === 0, `every icon button on the file page has a name: ${JSON.stringify(mute2.slice(0, 4).map(s => s.id))}`);
  const ask = await page.evaluate(() => { const b = document.querySelector('#fe-ask-go'); return b ? { disabled: b.disabled, bg: getComputedStyle(b).backgroundColor } : null; });
  check(!ask || !ask.disabled || ask.bg !== 'rgba(0, 0, 0, 0)', `a disabled solid button keeps its fill: ${JSON.stringify(ask)}`);
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
