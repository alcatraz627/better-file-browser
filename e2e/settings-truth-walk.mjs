// Settings says true things: an idle model reads as asleep, Model works while it
// sleeps, direction always does something, Width reaches the open page, emptied
// rules stay empty, a folder name may hold a space, a one-click reset has an Undo,
// and Reset leaves Saved where it lives. Rows sit in the tab their subject belongs to.
//
//   node e2e/settings-truth-walk.mjs [folder for screenshots]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, THEME, applyTheme } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shots = process.argv[2];
const h = await launch({ lmStub: true });
const read = async key => { await sleep(200); const v = await h.store.get(key); try { return JSON.parse(v); } catch { return v; } };
const tab = (page, t) => page.click(`#fe-settings-modal .fe-dlg-tab[data-tab="${t}"]`);
const openSettings = async page => { await page.keyboard.press(','); await page.waitForSelector('#fe-settings-modal .fe-dlg-box'); };
const closeSettings = async page => { await page.keyboard.press('Escape'); await sleep(200); };
const toastText = page => page.evaluate(() => [...document.querySelectorAll('.fe-toast, #fe-toast')].map(t => t.textContent).join(' '));
const pickSeg = (page, id, value) => page.click(`#${id} .fe-seg-b[data-v="${value}"]`);
try {
  let page = await h.open();
  await applyTheme(page);

  // Each subject lives in its own tab.
  await openSettings(page);
  const homes = await page.evaluate(() => {
    const at = id => document.getElementById(id)?.closest('[data-tab-body], [data-panel], .fe-dlg-pane, section[data-tab]')?.dataset ?? {};
    const tabOf = id => { const d = at(id); return d.tabBody ?? d.panel ?? d.tab ?? ''; };
    return Object.fromEntries(['fe-st-pan', 'fe-st-rd-code', 'fe-st-edit-roots', 'fe-st-peek-close', 'fe-st-home-url', 'fe-st-terminal', 'fe-st-rules-list', 'fe-st-keys', 'fe-st-saved-where'].map(id => [id, tabOf(id)]));
  });
  check(homes['fe-st-pan'] === 'files' && homes['fe-st-rd-code'] === 'look' && homes['fe-st-edit-roots'] === 'files' && homes['fe-st-peek-close'] === 'sidebar' && homes['fe-st-home-url'] === 'sidebar'
    && homes['fe-st-terminal'] === 'tools' && homes['fe-st-rules-list'] === 'tools' && homes['fe-st-keys'] === 'tools' && homes['fe-st-saved-where'] === 'notes', `rows sit in the tab of their subject: ${JSON.stringify(homes)}`);
  const buttons = await page.$$eval('#fe-st-export, #fe-st-import, #fe-st-reset, #fe-st-keys', bs => bs.map(b => getComputedStyle(b).borderTopColor !== 'rgba(0, 0, 0, 0)' && getComputedStyle(b).borderTopWidth !== '0px'));
  check(buttons.length === 4 && buttons.every(Boolean), `Export, Import, Reset and Keys read as buttons at rest: ${buttons}`);
  check((await page.$eval('#fe-settings-modal', d => d.textContent)).includes('Changes apply at once') && !(await page.$eval('#fe-settings-modal', d => d.textContent)).includes('Kept in this browser'), 'the title no longer claims everything stays in this browser');

  // Direction under "As listed" chooses Name, as the toolbar does.
  await tab(page, 'folders');
  await pickSeg(page, 'fe-st-sort-dir', 'desc');
  const order = await read('bfb-sort-v1');
  check(order.col === 'name' && order.dir === 'desc', `a direction under As listed sorts by name: ${JSON.stringify(order)}`);

  // A folder name with a space stays one chip.
  await tab(page, 'files');
  await page.click('#fe-st-edit-roots .fe-chipin-in');
  await page.keyboard.type('/Users/me/My Notes');
  await page.keyboard.press('Enter');
  const roots = (await read('bfb-settings-v1')).editableFolders;
  check(JSON.stringify(roots) === JSON.stringify(['/Users/me/My Notes']), `a folder with a space is one folder: ${JSON.stringify(roots)}`);
  // The reading sample follows the setting.
  await pickSeg(page, 'fe-st-rd-column', 'md');
  const sample = await page.evaluate(() => { const f = document.getElementById('fe-st-readsample'), d = f.firstElementChild; return { w: d.getBoundingClientRect().width, of: f.getBoundingClientRect().width, h: f.getBoundingClientRect().height }; });
  check(sample.w < sample.of * 0.7 && sample.h > 40, `the sample narrows with Width: ${JSON.stringify(sample)}`);
  if (shots) await page.screenshot({ path: join(shots, `set-reading-${THEME}.png`) });
  await pickSeg(page, 'fe-st-rd-column', 'unset');

  // Deleting every rule stays that way, and a one-click reset can be taken back.
  await tab(page, 'tools');
  const before = await page.$$eval('.fe-rule', r => r.length);
  await page.click('#fe-st-reset-rules');
  await sleep(150);
  check(/Undo/.test(await toastText(page)), `resetting rules offers Undo: ${await toastText(page)}`);
  await page.evaluate(() => [...document.querySelectorAll('.fe-toast button, #fe-toast button')].find(b => b.textContent === 'Undo')?.click());
  await sleep(150);
  check(await page.$$eval('.fe-rule', r => r.length) === before, 'Undo puts the rules back');
  for (let n = await page.$$eval('.fe-rule', r => r.length); n > 0; n--) { await page.click('.fe-rule .fe-st-rule-del'); await sleep(50); }
  check(/Undo/.test(await toastText(page)), 'deleting a rule offers Undo');
  await sleep(300);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe');
  await openSettings(page);
  await tab(page, 'tools');
  check(await page.$$eval('.fe-rule', r => r.length) === 0, 'an emptied rule list stays empty after a reload');
  await closeSettings(page);

  // Width reaches a file page behind the dialog.
  const doc = join(h.fixture, 'width.md');
  writeFileSync(doc, '# Width\n\n' + 'A long paragraph that fills the column. '.repeat(40) + '\n');
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-page p, .fe-page p, .md p', { timeout: 15000 });
  await sleep(400);
  const pWidth = () => page.evaluate(() => document.querySelector('#fe-page p, .fe-page p, .md p').getBoundingClientRect().width);
  const wide = await pWidth();
  await openSettings(page);
  await tab(page, 'files');
  await pickSeg(page, 'fe-st-rd-column', 'md');
  await sleep(400);
  const narrow = await pWidth();
  check(narrow < wide - 100, `Width applies to the open page: ${Math.round(wide)} to ${Math.round(narrow)}`);
  await pickSeg(page, 'fe-st-rd-column', 'unset');
  await closeSettings(page);

  // An idle model is asleep, not broken, and Model still lists what it can use.
  writeFileSync(h.lmDown, '1');
  page = await h.open();
  await openSettings(page);
  await tab(page, 'ai');
  await sleep(900);
  const asleep = await page.evaluate(() => ({
    state: document.querySelector('.fe-st-ai-state').textContent, sub: document.getElementById('fe-st-ai-sub').textContent,
    cold: document.querySelector('.fe-st-ai-head').classList.contains('cold'),
    warmOp: getComputedStyle(document.getElementById('fe-st-ai-warm')).opacity, warmDis: document.getElementById('fe-st-ai-warm').disabled,
  }));
  check(asleep.state === 'Asleep' && asleep.cold && /first question/.test(asleep.sub), `an idle model reads as asleep: ${JSON.stringify(asleep)}`);
  check(asleep.warmDis && Number(asleep.warmOp) < 1, `a Keep warm that cannot work looks it: ${JSON.stringify(asleep)}`);
  await page.click('#fe-st-ai-model .fe-dd-btn');
  await page.waitForSelector('.fe-dd-list');
  const listed = await page.$$eval('.fe-dd-list [role="option"]', o => o.length);
  check(listed >= 3, `Model lists its models while asleep: ${listed}`);
  if (shots) await page.screenshot({ path: join(shots, `set-ai-asleep-${THEME}.png`) });

  // Choosing a model here outranks a pick left over in Ask.
  await h.store.set('bfb-ask-model-v1', 'code');
  await page.$$eval('.fe-dd-list [role="option"]', o => o.find(x => /26b/.test(x.textContent)).click());
  await sleep(300);
  check(!(await h.store.get('bfb-ask-model-v1')), 'choosing a model in Settings clears the pick left in Ask');
  await closeSettings(page);

  // Not installed says what is true, and hides what cannot work.
  writeFileSync(h.lmGone, '1');
  page = await h.open();
  await openSettings(page);
  await tab(page, 'ai');
  await sleep(900);
  const gone = await page.evaluate(() => ({
    sub: document.getElementById('fe-st-ai-sub').textContent, hint: document.getElementById('fe-st-ai-hint').textContent,
    modelShown: document.getElementById('fe-st-ai-model').checkVisibility(),
  }));
  check(/Ask is off/.test(gone.sub) && !/hidden/.test(gone.sub) && !/extension-id|Native host/.test(gone.hint) && !gone.modelShown, `not installed says so plainly: ${JSON.stringify(gone)}`);
  await closeSettings(page);

  // Import names what it changes, and Saved's size.
  await h.store.set('bfb-saved-v1', [{ path: '/a/', label: 'a' }, { path: '/b/', label: 'b' }, { path: '/c/', label: 'c' }]);
  page = await h.open();
  await openSettings(page);
  await tab(page, 'data');
  mkdirSync(h.downloads, { recursive: true });
  const exp = join(h.downloads, 'import-me.json');
  writeFileSync(exp, JSON.stringify({ 'bfb-saved-v1': [{ path: '/a/', label: 'a' }], 'bfb-palette': 'ocean' }));
  await (await page.$('#fe-st-import-file')).uploadFile(exp);
  await page.waitForSelector('#fe-st-import-plan:not([hidden])');
  const plan = await page.$eval('#fe-st-import-plan-tx', e => e.textContent);
  check(/Saved: 3 to 1/.test(plan) && /Palette/.test(plan) && !/palette,|bfb-/.test(plan), `import says what would change in words: ${plan}`);
  await page.click('#fe-st-import-cancel');

  // Reset leaves Saved where it lives, and its Undo is the toast you see.
  await h.store.set('bfb-saved-folder-off-v1', '1');
  await h.store.set('bfb-palette', 'ocean');
  await page.click('#fe-st-reset');
  await sleep(1200);
  await page.waitForSelector('#fe');
  await sleep(1000);
  check(await h.store.get('bfb-saved-folder-off-v1') === '1', 'Reset keeps Saved in the browser when you moved it back');
  check(!(await h.store.get('bfb-palette')), 'Reset does clear the palette');
  const after = await toastText(page);
  check(/Settings reset/.test(after) && /Undo/.test(after) && !/lives in your notes/.test(after), `the reset's own Undo is what shows: ${after}`);
} finally {
  for (const r of results) console.log(r);
  console.log(`${results.filter(r => r.startsWith('PASS')).length} pass, ${results.filter(r => r.startsWith('FAIL')).length} fail`);
  await h.close();
}
