// Settings written by older versions sit in the page's localStorage. The first
// load after the upgrade must carry them into chrome.storage.local, once.
import { launch } from './harness.mjs';

const h = await launch();
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) failed++; };

try {
  const page = await h.open();
  // Pretend this profile predates the store: old values in localStorage, no marker.
  await page.evaluate(() => {
    localStorage.setItem('bfb-theme', 'light');
    localStorage.setItem('bfb-view', 'tiles');
    localStorage.setItem('bfb-saved-v1', JSON.stringify([{ path: '/tmp/', label: 'Old tmp' }]));
  });
  await h.store.remove('bfb-kv-migrated');
  await h.store.remove('bfb-theme'); await h.store.remove('bfb-view'); await h.store.remove('bfb-saved-v1');
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe');
  const seen = await page.evaluate(() => ({
    theme: document.getElementById('fe').dataset.theme,
    saved: [...document.querySelectorAll('#fe-sv-list .fe-pl-label')].map(e => e.textContent.trim()),
  }));
  check(seen.theme === 'light' && seen.saved.includes('Old tmp'), `old settings show after the upgrade: ${JSON.stringify(seen)}`);
  check(await h.store.get('bfb-view') === 'tiles' && await h.store.get('bfb-kv-migrated') === '1', 'values were copied into the extension store and marked done');

  // After the copy, the store wins: a stale localStorage value is ignored.
  await page.evaluate(() => localStorage.setItem('bfb-theme', 'dark'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe');
  check(await page.evaluate(() => document.getElementById('fe').dataset.theme) === 'light', 'the copy runs once');

  // A change in one tab reaches another open tab without a reload.
  const other = await h.open();
  await page.evaluate(() => document.querySelector('#fe-theme-btn')?.click());
  await new Promise(r => setTimeout(r, 300));
  const stored = await h.store.get('bfb-theme');
  await other.reload({ waitUntil: 'load' });
  await other.waitForSelector('#fe');
  check(stored === 'dark' && await other.evaluate(() => document.getElementById('fe').dataset.theme) === 'dark', `a theme switch in one tab is stored for all: ${stored}`);
} finally {
  await h.close();
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
