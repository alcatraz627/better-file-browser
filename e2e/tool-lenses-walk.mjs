// Search and Ask in the sidebar: Search finds text in this folder and its
// subfolders, with a snippet per file; Ask checks the local model when
// opened and answers, or says plainly why it cannot.
import { join } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
try {
  const page = await h.open();
  const rail = await page.$$eval('#fe-rail .fe-rail-btn:not([hidden]) em', es => es.map(e => e.textContent));
  check(rail.join() === 'Places,Notes,History,Search,Ask', `the rail lists five lenses: ${rail}`);

  await page.click('#fe-rail-search');
  await page.waitForFunction(() => document.activeElement?.id === 'fe-srch-q', { timeout: 2000 }).catch(() => null);
  check(await page.evaluate(() => document.activeElement?.id === 'fe-srch-q'), 'opening Search puts the cursor in its box');
  await page.type('#fe-srch-q', 'inner');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /match/.test(document.getElementById('fe-srch-status').textContent), { timeout: 8000 }).catch(() => null);
  const deep = await page.evaluate(() => ({ status: document.getElementById('fe-srch-status').textContent, hits: [...document.querySelectorAll('.fe-srch-hit .fe-sl')].map(e => e.textContent), mark: document.querySelector('.fe-srch-snip mark')?.textContent }));
  check(deep.hits.includes('nested/inner.txt') && deep.mark === 'inner', `Search reaches subfolders and marks the match: ${JSON.stringify(deep)}`);
  const row = await page.$eval('.fe-srch-hit', e => { const s = getComputedStyle(e); return { r: parseFloat(s.borderTopLeftRadius), pad: parseFloat(s.paddingLeft) }; });
  check(row.r === 8 && row.pad === 10, `results use the shared row: ${JSON.stringify(row)}`);
  await page.screenshot({ path: join(SHOTS, 'lens-search.png'), clip: { x: 0, y: 40, width: 520, height: 420 } });
  await page.click('#fe-srch-deep');
  await page.focus('#fe-srch-q');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /No file|match/.test(document.getElementById('fe-srch-status').textContent) && !/Searching/.test(document.getElementById('fe-srch-status').textContent), { timeout: 8000 }).catch(() => null);
  const shallow = await page.$eval('#fe-srch-status', e => e.textContent);
  check(/No file here contains "inner"/.test(shallow), `without subfolders it says nothing here matches: ${shallow}`);

  await page.click('#fe-rail-ask');
  await page.waitForFunction(() => !/Not checked|Checking/.test(document.getElementById('fe-ask-state').textContent), { timeout: 8000 }).catch(() => null);
  const st = await page.evaluate(() => ({ state: document.getElementById('fe-ask-state').textContent, cls: document.getElementById('fe-ask-status').className, about: document.querySelector('.fe-ask-about').textContent }));
  check(st.state.length > 5 && !/Checking/.test(st.state) && /this folder/.test(st.about), `Ask checks the model on open and says what it is about: ${JSON.stringify(st)}`);
  await page.type('#fe-ask-q', 'What is here?');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => { const a = document.querySelector('.fe-ask-a'); return a && !/Thinking/.test(a.textContent); }, { timeout: 15000 }).catch(() => null);
  const ans = await page.evaluate(() => ({ q: document.querySelector('.fe-ask-q')?.textContent, a: document.querySelector('.fe-ask-a')?.textContent, btn: document.getElementById('fe-ask-go').textContent }));
  check(ans.q === 'What is here?' && ans.a && ans.a.length > 5 && ans.btn === 'Ask', `a question gets an answer or a plain reason, and the button returns to Ask: ${JSON.stringify(ans)}`);
  await page.screenshot({ path: join(SHOTS, 'lens-ask.png'), clip: { x: 0, y: 40, width: 520, height: 520 } });
} finally {
  console.log(results.join('\n'));
  await h.close();
}
