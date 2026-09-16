// Regression gate for the note-editor workflow fixes, driven in the real
// extension. Isolated harness profile, so it does not touch the smoke state.
//   The note editor "+ tab" keeps the note; "open" goes to its file page.
import { launch } from './harness.mjs';

const strip = page => page.evaluate(() =>
  [...document.querySelectorAll('#fe-tabs .fe-tab')].map(t =>
    (t.classList.contains('temp') ? '~' : '') + (t.classList.contains('on') ? '*' : '') +
    t.querySelector('.fe-tab-lbl')?.textContent));

const fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };

const h = await launch();
try {
  // The note editor "+ tab" keeps the note as a strip tab.
  let page = await h.open();
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
