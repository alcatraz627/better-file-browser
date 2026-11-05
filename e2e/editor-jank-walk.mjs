// The editor's feel, measured while typing rather than after: Split holds still on
// a doc with diagrams, draws after a pause and not on every key, Edit never shows a
// blank frame, nothing asks twice, and keys meant for an input method stay with it.
//
//   node e2e/editor-jank-walk.mjs
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture] }));
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const dialogs = [];
  page.on('dialog', d => { dialogs.push(`${d.type()}: ${d.message()}`); d.accept(); });

  const blocks = [];
  for (let i = 0; i < 40; i++) {
    blocks.push(`## Part ${i}`, '', `Words of part ${i}.`, '');
    if (i % 8 === 0) blocks.push('```mermaid', `graph TD; A${i}-->B${i};`, '```', '');
  }
  const doc = join(h.fixture, 'diagrams.md');
  writeFileSync(doc, blocks.join('\n') + '\n');

  const openEdit = async file => {
    await page.goto('file://' + file, { waitUntil: 'load' });
    await page.waitForSelector('.fe-md');
    await wait(400);
    await page.click('#fe-fp-edit');
    await page.waitForSelector('#fe-fe-ta');
    await wait(400);
  };

  // Edit never paints a blank page: something readable is on screen in every frame.
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('.fe-md');
  await wait(400);
  await page.evaluate(() => {
    window.__blank = 0; window.__frames = 0;
    const seen = s => { const e = document.querySelector(s); return !!e?.checkVisibility() && e.getBoundingClientRect().height > 40 && (e.textContent || e.value || '').trim().length > 0; };
    const tick = () => { window.__frames++; if (!seen('.fe-md') && !seen('#fe-fe-paint')) window.__blank++; if (window.__frames < 40) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-fe-ta');
  await wait(900);
  const blank = await page.evaluate(() => ({ blank: window.__blank, frames: window.__frames }));
  check(blank.blank === 0, `Edit shows no blank frame: ${JSON.stringify(blank)}`);

  // Split: the rendered side holds still while typing, and diagrams survive.
  await page.click('[data-mode="split"]');
  await wait(1500);
  const svgs = await page.$$eval('#fe-fe-view svg', s => s.length);
  check(svgs > 0, `diagrams draw in Split: ${svgs}`);
  // The caret goes mid-document with its line in view, as when really editing there.
  await page.evaluate(() => {
    const ta = document.getElementById('fe-fe-ta');
    const at = ta.value.indexOf('Words of part 20.');
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(at, at);
    const line = ta.value.slice(0, at).split('\n').length - 1;
    document.getElementById('fe-fe-paint').children[line]?.scrollIntoView({ block: 'center' });
  });
  await wait(300);
  await page.evaluate(() => {
    const v = document.getElementById('fe-fe-view');
    window.__kept = [...v.querySelectorAll('.fe-md-mermaid')].at(-1);
    window.__keptAbove = [...v.querySelectorAll('.fe-md-mermaid')][0];
    window.__tops = [];
    window.__drew = 0;
    // Blocks sit inside the rendered wrapper, so that is where a draw shows.
    new MutationObserver(() => window.__drew++).observe(v.querySelector(':scope > .fe-md') ?? v, { childList: true });
    const sample = () => { window.__tops.push(Math.round(v.scrollTop)); window.__wait ||= /Rendering diagram/.test(v.innerText); if (window.__tops.length < 200) requestAnimationFrame(sample); };
    requestAnimationFrame(sample);
  });
  await wait(150);
  const drewBefore = await page.evaluate(() => window.__drew);
  await page.keyboard.type('typed quickly without a pause', { delay: 25 });
  const drewDuring = await page.evaluate(() => window.__drew) - drewBefore;
  await wait(700);
  const split = await page.evaluate(() => {
    const tops = window.__tops.slice(10);
    const jumps = tops.filter((t, i) => i && Math.abs(t - tops[i - 1]) > 40).length;
    return { jumps, top: tops[0], kept: !!window.__kept?.isConnected && !!window.__keptAbove?.isConnected, placeholder: window.__wait, updated: document.getElementById('fe-fe-view').innerText.includes('typed quickly') };
  });
  check(split.jumps === 0 && !split.placeholder, `typing in Split leaves the rendered side where it was: ${JSON.stringify(split)}`);
  check(split.kept, 'diagrams above and below the edit are the same elements after typing');
  const slBefore = await page.evaluate(() => window.__kept.getAttribute('data-sl'));
  await page.keyboard.press('Enter');
  await wait(700);
  const shifted = await page.evaluate(() => ({ kept: window.__kept.isConnected, sl: window.__kept.getAttribute('data-sl') }));
  const firstLine = s => Number(String(s).split('-')[0]);
  check(shifted.kept && firstLine(shifted.sl) === firstLine(slBefore) + 1, `a new line above keeps the diagram and moves its line number: ${slBefore} to ${shifted.sl}`);
  check(drewDuring === 0 && split.updated, `Split draws after a pause, not on each key: ${drewDuring} draws while typing, updated=${split.updated}`);

  // Keys held by an input method do not act as editor commands.
  await page.click('[data-mode="raw"]');
  await wait(200);
  await page.evaluate(() => {
    const ta = document.getElementById('fe-fe-ta');
    ta.focus();
    ta.setRangeText('- item', ta.value.length, ta.value.length, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    window.__ime = ta.value;
    for (const key of ['Enter', 'Escape']) ta.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, isComposing: true }));
  });
  await wait(300);
  const ime = await page.evaluate(() => ({ open: !!document.getElementById('fe-fe-ta'), same: document.getElementById('fe-fe-ta')?.value === window.__ime }));
  check(ime.open && ime.same, `Enter and Esc during composition do nothing to the editor: ${JSON.stringify(ime)}`);

  // PageDown brings the caret along.
  const caretLine = () => page.$eval('#fe-fe-ta', t => t.value.slice(0, t.selectionStart).split('\n').length);
  await page.evaluate(() => { const t = document.getElementById('fe-fe-ta'); t.focus(); t.setSelectionRange(0, 0); document.getElementById('fe-fe-scroll').scrollTop = 0; });
  const l0 = await caretLine();
  await page.keyboard.press('PageDown');
  await wait(150);
  const l1 = await caretLine();
  check(l1 > l0 + 5, `PageDown moves the caret with the view: ${l0} to ${l1}`);

  // ⌘S in Rich stays ours, wherever focus is.
  await page.click('[data-mode="rich"]');
  await wait(300);
  await page.evaluate(() => { window.__sKey = null; window.addEventListener('keydown', e => { if (e.key === 's') window.__sKey = e; }, true); });
  await page.keyboard.down('Meta'); await page.keyboard.press('s'); await page.keyboard.up('Meta');
  await wait(150);
  const sKey = await page.evaluate(() => ({ seen: !!window.__sKey, handled: window.__sKey?.defaultPrevented, focus: document.activeElement?.tagName }));
  check(sKey.seen && sKey.handled, `⌘S in Rich is handled, so Chrome does not offer to save the page: ${JSON.stringify(sKey)}`);
  await page.click('[data-mode="raw"]');
  await wait(1200);

  // Around the caret: Wrap works while editing, the pill holds still and clears the caret's words.
  const longDoc = join(h.fixture, 'long-lines.md');
  writeFileSync(longDoc, Array.from({ length: 80 }, (_, i) => `Line ${i} ${'wide words go on and on '.repeat(i < 3 ? 14 : 1)}`).join('\n') + '\n');
  await openEdit(longDoc);
  const wrapInfo = () => page.evaluate(() => {
    const s = document.getElementById('fe-fe-scroll'), rows = document.getElementById('fe-fe-paint').children;
    return { over: s.scrollWidth > s.clientWidth + 20, firstRow: Math.round(rows[0].getBoundingClientRect().height), wrap: document.getElementById('fe').dataset.wrap };
  });
  const wrapOn = await wrapInfo();
  await page.evaluate(() => document.getElementById('fe-fp-wrap')?.click());
  await wait(300);
  const wrapOff = await wrapInfo();
  const lined = await page.evaluate(() => {
    const ta = document.getElementById('fe-fe-ta'), p = document.getElementById('fe-fe-paint');
    return { ta: Math.round(ta.getBoundingClientRect().height), paint: Math.round(p.getBoundingClientRect().height) };
  });
  check(wrapOn.wrap !== wrapOff.wrap && wrapOff.over && wrapOff.firstRow < wrapOn.firstRow && Math.abs(lined.ta - lined.paint) < 3, `Wrap changes the text while editing and the caret layer follows: ${JSON.stringify({ wrapOn, wrapOff, lined })}`);
  await page.evaluate(() => document.getElementById('fe-fp-wrap')?.click());
  await wait(200);

  await page.evaluate(() => { const t = document.getElementById('fe-fe-ta'); t.focus(); t.setSelectionRange(0, 0); document.getElementById('fe-fe-scroll').scrollTop = 0; });
  await wait(200);
  const pillState = () => page.$eval('#fe-fe-pill', p => ({ left: Math.round(p.getBoundingClientRect().left), opacity: Number(getComputedStyle(p).opacity), under: p.classList.contains('under') }));
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => {
    const s = document.getElementById('fe-fe-scroll'), row = document.querySelector('#fe-fe-paint .fe-fe-row.cur'), p = document.getElementById('fe-fe-pill').getBoundingClientRect();
    s.scrollTop += row.getBoundingClientRect().top - p.top;
  });
  await wait(400);
  const overWords = await pillState();
  check(overWords.under && overWords.opacity < 0.5, `the pill fades when the caret's words are under it: ${JSON.stringify(overWords)}`);
  await page.evaluate(() => { const t = document.getElementById('fe-fe-ta'); const at = t.value.indexOf('Line 40'); t.setSelectionRange(at, at); document.getElementById('fe-fe-paint').children[40].scrollIntoView({ block: 'center' }); });
  await wait(400);
  const clearOfWords = await pillState();
  check(!clearOfWords.under && clearOfWords.opacity === 1, `the pill stays solid when the caret's words are clear of it: ${JSON.stringify(clearOfWords)}`);
  writeFileSync(h.writeStall, '0.6');
  const lefts = new Set([clearOfWords.left]);
  await page.keyboard.type('x');
  await wait(100);
  lefts.add((await pillState()).left);
  await wait(900);
  lefts.add((await pillState()).left);
  await wait(1100);
  lefts.add((await pillState()).left);
  rmSync(h.writeStall);
  check(lefts.size === 1, `the pill holds still through Edited, Saving and Saved: ${JSON.stringify([...lefts])}`);

  // The conflict banner does not move the line being typed, and typing at the end keeps the caret in view.
  const lineY = () => page.evaluate(() => { const r = document.querySelector('#fe-fe-paint .fe-fe-row.cur'); return Math.round(r.getBoundingClientRect().top); });
  const y0 = await lineY();
  writeFileSync(longDoc, 'changed elsewhere\n');
  await page.keyboard.type('y');
  await page.waitForFunction(() => /Changed on disk/.test(document.getElementById('fe-fe-banner')?.textContent ?? ''), { timeout: 9000 });
  check(await lineY() === y0, 'the conflict banner leaves the typed line where it is');
  await page.click('#fe-fe-banner [data-act="overwrite"]');
  await wait(800);
  await page.evaluate(() => { const t = document.getElementById('fe-fe-ta'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); document.getElementById('fe-fe-scroll').scrollTop = 1e6; });
  await page.keyboard.press('Enter');
  await page.keyboard.type('at the end');
  await wait(200);
  const endGap = await page.evaluate(() => { const r = document.querySelector('#fe-fe-paint .fe-fe-row.cur').getBoundingClientRect(), s = document.getElementById('fe-fe-scroll').getBoundingClientRect(); return Math.round(s.bottom - r.bottom); });
  check(endGap >= 0, `typing at the end keeps the caret's line fully in view: ${endGap}px below it`);
  await page.click('[data-act="done"]');
  await wait(1200);
  await openEdit(doc);

  // Asked once, in the app's own box, and not again on the way out.
  dialogs.length = 0;
  await page.focus('#fe-fe-ta');
  await page.keyboard.type('MINE');
  writeFileSync(doc, blocks.join('\n') + '\nfrom elsewhere\n');
  await page.waitForFunction(() => /Changed on disk/.test(document.getElementById('fe-fe-banner')?.textContent ?? ''), { timeout: 9000 });
  await page.focus('#fe-fe-ta');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.fe-yesno-box', { timeout: 3000 });
  await page.click('.fe-yesno-box [data-a="yes"]');
  await wait(400);
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  check(dialogs.length === 0, `leaving a conflict asks once, never in a browser box: ${JSON.stringify(dialogs)}`);

  // A new note takes its name from the finished title, not the first pause.
  const notesDir = join(h.fixture, 'notes');
  mkdirSync(notesDir);
  await h.store.edit('bfb-settings-v1', s => ({ ...s, notesRoot: notesDir }));
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr');
  await wait(500);
  await page.evaluate(() => document.body.click());
  await page.keyboard.press('n');
  await page.waitForSelector('#fe-ed-src', { timeout: 5000 });
  await wait(300);
  await page.keyboard.type('# Sho');
  await wait(2200);
  await page.keyboard.type('pping for the week');
  await wait(2400);
  const names = readdirSync(notesDir).filter(f => f.endsWith('.md'));
  check(names.length === 1 && /^shopping-for-the-week/.test(names[0]), `a new note's file follows its finished title: ${JSON.stringify(names)}`);

  // The peek's live render keeps a diagram the same way.
  await page.focus('#fe-ed-src');
  await page.keyboard.type('\n\n```mermaid\ngraph TD; P-->Q;\n```\n\nAfter it.');
  await page.waitForSelector('#fe-ed-view .fe-md-mermaid', { timeout: 5000 });
  await wait(900);
  await page.evaluate(() => { window.__peekKept = document.querySelector('#fe-ed-view .fe-md-mermaid'); });
  await page.keyboard.type(' More words.', { delay: 30 });
  await wait(500);
  const peek = await page.evaluate(() => ({ kept: !!window.__peekKept?.isConnected, words: document.getElementById('fe-ed-view').innerText.includes('More words') }));
  check(peek.kept && peek.words, `typing in the peek keeps a diagram it did not touch: ${JSON.stringify(peek)}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
