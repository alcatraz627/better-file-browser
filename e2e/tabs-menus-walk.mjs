// A crowded tab strip and the menus around it: tab labels that stay different,
// pinned tabs that stay put, Close others with an undo and a Closed tabs list in
// History, the Tour's real Edit key, the row and tab menus, the hold-⌥ badges,
// and a palette that matches word starts and wraps its chips.
//   node e2e/tabs-menus-walk.mjs [--light]   → e2e/shots/tabs-menus-*.png
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { launch, applyTheme, shot } from './harness.mjs';

let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// A missing control is a failed check, not a crash, so one gap leaves the rest of the walk running.
const appears = (page, sel) => page.waitForSelector(sel, { timeout: 2500 }).then(() => true, () => false);

const dir = '/tmp/bfb-tabs-menus';
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
for (let i = 1; i <= 25; i++) writeFileSync(`${dir}/quarterly-report-final-${String(i).padStart(3, '0')}.csv`, 'a,b\n1,2\n');
writeFileSync(`${dir}/notes.txt`, 'plain words to copy\n');

const h = await launch();
try {
  const page = await h.open(dir);
  await applyTheme(page);
  const tabs = () => page.$$eval('#fe-tabs .fe-tab', ts => ts.map(t => ({
    id: t.dataset.id, on: t.classList.contains('on'), pinned: t.classList.contains('pinned'),
    w: Math.round(t.getBoundingClientRect().width), left: Math.round(t.getBoundingClientRect().left),
    txt: t.querySelector('.fe-tab-lbl')?.textContent ?? '', cur: t.hasAttribute('aria-current'),
  })));
  const toastText = () => page.$eval('#fe-toast', t => t.classList.contains('show') ? t.textContent : '');

  // Keep every csv as a background tab: Alt+Enter on each row.
  await page.keyboard.press('Home');
  for (let i = 0; i < 26; i++) {
    await page.keyboard.down('Alt'); await page.keyboard.press('Enter'); await page.keyboard.up('Alt');
    await page.keyboard.press('ArrowDown');
  }
  await sleep(300);

  // 5: cut-off labels still tell the tabs apart, and the active tab keeps room.
  let t = await tabs();
  const labels = t.filter(x => /^quar/.test(x.txt)).map(x => x.txt);
  check(labels.length >= 24 && new Set(labels).size === labels.length, `${labels.length} cut-off labels are all different (${new Set(labels).size} distinct): ${labels.slice(0, 3).join(' | ')}`);
  const active = t.find(x => x.on);
  check(active && active.w >= 130, `the active tab keeps room: ${active?.w}px`);
  await shot(page, 'tabs-menus-crowded');

  // 6: a pinned tab shows its icon, stays at the left while the strip scrolls, and is the only active one.
  await page.keyboard.press('p');
  await sleep(300);
  t = await tabs();
  const pin = t[0];
  check(pin.pinned && pin.on && pin.w >= 28, `a pinned tab is wide enough to read: ${pin.w}px`);
  check(await page.$eval('#fe-tabs .fe-tab.pinned .fe-tab-ico svg', s => !!s && s.getBoundingClientRect().width > 8), 'a pinned tab shows its file icon');
  check(t.filter(x => x.cur).length === 1 && t.filter(x => x.on).length === 1 && t[0].cur, 'only the pinned tab is current, not its neighbour');
  await page.$eval('#fe-tabs', s => { s.scrollLeft = s.scrollWidth; });
  await sleep(150);
  const strip = await page.$eval('#fe-tabs', s => s.getBoundingClientRect().left);
  const pinLeft = (await tabs())[0].left;
  check(Math.abs(pinLeft - strip) < 24, `the pinned tab stays at the left after the strip scrolls: ${pinLeft - strip}px from the edge`);
  const divider = await page.$eval('#fe-tabs .fe-tab.pinned', a => { const s = getComputedStyle(a, '::after'); return { end: a.classList.contains('pin-end'), content: s.content, w: parseFloat(s.width) }; });
  check(divider.end && divider.content !== 'none' && divider.w >= 12, `a fading divider follows the last pinned tab, so a tab scrolled under it never reads as part of it: ${JSON.stringify(divider)}`);
  await shot(page, 'tabs-menus-pinned');
  // Two pinned tabs sit side by side, and stay so when one changes size without the strip redrawing (a font or density change).
  await page.$eval('#fe-tabs', s => { s.scrollLeft = 0; });
  await page.evaluate(() => document.querySelectorAll('#fe-tabs .fe-tab:not(.pinned)')[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 40 })));
  await sleep(200);
  const pinItem = await page.evaluate(() => { const i = [...document.querySelectorAll('.fe-ctx-item[data-act="pin"]')].find(x => x.offsetParent && /^Pin/.test(x.textContent.trim())); if (i) i.click(); return !!i; });
  await sleep(300);
  const sideBySide = () => page.$$eval('#fe-tabs .fe-tab.pinned', ps => ps.map(p => { const b = p.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; }));
  await page.evaluate(() => { document.querySelector('#fe-tabs .fe-tab.pinned').style.paddingInline = '20px'; });
  await sleep(200);
  const pins = await sideBySide();
  check(pinItem && pins.length === 2 && pins[1][0] >= pins[0][1] && pins[1][0] - pins[0][1] < 12, `two pinned tabs stay side by side when one grows: ${JSON.stringify(pins)}`);
  await page.evaluate(() => { document.querySelector('#fe-tabs .fe-tab.pinned').style.paddingInline = ''; });
  await page.evaluate(() => document.querySelectorAll('#fe-tabs .fe-tab.pinned')[1].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 40 })));
  await sleep(200);
  await page.evaluate(() => [...document.querySelectorAll('.fe-ctx-item[data-act="pin"]')].find(x => x.offsetParent)?.click());
  await sleep(300);

  // 25 (tab menu): Close to the right, with an undo.
  await page.$eval('#fe-tabs', s => { s.scrollLeft = 0; });
  const before = (await tabs()).length;
  await page.click('#fe-tabs .fe-tab:nth-child(6)', { button: 'right' });
  const hasRight = await appears(page, '.fe-tab-menu [data-act="right"]');
  check(hasRight, 'the tab menu offers Close to the right');
  if (hasRight) await page.click('.fe-tab-menu [data-act="right"]');
  await sleep(250);
  const afterRight = (await tabs()).length;
  check(afterRight === 6 && /^Closed \d+ tabs/.test(await toastText()), `Close to the right leaves 6 tabs (had ${before}): ${afterRight}, "${await toastText()}"`);
  if (hasRight) await page.click('#fe-toast .fe-toast-act');
  await sleep(250);
  check((await tabs()).length === before, `undo brings the closed tabs back: ${(await tabs()).length}`);

  // 7: Close others undoes the same way, and History lists what closed.
  await page.click('#fe-tabs .fe-tab:nth-child(4)', { button: 'right' });
  await page.waitForSelector('.fe-tab-menu [data-act="others"]');
  await page.click('.fe-tab-menu [data-act="others"]');
  await sleep(250);
  const noUndo = !(await appears(page, '#fe-toast .fe-toast-act'));
  const kept = (await tabs()).length;
  check(kept === 2 && /^Closed \d+ tabs/.test(await toastText()), `Close others leaves the pinned tab and the one named, with a toast: ${kept}, "${await toastText()}"`);
  if (!noUndo) await page.click('#fe-toast .fe-toast-act');
  await sleep(250);
  check((await tabs()).length === before, `undo after Close others restores every tab: ${(await tabs()).length}`);
  await page.click('#fe-tabs .fe-tab:nth-child(2)', { button: 'right' });
  await page.click('.fe-tab-menu [data-act="others"]');
  await sleep(300);
  await page.keyboard.press('Escape');
  await page.keyboard.press('g'); await page.keyboard.press('4');
  await sleep(500);
  const hist = await page.$$eval('#fe-rc-sets .fe-rc-tab', b => ({ n: b.length, sec: !document.getElementById('fe-rc-tabs-sec').hidden, first: b[0]?.textContent ?? '' }));
  check(hist.sec && hist.n >= 2, `History has a Closed tabs section listing what closed: ${hist.n} rows, "${hist.first}"`);
  await shot(page, 'tabs-menus-history');
  if (hist.n) await page.click('#fe-rc-sets .fe-rc-tab');
  await sleep(900);
  const reopened = await page.$eval('#fe-tabs', s => s.querySelectorAll('.fe-tab').length).catch(() => 0);
  check(reopened === kept + 1, `a Closed tabs row brings its tab back: ${reopened} tabs`);

  // 21: the Tour lists Edit as e then e.
  await page.keyboard.press('?');
  await page.waitForSelector('#fe-help-modal .fe-km');
  await page.click('#fe-help-modal .fe-dlg-tab[data-tab="start"]');
  await sleep(200);
  const tour = await page.evaluate(() => {
    const card = [...document.querySelectorAll('#fe-help-modal .fe-dlg-pane[data-tab="start"] .fe-hc')].find(c => /^Edit/.test(c.textContent.trim()));
    return card ? [...card.querySelectorAll('kbd')].map(k => k.textContent) : null;
  });
  check(JSON.stringify(tour) === '["e","e"]', `the Tour's Edit card shows e then e: ${JSON.stringify(tour)}`);
  await page.keyboard.press('Escape');
  await sleep(200);
} finally { await h.close(); }

