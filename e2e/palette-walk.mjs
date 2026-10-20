// The four palettes (Slate, Violet, Sand, Ink) are picked in Settings and work
// in both themes. Slate is the default. A pick applies at once, survives a
// reload, and the theme toggle still flips light and dark under it. Every
// palette and theme is shot on the listing and on a file page for reading.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

// Accent and page background per palette and theme, from src/styles.ts.
const WANT = {
  slate:  { dark: ['#3cc6c0', '#0f1316'], light: ['#0e8f8a', '#eef3f5'] },
  violet: { dark: ['#9d7cff', '#101014'], light: ['#6d4aff', '#f4f4f7'] },
  sand:   { dark: ['#e8789a', '#13110f'], light: ['#c2406b', '#f6f2ec'] },
  ink:    { dark: ['#f2f2f3', '#0c0c0d'], light: ['#141414', '#f5f5f5'] },
};

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const settle = () => new Promise(r => setTimeout(r, 300));
const read = p => p.evaluate(() => {
  const fe = document.getElementById('fe');
  const cs = getComputedStyle(fe);
  return { palette: fe.dataset.palette, theme: fe.dataset.theme, ac: cs.getPropertyValue('--ac').trim(), bg: cs.getPropertyValue('--bg').trim(),
    html: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() };
});
const pick = async (p, name) => {
  await p.click('#fe-settings-btn');
  await p.click('#fe-settings-modal .fe-dlg-tab[data-tab="look"]');
  await p.click(`#fe-settings-modal input[name="bfb-palette"][value="${name}"]`);
  await p.keyboard.press('Escape');
};
const setTheme = async (p, theme) => {
  if ((await read(p)).theme !== theme) await p.click('#fe-theme-btn');
  await p.mouse.move(1300, 780); await settle();
};
try {
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 800 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe');

  const first = await read(page);
  check(first.palette === 'slate' && first.ac === WANT.slate[first.theme][0], `Slate is the default: ${JSON.stringify(first)}`);

  for (const name of Object.keys(WANT)) {
    await pick(page, name);
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      const s = await read(page);
      const [ac, bg] = WANT[name][theme];
      check(s.palette === name && s.ac === ac && s.bg === bg && s.html === bg, `${name} ${theme} applies its accent and background to the page: ${JSON.stringify(s)}`);
      await page.screenshot({ path: join(SHOTS, `palette-${name}-${theme}.png`) });
    }
  }

  await pick(page, 'sand');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe');
  const kept = await read(page);
  check(kept.palette === 'sand', `the palette survives a reload: ${kept.palette}`);
  await page.click('#fe-settings-btn');
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="look"]');
  const radios = await page.evaluate(() => ({
    palette: document.querySelector('input[name="bfb-palette"]:checked')?.value,
    theme: document.querySelector('input[name="bfb-theme"]:checked')?.value,
    fe: document.getElementById('fe').dataset.theme,
  }));
  check(radios.palette === 'sand' && radios.theme === radios.fe, `Settings shows the saved palette and the current theme: ${JSON.stringify(radios)}`);
  await page.screenshot({ path: join(SHOTS, 'palette-settings.png') });
  await page.keyboard.press('Escape');

  // A file page reads in every palette; mermaid follows the theme.
  for (const name of Object.keys(WANT)) {
    await pick(page, name);
    await page.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
    await page.waitForSelector('#fe');
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      await new Promise(r => setTimeout(r, 500));
      await page.screenshot({ path: join(SHOTS, `palette-${name}-${theme}-file.png`) });
    }
    await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
    await page.waitForSelector('#fe');
  }
  await pick(page, 'slate');
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'palette walk passes');
