// Walks the shared note order (specs/order.md) in the sidebar on a scratch store it builds itself:
// pinned first, then never-arranged notes newest created first, then `pos` in byte order, and an
// edit or a new note never reshuffles the arranged ones. Also the one-line editor header title.
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

  // The header name is one line, cut in the middle.
  await page.setViewport({ width: 900, height: 900 });
  await page.click('#fe-nt-list .fe-nt-item[data-rel="zz-long.md"] .fe-si-link');
  await page.waitForSelector('#fe-ed-src', { timeout: 8_000 });
  await sleep(300);
  const hdr = await page.$eval('#fe-ql-name', e => {
    const hd = e.querySelector('.fe-mid-h');
    return { tail: e.querySelector('.fe-mid-t')?.textContent ?? '', cut: !!hd && hd.scrollWidth > hd.clientWidth + 1, h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight) || 18 };
  });
  check(hdr.cut && hdr.tail.length === 10 && LONG.endsWith(hdr.tail) && hdr.h < 30, `the editor header title is one line cut in the middle, ending "${hdr.tail}"`);
  await shot(page, 'order-header');
} finally {
  await h.close();
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall ok');
process.exit(fails.length ? 1 : 0);
