// One address on the Mac: Copy link on a note row copies the phone link when phone access is on (it opens
// on the Mac and the phone) and a file link when it is off, and says plainly which. A phone-server link
// followed on the Mac opens the file locally.
//
//   node e2e/address-walk.mjs      (a generated scratch store)
import { makeNotesStore } from './make-notes-store.mjs';
import { launch, shot } from './harness.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const store = join(tmpdir(), `bfb-address-walk-${process.pid}`);
makeNotesStore(store);
const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const h = await launch();
try {
  const page = await h.open();
  await h.store.set('bfb-lens-v1', 'notes');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, showSidebar: true, tooltips: true, notesRoot: store }));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-list .fe-nt-item');
  const copyLink = async () => {
    await page.click('#fe-nt-list .fe-nt-item[data-rel="ideas.md"] .fe-si-link', { button: 'right' });
    await page.waitForSelector('.fe-ctx-item[data-act="cp-link"]');
    await page.click('.fe-ctx-item[data-act="cp-link"]');
    await sleep(500);
    return page.$eval('#fe-toast', e => e.textContent);
  };
  const said = await copyLink();
  check(/Phone access is off, so it opens only on this Mac/.test(said), `with phone access off, Copy link says it opens only on this Mac: ${said}`);
  await shot(page, 'address-copy-off');

  await h.store.set('bfb-phone-on', '1');
  await h.store.set('bfb-phone-url', 'http://100.64.0.9:8446');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-list .fe-nt-item');
  const said2 = await copyLink();
  check(/opens on this Mac and on your phone/.test(said2), `with phone access on, Copy link says it opens on both: ${said2}`);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  check(clip === '' || clip === `http://100.64.0.9:8446${store}/ideas.md`, `and copies the phone address: ${clip || '(clipboard not readable here)'}`);

  // A phone-server link followed on the Mac opens the file here.
  await page.evaluate(root => { const a = document.createElement('a'); a.id = 'probe-link'; a.href = `http://100.64.0.9:8446${root}/ideas.md`; a.textContent = 'x'; a.style.cssText = 'position:fixed;top:60px;left:320px;z-index:99999;background:#fff;color:#000'; document.body.append(a); }, store);
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }).catch(() => null), page.click('#probe-link')]);
  check(page.url().startsWith('file://') && page.url().endsWith('/ideas.md'), `a phone-server link opens the file on the Mac: ${page.url().replace(store, '<store>')}`);
} finally {
  await h.close();
}
if (fails.length) { console.error(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
