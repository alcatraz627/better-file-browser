// Every bar on every surface: the same height, side padding and gap, md
// controls, and room above and below when a narrow window wraps it. Bars
// along a page or panel are 40px; toolbars inside content (a code block, a
// comment, a lens) are inset and only share the gap. Each bar the walk lists
// must be opened and measured. One theme per run; BFB_THEME=light for the other.
//   node e2e/bars-walk.mjs   → e2e/shots/bars-*.png
import { writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { launch, shot, applyTheme } from './harness.mjs';

const CLI = resolve(new URL('..', import.meta.url).pathname, 'native', 'bfb_docs.py');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_') && !k.startsWith('BFB_'))), BFB_DOCS_HOME: h.docsHome };
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
const BARS = ['#fe-bar', '#fe-toolbar', '#fe-statusbar', '#fe-fp-bar', '#fe-ql-hdr', '.fe-ql-imgbar', '.fe-ql-htmlbar', '#fe-ed-bar'];
const INSET = ['.fe-md-code-bar', '.fe-cm-tools', '.fe-lens-tools'];
try {
  // A notes folder of its own, never the owner's.
  const notes = mkdtempSync(join(tmpdir(), 'bfb-bars-notes-'));
  writeFileSync(join(notes, 'one.md'), '# One\n\nA note.\n');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture], notesRoot: notes }));
  await h.store.set('bfb-comments-filter-v1', 'open');
  writeFileSync(join(h.fixture, 'pic.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#3c6"/></svg>');
  writeFileSync(join(h.fixture, 'page.html'), '<!doctype html><title>t</title><p>Hello</p>');
  writeFileSync(join(h.fixture, 'empty.txt'), '');
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  await applyTheme(page);
  // What each visible bar measures: its box, padding, gap, the heights of its
  // own controls (not those inside a field or a segmented group), and the
  // room between its rows of controls and its edges.
  const measure = () => page.evaluate((bars, inset) => [...bars.map(s => [s, false]), ...inset.map(s => [s, true])].flatMap(([sel, isInset]) =>
    [...document.querySelectorAll(sel)].filter(b => b.offsetParent && b.getClientRects().length).slice(0, 1).map(b => {
      const cs = getComputedStyle(b), r = b.getBoundingClientRect();
      const ctls = [...b.querySelectorAll('.btn, .fe-dd-btn, .fe-seg')].filter(c => c.offsetParent && !c.closest('#fe-ff, .fe-seg .btn, .tb'));
      const boxes = ctls.map(c => c.getBoundingClientRect());
      return { sel, inset: isInset, h: Math.round(r.height), padL: cs.paddingLeft, padR: cs.paddingRight, gap: cs.columnGap,
        ctl: [...new Set(boxes.map(c => Math.round(c.height)))],
        room: boxes.length ? Math.floor(Math.min(...boxes.map(t => t.top - r.top), ...boxes.map(t => r.bottom - t.bottom))) : null };
    })), BARS, INSET);
  const seen = new Map();
  const take = async label => { for (const m of await measure()) if (!seen.has(m.sel)) seen.set(m.sel, { ...m, where: label }); };
  const preview = async name => {
    await (await page.$(`#fe-tbody tr[data-idx]:has(a[href$="${name}"]) td.c-nm`)).click();
    await page.waitForSelector('#fe-qlook', { visible: true, timeout: 5000 }); await sleep(500);
  };
  const close = async () => { await page.keyboard.press('Escape'); await sleep(250); };

  await take('listing');
  await page.screenshot({ path: await shot(page, 'bars-listing'), clip: { x: 0, y: 0, width: 1400, height: 140 } });
  await preview('readme.md'); await take('preview'); await close();
  await preview('pic.svg'); await take('image'); await close();
  await preview('page.html'); await take('html'); await close();

  // A notice: an empty file's preview says so in the notice part.
  await preview('empty.txt');
  const note = await page.evaluate(() => { const n = document.querySelector('#fe-qlook .notice'); if (!n) return null; return { text: n.textContent.trim(), pad: getComputedStyle(n).paddingLeft }; });
  check(!!note && /Empty file/.test(note.text) && note.pad === '12px', `an empty file's preview shows a notice: ${JSON.stringify(note)}`);
  await close();

  // The note editor's bar.
  await page.keyboard.press('n');
  await page.waitForSelector('#fe-ed-bar', { visible: true, timeout: 8000 }).catch(() => null); await sleep(300);
  await take('editor');
  await page.screenshot({ path: await shot(page, 'bars-editor'), clip: { x: 0, y: 0, width: 1400, height: 160 } });
  await close();

  const doc = join(h.fixture, 'bars.md');
  writeFileSync(doc, '# Bars\n\nSome words to comment on here.\n\n```js\nconst a = 1;\n```\n');
  spawnSync('python3', [CLI, '--json', '--as', 'bfb', 'comments', 'new', doc, '--quote', 'words to comment', 'A note'], { env, encoding: 'utf8' });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-bar'); await sleep(400);
  await page.click('#fe-cm .fe-cm-th[data-id]').catch(() => null); await sleep(300);
  await take('file page');
  await page.screenshot({ path: await shot(page, 'bars-file'), clip: { x: 0, y: 0, width: 1400, height: 160 } });

  const rows = [...seen.values()];
  for (const r of rows) console.log(`     ${r.where.padEnd(10)} ${r.sel.padEnd(16)} h=${r.h} pad=${r.padL}/${r.padR} gap=${r.gap} ctl=${r.ctl.join(',')} room=${r.room}`);
  const missing = [...BARS, ...INSET].filter(s => !seen.has(s));
  check(missing.length === 0, `every bar the walk lists was opened and measured: missing ${JSON.stringify(missing)}`);
  const bars = rows.filter(r => !r.inset);
  const offH = bars.filter(r => r.h !== 40);
  check(offH.length === 0, `every bar is 40px tall: ${JSON.stringify(offH.map(r => [r.sel, r.h]))}`);
  const offPad = bars.filter(r => r.padL !== '12px' || r.padR !== '12px');
  check(offPad.length === 0, `every bar has 12px sides: ${JSON.stringify(offPad.map(r => [r.sel, r.padL, r.padR]))}`);
  const offGap = rows.filter(r => r.gap !== '4px');
  check(offGap.length === 0, `every bar and inset toolbar has a 4px gap: ${JSON.stringify(offGap.map(r => [r.sel, r.gap]))}`);
  const offCtl = bars.filter(r => r.ctl.some(c => c !== 28));
  check(offCtl.length === 0, `controls in bars are md, 28px: ${JSON.stringify(offCtl.map(r => [r.sel, r.ctl]))}`);

  // Narrow, the toolbar wraps and its rows keep room above and below
  // (a 40px bar with a 1px border and 28px controls leaves 5px).
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.setViewport({ width: 700, height: 900 }); await sleep(500);
  const narrow = (await measure()).find(m => m.sel === '#fe-toolbar');
  check(!!narrow && narrow.h > 40 && narrow.room >= 5, `a wrapped toolbar keeps room above and below its rows: ${JSON.stringify(narrow)}`);
  await page.screenshot({ path: await shot(page, 'bars-narrow'), clip: { x: 0, y: 0, width: 700, height: 200 } });
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
