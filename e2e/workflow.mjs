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
  // The saved-row click is deferred (double-click renames); wait for the
  // navigation to settle before reading the strip on the new page.
  await page.waitForFunction(() => location.href.endsWith('readme.md'), { timeout: 3000 }).catch(() => {});
  await page.waitForSelector('#fe-tabs .fe-tab', { timeout: 3000 }).catch(() => {});
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
  await page.close();

  // A double-click renames a saved bookmark; the single click that precedes it
  // must not navigate away first.
  page = await h.open();
  await page.evaluate(fx => localStorage.setItem('bfb-saved-v1',
    JSON.stringify([{ path: fx + '/nested/', label: 'nested' }])), h.fixture);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-sv-list .fe-pl-label');
  const box = await (await page.$('#fe-sv-list .fe-pl-label')).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ clickCount: 1 }); await page.mouse.up({ clickCount: 1 });
  await page.mouse.down({ clickCount: 2 }); await page.mouse.up({ clickCount: 2 });
  await page.waitForFunction(() => document.querySelector('#fe-sv-list .fe-pl-label')?.getAttribute('contenteditable') === 'true', { timeout: 2000 }).catch(() => {});
  await page.evaluate(() => {
    const el = document.querySelector('#fe-sv-list .fe-pl-label');
    el.textContent = 'Renamed';
    const r = document.createRange(); r.selectNodeContents(el);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 400));
  const renamed = await page.evaluate(() => JSON.parse(localStorage.getItem('bfb-saved-v1'))[0].label);
  check(renamed === 'Renamed' && !page.url().endsWith('/nested/'), `double-click renames a saved bookmark without navigating: label=${renamed} url=${page.url().split('/').pop() || '/'}`);
  await page.close();

  // A double-click on a note label renames it; the single click must not open
  // the editor first (the sibling of the saved-bookmark rename).
  page = await h.open();
  await page.evaluate(nd => localStorage.setItem('bfb-settings-v1',
    JSON.stringify({ showSidebar: true, tooltips: true, notesRoot: nd })), h.notesDir);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-list .fe-nt-label', { timeout: 5000 });
  const nbox = await (await page.$('#fe-nt-list .fe-nt-label')).boundingBox();
  await page.mouse.move(nbox.x + nbox.width / 2, nbox.y + nbox.height / 2);
  await page.mouse.down({ clickCount: 1 }); await page.mouse.up({ clickCount: 1 });
  await page.mouse.down({ clickCount: 2 }); await page.mouse.up({ clickCount: 2 });
  const noteEditable = await page.waitForFunction(() => document.querySelector('#fe-nt-list .fe-nt-label')?.getAttribute('contenteditable') === 'true', { timeout: 2000 }).then(() => true).catch(() => false);
  const editorClosed = await page.$eval('#fe-qlook', el => el.style.display === 'none').catch(() => false);
  check(noteEditable && editorClosed, `double-click renames a note without the editor stealing it: editable=${noteEditable} editorClosed=${editorClosed}`);
  await page.close();
} finally {
  await h.close();
}

if (fails.length) { console.error(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall workflow-fix checks passed');
