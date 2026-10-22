// The listing names each file's type in words and shows a saved item's tags
// as chips in the Tags column, tinted by the tag's colour.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
try {
  await h.store.set('bfb-saved-v1', [
    { path: join(h.fixture, 'readme.md'), label: 'readme', tags: ['work', 'spec'] },
    { path: join(h.fixture, 'nested') + '/', label: 'nested', tags: ['work'] },
  ]);
  await h.store.set('bfb-tags-v1', [{ name: 'work', color: '#4dabf7' }, { name: 'spec', color: '#38d9a9' }]);
  for (const theme of ['dark', 'light']) {
    const page = await h.open();
    await page.setViewport({ width: 1400, height: 700 });
    await page.waitForSelector('#fe-tbody tr[data-idx]');
    if (theme === 'light') { await page.click('#fe-theme-btn'); await page.mouse.move(700, 600); await new Promise(r => setTimeout(r, 500)); }
    const rows = await page.$$eval('#fe-tbody tr[data-idx]', trs => Object.fromEntries(trs.map(tr => [
      tr.querySelector('.fe-nm')?.textContent,
      { type: tr.querySelector('td.c-tp')?.textContent, tags: [...tr.querySelectorAll('td.c-tg .chip')].map(c => c.textContent) },
    ])));
    const head = await page.$$eval('#fe-table thead th', ths => ths.map(t => t.textContent.trim()).filter(Boolean));
    check(head.includes('Type') && head.includes('Tags'), `${theme}: header has Type and Tags: ${JSON.stringify(head)}`);
    check(rows['readme.md']?.type === 'Markdown' && rows['code.py']?.type === 'Python' && rows['nested']?.type === 'Folder',
      `${theme}: types in words: ${JSON.stringify({ md: rows['readme.md']?.type, py: rows['code.py']?.type, dir: rows['nested']?.type })}`);
    check(JSON.stringify(rows['readme.md']?.tags) === '["work","spec"]' && JSON.stringify(rows['nested']?.tags) === '["work"]' && rows['notes.txt']?.tags.length === 0,
      `${theme}: saved items show their tags as chips, others none: ${JSON.stringify({ md: rows['readme.md']?.tags, dir: rows['nested']?.tags, txt: rows['notes.txt']?.tags })}`);
    await page.screenshot({ path: join(SHOTS, `columns-${theme}.png`), clip: { x: 0, y: 0, width: 1400, height: 360 } });
    if (theme === 'dark') {
      // While the custom tooltip holds a control's title, the control keeps its name.
      const before = await page.$eval('#fe-help-btn', b => b.title);
      await page.hover('#fe-help-btn');
      const during = await page.$eval('#fe-help-btn', b => ({ title: b.getAttribute('title'), label: b.getAttribute('aria-label') }));
      check(during.title === null && during.label === before, `a hovered control keeps its name as aria-label: ${JSON.stringify(during)}`);
      await page.mouse.move(700, 600);
      const after = await page.$eval('#fe-help-btn', b => ({ title: b.getAttribute('title'), label: b.getAttribute('aria-label') }));
      check(after.title === before && after.label === null, `leaving restores the title and drops the label: ${JSON.stringify(after)}`);
    }
    await page.close();
  }
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'columns walk passes');
