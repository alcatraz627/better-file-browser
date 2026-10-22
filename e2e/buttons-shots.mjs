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
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  const clip = async (name, sel, pad = 10) => {
    const box = await page.$eval(sel, el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    await page.screenshot({ path: await shot(page, name), clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 } });
  };
  // Every icon button is the part, and none is wider or taller than its size.
  // The view switch is a Segmented group, which sets its own height.
  const audit = () => page.evaluate(() => [...document.querySelectorAll('button.btn[data-icon]:not(.fe-view-btn)')].filter(b => b.offsetParent).map(b => {
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

  await page.evaluate(() => document.querySelector('#fe-rail-ask')?.click()); await sleep(400);
  await clip('buttons-ask', '#fe-lenses .fe-lens:not([hidden])');
  await page.keyboard.press(','); await sleep(400);
  await page.screenshot({ path: await shot(page, 'buttons-settings') });
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
