// Walks the shared note order (specs/order.md) in the sidebar on a scratch store it builds itself:
// pinned first, then never-arranged notes newest created first, then `pos` in byte order, and an
// edit or a new note never reshuffles the arranged ones. Also the one-line title chip in the editor.
//
//   node e2e/notes-order-walk.mjs      (BFB_THEME=light for the light theme)
import { launch, shot, applyTheme } from './harness.mjs';
import { rmSync, mkdirSync, writeFileSync, utimesSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const store = '/private/tmp/claude-501/laneD/order-store';
rmSync(store, { recursive: true, force: true });
mkdirSync(store, { recursive: true });
const note = (rel, title, fm, mtime) => {
  writeFileSync(join(store, rel), `---\ntitle: "${title}"\n${fm}---\nbody of ${title}\n`);
  utimesSync(join(store, rel), mtime, mtime);
};
const now = Date.now() / 1000;
note('p1.md', 'Pinned unarranged', 'created: 2026-01-01T00:00:00Z\npinned: true\n', now - 900);
note('p2.md', 'Pinned arranged', 'created: 2026-01-02T00:00:00Z\npinned: true\npos: a\n', now - 800);
note('u1.md', 'Unarranged newer', 'created: 2026-03-01T00:00:00Z\n', now - 700);
note('u2.md', 'Unarranged older', 'created: 2026-02-01T00:00:00Z\n', now - 600);
note('k1.md', 'Arranged second', 'created: 2026-01-03T00:00:00Z\npos: b\n', now - 10);
note('k2.md', 'Arranged first', 'created: 2026-01-04T00:00:00Z\npos: a\n', now - 500);
const LONG = 'A long header title that keeps going and going well past the width of the editor dialog header, so it has to be cut somewhere in the middle of it all and end here';
note('zz-long.md', LONG, 'created: 2025-12-01T00:00:00Z\npos: c\n', now - 400);

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rows = page => page.$$eval('#fe-nt-list .fe-nt-item', els => els.map(e => e.getAttribute('data-rel')));

const h = await launch();
try {
  const page = await h.open();
  await h.store.set('bfb-settings-v1', { showSidebar: true, tooltips: true, notesRoot: store });
  await page.reload({ waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 10_000 });
  const want = ['p1.md', 'p2.md', 'u1.md', 'u2.md', 'k2.md', 'k1.md', 'zz-long.md'];
  const got = await rows(page);
  check(JSON.stringify(got) === JSON.stringify(want), `sidebar order is pinned, unarranged by created, then pos: ${got.join(' ')}`);
  await shot(page, 'order-sidebar');

  // Editing the last note (k1, newest file time) must not move it.
  await page.click('#fe-nt-list .fe-nt-item[data-rel="k1.md"] .fe-si-link');
  await page.waitForSelector('#fe-ed-src', { timeout: 8_000 });
  await page.evaluate(() => { const ta = document.getElementById('fe-ed-src'); ta.value += '\nedited\n'; ta.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(() => /saved \d/.test(document.getElementById('fe-ql-meta').textContent), { timeout: 8_000 }).catch(() => null);
  await sleep(500);
  check(readFileSync(join(store, 'k1.md'), 'utf8').includes('edited') && /^pos: b$/m.test(readFileSync(join(store, 'k1.md'), 'utf8')), 'the edit reached the file and kept its pos line');
  await page.keyboard.press('Escape');
  await sleep(500);
  const afterEdit = await rows(page);
  check(JSON.stringify(afterEdit) === JSON.stringify(want), `an edit does not reorder the list: ${afterEdit.join(' ')}`);

  // A new note has no pos, so it lands above the arranged notes (below the pinned ones).
  await page.keyboard.press('n');
  await page.waitForSelector('#fe-ed-src', { timeout: 8_000 });
  await page.evaluate(() => { const ta = document.getElementById('fe-ed-src'); ta.value = '# Brand new\n\nhi\n'; ta.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(() => /saved \d/.test(document.getElementById('fe-ql-meta').textContent), { timeout: 8_000 }).catch(() => null);
  await page.keyboard.press('Escape');
  await sleep(800);
  const afterNew = await rows(page);
  check(afterNew.length === 8 && afterNew.slice(0, 2).join() === 'p1.md,p2.md' && afterNew[2].startsWith('brand-new') && afterNew.slice(3).join() === want.slice(2).join(), `a new note lands first among the unarranged: ${afterNew.join(' ')}`);

  // Dragging notes: a drop above or below a row places the note there, a drop in
  // the other group or on its header pins or unpins it, and the files carry it.
  const fileOf = rel => readFileSync(join(store, rel), 'utf8');
  const waitFile = async (rel, re) => { for (let i = 0; i < 40 && !re.test(fileOf(rel)); i++) await sleep(100); return re.test(fileOf(rel)); };
  const drag = (srcRel, dstSel, after) => page.evaluate((srcRel, dstSel, after) => {
    const src = document.querySelector(`#fe-nt-list .fe-nt-item[data-rel="${srcRel}"]`);
    const dt = new DataTransfer();
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    const zone = !!document.querySelector('#fe-nt-list .fe-nt-pinzone');
    const target = document.querySelector(dstSel);   // measured after dragstart: the pin zone shifts rows down
    const tr = target.getBoundingClientRect(), ty = after ? tr.bottom - 3 : tr.top + 3, x = tr.left + 20;
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: ty }));
    const mark = target.classList.contains('drop-after') ? 'after' : target.classList.contains('drop-before') ? 'before' : target.classList.contains('drop-in') ? 'in' : '';
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: ty }));
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    return { zone, mark };
  }, srcRel, dstSel, after);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 10_000 });
  const startOrder = await rows(page);
  check(await page.$$eval('#fe-nt-list .fe-nt-item', els => els.every(e => e.draggable)), 'every note row can be dragged');
  const d1 = await drag('u2.md', '#fe-nt-list .fe-nt-item[data-rel="u1.md"]', false);
  const o1 = await rows(page);
  const u1At = startOrder.indexOf('u1.md');
  check(d1.mark === 'before' && o1[u1At] === 'u2.md' && o1[u1At + 1] === 'u1.md', `dropping on the top half of a row puts the note above it: ${o1.join(' ')}`);
  check(await waitFile('u2.md', /^pos: \S+$/m) && await waitFile('u1.md', /^pos: \S+$/m), 'the dropped note and the one it went above got pos lines in their files');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 10_000 });
  const o1r = await rows(page);
  check(JSON.stringify(o1r) === JSON.stringify(o1), `the dragged order survives a reload: ${o1r.join(' ')}`);
  const d2 = await drag('k1.md', '#fe-nt-list .fe-nt-item[data-rel="p1.md"]', true);
  check(d2.mark === 'after' && (await rows(page))[1] === 'k1.md', 'dropping in the Pinned group under a row pins the note there');
  check(await waitFile('k1.md', /^pinned: true$/m), 'the pin reached the file');
  const d3 = await drag('p1.md', '#fe-nt-list .fe-nt-grp[data-grp="all"]', false);
  check(d3.mark === 'in' && await waitFile('p1.md', /^(?![\s\S]*^pinned: true$)/m), 'dropping a pinned note on the All notes header unpins it');
  await drag('p2.md', '#fe-nt-list .fe-nt-grp[data-grp="all"]', false);
  await drag('k1.md', '#fe-nt-list .fe-nt-grp[data-grp="all"]', false);
  await waitFile('k1.md', /^(?![\s\S]*^pinned: true$)/m);
  check(!(await page.$('#fe-nt-list .fe-nt-grp')), 'with nothing pinned the list is one plain list again');
  const d4 = await drag('u1.md', '#fe-nt-list .fe-nt-pinzone', false);
  check(d4.zone && d4.mark === 'in' && await waitFile('u1.md', /^pinned: true$/m), 'with nothing pinned, a drag shows a pin zone and a drop there pins the note');
  check(!(await page.$('#fe-nt-list .fe-nt-pinzone')), 'the pin zone goes away after the drop');
  await shot(page, 'order-dragged');

  // A new note offers its title chip at once, and naming it there writes the heading line.
  await page.keyboard.press('n');
  await page.waitForSelector('#fe-ed-src', { timeout: 8_000 });
  await sleep(300);
  const chip = await page.$eval('#fe-meta-title', b => ({ untitled: b.classList.contains('untitled'), text: b.textContent.trim(), bg: getComputedStyle(b).backgroundColor, color: getComputedStyle(b).color }));
  check(chip.untitled && /Untitled/.test(chip.text) && chip.bg === 'rgba(0, 0, 0, 0)', `a new note shows a themed title chip to name it: ${JSON.stringify(chip)}`);
  await shot(page, 'title-new');
  const rowH = () => page.$eval('#fe-ed-meta', e => e.getBoundingClientRect().height);
  const before = await rowH();
  await page.click('#fe-meta-title');
  const during = await rowH();
  check(Math.abs(before - during) < 0.5, `opening the title box does not move the row: ${before} → ${during}`);
  await page.keyboard.type('Named from chip');
  await shot(page, 'title-editing');
  await page.keyboard.press('Enter');
  const src = await page.$eval('#fe-ed-src', t => t.value);
  check(src.startsWith('# Named from chip'), `naming from the chip writes the heading line: ${JSON.stringify(src.slice(0, 30))}`);
  await page.waitForFunction(() => /saved \d/.test(document.getElementById('fe-ql-meta').textContent), { timeout: 8_000 }).catch(() => null);
  await sleep(400);
  const named = await page.$eval('#fe-meta-title', b => b.textContent.trim());
  check(named === 'Named from chip', `the chip then shows the new title: ${named}`);
  await page.hover('#fe-meta-title');
  await shot(page, 'title-hover');
  await page.keyboard.press('Escape');
  await sleep(500);

  // The note's title shows once, in its title chip under the header: one line, cut in the middle.
  await page.setViewport({ width: 900, height: 900 });
  await page.click('#fe-nt-list .fe-nt-item[data-rel="zz-long.md"] .fe-si-link');
  await page.waitForSelector('#fe-ed-src', { timeout: 8_000 });
  await sleep(300);
  const hdr = await page.$eval('#fe-meta-title', e => {
    const hd = e.querySelector('.fe-mid-h');
    return { tail: e.querySelector('.fe-mid-t')?.textContent ?? '', cut: !!hd && hd.scrollWidth > hd.clientWidth + 1, h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight) || 18 };
  });
  check(hdr.cut && hdr.tail.length === 10 && LONG.endsWith(hdr.tail) && hdr.h < 30, `the note's title chip is one line cut in the middle, ending "${hdr.tail}"`);
  await shot(page, 'order-header');
} finally {
  await h.close();
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall ok');
process.exit(fails.length ? 1 : 0);
