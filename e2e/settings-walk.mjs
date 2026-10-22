// Settings: every tab renders its controls, the controls save and apply, and
// keys drive them. Screenshots of each tab land in e2e/shots/.
//
//   node e2e/settings-walk.mjs      (BFB_THEME=light for the light theme)
import { launch, shot, applyTheme } from './harness.mjs';

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const read = async key => { await sleep(150); const v = await h.store.get(key); try { return JSON.parse(v); } catch { return v; } };
const h = await launch({ lmStub: true });
try {
  const page = await h.open();
  await applyTheme(page);
  await page.keyboard.press(',');
  await page.waitForSelector('#fe-settings-modal .fe-dlg-box');
  const tabs = ['look', 'folders', 'files', 'notes', 'ai', 'data'];
  for (const t of tabs) {
    await page.click(`#fe-settings-modal .fe-dlg-tab[data-tab="${t}"]`);
    await sleep(t === 'ai' ? 900 : 200);
    await shot(page, `settings-${t}`);
  }
  const selects = await page.$$eval('#fe-settings-modal select', s => s.length);
  check(selects === 0, `no plain selects left in Settings: ${selects}`);

  // Look: palette, System mode, app icon, sliders.
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="look"]');
  await page.click('input[name="bfb-palette"][value="ocean"] + .fe-set-thumb');
  check(await page.$eval('#fe', e => e.dataset.palette) === 'ocean', 'Ocean palette applies');
  await page.click('input[name="bfb-theme"][value="system"] + .fe-set-thumb');
  const mode = await page.$eval('#fe', e => [e.dataset.mode, e.dataset.theme]);
  check(mode[0] === 'system' && ['dark', 'light'].includes(mode[1]), `System mode resolves: ${mode}`);
  await page.click('input[name="bfb-appicon"][value="sprout"] + img');
  const fav = await page.$eval('link[rel="icon"]', l => l.href);
  check(/12-sprout\.svg$/.test(fav), `app icon changes the tab icon: ${fav}`);
  const action = await h.sw.evaluate(async () => { const out = []; for (const id of ['sprout', 'mono-b', 'classic']) out.push(await setActionIcon(id).then(() => 'ok', e => String(e))); return out.join(','); });
  check(action === 'ok,ok,ok', `the toolbar icon takes the app icon: ${action}`);
  const imgsOk = await page.$$eval('.fe-appicon img', a => a.every(i => i.complete && i.naturalWidth > 0));
  check(imgsOk, 'all 16 app icons load');
  // Slider by keys: focus, arrow right, the value and the text scale move.
  await page.focus('#fe-st-rd-size input');
  await page.keyboard.press('ArrowRight');
  await sleep(100);
  const txt = await page.evaluate(() => [document.querySelector('#fe-st-rd-size output').textContent, getComputedStyle(document.documentElement).getPropertyValue('--ui-text-scale')]);
  check(txt[0] === '16 px' && Math.abs(parseFloat(txt[1]) - 16 / 15) < 0.01, `text slider moves by key and applies: ${txt}`);
  // Density segment by keys.
  await page.focus('#fe-st-density .fe-seg-b.on');
  await page.keyboard.press('ArrowRight');
  check(await page.$eval('#fe', e => e.classList.contains('compact')), 'density Compact by arrow key');
  await page.keyboard.press('ArrowLeft');

  // Folders: dropdown by keys.
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="folders"]');
  await page.focus('#fe-st-group .fe-dd-btn');
  await page.keyboard.press('ArrowDown');
  await page.waitForSelector('.fe-dd-list');
  await sleep(200);
  await shot(page, 'settings-dropdown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const grp = await read('bfb-group-v1');
  check(grp === 'folders-first', `group dropdown picks by keys: ${grp}`);
  const listGone = await page.$('.fe-dd-list');
  check(!listGone, 'the list closes after a pick');
  const dlgOpen = await page.$eval('#fe-settings-modal', e => e.style.display !== 'none');
  check(dlgOpen, 'Settings stays open after Enter in the list');
  // Esc closes only the topmost layer: the open list, not the dialog under it.
  await page.keyboard.press('ArrowDown');
  await page.waitForSelector('.fe-dd-list');
  await page.keyboard.press('Escape');
  await sleep(100);
  const escList = !!(await page.$('.fe-dd-list'));
  const escDlg = await page.$eval('#fe-settings-modal', e => e.style.display !== 'none');
  const escFocus = await page.evaluate(() => document.activeElement?.closest('#fe-st-group') != null);
  check(!escList && escDlg && escFocus, `Esc on an open list closes the list and leaves Settings open, focus on the button: ${JSON.stringify({ escList, escDlg, escFocus })}`);

  // Files: chips and icon rules.
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="files"]');
  await page.click('#fe-st-excluded-exts .fe-chipin-in');
  await page.keyboard.type('.svg');
  await page.keyboard.press('Enter');
  const ex = await read('bfb-settings-v1');
  check((ex.excludedFileExtensions ?? []).includes('svg'), `chip adds .svg: ${JSON.stringify(ex.excludedFileExtensions)}`);
  await page.click('.fe-rule-add[data-name="Images"]');
  const rules = await read('bfb-icon-rules-v1');
  check(Array.isArray(rules) && rules.some(r => r.glyph === 'image'), 'suggestion adds an Images rule with a picture');
  await page.click('.fe-rule:last-child .fe-rule-ico');
  await page.waitForSelector('.fe-rule-pop');
  await sleep(250);
  await shot(page, 'settings-rule-pop');
  await page.click('.fe-rule-pop .fe-rp-c[data-c="#40c057"]');
  const rules2 = await read('bfb-icon-rules-v1');
  check(rules2.at(-1).color === '#40c057', 'swatch sets the rule colour');
  await page.keyboard.press('Escape');
  check(!(await page.$('.fe-rule-pop')), 'Esc closes the icon designer');
  await page.click('.fe-rule:last-child .fe-st-rule-pattern', { clickCount: 3 });
  await page.keyboard.type('(');
  check(await page.$eval('.fe-rule:last-child .fe-st-rule-pattern', e => e.classList.contains('bad')), 'a broken pattern is marked');
} finally {
  await h.close();
  process.exitCode = fails.length ? 1 : 0;
}
