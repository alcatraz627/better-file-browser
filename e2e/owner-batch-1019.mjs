// Walks the owner's 2026-10-19 reports on real documents: bare links,
// highlighting in markdown fences and raw JSON, the contents in the sidebar,
// HTML as a page in the preview, and tab switching that keeps the open doc.
// Runs both themes; screenshots land in e2e/shots/owner-*.png.
import assert from 'node:assert/strict';
import { copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const SAMPLES = {
  'bot-landscape.md': '/Users/alcatraz627/Code/Versable/slack-automation/.claude/output/20261016-clanky-plan/bot-landscape.md',
  'rithum.md': '/Users/alcatraz627/Code/Versable/sor/notes/20261015-rithum-integration-hub.md',
  'cards.json': '/Users/alcatraz627/Code/Versable/slack-automation/docs/plan/2026-10-16-clanky-next/cards/cards.json',
};

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
try {
  for (const [name, src] of Object.entries(SAMPLES)) {
    if (existsSync(src)) copyFileSync(src, join(h.fixture, name));
    else writeFileSync(join(h.fixture, name), name.endsWith('.json') ? '{"a": "https://x.com", "n": 1}' : '# Sample\n\nhttps://example.com\n\n```sql\nSELECT 1;\n```\n');
  }
  writeFileSync(join(h.fixture, 'page.html'), '<!doctype html><h1 style="color:#c00">Rendered heading</h1><p id="js"></p><script>document.getElementById("js").textContent = "script ran"</script>');

  for (const theme of ['dark', 'light']) {
    const page = await h.browser.newPage();
    await page.goto('file://' + join(h.fixture, 'bot-landscape.md'), { waitUntil: 'load' });
    await page.evaluate(t => localStorage.setItem('bfb-theme', t), theme);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#fe-page .fe-md');

    const web = await page.$$eval('#fe-page .fe-md a[href^="http"]', a => a.length);
    const inTables = await page.$$eval('#fe-page .fe-md td a[href^="http"]', a => a.length);
    check(web > 40 && inTables > 10, `${theme}: bare URLs are links (${web} total, ${inTables} in table cells)`);
    const toc = await page.$$eval('#fe-side-toc #fe-toc a', a => a.length);
    const tocBox = await page.$eval('#fe-side-toc', el => { const r = el.getBoundingClientRect(); return { h: Math.round(r.height), side: Math.round(el.parentElement.getBoundingClientRect().height) }; });
    check(toc > 3 && tocBox.h <= tocBox.side / 2 + 2, `${theme}: contents sit in the sidebar's top half (${toc} rows, ${tocBox.h}px of ${tocBox.side}px)`);
    await page.screenshot({ path: join(SHOTS, `owner-links-toc-${theme}.png`) });

    await page.goto('file://' + join(h.fixture, 'rithum.md'), { waitUntil: 'load' });
    await page.waitForSelector('#fe-page .fe-md-pre');
    const sql = await page.$$eval('#fe-page .fe-md-pre .tok-kw-ctrl', s => s.map(x => x.textContent));
    const http = await page.$$eval('#fe-page .fe-md-pre .tok-key', s => s.length);
    check(sql.includes('SELECT') && http > 0, `${theme}: uppercase SQL and http fences are coloured (${sql.slice(0, 4).join(',')}; ${http} keys)`);
    await page.evaluate(() => [...document.querySelectorAll('#fe-page .fe-md-lang')].find(x => x.textContent === 'sql')?.scrollIntoView());
    await page.screenshot({ path: join(SHOTS, `owner-highlight-${theme}.png`) });

    await page.goto('file://' + join(h.fixture, 'cards.json'), { waitUntil: 'load' });
    await page.waitForSelector('#fe-fp-raw');
    await page.click('#fe-fp-raw');
    const keys = await page.$$eval('#fe-page .tok-key', s => s.length);
    check(keys > 3, `${theme}: raw JSON is coloured (${keys} keys)`);
    await page.screenshot({ path: join(SHOTS, `owner-json-raw-${theme}.png`) });
    await page.click('#fe-fp-raw');

    await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
    await page.waitForSelector('#fe-tbody');
    await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="page.html"]) td.c-nm')).click();
    await page.waitForSelector('#fe-ql-body iframe.fe-ql-html');
    const frame = await (await page.$('#fe-ql-body iframe.fe-ql-html')).contentFrame();
    await frame.waitForFunction(() => document.getElementById('js')?.textContent === 'script ran', { timeout: 3000 }).catch(() => null);
    const inFrame = await frame.evaluate(() => ({ h1: document.querySelector('h1')?.textContent, js: document.getElementById('js')?.textContent }));
    check(inFrame.h1 === 'Rendered heading' && inFrame.js === 'script ran', `${theme}: HTML previews as a page (${JSON.stringify(inFrame)})`);
    await page.screenshot({ path: join(SHOTS, `owner-html-preview-${theme}.png`) });
    await page.click('.fe-ql-htmlbar [data-v="src"]');
    const src = await page.$$eval('#fe-ql-body .fe-code .tok-type', s => s.length);
    check(src > 0, `${theme}: Source shows highlighted markup`);
    await page.click('.fe-ql-htmlbar [data-v="page"]');
    await page.close();
  }

  // Tabs: a fresh Chrome tab no longer pulls in another tab's strip, and
  // switching away from an unkept doc keeps it.
  const a = await h.browser.newPage();
  await a.goto('file://' + join(h.fixture, 'notes.txt'), { waitUntil: 'load' });
  await a.waitForSelector('#fe-tabs');
  await a.keyboard.press('t');
  await a.goto('file://' + join(h.fixture, 'code.py'), { waitUntil: 'load' });
  await a.waitForSelector('#fe-tabs');
  await a.keyboard.press('t');
  await a.close();
  await new Promise(r => setTimeout(r, 3000));

  const b = await h.browser.newPage();
  await b.goto('file://' + join(h.fixture, 'rithum.md'), { waitUntil: 'load' });
  await b.waitForSelector('#fe-tabs');
  await new Promise(r => setTimeout(r, 1500));
  const strip = await b.$$eval('#fe-tabs .fe-tab', t => t.map(x => x.textContent.trim()));
  check(strip.length === 1, `fresh tab shows only the doc opened, no restored strip (${JSON.stringify(strip)})`);
  const recent = await b.$$eval('#fe-side [data-sec="recent"] .fe-sl', s => s.map(x => x.textContent));
  check(recent.includes('notes.txt') && recent.includes('code.py'), `Recent lists files opened lately (${JSON.stringify(recent)})`);

  await b.goto('file://' + join(h.fixture, 'script.sh'), { waitUntil: 'load' });
  await b.waitForSelector('#fe-tabs');
  await b.keyboard.press('t');
  await b.goto('file://' + join(h.fixture, 'rithum.md'), { waitUntil: 'load' });
  await b.waitForSelector('#fe-tabs .fe-tab');
  const kept = await b.$$('#fe-tabs .fe-tab[data-id]:not([data-id=""])');
  await Promise.all([b.waitForNavigation({ waitUntil: 'load' }), kept[0].click()]);
  await b.waitForSelector('#fe-tabs .fe-tab');
  const after = await b.$$eval('#fe-tabs .fe-tab', t => t.map(x => x.textContent.trim()));
  check(after.some(x => x.includes('rithum')), `switching tabs keeps the doc you were on (${JSON.stringify(after)})`);
  await b.screenshot({ path: join(SHOTS, 'owner-tabs-dark.png') });
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.length && results.every(r => r.startsWith('PASS')), 'all owner-batch checks pass');
