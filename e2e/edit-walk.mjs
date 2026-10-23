// Editing a text file in place: a folder not yet allowed asks once in a
// popover, the reading column becomes coloured numbered source, the text saves
// itself after a pause, a preview toggle shows the render, a change on disk
// while edited raises the banner instead of overwriting, and Done goes back
// to reading.
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, utimesSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const typeAtEnd = async (page, text) => {
  await page.focus('#fe-fe-ta');
  await page.keyboard.down('Meta'); await page.keyboard.press('ArrowDown'); await page.keyboard.up('Meta');
  await page.keyboard.type(text);
};
try {
  const md = join(h.fixture, 'edit-me.md');
  const txt = join(h.fixture, 'plain.txt');
  writeFileSync(md, '# Title\n\nfirst\n');
  writeFileSync(txt, 'a: 1\n');
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  let dialogs = 0;
  page.on('dialog', d => { dialogs++; void d.accept(); });

  // Not allowed yet: Edit asks next to the button; Cancel leaves the page alone.
  await page.goto('file://' + md, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-edit');
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-allow', { timeout: 3000 }).catch(() => null);
  const pop = await page.evaluate(() => {
    const p = document.getElementById('fe-allow'), b = document.getElementById('fe-fp-edit');
    if (!p) return null;
    const r = p.getBoundingClientRect(), br = b.getBoundingClientRect();
    return { text: p.textContent.replace(/\s+/g, ' ').trim(), below: r.top >= br.bottom, inView: r.left >= 0 && r.right <= innerWidth };
  });
  check(!!pop && /Allow editing here/.test(pop.text) && /14 days/.test(pop.text) && pop.below && pop.inView, `outside an allowed folder, Edit asks in a popover: ${JSON.stringify(pop)}`);
  await page.screenshot({ path: join(SHOTS, 'edit-allow.png') });
  await page.click('#fe-allow [data-a="cancel"]');
  check(!(await page.$('#fe-allow')) && await page.$eval('#fe-fe', el => el.style.display === 'none'), 'Cancel closes it and stays reading');

  // Allow folder: remembered in Settings, and the editor opens straight away.
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-allow [data-a="folder"]');
  await page.click('#fe-allow [data-a="folder"]');
  await page.waitForSelector('#fe-fe-ta', { timeout: 5000 });
  const allowed = (await h.store.json('bfb-settings-v1', {})).editableFolders ?? [];
  check(allowed.includes(h.fixture), `Allow folder saves the folder and opens the editor: ${JSON.stringify(allowed)}`);

  // The page's own settings copy predates the grant; saving it (the sidebar
  // toggle does) must keep the grant, and after a reload Edit just opens.
  await page.click('#fe-side-toggle');
  await page.click('#fe-side-toggle');
  const kept = (await h.store.json('bfb-settings-v1', {})).editableFolders ?? [];
  check(kept.includes(h.fixture), `a later settings save keeps the grant: ${JSON.stringify(kept)}`);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-edit');
  await page.click('#fe-fp-edit');
  const reopened = await Promise.race([
    page.waitForSelector('#fe-fe-ta', { timeout: 5000 }).then(() => 'editor'),
    page.waitForSelector('#fe-allow', { timeout: 5000 }).then(() => 'asked'),
  ]).catch(() => 'nothing');
  check(reopened === 'editor', `after a reload Edit opens without asking again: ${reopened}`);

  const src = await page.evaluate(() => ({
    lines: [...document.querySelectorAll('#fe-fe-paint .fe-fe-ln')].map(e => e.textContent),
    tokens: document.querySelectorAll('#fe-fe-paint span[class^="tok-"]').length,
    toc: document.getElementById('fe-toc-rail').hidden ? 'none' : 'shown',
    pill: !!document.querySelector('#fe-fe-pill [data-act="done"]'),
    oldBar: !!document.getElementById('fe-fe-bar'),
  }));
  check(src.lines.join() === '1,2,3,4' && src.tokens > 0 && src.toc === 'none' && src.pill && !src.oldBar, `source is coloured and numbered, Contents hides, one pill: ${JSON.stringify(src)}`);

  await typeAtEnd(page, 'second line\n');
  const edited = await page.$eval('#fe-fe-state', el => ({ cls: el.className, text: el.textContent }));
  check(edited.cls === 'dirty' && /Edited/.test(edited.text), `typing shows Edited: ${JSON.stringify(edited)}`);
  await page.waitForFunction(() => document.getElementById('fe-fe-state').className === 'saved', { timeout: 5000 }).catch(() => null);
  check(readFileSync(md, 'utf8').endsWith('second line\n'), `it saves itself after a pause: ${JSON.stringify(readFileSync(md, 'utf8'))}`);

  // One ⌘Z takes back one step, not two.
  await typeAtEnd(page, 'aaa');
  await new Promise(r => setTimeout(r, 800));
  await typeAtEnd(page, 'bbb');
  await new Promise(r => setTimeout(r, 800));
  await page.keyboard.down('Meta'); await page.keyboard.press('z'); await page.keyboard.up('Meta');
  const undone = await page.$eval('#fe-fe-ta', el => el.value);
  check(undone.endsWith('second line\naaa'), `one ⌘Z takes back only the last step: ${JSON.stringify(undone.slice(-16))}`);
  await page.keyboard.down('Meta'); await page.keyboard.press('z'); await page.keyboard.up('Meta');
  await page.keyboard.down('Meta'); await page.keyboard.press('s'); await page.keyboard.up('Meta');
  await page.waitForFunction(() => document.getElementById('fe-fe-state').className === 'saved', { timeout: 5000 }).catch(() => null);

  // The caret sits over its own text: the painted row for line 4 lines up with the textarea's line 4.
  const aligned = await page.evaluate(() => {
    const row = document.querySelectorAll('#fe-fe-paint .fe-fe-row')[3].getBoundingClientRect();
    const ta = document.getElementById('fe-fe-ta').getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(document.getElementById('fe-fe-ta')).lineHeight);
    return Math.abs(row.top - (ta.top + 3 * lh));
  });
  check(aligned < 1, `painted rows line up with the typed text (off by ${aligned.toFixed(2)}px)`);

  // Mouse: a click on line 1 marks that line; a click on the blank space
  // below the text puts the caret at the end; a double-click selects a word.
  await page.evaluate(() => document.activeElement.blur());
  const at = await page.evaluate(() => {
    const r = document.querySelectorAll('#fe-fe-paint .fe-fe-code')[0].getBoundingClientRect();
    const col = document.getElementById('fe-fe-scroll').getBoundingClientRect();
    return { x: r.left + 30, y: r.top + r.height / 2, belowY: col.bottom - 40, sideX: col.right - 10 };
  });
  await page.mouse.click(at.x, at.y);
  const cur1 = await page.evaluate(() => ({ focus: document.activeElement.id, cur: [...document.querySelectorAll('#fe-fe-paint .fe-fe-row')].findIndex(r => r.classList.contains('cur')) }));
  check(cur1.focus === 'fe-fe-ta' && cur1.cur === 0, `a click in the text focuses it and marks its line: ${JSON.stringify(cur1)}`);
  await page.mouse.click(at.x, at.belowY);
  const end = await page.evaluate(() => { const t = document.getElementById('fe-fe-ta'); return { focus: document.activeElement.id, atEnd: t.selectionStart === t.value.length, cur: [...document.querySelectorAll('#fe-fe-paint .fe-fe-row')].findIndex(r => r.classList.contains('cur')), rows: document.querySelectorAll('#fe-fe-paint .fe-fe-row').length }; });
  check(end.focus === 'fe-fe-ta' && end.atEnd && end.cur === end.rows - 1, `a click below the text puts the caret at the end: ${JSON.stringify(end)}`);
  await page.mouse.click(at.sideX, at.y);
  const side = await page.evaluate(() => { const t = document.getElementById('fe-fe-ta'); return { pos: t.selectionStart, lineEnd: t.value.indexOf('\n') }; });
  check(side.pos === side.lineEnd, `a click beside a line puts the caret at that line's end: ${JSON.stringify(side)}`);
  await page.mouse.click(at.x + 20, at.y, { count: 2 });
  const word = await page.evaluate(() => { const t = document.getElementById('fe-fe-ta'); return t.value.slice(t.selectionStart, t.selectionEnd); });
  check(word === 'Title', `a double-click selects the word: ${JSON.stringify(word)}`);
  await page.screenshot({ path: join(SHOTS, 'edit-select-dark.png'), clip: { x: 0, y: 0, width: 1400, height: 360 } });
  await page.screenshot({ path: join(SHOTS, 'edit-md-dark.png') });

  // Raw, Split and Rich: Rich shows the rendered page alone, Split shows both
  // side by side, and the reading width narrows Raw and Rich.
  await page.click('#fe-fe-pill [data-mode="rich"]');
  const preview = await page.evaluate(() => ({ view: !document.getElementById('fe-fe-view').hidden, text: document.getElementById('fe-fe-view').textContent, src: document.getElementById('fe-fe-src').hidden }));
  check(preview.view && preview.src && /second line/.test(preview.text), `Rich shows the rendered page alone: ${JSON.stringify(preview)}`);
  await page.click('#fe-fe-pill [data-mode="split"]');
  const split = await page.evaluate(() => { const s = document.getElementById('fe-fe-src').getBoundingClientRect(), v = document.getElementById('fe-fe-view').getBoundingClientRect(); return { both: s.width > 100 && v.width > 100, sideBySide: Math.abs(s.top - v.top) < 2 && v.left >= s.right - 1 }; });
  check(split.both && split.sideBySide, `Split shows text and rendered view side by side: ${JSON.stringify(split)}`);
  const splitAlign = await page.evaluate(() => {
    const row = document.querySelectorAll('#fe-fe-paint .fe-fe-row')[2].getBoundingClientRect();
    const ta = document.getElementById('fe-fe-ta').getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(document.getElementById('fe-fe-ta')).lineHeight);
    return { off: Math.abs(row.top - (ta.top + 2 * lh)), diagShown: getComputedStyle(document.getElementById('fe-fe-diag')).display !== 'none' };
  });
  check(splitAlign.off < 1 && !splitAlign.diagShown, `in Split the typed text sits on its painted row and no empty problem count shows: ${JSON.stringify(splitAlign)}`);
  const splitWide = await page.evaluate(() => { const ta = document.getElementById("fe-fe-ta"), cs = getComputedStyle(ta), cell = document.querySelector("#fe-fe-paint .fe-fe-row > :last-child"); return { ta: Math.round(ta.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)), cell: Math.round(cell.getBoundingClientRect().width) }; });
  check(splitWide.ta === splitWide.cell, `in Split the typing box is as wide as the painted text, so both wrap alike: ${JSON.stringify(splitWide)}`);
  await page.screenshot({ path: join(SHOTS, 'edit-split-dark.png') });
  await page.click('#fe-fe-pill [data-mode="raw"]');
  const fullW = await page.$eval('#fe-fe-col', el => el.getBoundingClientRect().width);
  for (let i = 0; i < 4 && !(await page.$eval('#fe-fp-column', b => /MD/.test(b.textContent))); i++) await page.click('#fe-fp-column');
  const mdW = await page.$eval('#fe-fe-col', el => el.getBoundingClientRect().width);
  check(mdW < fullW - 100, `the reading width narrows the editor too: ${Math.round(fullW)} → ${Math.round(mdW)}px`);
  for (let i = 0; i < 4 && !(await page.$eval('#fe-fp-column', b => /Full/.test(b.textContent))); i++) await page.click('#fe-fp-column');

  // A change on disk while edited raises the banner and keeps the disk copy.
  await typeAtEnd(page, 'mine\n');
  writeFileSync(md, '# Title\n\n## Section\n\nchanged elsewhere\n');
  const later = new Date(Date.now() + 5000); utimesSync(md, later, later);
  await page.waitForFunction(() => document.getElementById('fe-fe-banner').style.display !== 'none', { timeout: 6000 }).catch(() => null);
  check(await page.$eval('#fe-fe-banner', el => el.style.display !== 'none') && readFileSync(md, 'utf8').includes('changed elsewhere'), 'an on-disk change while edited shows the banner, file untouched');
  await page.click('#fe-fe-banner [data-act="reload"]');
  await page.waitForFunction(() => document.getElementById('fe-fe-ta').value.includes('changed elsewhere'), { timeout: 5000 }).catch(() => null);
  check(await page.$eval('#fe-fe-ta', el => el.value.includes('changed elsewhere')), 'Load from disk replaces the editor text');
  await page.click('#fe-fe-pill [data-act="done"]');
  await page.waitForFunction(() => document.getElementById('fe-page').style.display !== 'none', { timeout: 3000 }).catch(() => null);
  const back = await page.$eval('#fe-page', el => el.style.display !== 'none' && el.textContent.includes('changed elsewhere'));
  const tocBack = await page.$eval('#fe-toc-rail', el => !el.hidden && el.querySelectorAll('#fe-toc a').length === 2);
  check(back && tocBack && dialogs === 0, `Done returns to reading with Contents back, no prompt (${dialogs})`);

  // A non-markdown file edits as source alone, with no preview toggle.
  await page.goto('file://' + txt, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-edit');
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-fe-ta');
  check(!(await page.$('#fe-fe-view')) && !(await page.$('#fe-fe-pill [data-mode]')), 'a .txt file edits as source alone');

  // A file the host will not edit (read-only here) says why beside the Edit button.
  const locked = join(h.fixture, 'locked.txt');
  writeFileSync(locked, 'hands off\n');
  chmodSync(locked, 0o444);
  await page.goto('file://' + locked, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-edit');
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-allow.fe-allow-note', { timeout: 5000 }).catch(() => null);
  const refused = await page.$eval('#fe-allow.fe-allow-note', el => el.textContent).catch(() => '');
  check(/Cannot edit this file/.test(refused) && /read-only/.test(refused), `a read-only file says why it cannot be edited: "${refused}"`);
  chmodSync(locked, 0o644);

  // A .yaml file, which Chrome downloads, opens in its folder's view: coloured and editable.
  const yaml = join(h.fixture, 'conf.yaml');
  writeFileSync(yaml, 'name: demo\nsteps:\n  - run: make\n');
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody');
  const row = await page.$('#fe-tbody tr[data-idx]:has(a[href$="conf.yaml"]) td.c-nm');
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }).catch(() => null), row.click({ count: 2 })]);
  await page.waitForSelector('#fe-page .fe-jt-key', { timeout: 5000 }).catch(() => null);
  const yv = { url: page.url(), keys: await page.$$eval('#fe-page .fe-jt-key', s => s.map(x => x.textContent)), crumb: await page.title() };
  check(yv.url.endsWith('/#view=conf.yaml') && yv.keys.includes('name') && /conf\.yaml/.test(yv.crumb), `a .yaml opens in its folder view as a tree: ${JSON.stringify(yv)}`);
  await page.keyboard.press('e'); await page.keyboard.press('e');
  await page.waitForSelector('#fe-fe-ta');
  await typeAtEnd(page, 'done: true\n');
  await page.keyboard.down('Meta'); await page.keyboard.press('s'); await page.keyboard.up('Meta');
  await page.waitForFunction(() => document.getElementById('fe-fe-state').className === 'saved', { timeout: 5000 }).catch(() => null);
  check(readFileSync(yaml, 'utf8').endsWith('done: true\n'), 'the .yaml saves from its view');
  // A duplicate key marks its row and the pill counts it; the fix clears both.
  await typeAtEnd(page, 'name: again\n');
  await page.waitForFunction(() => !document.getElementById('fe-fe-diag').hidden, { timeout: 3000 }).catch(() => null);
  const bad = await page.evaluate(() => ({ pill: document.getElementById('fe-fe-diag').textContent, rows: [...document.querySelectorAll('#fe-fe-paint .fe-fe-row')].map((r, i) => r.classList.contains('err') ? i + 1 : 0).filter(Boolean) }));
  check(/1 error/.test(bad.pill) && bad.rows.includes(5), `a duplicate key marks line 5 and the pill counts it: ${JSON.stringify(bad)}`);
  await page.screenshot({ path: join(SHOTS, 'edit-yaml-problem-dark.png') });
  await page.click('#fe-fe-pill [data-mode="rich"]');
  const tree = await page.$$eval('#fe-fe-view .fe-jt-key', s => s.map(x => x.textContent));
  check(tree.includes('steps') && tree.includes('done'), `YAML Rich still draws the tree with the mistake in it: ${JSON.stringify(tree)}`);
  await page.click('#fe-fe-pill [data-mode="raw"]');
  await page.evaluate(() => { const t = document.getElementById('fe-fe-ta'); t.value = t.value.replace('name: again\n', ''); t.dispatchEvent(new Event('input')); });
  await page.waitForFunction(() => document.getElementById('fe-fe-diag').hidden, { timeout: 3000 }).catch(() => null);
  check(await page.$eval('#fe-fe-diag', el => el.hidden) && !(await page.$('#fe-fe-paint .fe-fe-row.err')), 'removing the duplicate clears the mark and the count');

  // When the column narrows without typing, the text re-wraps; the textarea
  // must grow with it and never scroll inside itself, or the caret leaves its words.
  const wrapMd = join(h.fixture, 'wrap-me.md');
  writeFileSync(wrapMd, Array.from({ length: 12 }, (_, i) => `Line ${i} ` + 'words that wrap once the column gets narrow enough to need it. '.repeat(3)).join('\n') + '\n');
  await page.setViewport({ width: 1400, height: 700 });
  await page.goto('file://' + wrapMd, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-edit');
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-fe-ta', { timeout: 5000 });
  await page.setViewport({ width: 760, height: 700 });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => { const ta = document.getElementById('fe-fe-ta'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); });
  await page.keyboard.press('ArrowLeft');
  await new Promise(r => setTimeout(r, 150));
  const wrapped = await page.evaluate(() => {
    const ta = document.getElementById('fe-fe-ta'), paint = document.getElementById('fe-fe-paint');
    const last = [...paint.querySelectorAll('.fe-fe-row')].at(-2).getBoundingClientRect();
    return { taH: ta.clientHeight, paintH: Math.round(paint.getBoundingClientRect().height), scrollTop: ta.scrollTop, lastRowBottom: Math.round(last.bottom - ta.getBoundingClientRect().top) };
  });
  check(wrapped.taH === wrapped.paintH && wrapped.scrollTop === 0, `after the column narrows the textarea grows with the text and does not scroll inside itself: ${JSON.stringify(wrapped)}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'edit walk passes');
