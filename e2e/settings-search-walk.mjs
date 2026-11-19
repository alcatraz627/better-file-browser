// Settings search: typing shows the matching settings from every tab together,
// marks the words that matched, and the tab list counts and names the matches.
// A named match scrolls to its row, a control works in the results, Esc clears
// and a second Esc closes, and closing leaves the tabs as they were.
//
//   node e2e/settings-search-walk.mjs [folder for screenshots]   (BFB_THEME=light for the light theme)
import { join } from 'node:path';
import { launch, THEME } from './harness.mjs';

const h = await launch();
const shots = process.argv[2];
let failed = 0;
const check = (ok, msg, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${ok || got === undefined ? '' : `  got: ${JSON.stringify(got)}`}`); if (!ok) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  if (THEME === 'light') await h.store.set('bfb-theme', 'light');
  const page = await h.open();
  await page.setViewport({ width: 1300, height: 900 });
  page.on('pageerror', e => check(false, `no page error (${e.message})`));
  await page.click('#fe-settings-btn');
  await page.waitForFunction(() => !document.getElementById('fe-settings-modal').hidden);
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="look"]');
  check(!!await page.$('#fe-settings-modal .fe-dlg-title #fe-st-search') && await page.$$eval('#fe-settings-modal .fe-dlg-tabs > *', c => c.every(x => x.matches('.fe-dlg-tab, .fe-dlg-hits'))), 'the search box sits above the tab list, which holds only tabs');

  const state = () => page.evaluate(() => {
    const vis = e => !!e && e.checkVisibility();
    const res = document.querySelector('.fe-dlg-results');
    return {
      searching: document.getElementById('fe-settings-modal').classList.contains('searching'),
      panes: [...res.querySelectorAll(':scope > .fe-dlg-pane')].map(p => p.dataset.tab),
      rows: [...res.querySelectorAll('.fe-set-l')].filter(vis).map(l => l.textContent.trim()),
      counts: Object.fromEntries([...document.querySelectorAll('#fe-settings-modal .fe-dlg-tab')].map(t => [t.dataset.tab, t.querySelector('.fe-dlg-n')?.textContent ?? null])),
      named: [...document.querySelectorAll('.fe-dlg-hits')].map(l => [l.dataset.tab, [...l.querySelectorAll('.fe-dlg-hit')].map(b => b.textContent)]),
      marks: CSS.highlights.get('bfb-settings-hit')?.size ?? 0,
      empty: res.querySelector('.fe-sr-empty')?.textContent ?? null,
    };
  });
  const type = async q => {
    await page.$eval('#fe-st-search', i => { i.value = ''; });
    await page.click('#fe-st-search');
    await page.keyboard.type(q);
    await sleep(200);
    return state();
  };

  // "sidebar" matches across tabs: Sidebar and Home whole (its name), and rows elsewhere.
  let s = await type('sidebar');
  check(s.searching && s.panes.includes('sidebar') && s.panes.length >= 2, 'a word shows matching settings from more than one tab', s.panes);
  check(s.counts.sidebar && Number(s.counts.sidebar) >= 4 && s.counts.web === null, 'the tab list counts matches per tab, none where nothing matched', s.counts);
  check(s.marks > 0, 'the matched words are marked', s.marks);
  await shot('settings-search');

  // Two words narrow it; every word must appear.
  s = await type('editable folders');
  check(s.rows.includes('Editable folders') && s.panes.join() === 'files', 'two words narrow to the one setting', s);
  check(s.named.some(([t, n]) => t === 'files' && n.includes('Editable folders')), 'and the tab list names it', s.named);

  // A word only in a control's tooltip still finds it.
  s = await type('ghostty');
  check(s.panes.includes('tools') && s.rows.includes('Terminal app'), 'a word from a control finds its row', s.rows);

  // A control works inside the results.
  s = await type('tooltips');
  const before = await page.$eval('#fe-st-tooltips', i => i.checked);
  await page.click('#fe-st-tooltips');
  await sleep(150);
  const stored = JSON.parse((await h.store.get('bfb-settings-v1')) ?? '{}');
  check(stored.tooltips === !before, 'a switch in the results changes the setting', stored.tooltips);
  await page.click('#fe-st-tooltips');

  // A named match scrolls to its row.
  s = await type('row');
  s = await type('sections');
  await page.evaluate(() => document.querySelector('.fe-dlg-hit')?.click());
  await sleep(700);
  const seen = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.fe-dlg-results .fe-set-l')].find(l => l.textContent.trim() === 'Sections');
    const r = el?.getBoundingClientRect(), box = document.querySelector('.fe-dlg-results').getBoundingClientRect();
    return r ? r.top >= box.top && r.bottom <= box.bottom : false;
  });
  check(seen, 'clicking a named match brings its row into view');

  // Nothing matched says so.
  s = await type('zzqqxx');
  check(/No setting matches/.test(s.empty ?? ''), 'no match says so', s.empty);

  // Esc clears; a second Esc closes Settings.
  await page.focus('#fe-st-search');
  await page.keyboard.press('Escape');
  await sleep(150);
  s = await state();
  check(!s.searching && await page.$eval('#fe-st-search', i => i.value) === '' && !await page.$eval('#fe-settings-modal', m => m.hidden), 'Esc clears the box and Settings stays open');
  check(await page.evaluate(() => document.querySelectorAll('#fe-settings-modal .fe-dlg-box > .fe-dlg-pane:not(.fe-dlg-results)').length) === 9, 'every tab is back in its place');
  check(await page.$eval('#fe-settings-modal .fe-dlg-pane[data-tab="look"]', p => p.classList.contains('on') && p.checkVisibility()), 'and the tab that was open shows again');
  await page.keyboard.press('Escape');
  await sleep(200);
  check(await page.$eval('#fe-settings-modal', m => m.hidden), 'a second Esc closes Settings');

  // Closing mid-search leaves it clear next time; a tab click ends a search.
  await page.click('#fe-settings-btn');
  await page.waitForFunction(() => !document.getElementById('fe-settings-modal').hidden);
  await type('font');
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="ai"]');
  await sleep(150);
  s = await state();
  check(!s.searching && await page.$eval('#fe-settings-modal .fe-dlg-pane[data-tab="ai"]', p => p.checkVisibility()), 'picking a tab ends the search and opens that tab');
  await type('font');
  await page.click('#fe-settings-modal .fe-dlg-close');
  await sleep(200);
  await page.click('#fe-settings-btn');
  await sleep(200);
  check(await page.$eval('#fe-st-search', i => i.value) === '' && !(await state()).searching, 'Settings opens clear after closing mid-search');

  async function shot(name) { if (shots) { await sleep(200); await page.screenshot({ path: join(shots, `${name}-${THEME}.png`) }); } }
} catch (err) {
  console.error(err);
  failed++;
} finally {
  await h.close();
  if (failed) { console.log(`${failed} failed`); process.exitCode = 1; }
}
