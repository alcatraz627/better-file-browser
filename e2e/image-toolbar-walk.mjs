// Walks the image preview toolbar on a picture from a scratch copy of the notes store:
// zoom, actual size, rotate, flip, copy image (read back from the clipboard), open in app.
// "Open in app" goes through the real launcher host with a fake `open` first on PATH, so no app opens.
//
//   node e2e/image-toolbar-walk.mjs   (a generated store; BFB_NOTES_SRC names another scratch store, never a real Notes folder)
//   BFB_THEME=light ...
import { notesSource, scratchStore } from './make-notes-store.mjs';
import { launch, shot, applyTheme } from './harness.mjs';
import { cpSync, rmSync, readFileSync, existsSync, writeFileSync, mkdirSync, chmodSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { createHash } from 'node:crypto';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SRC = notesSource();
const store = scratchStore(SRC, 'image-walk');
rmSync(store, { recursive: true, force: true });
mkdirSync(store, { recursive: true });
cpSync(SRC, store, { recursive: true, preserveTimestamps: true });
const OUT = process.env.BFB_WALK_OUT || join(store, '..', 'bfb-notes-walk-out');
mkdirSync(OUT, { recursive: true });

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const pic = readdirSync(join(store, 'attachments')).find(f => /\.png$/.test(f));
// A wide picture of known size, so the turn is easy to read: 400 x 120.
const wide = join(store, 'attachments', 'wide-400x120.svg');
writeFileSync(wide, '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120"><rect width="400" height="120" fill="#2b6cb0"/><rect width="200" height="120" fill="#ed8936"/><text x="12" y="70" font-size="40" fill="white">LEFT</text></svg>');

// The real launcher host behind a fake `open`.
const fakeBin = join(OUT, 'fakebin'); mkdirSync(fakeBin, { recursive: true });
const openLog = join(OUT, 'open.log'); rmSync(openLog, { force: true });
writeFileSync(join(fakeBin, 'open'), `#!/bin/sh\nprintf "%s\\n" "$*" >> "${openLog}"\n`); chmodSync(join(fakeBin, 'open'), 0o755);
const wrapper = join(OUT, 'launcher-wrapper.sh');
writeFileSync(wrapper, `#!/bin/sh\nPATH="${fakeBin}:$PATH" exec python3 "${join(ROOT, 'native', 'ghostty_launcher.py')}"\n`); chmodSync(wrapper, 0o755);
const extId = createHash('sha256').update(ROOT).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));

