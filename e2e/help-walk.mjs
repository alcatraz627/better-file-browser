// Help: the keyboard map lights keys on hover, filters by typing and by
// clicking a key, and every page is cards rather than paragraphs.
//
//   node e2e/help-walk.mjs      (BFB_THEME=light for the light theme)
import { launch, shot, applyTheme } from './harness.mjs';

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  const page = await h.open();
  await applyTheme(page);
  await page.keyboard.press('?');
  await page.waitForSelector('#fe-help-modal .fe-km');
  await page.click('#fe-help-modal .fe-dlg-tab[data-tab="keys"]');
  const caps = await page.$$eval('#fe-help-modal .fe-km-cap', c => c.length);
  const used = await page.$$eval('#fe-help-modal .fe-km-cap.used', c => c.length);
  check(caps > 60 && used > 30, `a full keyboard with the used keys tinted: ${used} of ${caps}`);
  await page.hover('#fe-help-modal .fe-km-i[data-q^="command palette"]');
  const lit = await page.$$eval('#fe-help-modal .fe-km-cap.hl', c => [...new Set(c.map(x => x.dataset.cap))].sort().join(' '));
  check(lit === 'k meta', `hovering "Command palette" lights ⌘ and K: ${lit}`);
  await sleep(120);
  await shot(page, 'help-keys');
  await page.hover('#fe-help-modal .fe-km-cap[data-cap="g"]');
  const gRows = await page.$$eval('#fe-help-modal .fe-km-i.on', r => r.length);
  check(gRows >= 10, `hovering G marks the g sequences: ${gRows}`);
  await page.click('#fe-help-modal .fe-km-cap[data-cap="g"]');
  const shown = await page.$$eval('#fe-help-modal .fe-km-i', r => r.filter(x => !x.hidden).length);
  check(shown === gRows, `clicking G keeps only its actions: ${shown}`);
  await page.click('#fe-help-modal .fe-km-cap[data-cap="g"]');
  await page.type('#fe-help-modal .fe-km-q', 'tab');
  const typed = await page.$$eval('#fe-help-modal .fe-km-i', r => r.filter(x => !x.hidden).length);
  check(typed > 3 && typed < 25, `typing "tab" filters the list: ${typed}`);
  for (const t of ['start', 'mouse', 'files', 'notes', 'how']) {
    await page.click(`#fe-help-modal .fe-dlg-tab[data-tab="${t}"]`);
    await sleep(150);
    const n = await page.$$eval(`#fe-help-modal .fe-dlg-pane[data-tab="${t}"] .fe-hc`, c => c.length);
    const prose = await page.$$eval(`#fe-help-modal .fe-dlg-pane[data-tab="${t}"] p:not(.fe-dlg-ph p)`, p => p.length);
    check(n >= 8 && prose === 0, `${t}: ${n} cards, no paragraphs`);
    await shot(page, `help-${t}`);
  }
} finally {
  await h.close();
  process.exitCode = fails.length ? 1 : 0;
}
