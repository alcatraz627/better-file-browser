// Editing a very large file: a 100,000-line file opens in the editor quickly,
// a key costs about what it costs in a small file, typing in the middle and at
// the end lands in the right place on disk, a click on a line far down puts
// the caret there, the painted rows stay under the typed text, and undo works.
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const LINES = Number(process.argv[2]) || 100_000;   // node e2e/big-edit-walk.mjs 300000 for a near-cap file
const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lineText = i => `const value${i} = compute(${i}, "row"); // note ${i}`;
try {
  const original = Array.from({ length: LINES }, (_, i) => lineText(i)).join('\n') + '\n';
  const file = join(h.fixture, 'huge.ts');
  writeFileSync(file, original);
  const tiny = join(h.fixture, 'tiny.ts');
  writeFileSync(tiny, 'x\n');
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  page.on('dialog', d => void d.accept());

  // Allow the fixture folder once, on a tiny file.
  await page.goto('file://' + tiny, { waitUntil: 'load' });
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-allow [data-a="folder"]');
  await page.click('#fe-allow [data-a="folder"]');
  await page.waitForSelector('#fe-fe-ta');

  await page.goto('file://' + file, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-edit');
  const t0 = Date.now();
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-fe-ta', { timeout: 60_000 });
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const openMs = Date.now() - t0;
  const shape = await page.evaluate(() => ({
    big: document.getElementById('fe-fe').classList.contains('fe-fe-big'),
    taLines: document.getElementById('fe-fe-ta').value.split('\n').length,
    rows: document.querySelectorAll('#fe-fe-paint .fe-fe-row').length,
  }));
  check(openMs < 5000 && shape.big && shape.taLines <= 3000 && shape.rows < 400,
    `${LINES.toLocaleString()} lines open in large mode in ${openMs}ms, the textarea holds ${shape.taLines} lines, ${shape.rows} rows painted`);

  // Cost of a key, through the editor's own input handling.
  const keyMs = await page.evaluate(async () => {
    const ta = document.getElementById('fe-fe-ta');
    ta.focus(); ta.setSelectionRange(5, 5);
    const ts = [];
    for (let i = 0; i < 7; i++) {
      const t = performance.now();
      ta.setRangeText('k', ta.selectionStart, ta.selectionStart, 'end');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      document.body.offsetHeight;
      await new Promise(r => requestAnimationFrame(r));
      ts.push(performance.now() - t);
    }
    for (let i = 0; i < 7; i++) { ta.setRangeText('', 5, 6, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
    return ts.sort((a, b) => a - b)[3];
  });
  check(keyMs < 80, `a key takes ${keyMs.toFixed(0)}ms (median of 7)`);

  // Scroll far down; the rows on screen are painted, and the textarea covers them.
  const target = Math.floor(LINES * 0.6);
  await page.evaluate(n => {
    const sc = document.getElementById('fe-fe-scroll');
    const lh = parseFloat(getComputedStyle(document.getElementById('fe-fe-ta')).lineHeight);
    sc.scrollTop = n * lh;
  }, target);
  await sleep(300);
  const mid = await page.evaluate(() => {
    const ta = document.getElementById('fe-fe-ta').getBoundingClientRect();
    const sc = document.getElementById('fe-fe-scroll').getBoundingClientRect();
    const vis = [...document.querySelectorAll('#fe-fe-paint .fe-fe-row')].filter(r => { const b = r.getBoundingClientRect(); return b.top > sc.top + 100 && b.bottom < sc.bottom - 100; });
    const row = vis[5];
    const code = row?.querySelector('.fe-fe-code').getBoundingClientRect();
    return { covered: ta.top <= sc.top && ta.bottom >= sc.bottom, n: row ? Number(row.querySelector('.fe-fe-ln').textContent) : 0, text: row?.textContent, x: code?.left + 60, y: code ? code.top + code.height / 2 : 0 };
  });
  check(mid.covered && mid.n > target - 100 && mid.n < target + 100, `scrolled to line ${mid.n}: the textarea covers the view`);
  await page.screenshot({ path: join(SHOTS, 'big-edit-middle.png') });

  // A click on that line puts the caret on it; typing lands in that line on disk.
  await page.mouse.click(mid.x, mid.y);
  await page.keyboard.type('MID');
  const cur = await page.evaluate(() => Number(document.querySelector('#fe-fe-paint .fe-fe-row.cur .fe-fe-ln')?.textContent));
  check(cur === mid.n, `the caret's line is marked: ${cur}`);
  // Painted row under the caret line lines up with the textarea's own line.
  const aligned = await page.evaluate(() => {
    const ta = document.getElementById('fe-fe-ta');
    const lh = parseFloat(getComputedStyle(ta).lineHeight);
    const row = document.querySelector('#fe-fe-paint .fe-fe-row.cur');
    const before = ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
    return Math.abs(row.getBoundingClientRect().top - (ta.getBoundingClientRect().top + before * lh));
  });
  check(aligned < 1, `the painted row sits under the typed line (off by ${aligned.toFixed(2)}px)`);

  // Jump to the end and type there (after a pause, so it is its own undo step).
  await sleep(800);
  await page.keyboard.down('Meta'); await page.keyboard.press('ArrowDown'); await page.keyboard.up('Meta');
  await page.keyboard.type('END');
  await sleep(200);
  const endAlign = await page.evaluate(() => {
    const ta = document.getElementById('fe-fe-ta');
    const lh = parseFloat(getComputedStyle(ta).lineHeight);
    const row = document.querySelector('#fe-fe-paint .fe-fe-row.cur');
    const before = ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
    return { off: Math.abs(row.getBoundingClientRect().top - (ta.getBoundingClientRect().top - ta.scrollTop + before * lh)), inner: ta.scrollTop };
  });
  const heights = await page.evaluate(() => {
    const ta = document.getElementById('fe-fe-ta');
    const row = document.querySelector('#fe-fe-paint .fe-fe-row');
    return { rowH: row.getBoundingClientRect().height, taLine: ta.scrollHeight / ta.value.split('\n').length };
  });
  check(heights.rowH === heights.taLine, `painted rows and textarea lines are the same height, so they never drift: ${JSON.stringify(heights)}`);
  check(endAlign.off < 1 && endAlign.inner === 0, `at the end the caret stays on its painted row: ${JSON.stringify(endAlign)}`);
  await page.screenshot({ path: join(SHOTS, 'big-edit-end.png') });
  await page.screenshot({ path: join(SHOTS, 'big-edit-end-zoom.png'), clip: { x: 300, y: 660, width: 400, height: 100, scale: 3 } });
  await page.keyboard.down('Meta'); await page.keyboard.press('s'); await page.keyboard.up('Meta');
  await page.waitForFunction(() => document.getElementById('fe-fe-state').className === 'saved', { timeout: 20_000 }).catch(() => null);
  const disk = readFileSync(file, 'utf8');
  const lines = disk.split('\n');
  const midLine = lines[mid.n - 1];
  check(disk.endsWith('\nEND') && lines.length === LINES + 1, `typing after ⌘↓ lands at the very end: ${JSON.stringify(disk.slice(-20))}`);
  check(midLine.includes('MID') && midLine.replace('MID', '') === lineText(mid.n - 1), `typing after the click lands in line ${mid.n}: ${JSON.stringify(midLine)}`);
  const others = lines.filter((l, i) => i !== mid.n - 1 && i < LINES).every((l, i) => l === lineText(i >= mid.n - 1 ? i + 1 : i));
  check(others, 'every other line is untouched');

  // Undo takes back the last typing, across the window.
  await sleep(700);
  await page.keyboard.down('Meta'); await page.keyboard.press('z'); await page.keyboard.up('Meta');
  await page.keyboard.down('Meta'); await page.keyboard.press('s'); await page.keyboard.up('Meta');
  await page.waitForFunction(() => document.getElementById('fe-fe-state').className === 'saved', { timeout: 20_000 }).catch(() => null);
  await sleep(300);
  const after = readFileSync(file, 'utf8');
  check(!after.includes('END') && after.includes('MID') && after.length === original.length + 3, `undo takes back the last typing and keeps the one before: ends ${JSON.stringify(after.slice(-12))}, MID kept ${after.includes('MID')}`);

  // A large markdown file in Split: the text side windows on its own scroll,
  // typing deep in it lands on the right line, and the rendered side catches up.
  const md = join(h.fixture, 'huge.md');
  const mdLines = Array.from({ length: 20_000 }, (_, i) => i % 50 === 0 ? `## Part ${i / 50}` : `Paragraph line ${i} with *some* text.`);
  writeFileSync(md, mdLines.join('\n') + '\n');
  await page.goto('file://' + md, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-edit');
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-fe-ta', { timeout: 60_000 });
  await page.click('#fe-fe-pill [data-mode="split"]');
  await sleep(1500);
  const split = await page.evaluate(() => {
    const s = document.getElementById('fe-fe-src').getBoundingClientRect(), v = document.getElementById('fe-fe-view').getBoundingClientRect();
    return { both: s.width > 100 && v.width > 100, h2s: document.querySelectorAll('#fe-fe-view h2').length };
  });
  check(split.both && split.h2s === 400, `Split shows text and the rendered page for a 20,000-line markdown file: ${JSON.stringify(split)}`);
  await page.evaluate(() => { const s = document.getElementById('fe-fe-src'); s.scrollTop = s.scrollHeight * 0.75; });
  await sleep(300);
  const deep = await page.evaluate(() => {
    const s = document.getElementById('fe-fe-src').getBoundingClientRect();
    const ta = document.getElementById('fe-fe-ta').getBoundingClientRect();
    const vis = [...document.querySelectorAll('#fe-fe-paint .fe-fe-row')].filter(r => { const b = r.getBoundingClientRect(); return b.top > s.top + 80 && b.bottom < s.bottom - 80; });
    const row = vis[3], code = row.querySelector('.fe-fe-code').getBoundingClientRect();
    return { covered: ta.top <= s.top && ta.bottom >= s.bottom, n: Number(row.querySelector('.fe-fe-ln').textContent), x: code.left + 30, y: code.top + code.height / 2 };
  });
  check(deep.covered && deep.n > 14_000, `deep in Split (line ${deep.n}) the textarea covers the text side`);
  await page.mouse.click(deep.x, deep.y);
  await page.keyboard.type('ZZ');
  await sleep(2000);
  const rendered = await page.$eval('#fe-fe-view', el => el.textContent.includes('ZZ'));
  await page.keyboard.down('Meta'); await page.keyboard.press('s'); await page.keyboard.up('Meta');
  await page.waitForFunction(() => document.getElementById('fe-fe-state').className === 'saved', { timeout: 20_000 }).catch(() => null);
  const mdDisk = readFileSync(md, 'utf8').split('\n');
  check(mdDisk[deep.n - 1].includes('ZZ') && rendered, `typing there lands in line ${deep.n} and the rendered side shows it: ${JSON.stringify(mdDisk[deep.n - 1])}`);
  await page.screenshot({ path: join(SHOTS, 'big-edit-split.png') });
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'big edit walk passes');
