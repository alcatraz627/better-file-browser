// Keys that must stay with the surface that has them, now that one router
// runs every command: a docked preview does not take the sidebar's arrows,
// the palette keeps Tab over a dialog, a radio group is one Tab stop, Esc
// closes a popover before anything else, and the comments box keeps its own Esc.
//   node e2e/keys-guard-walk.mjs
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { launch } from './harness.mjs';

const CLI = resolve(new URL('..', import.meta.url).pathname, 'native', 'bfb_docs.py');
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_') && !k.startsWith('BFB_'))), BFB_DOCS_HOME: h.docsHome };
const cli = (...args) => spawnSync('python3', [CLI, '--json', ...args], { env, encoding: 'utf8' });
try {
  const names = ['readme.md', 'nested/', 'notes.txt', 'data.json', 'rows.tsv', 'script.sh', 'code.py', 'nested/inner.txt'];
  await h.store.set('bfb-saved-v1', names.map(n => ({ path: h.fixture + '/' + n, label: n.replace(/\/$/, '') })));
  // Docking folds the sidebar by default; this step needs both on screen.
  await h.store.set('bfb-settings-v1', { dockFoldsSidebar: false });
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  const ae = () => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.getAttribute('href') || a.className || a.tagName) : ''; });

  // A docked preview leaves ↓ on a sidebar row to the sidebar.
  await page.click('#fe-scroll [data-idx]:has(a[href$="notes.txt"])');
  await sleep(500);
  await page.keyboard.press('d');
  await sleep(200);
  await page.evaluate(() => document.querySelector('#fe-rail-saved')?.click());
  await sleep(200);
  await page.$eval('#fe-lenses .fe-lens:not([hidden]) .fe-si-link', a => a.focus());
  const r1a = { focus: await ae(), name: await page.$eval('#fe-ql-name', n => n.textContent) };
  await page.keyboard.press('ArrowDown');
  await sleep(300);
  const r1b = { focus: await ae(), name: await page.$eval('#fe-ql-name', n => n.textContent) };
  check(r1a.focus !== r1b.focus && r1a.name === r1b.name, `↓ on a sidebar row moves the row, not the docked preview: ${r1a.name} → ${r1b.name}`);
  await page.evaluate(() => document.getElementById('fe-ql-dock')?.click());
  await sleep(100);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Escape');
  await sleep(200);

  // The palette over Settings keeps Tab.
  await page.keyboard.press(',');
  await sleep(300);
  await page.keyboard.down('Meta'); await page.keyboard.press('k'); await page.keyboard.up('Meta');
  await sleep(300);
  await page.keyboard.press('Tab');
  await sleep(200);
  check(await page.evaluate(() => !!document.activeElement?.closest('.fe-pal')), `Tab in the palette over Settings stays in the palette: ${await ae()}`);
  await page.keyboard.press('Escape');
  await sleep(200);

  // A radio group is one Tab stop.
  await page.evaluate(() => {
    const r = document.querySelector('#fe-settings-modal input[type=radio]');
    for (const t of document.querySelectorAll('#fe-settings-modal [data-tab]')) { t.click(); if (r && r.offsetParent !== null) return; }
  });
  await sleep(200);
  const start = await page.evaluate(() => { const r = [...document.querySelectorAll('#fe-settings-modal input[type=radio]')].find(x => x.offsetParent !== null && x.checked); r?.focus(); return r?.name ?? ''; });
  await page.keyboard.press('Tab');
  const next = await page.evaluate(() => document.activeElement?.name ?? document.activeElement?.tagName);
  check(!!start && next !== start, `Tab from a checked radio leaves its group: ${start} → ${next}`);
  await page.keyboard.press('Escape');
  await sleep(300);

  // Esc closes a popover opened from a sidebar button, and focus stays on the button.
  await page.evaluate(() => document.querySelector('#fe-rail-ask')?.click());
  await sleep(300);
  await page.click('#fe-ask-hist-btn');
  await sleep(200);
  await page.keyboard.press('Escape');
  await sleep(200);
  const hist = await page.evaluate(() => ({ open: !document.getElementById('fe-ask-hist').hidden, focus: document.activeElement?.id }));
  check(!hist.open && hist.focus === 'fe-ask-hist-btn', `one Esc closes the Ask history and keeps focus on its button: ${JSON.stringify(hist)}`);

  // The comments box keeps its own Esc.
  const doc = join(h.fixture, 'keys.md');
  writeFileSync(doc, '# Keys\n\nThe first paragraph sits at the top.\n\nA second paragraph follows it.\n');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture] }));
  await h.store.set('bfb-comments-filter-v1', 'open');
  cli('--as', 'bfb', 'comments', 'new', doc, '--quote', 'second paragraph', 'Seeded thread');
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-cm .fe-cm-th', { timeout: 8000 });
  // The comments rail starts hidden; its button in the file bar shows it.
  if (!await page.$eval('#fe-cm', e => e.checkVisibility())) { await page.click('#fe-fp-cm'); await sleep(400); }
  await page.click('#fe-cm .fe-cm-th[data-id]');
  await sleep(300);
  await page.$eval('#fe-cm .fe-cm-th[data-id]', t => t.focus());
  await page.keyboard.press('Escape');
  await sleep(200);
  const card = await page.evaluate(() => ({ on: !!document.querySelector('#fe-cm .fe-cm-th.on'), focus: document.activeElement?.id || document.activeElement?.tagName }));
  check(!card.on && card.focus === 'fe-page', `Esc on a thread card lets it go and puts focus on the page: ${JSON.stringify(card)}`);
  await page.evaluate(() => { window.getSelection()?.removeAllRanges(); document.activeElement?.blur(); });
  await page.keyboard.press('c');
  await sleep(300);
  await page.keyboard.type('keep me');
  await page.$eval('#fe-cm .fe-cm-new [data-a="post"]', b => b.focus());
  await page.keyboard.press('Escape');
  await sleep(200);
  await page.evaluate(() => { window.getSelection()?.removeAllRanges(); document.activeElement?.blur(); });
  await page.keyboard.press('c');
  await sleep(300);
  const kept = await page.$eval('#fe-cm textarea[data-for="new"]', t => t.value).catch(() => '');
  check(kept === 'keep me', `Esc on the draft's button puts the text away, and c brings it back: "${kept}"`);
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