// A second, calmer run for the row menu, the badges and the palette.
const h2 = await launch();
try {
  const page = await h2.open(dir);
  await applyTheme(page);
  const toastText = () => page.$eval('#fe-toast', t => t.classList.contains('show') ? t.textContent : '');

  // 25 (row menu): Keep as tab, Ask and Copy contents.
  await page.click('tr[data-idx="2"]', { button: 'right' });
  await page.waitForSelector('#fe-ctx .fe-ctx-item');
  const items = await page.$$eval('#fe-ctx .fe-ctx-item', r => r.map(x => x.textContent.trim()));
  check(['Keep as tab', 'Ask', 'Copy contents'].every(w => items.some(i => i.startsWith(w))), `the row menu has Keep as tab, Ask and Copy contents: ${items.join(' | ')}`);
  await shot(page, 'tabs-menus-row-menu');
  const tabsBefore = await page.$$eval('#fe-tabs .fe-tab', t => t.length);
  if (await appears(page, '#fe-ctx [data-act="keep"]')) await page.click('#fe-ctx [data-act="keep"]');
  await sleep(250);
  const tabsAfter = await page.$$eval('#fe-tabs .fe-tab', t => t.length);
  check(tabsAfter === tabsBefore + 1, `Keep as tab keeps the row as a tab: ${tabsBefore} to ${tabsAfter}`);
  await page.keyboard.press('Escape');
  await page.click('tr[data-idx="2"]', { button: 'right' });
  if (await appears(page, '#fe-ctx [data-act="cp-text"]')) await page.click('#fe-ctx [data-act="cp-text"]');
  await page.waitForFunction(() => /Cop(ied|y failed)/.test(document.getElementById('fe-toast').textContent), { timeout: 3000 }).catch(() => null);
  check(/^Copied the contents of /.test(await toastText()), `Copy contents reports what it copied: "${await toastText()}"`);
  await page.click('tr[data-idx="2"]', { button: 'right' });
  if (await appears(page, '#fe-ctx [data-act="ask"]')) await page.click('#fe-ctx [data-act="ask"]');
  await page.waitForFunction(() => document.getElementById('fe-qlook')?.style.display === 'flex', { timeout: 3000 }).catch(() => null);
  check(await page.$eval('#fe-qlook', q => q.style.display === 'flex'), 'Ask opens the preview of that file');
  await page.keyboard.press('Escape'); await sleep(200);

  await page.keyboard.press('Escape');
  await sleep(200);

  // 26: hold ⌥ and no two badges cover each other; Sort has one.
  await page.keyboard.down('Alt');
  await sleep(800);
  const badges = await page.$$eval('.fe-hints > kbd', ks => ks.map(k => { const r = k.getBoundingClientRect(); return { t: k.textContent, l: r.left, r: r.right, tp: r.top, b: r.bottom }; }));
  const clash = [];
  badges.forEach((a, i) => badges.slice(i + 1).forEach(b => { if (a.l < b.r && b.l < a.r && a.tp < b.b && b.tp < a.b) clash.push(`${a.t}/${b.t}`); }));
  check(badges.length > 8 && clash.length === 0, `${badges.length} key badges, none covering another${clash.length ? ': ' + clash.join(' ') : ''}`);
  const sortAt = await page.evaluate(() => { const s = document.getElementById('fe-sg-btn').getBoundingClientRect(); return [...document.querySelectorAll('.fe-hints > kbd')].some(k => { const r = k.getBoundingClientRect(); return k.textContent === 's' && r.left < s.right && r.right > s.left; }); });
  check(sortAt, 'Sort has a badge');
  await shot(page, 'tabs-menus-badges');
  await page.keyboard.up('Alt');
  await sleep(200);

  // 31: the palette ranks word starts and keeps its chips in view.
  const open = async () => { await page.keyboard.down('Meta'); await page.keyboard.press('k'); await page.keyboard.up('Meta'); await page.waitForSelector('.fe-pal input'); await sleep(150); };
  await open();
  await page.keyboard.type('sett');
  await sleep(150);
  const titles = await page.$$eval('.fe-pal-i .fe-pal-t', r => r.map(x => x.textContent));
  check(titles[0] === 'Settings' && !titles.includes('Copy selected paths'), `"sett" finds Settings and not scattered letters: ${titles.join(' | ')}`);
  await page.keyboard.press('Escape');
  for (const w of [1400, 520]) {
    await page.setViewport({ width: w, height: 900 });
    await open();
    await page.keyboard.type('e');
    await sleep(150);
    const chips = await page.$eval('.fe-pal-tabs', el => { const box = el.getBoundingClientRect(); return { clipped: el.scrollWidth > el.clientWidth, out: [...el.children].filter(c => { const r = c.getBoundingClientRect(); return r.right > box.right + 1 || r.left < box.left - 1; }).map(c => c.textContent) }; });
    check(!chips.clipped && chips.out.length === 0, `at ${w}px every palette chip is in view${chips.out.length ? ': out ' + chips.out.join(',') : ''}`);
    if (w === 520) await shot(page, 'tabs-menus-palette-narrow');
    await page.keyboard.press('Escape');
    await sleep(150);
  }
} finally { await h2.close(); rmSync(dir, { recursive: true, force: true }); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
