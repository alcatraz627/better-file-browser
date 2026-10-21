// The sidebar is a bar of seven lenses. Notes shows first; Saved is a lens
// of its own; Places lists Home and the folders under it, read from a page under
// your home; History lists what you opened lately. The choice survives a
// reload, arrow keys move between lenses, and History can be switched off.
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
// Let the 120ms background fade finish so a shot shows the settled state.
const settle = () => new Promise(r => setTimeout(r, 250));
const state = p => p.evaluate(() => ({
  rail: [...document.querySelectorAll('#fe-rail .fe-rail-btn')].filter(b => !b.hidden).map(b => b.textContent.trim()),
  on: document.querySelector('#fe-rail .fe-rail-btn.on')?.textContent.trim(),
  shown: [...document.querySelectorAll('#fe-lenses .fe-lens')].filter(l => !l.hidden).map(l => l.dataset.lens),
  head: document.querySelector('#fe-lenses .fe-lens:not([hidden]) .fe-lens-t b')?.textContent,
}));
try {
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 800 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  // A page under home teaches the explorer where home is.
  await page.goto('file://' + homedir() + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-rail');
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-rail');

  const first = await state(page);
  check(first.rail.join() === 'Places,Saved,Notes,History,Search,Ask,Comments' && first.on === 'Notes' && first.shown.join() === 'notes' && first.head === 'Notes',
    `the bar shows seven lenses, Notes first: ${JSON.stringify(first)}`);
  const notes = await page.evaluate(() => ({ saved: !!document.querySelector('#fe-lens-saved #fe-sv-list'), list: !!document.querySelector('#fe-lens-notes #fe-nt-list') }));
  check(notes.saved && notes.list, `Saved and the notes list sit in lenses of their own: ${JSON.stringify(notes)}`);
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') { await page.click('#fe-theme-btn'); await page.mouse.move(700, 700); await new Promise(r => setTimeout(r, 400)); }
    await page.screenshot({ path: join(SHOTS, `lens-notes-${theme}.png`), clip: { x: 0, y: 0, width: 700, height: 520 } });
  }

  await page.click('#fe-rail-places');
  const places = await page.evaluate(() => [...document.querySelectorAll('#fe-lens-places a.fe-si')].map(a => ({ t: a.textContent.trim(), href: a.getAttribute('href') })));
  const home = 'file://' + homedir() + '/';
  check(places[0]?.t === 'Home' && places[0]?.href === home && places.some(p => p.t === 'Downloads' && p.href === home + 'Downloads/') && places.at(-1)?.t === 'Root /',
    `Places starts at your Home, read from a visit, and ends at Root: ${JSON.stringify(places.slice(0, 3))} … ${JSON.stringify(places.at(-1))}`);
  await page.mouse.move(700, 700); await settle();
  await page.screenshot({ path: join(SHOTS, 'lens-places-light.png'), clip: { x: 0, y: 0, width: 700, height: 520 } });

  await page.click('#fe-rail-history');
  const hist = await page.evaluate(() => [...document.querySelectorAll('#fe-lens-history a.fe-si')].map(a => a.getAttribute('title')));
  check(hist.includes(homedir() + '/'), `History lists the folder opened before: ${JSON.stringify(hist)}`);
  await page.mouse.move(700, 700); await settle();
  await page.screenshot({ path: join(SHOTS, 'lens-history-light.png'), clip: { x: 0, y: 0, width: 700, height: 520 } });

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-rail');
  const kept = await state(page);
  check(kept.on === 'History' && kept.shown.join() === 'history', `the lens survives a reload: ${JSON.stringify(kept)}`);

  await page.focus('#fe-rail-history');
  await page.keyboard.press('ArrowUp');
  const up = await state(page);
  check(up.on === 'Notes', `ArrowUp moves to the lens above: ${up.on}`);

  await page.click('#fe-settings-btn');
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="folders"]');
  await page.click('#fe-st-sec-recent');
  await page.keyboard.press('Escape');
  const off = await state(page);
  check(off.rail.join() === 'Places,Saved,Notes,Search,Ask,Comments', `switching History off removes its lens: ${JSON.stringify(off.rail)}`);
  await page.click('#fe-settings-btn');
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="folders"]');
  await page.click('#fe-st-sec-recent');
  await page.keyboard.press('Escape');
  check((await state(page)).rail.join() === 'Places,Saved,Notes,History,Search,Ask,Comments', 'switching it back on returns it');
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'lens walk passes');