const h = await launch();
try {
  const hosts = join(tmpdir(), `bfb-profile-${process.pid}`, 'NativeMessagingHosts');
  writeFileSync(join(hosts, 'com.better_file_browser.ghostty.json'), JSON.stringify({
    name: 'com.better_file_browser.ghostty', description: 'launcher (e2e)', path: wrapper, type: 'stdio',
    allowed_origins: [`chrome-extension://${extId}/`] }));
  const ctx = h.browser.defaultBrowserContext();
  await ctx.overridePermissions('file://', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']).catch(() => null);

  const page = await h.open(join(store, 'attachments'));
  await applyTheme(page);
  const preview = async name => {
    await (await page.$(`#fe-tbody tr[data-idx]:has(a[href$="${name}"]) td.c-nm`)).click();
    await page.keyboard.press('Space');
    await page.waitForSelector('.fe-ql-imgbar', { timeout: 8_000 });
    await page.waitForFunction(() => document.querySelector('.fe-ql-imgwrap')?.dataset.zoom, { timeout: 5_000 });
    await sleep(200);
  };
  const state = () => page.evaluate(() => {
    const w = document.querySelector('.fe-ql-imgwrap'), i = w.querySelector('img'), s = w.querySelector('.fe-ql-imgsizer');
    const r = i.getBoundingClientRect();
    return { zoom: +w.dataset.zoom, rot: +w.dataset.rot, flip: w.dataset.flip, dim: w.querySelector('.fe-ql-dim').textContent,
      sizerW: s.offsetWidth, sizerH: s.offsetHeight, boxW: Math.round(r.width), boxH: Math.round(r.height), nat: [i.naturalWidth, i.naturalHeight] };
  });
  const press = async act => { await page.click(`.fe-ql-imgbar [data-img="${act}"]`); await sleep(150); };

  await preview('wide-400x120.svg');
  // 1. Every button has an icon on its left.
  const bar = await page.$$eval('.fe-ql-imgbar button', bs => bs.map(b => ({ act: b.dataset.img, text: b.textContent.trim(), iconFirst: b.firstElementChild?.tagName === 'svg' })));
  check(bar.length === 8 && bar.every(b => b.iconFirst && b.text), `the toolbar has eight buttons, each with an icon left of its text: ${JSON.stringify(bar.map(b => b.text))}`);
  let s = await state();
  check(s.nat[0] === 400 && s.zoom === 100 && /400 × 120 · 100%/.test(s.dim), `a small picture opens at 100%: ${JSON.stringify(s)}`);
  await shot(page, 'image-toolbar');

  // 2. Zoom in and out by a quarter, actual size and fit.
  await press('in'); s = await state();
  check(s.zoom === 125 && s.boxW === 500, `zoom in: 125%, the picture is 500 px wide: ${s.zoom}% ${s.boxW}`);
  await press('in'); await press('out'); s = await state();
  check(s.zoom === 125, `zoom out undoes a zoom in: ${s.zoom}%`);
  await press('out'); await press('out'); s = await state();
  check(s.zoom === 80, `two more out: 80%: ${s.zoom}%`);
  await press('actual'); s = await state();
  check(s.zoom === 100 && s.boxW === 400, `actual size: 100%, 400 px wide: ${s.zoom}% ${s.boxW}`);
  // 3. Rotate and flip.
  await press('rotate'); s = await state();
  check(s.rot === 90 && s.sizerW === 120 && s.sizerH === 400 && s.boxW === 120 && s.boxH === 400, `rotate turns it a quarter and the frame follows: ${JSON.stringify(s)}`);
  await press('flip'); s = await state();
  check(s.flip === '1' && s.rot === 90, `flip mirrors it: ${JSON.stringify(s)}`);
  await shot(page, 'image-rotated-flipped');
  const copyReads = async () => page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const blob = await items[0].getType('image/png');
    const bmp = await createImageBitmap(blob);
    const c = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d'); c.drawImage(bmp, 0, 0);
    const px = (x, y) => [...c.getImageData(x, y, 1, 1).data].slice(0, 3);
    return { w: bmp.width, h: bmp.height, top: px(Math.floor(bmp.width / 2), 5), bottom: px(Math.floor(bmp.width / 2), bmp.height - 5) };
  });
  // 4. Copy: the clipboard holds the picture as shown (quarter turn clockwise, then mirrored left-right).
  await press('copy');
  await sleep(600);
  const toastText = await page.$eval('#fe-toast', t => t.textContent).catch(() => '');
  let clip = null;
  try { clip = await copyReads(); } catch (e) { clip = { error: String(e) }; }
  check(clip && clip.w === 120 && clip.h === 400, `copy puts the turned picture on the clipboard (120 x 400): ${JSON.stringify(clip)} toast "${toastText}"`);
  // Orange is the left half. Turned clockwise it is the top half; the mirror leaves top and bottom alone.
  const orange = c => c && c[0] > 200 && c[1] > 100 && c[2] < 100;
  check(clip && orange(clip.top) && !orange(clip.bottom), `the copy has the orange half on top, as shown: top ${clip?.top} bottom ${clip?.bottom}`);
  writeFileSync(join(OUT, 'clipboard-readback.json'), JSON.stringify(clip));
  // 5. Fit returns, and a big picture fits the panel instead of overflowing.
  await press('fit'); s = await state();
  check(s.zoom === 100, `fit on a small picture stays at 100%: ${s.zoom}%`);
  // 6. Open in app: the launcher is asked for exactly this file.
  await press('open');
  for (let i = 0; i < 20 && !existsSync(openLog); i++) await sleep(250);
  const launched = existsSync(openLog) ? readFileSync(openLog, 'utf8').trim().split('\n') : [];
  check(launched.length === 1 && launched[0].endsWith('/attachments/wide-400x120.svg'), `open in app hands the file to the launcher: ${JSON.stringify(launched)}`);
  await page.keyboard.press('Escape');

  // 7. A big picture opens fitted and can be zoomed to its size.
  await preview(pic);
  s = await state();
  check(s.nat[0] > 0 && s.boxW <= 1400 && s.boxH <= 900 && /%$/.test(s.dim), `a large picture opens fitted inside the panel: ${JSON.stringify(s)}`);
  await shot(page, 'image-large-fit');
  await press('actual'); s = await state();
  check(s.zoom === 100 && s.boxW === s.nat[0], `actual size shows every pixel: ${JSON.stringify(s)}`);
  await shot(page, 'image-large-actual');
  await page.keyboard.press('Escape');
} finally {
  await h.close();
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
