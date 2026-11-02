// The note row's remaining actions, walked on a generated store: the colour filter row, Show in Finder,
// Send (one click, never wakes an agent), Show on the Pi screen against a stand-in Pi (on, screen off, and
// the Pi gone), and a new note that copies its own path.
//
//   node e2e/note-actions-walk.mjs      (BFB_THEME=light for the light shots)
import { makeNotesStore } from './make-notes-store.mjs';
import { launch, shot, applyTheme } from './harness.mjs';
import { createServer } from 'node:http';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const store = join(tmpdir(), `bfb-actions-walk-${process.pid}`);
makeNotesStore(store);
const OUT = join(tmpdir(), `bfb-actions-out-${process.pid}`);
mkdirSync(OUT, { recursive: true });

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const row = rel => `#fe-nt-list .fe-nt-item[data-rel="${rel}"]`;

// A stand-in Pi, a recorder for claude-ipc (it must never be called), and the launcher host behind a fake `open`.
const seen = [];
let piMode = 'on';
const pi = createServer((req, res) => {
  let b = ''; req.on('data', d => { b += d; }); req.on('end', () => {
    seen.push({ url: req.url, token: req.headers['x-csync-token'], body: JSON.parse(b || '{}') });
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ sentToDisplay: piMode === 'on' }));
  });
});
await new Promise(r => pi.listen(0, '127.0.0.1', r));
const tokenFile = join(OUT, 'mesh.token'); writeFileSync(tokenFile, 'walk-token\n');
const ipcLog = join(OUT, 'ipc.log'); const ipc = join(OUT, 'claude-ipc');
writeFileSync(ipc, `#!/bin/sh\nprintf '%s\\n' "$*" >> '${ipcLog}'\n`); chmodSync(ipc, 0o755);
process.env.BFB_PI_BASE = `http://127.0.0.1:${pi.address().port}`;
process.env.BFB_PI_TOKEN_FILE = tokenFile;
process.env.BFB_CLAUDE_IPC = ipc;
const fakeBin = join(OUT, 'fakebin'); mkdirSync(fakeBin, { recursive: true });
const openLog = join(OUT, 'open.log'); rmSync(openLog, { force: true });
writeFileSync(join(fakeBin, 'open'), `#!/bin/sh\nprintf "%s\\n" "$*" >> "${openLog}"\n`); chmodSync(join(fakeBin, 'open'), 0o755);
const wrapper = join(OUT, 'launcher-wrapper.sh');
writeFileSync(wrapper, `#!/bin/sh\nPATH="${fakeBin}:$PATH" exec python3 "${join(ROOT, 'native', 'ghostty_launcher.py')}"\n`); chmodSync(wrapper, 0o755);
const extId = createHash('sha256').update(ROOT).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));

