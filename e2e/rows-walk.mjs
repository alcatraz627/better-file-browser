// Every list shows one selected look and one hover look: the selected,
// current or active row takes the accent wash with body text; hover and the
// keyboard cursor take the hover wash. Measured on the sidebar, palette,
// dropdown, context menu, contents rail and the listing's tree and table.
// One theme per run; BFB_THEME=light for the other.
//   node e2e/rows-walk.mjs   → e2e/shots/rows-*.png
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, shot, applyTheme } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
try {
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  await applyTheme(page);
  // The two washes, resolved in this theme.
  const want = await page.evaluate(() => {
    const probe = c => { const d = document.createElement('div'); d.style.background = `var(${c})`; document.getElementById('fe').appendChild(d); const v = getComputedStyle(d).backgroundColor; d.remove(); return v; };
    const tx = getComputedStyle(document.getElementById('fe')).getPropertyValue('--tx').trim();
    const t = document.createElement('div'); t.style.color = tx; document.body.appendChild(t); const txc = getComputedStyle(t).color; t.remove();
    return { on: probe('--on'), hover: probe('--hover'), tx: txc };
  });
  const look = sel => page.$eval(sel, e => ({ bg: getComputedStyle(e).backgroundColor, fg: getComputedStyle(e).color })).catch(() => null);
  const seen = [];
  const selected = async (name, sel) => { const l = await look(sel); seen.push([name, 'selected', l]); return l; };
  const hovered = async (name, sel) => { await page.hover(sel).catch(() => null); await sleep(200); const l = await look(sel); seen.push([name, 'hover', l]); return l; };

  // Sidebar: the current place, and a row under the pointer.
  await page.click('#fe-rail-places'); await sleep(300);
  // The fixture is not a Places entry, so the current place is checked by its marks: every .active row says so to a screen reader.
  const hasHere = await page.evaluate(() => [...document.querySelectorAll('#fe-lenses .active')].every(a => a.getAttribute('aria-current') === 'page'));
  await hovered('places row', '#fe-lens-places .fe-si:not([aria-current])');

  // Palette: the active row.
  await page.keyboard.down('Meta'); await page.keyboard.press('k'); await page.keyboard.up('Meta'); await sleep(300);
  await selected('palette active', '.fe-pal-i.on');
  await page.screenshot({ path: await shot(page, 'rows-palette') });
  await page.keyboard.press('Escape'); await sleep(200);

  // Listing: details selected, then tree selected.
  await page.click('#fe-tbody tr[data-idx]:has(a[href$="notes.txt"]) td.c-sz'); await sleep(200);
  await selected('details selected', '#fe-tbody tr.selected td.c-sz');
  // Tree: the same look as the table.
  const treeRow = '.fe-tree-row:has(a[href$="notes.txt"])';
  for (let i = 0; i < 3 && !(await page.$(treeRow)); i++) { await page.click('#fe-view-group [data-v="tree"]'); await sleep(400); }
  // The look of a selected tree row, painted as listing.ts paints it (the
  // gestures that select have their own walks); the pointer rests elsewhere.
  await page.evaluate(() => document.querySelector('.fe-tree-row:has(a[href$="notes.txt"])')?.classList.add('selected'));
  await page.mouse.move(5, 880); await sleep(150);
  await selected('tree selected', '.fe-tree-row.selected');
  const treeName = await page.$eval('.fe-tree-row.selected .fe-nm', e => getComputedStyle(e).color).catch(() => null);
  // Back to the table, from a fresh page so nothing open swallows the click.
  await page.reload({ waitUntil: 'load' }); await sleep(400);
  await page.click('#fe-view-group [data-v="details"]'); await page.waitForSelector('#fe-tbody tr[data-idx]'); await sleep(200);

  // Item menu: the keyboard cursor.
  // Opened by its key: headless Chrome sends no keys to the page after a right-click.
  await page.click('#fe-tbody tr[data-idx]:has(a[href$="notes.txt"]) td.c-sz'); await page.keyboard.press('x'); await sleep(300);
  await page.keyboard.press('ArrowDown'); await sleep(150);
  await selected('menu cursor', '.fe-ctx-item.kb, .fe-ctx-item:focus');
  await page.keyboard.press('Escape'); await sleep(200);

  // Dropdown: the chosen option, and the keyboard cursor.
  await page.keyboard.press(','); await page.waitForSelector('#fe-settings-modal .fe-dlg-box', { visible: true }); await sleep(300);
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="folders"]'); await sleep(200);
  await page.click('#fe-st-terminal'); await sleep(300);
  await selected('dropdown chosen', '.fe-dd-opt[aria-selected="true"]');
  await page.keyboard.press('ArrowDown'); await sleep(150);
  await selected('dropdown cursor', '.fe-dd-opt.kb');
  await page.screenshot({ path: await shot(page, 'rows-dropdown') });
  await page.keyboard.press('Escape'); await sleep(150);
  await page.keyboard.press('Escape'); await sleep(200);

  // Contents rail: the heading in view.
  const doc = join(h.fixture, 'rows.md');
  writeFileSync(doc, '# Rows\n\n' + Array.from({ length: 8 }, (v, i) => `## Part ${i}\n\n${'Words. '.repeat(80)}\n`).join('\n'));
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-toc a'); await sleep(400);
  await selected('contents current', '#fe-toc a.on');
  await hovered('contents row', '#fe-toc a:not(.on)');
  await page.screenshot({ path: await shot(page, 'rows-contents') });

  for (const [n, k, l] of seen) console.log(`     ${n.padEnd(18)} ${k.padEnd(8)} ${JSON.stringify(l)}`);
  const sel = seen.filter(([, k]) => k === 'selected').filter(([n]) => !/cursor/.test(n));
  const cur = seen.filter(([n]) => /cursor/.test(n));
  const hov = seen.filter(([, k]) => k === 'hover');
  const bad = (xs, bg) => xs.filter(([, , l]) => !l || l.bg !== bg).map(([n, , l]) => [n, l?.bg]);
  check(hasHere, 'every current place in the sidebar carries aria-current');
  check(bad(sel, want.on).length === 0, `every selected, current or active row has the accent wash ${want.on}: ${JSON.stringify(bad(sel, want.on))}`);
  check(bad([...hov, ...cur], want.hover).length === 0, `every hovered row and keyboard cursor has the hover wash ${want.hover}: ${JSON.stringify(bad([...hov, ...cur], want.hover))}`);
  check(treeName === want.tx, `a selected tree row's name is body text, as in the table: ${treeName} vs ${want.tx}`);
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
