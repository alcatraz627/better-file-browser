// Regression gate for composite workflow fixes, driven in the real extension.
// Isolated harness profile, so it does not touch the smoke state.
//   A sidebar click keeps the current folder; the note editor "+ tab" and
//   "open" act on the note.
import { launch } from './harness.mjs';

const strip = page => page.evaluate(() =>
  [...document.querySelectorAll('#fe-tabs .fe-tab')].map(t =>
    (t.classList.contains('temp') ? '~' : '') + (t.classList.contains('on') ? '*' : '') +
    t.querySelector('.fe-tab-lbl')?.textContent));

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };

const h = await launch();
try {
  // A saved-item sidebar click keeps the current folder as a tab (option 1).
  let page = await h.open();
  await page.evaluate(fx => localStorage.setItem('bfb-saved-v1',
    JSON.stringify([{ path: fx + '/readme.md', label: 'readme.md' }])), h.fixture);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-sv-list .fe-si-link');
  const sBefore = await strip(page);
  await page.click('#fe-sv-list .fe-si-link');
  await new Promise(r => setTimeout(r, 250));
  const sAfter = await strip(page);
  check(sBefore.length === 1 && sAfter.some(l => /bfb-fixture/.test(l)) && sAfter.some(l => /readme\.md/.test(l)),
    `sidebar click keeps the current folder as a tab: before=${JSON.stringify(sBefore)} after=${JSON.stringify(sAfter)}`);
  await page.close();

  // The note editor "+ tab" keeps the note as a strip tab.
  page = await h.open();
  await page.evaluate(nd => localStorage.setItem('bfb-settings-v1',
    JSON.stringify({ showSidebar: true, tooltips: true, notesRoot: nd })), h.notesDir);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-list .fe-si-link', { timeout: 5000 });
  await page.click('#fe-nt-list .fe-si-link');
  await page.waitForSelector('#fe-ql-body.fe-editing', { timeout: 5000 });
  await page.click('#fe-ql-tab');
  await new Promise(r => setTimeout(r, 250));
  const aAfter = await strip(page);
  check(aAfter.some(l => /existing-note\.md/.test(l)), `note editor + tab keeps the note: ${JSON.stringify(aAfter)}`);
  await page.close();

  // Defect A: note editor "open" navigates to the note's file page.
  page = await h.open();
  await page.evaluate(nd => localStorage.setItem('bfb-settings-v1',
    JSON.stringify({ showSidebar: true, tooltips: true, notesRoot: nd })), h.notesDir);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-list .fe-si-link', { timeout: 5000 });
  await page.click('#fe-nt-list .fe-si-link');
  await page.waitForSelector('#fe-ql-body.fe-editing', { timeout: 5000 });
  await page.click('#fe-ql-go');
  await new Promise(r => setTimeout(r, 500));
  check(/existing-note\.md$/.test(page.url()), `note editor open goes to the note page: ${page.url()}`);
} finally {
  await h.close();
}

if (fails.length) { console.error(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall workflow-fix checks passed');