const h = await launch();
try {
  writeFileSync(join(tmpdir(), `bfb-profile-${process.pid}`, 'NativeMessagingHosts', 'com.better_file_browser.ghostty.json'), JSON.stringify({
    name: 'com.better_file_browser.ghostty', description: 'launcher (e2e)', path: wrapper, type: 'stdio', allowed_origins: [`chrome-extension://${extId}/`] }));
  const page = await h.open();
  await h.store.set('bfb-lens-v1', 'notes');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, showSidebar: true, tooltips: true, notesRoot: store }));
  await applyTheme(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 10_000 });
  await sleep(500);
  const toast = async () => { await sleep(500); return page.$eval('#fe-toast', e => e.textContent); };
  const clearToast = () => page.evaluate(() => { document.getElementById('fe-toast').textContent = ''; });
  const menu = async (rel, act) => {
    await page.click(`${row(rel)} .fe-si-link`, { button: 'right' });
    await page.waitForSelector(`.fe-ctx-item[data-act="${act}"]`);
    await page.click(`.fe-ctx-item[data-act="${act}"]`);
  };
  const rels = () => page.$$eval('#fe-nt-list .fe-nt-item', rs => rs.map(r => r.dataset.rel));

  // 1. The colour row: All and the eight colours, filtering by exact colour, and the box still matches colour names.
  const chips = await page.$$eval('#fe-lens-colours .fe-lens-colour', cs => cs.map(c => c.textContent.trim()));
  check(chips.length === 9 && chips[0] === 'All' && chips.includes('Blue') && chips.includes('Purple'), `a colour row sits above the list with All and the eight colours: ${chips}`);
  await shot(page, 'actions-colour-row');
  const all = await rels();
  await page.click('#fe-lens-colours .fe-lens-colour[data-colour="blue"]'); await sleep(500);
  const blue = await rels();
  const pressed = await page.$eval('#fe-lens-colours .fe-lens-colour[data-colour="blue"]', c => c.getAttribute('aria-pressed'));
  check(blue.join() === '20260930-145139.md' && pressed === 'true' && await page.$eval('#fe-lens-filter', e => e.value) === 'colour:blue', `Blue keeps only the blue note and shows as pressed: ${blue}`);
  await shot(page, 'actions-colour-blue');
  await page.click('#fe-lens-colours .fe-lens-colour[data-colour=""]'); await sleep(500);
  check((await rels()).length === all.length && await page.$eval('#fe-lens-filter', e => e.value) === '', 'All brings every note back and clears the box');
  await page.type('#fe-lens-filter', 'purple'); await sleep(500);
  check((await rels()).includes('20260929-195411.md'), 'typing a colour name in the box still matches the note of that colour');
  await page.$eval('#fe-lens-filter', e => { e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(400);
  await page.click('#fe-rail-saved'); await sleep(400);
  check(await page.$eval('#fe-lens-colours', e => e.hidden), 'the colour row is not shown in the Saved lens');
  await page.click('#fe-rail-notes'); await sleep(400);

  // 2. Show in Finder, the way listing rows do it.
  await menu('meeting-notes.md', 'ow:finder'); await sleep(1500);
  const opened = existsSync(openLog) ? readFileSync(openLog, 'utf8') : '';
  check(/^-R \/.*bfb-actions-walk-\d+\/meeting-notes\.md$/.test(opened.trim()), `Show in Finder reveals the note's file: ${opened.trim().replace(/ \/.*\//, ' <store>/')}`);

  // 3. Send: one click opens the system share (or copies the text where there is none) and wakes nobody.
  await clearToast();
  await menu('meeting-notes.md', 'send');
  const sent = await toast();
  check(/^(This browser has no share menu|Sharing failed|)/.test(sent) && !existsSync(ipcLog), `Send is one click and never calls claude-ipc: toast "${sent}"`);
  check(!existsSync(ipcLog), 'syncing, tagging and Send left the agent line alone: claude-ipc was never called');

  // 4. Show on the Pi screen, against a stand-in.
  await clearToast();
  await menu('meeting-notes.md', 'pi');
  check(await toast() === 'Showing on the Pi screen.', 'the Pi shows the note');
  check(seen.length === 1 && seen[0].url === '/v1/display/show' && seen[0].token === 'walk-token' && seen[0].body.text.includes('A note bfb named after its title.'), `it posted the note's words with the token: ${JSON.stringify(seen[0]?.body).slice(0, 90)}`);
  piMode = 'off'; await clearToast();
  await menu('meeting-notes.md', 'pi');
  check(await toast() === 'Sent. The Pi screen is off.', 'a Pi whose screen is off says so');
  await shot(page, 'actions-pi-toast');
  await new Promise(r => pi.close(r)); await clearToast();
  const t0 = Date.now();
  await menu('meeting-notes.md', 'pi');
  await page.waitForFunction(() => /did not answer/.test(document.getElementById('fe-toast')?.textContent ?? ''), { timeout: 9000 }).catch(() => null);
  check(/The Pi did not answer/.test(await page.$eval('#fe-toast', e => e.textContent)) && Date.now() - t0 < 9000, `with the Pi gone it says so plainly and does not hang: ${Date.now() - t0} ms`);

  // 5. A new note that copies its own path, from the palette.
  const before = new Set(readdirSync(store));
  await page.keyboard.press('Escape');
  await page.keyboard.down('Meta'); await page.keyboard.press('k'); await page.keyboard.up('Meta');
  await page.waitForSelector('.fe-pal input'); await sleep(200);
  await page.type('.fe-pal input', 'copy its path'); await sleep(300);
  await shot(page, 'actions-palette-path');
  await page.keyboard.press('Enter'); await sleep(1500);
  const made = readdirSync(store).filter(f => !before.has(f) && f.endsWith('.md'));
  check(made.length === 1 && /^untitled-\d+\.md$/.test(made[0]) && /Made a new note and copied its path/.test(await page.$eval('#fe-toast', e => e.textContent)), `the palette makes an empty note and says it copied its path: ${made}`);
  check(!!(await page.$('#fe-meta-title')), 'and the editor opens on it');
  await shot(page, 'actions-new-note-path');
} finally {
  await h.close();
  try { pi.close(); } catch { /* already stopped */ }
}
if (fails.length) { console.error(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
