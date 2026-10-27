// Holding Shift over a reading surface shows a grab hand, and dragging scrolls
// what is under the pointer: the page, a wide table, a long code line. It does
// nothing over the toolbar or the comments, and the key follows Settings.
// BFB_THEME=light runs it on the light theme.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, applyTheme, shot } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  const wide = '| ' + Array.from({ length: 30 }, (_, i) => `column ${i}`).join(' | ') + ' |\n|' + '---|'.repeat(30) + '\n| ' + Array.from({ length: 30 }, (_, i) => `value ${i}`).join(' | ') + ' |\n';
  const code = '```js\nconst x = "' + 'a long line of code '.repeat(30) + '";\n```\n';
  const body = Array.from({ length: 80 }, (_, i) => `Paragraph ${i} with some words to read.`).join('\n\n');
  const doc = join(h.fixture, 'pan.md');
  writeFileSync(doc, `# Pan\n\n${wide}\n${code}\n${body}\n`);
  const page = await h.open(h.fixture);
  await applyTheme(page);
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-md');
  await sleep(400);

  const center = sel => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 30) }; });
  const cursorAt = (x, y) => page.evaluate((x, y) => getComputedStyle(document.elementFromPoint(x, y)).cursor, x, y);
  const drag = async (from, dx, dy) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) await page.mouse.move(from.x + dx * i / 5, from.y + dy * i / 5);
    await page.mouse.up();
    await sleep(150);
  };

  // The page itself.
  const para = await page.evaluate(() => { const p = [...document.querySelectorAll('#fe-page .fe-md p')].find(p => { const r = p.getBoundingClientRect(); return r.top > 300 && r.bottom < innerHeight - 100; }); const r = p.getBoundingClientRect(); return { x: r.left + 40, y: r.top + 8 }; });
  await page.mouse.move(para.x, para.y);
  await page.keyboard.down('Shift');
  await page.mouse.move(para.x + 2, para.y);
  await sleep(100);
  check(await cursorAt(para.x, para.y) === 'grab', `holding Shift over the page shows a grab hand: ${await cursorAt(para.x, para.y)}`);
  const top0 = await page.$eval('#fe-page', p => p.scrollTop);
  await drag(para, 0, -200);
  const top1 = await page.$eval('#fe-page', p => p.scrollTop);
  check(top1 - top0 > 150, `Shift-dragging up scrolls the page down: ${top0} -> ${top1}`);
  const sel = await page.evaluate(() => String(getSelection()));
  check(sel === '', `the drag selects no text: "${sel.slice(0, 30)}"`);

  // A wide table and a long code line scroll sideways under the pointer.
  await page.$eval('#fe-page', p => { p.scrollTop = 0; });
  await sleep(150);
  const tw = await center('#fe-page .fe-md-tablewrap');
  await drag(tw, -300, 0);
  const tl = await page.$eval('#fe-page .fe-md-tablewrap', e => e.scrollLeft);
  check(tl > 200, `Shift-dragging left over a wide table scrolls the table: ${tl}`);
  const pre = await center('#fe-page .fe-md-pre');
  await drag(pre, -300, 0);
  const pl = await page.$eval('#fe-page .fe-md-pre', e => e.scrollLeft);
  check(pl > 200, `Shift-dragging left over a long code line scrolls the code: ${pl}`);
  await shot(page, 'pan-file-page');

  // Not over the toolbar.
  const bar = await center('#fe-fp-bar');
  const barCursor = await cursorAt(bar.x, bar.y);
  check(barCursor !== 'grab', `the toolbar keeps its own pointer: ${barCursor}`);
  await page.mouse.move(para.x, para.y);
  await page.keyboard.up('Shift');
  await sleep(100);
  check(await cursorAt(para.x, para.y) !== 'grab', 'letting go of Shift puts the pointer back');

  // Not over the comments.
  await page.click('#fe-fp-cm').catch(() => {});
  await sleep(300);
  const rail = await page.$('#fe-cm');
  if (rail && await rail.evaluate(e => e.getBoundingClientRect().width > 0)) {
    const rc = await center('#fe-cm');
    await page.mouse.move(rc.x, rc.y);
    await page.keyboard.down('Shift');
    await page.mouse.move(rc.x + 2, rc.y);
    await sleep(100);
    check(await cursorAt(rc.x, rc.y) !== 'grab', `the comments keep their own pointer: ${await cursorAt(rc.x, rc.y)}`);
    await page.keyboard.up('Shift');
  } else check(false, 'the comments rail opened for the check');

  // The floating preview.
  const list = await h.open(h.fixture);
  await applyTheme(list);
  await list.waitForSelector('#fe-tbody tr[data-idx]');
  await list.click('#fe-tbody tr[data-idx]:has(a[href$="/pan.md"]) td.c-sz');
  await list.keyboard.press('Space');
  await list.waitForFunction(() => document.getElementById('fe-qlook')?.style.display === 'flex', { timeout: 5000 });
  await sleep(400);
  const qb = await list.evaluate(() => { const p = [...document.querySelectorAll('#fe-ql-body .fe-md p')].find(p => { const r = p.getBoundingClientRect(); return r.top > 300 && r.bottom < innerHeight - 100; }); const r = p.getBoundingClientRect(); return { x: r.left + 40, y: r.top + 8 }; });
  await list.mouse.move(qb.x, qb.y);
  await list.keyboard.down('Shift');
  const q0 = await list.$eval('#fe-ql-body', b => b.scrollTop);
  await list.mouse.down();
  for (let i = 1; i <= 5; i++) await list.mouse.move(qb.x, qb.y - 40 * i);
  await list.mouse.up();
  await sleep(150);
  const q1 = await list.$eval('#fe-ql-body', b => b.scrollTop);
  await list.keyboard.up('Shift');
  check(q1 - q0 > 150, `Shift-dragging in the preview scrolls it: ${q0} -> ${q1}`);
  await list.keyboard.press('Escape');

  // The key follows Settings: with Option chosen, Shift does nothing and Option drags.
  const s = JSON.parse(await h.store.get('bfb-settings-v1') ?? '{}');
  await h.store.set('bfb-settings-v1', { ...s, panKey: 'Alt' });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-md');
  await sleep(400);
  const p2 = await page.evaluate(() => { const p = [...document.querySelectorAll('#fe-page .fe-md p')].find(p => { const r = p.getBoundingClientRect(); return r.top > 300 && r.bottom < innerHeight - 100; }); const r = p.getBoundingClientRect(); return { x: r.left + 40, y: r.top + 8 }; });
  await page.mouse.move(p2.x, p2.y);
  await page.keyboard.down('Shift');
  await page.mouse.move(p2.x + 2, p2.y);
  await sleep(100);
  const shiftNow = await cursorAt(p2.x, p2.y);
  await page.keyboard.up('Shift');
  await page.keyboard.down('Alt');
  await page.mouse.move(p2.x + 4, p2.y);
  await sleep(100);
  const altNow = await cursorAt(p2.x, p2.y);
  await page.keyboard.up('Alt');
  check(shiftNow !== 'grab' && altNow === 'grab', `with Option chosen, Option shows the hand and Shift does not: ${shiftNow} / ${altNow}`);
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
