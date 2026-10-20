// Formats: a file with mistakes still renders, a quiet strip lists the
// problems and each one opens the source at its line; JSON with comments is a
// warning, not an error; an HTML file edits with its page drawn beside it in
// a frame that runs no scripts.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, SHOTS } from './harness.mjs';

const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  writeFileSync(join(h.fixture, 'broken.json'), '{\n  "name": "demo",\n  "list": [1, 2,\n  "x": 3\n}\n');
  writeFileSync(join(h.fixture, 'tsconfig.json'), '{\n  // strict mode\n  "strict": true,\n}\n');
  writeFileSync(join(h.fixture, 'notes.md'), '# One\n\n### Three\n\n```js\nopen fence\n');
  writeFileSync(join(h.fixture, 'page.html'), '<html><body>\n<h1>Hello</h1>\n<div><span>a</div>\n<script>document.body.dataset.ran = "yes"; window.ownRan = 1</script>\n</body></html>\n');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture], excludedFileExtensions: ['pdf'] }));
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));

  await page.goto('file://' + join(h.fixture, 'broken.json'), { waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-diag', { timeout: 6000 }).catch(() => null);
  const strip = await page.evaluate(() => ({ head: document.querySelector('.fe-diag > summary')?.textContent, line: document.querySelector('.fe-diag-row')?.dataset.line, body: !!document.querySelector('#fe-page .fe-code, #fe-page .fe-jt-root') }));
  check(strip.head === '1 error' && strip.line === '4' && strip.body, `broken JSON still shows its text and one error on line 4: ${JSON.stringify(strip)}`);
  await page.screenshot({ path: join(SHOTS, 'formats-json-error.png'), clip: { x: 290, y: 50, width: 1100, height: 420 } });
  await page.click('.fe-diag-row');
  await sleep(200);
  const jumped = await page.evaluate(() => ({ raw: document.getElementById('fe-fp-raw').classList.contains('on'), marked: [...document.querySelectorAll('.fe-cl')].map((r, i) => r.classList.contains('err') ? i + 1 : 0).filter(Boolean) }));
  check(jumped.raw && jumped.marked.join() === '4', `its line number opens the source with line 4 marked: ${JSON.stringify(jumped)}`);

  await page.goto('file://' + join(h.fixture, 'tsconfig.json'), { waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-diag', { timeout: 6000 }).catch(() => null);
  const ts = await page.evaluate(() => ({ cls: document.querySelector('.fe-diag')?.className, head: document.querySelector('.fe-diag > summary')?.textContent }));
  check(/warn/.test(ts.cls ?? '') && ts.head === '1 warning', `JSON with comments is a warning: ${JSON.stringify(ts)}`);

  await page.goto('file://' + join(h.fixture, 'notes.md'), { waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-diag', { timeout: 6000 }).catch(() => null);
  const md = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.fe-diag-row')].map(r => r.dataset.line), h1: document.querySelector('#fe-page .fe-md h1')?.textContent }));
  check(md.rows.join() === '3,5' && md.h1 === 'One', `Markdown renders and lists the skipped heading and the open code block: ${JSON.stringify(md)}`);

  await page.goto('file://' + join(h.fixture, 'page.html'), { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-edit', { timeout: 6000 });
  const own = await page.evaluate(() => ({ ran: window.ownRan ?? null, page: !!document.querySelector('#fe.fe-file-page') }));
  check(own.ran === null && own.page,`an HTML file the explorer takes over runs none of its own scripts: ${JSON.stringify(own)}`);
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-fe-ta');
  await page.click('#fe-fe-pill [data-mode="split"]');
  await page.waitForSelector('#fe-fe-view iframe.fe-html-frame');
  await sleep(400);
  const frame = await page.$('#fe-fe-view iframe.fe-html-frame');
  const inner = await (await frame.contentFrame()).evaluate(() => ({ h1: document.querySelector('h1')?.textContent, ran: document.body.dataset.ran ?? null }));
  const marks = await page.evaluate(() => ({ pill: document.getElementById('fe-fe-diag').textContent, rows: [...document.querySelectorAll('#fe-fe-paint .fe-fe-row')].map((r, i) => r.classList.contains('warn') || r.classList.contains('err') ? i + 1 : 0).filter(Boolean) }));
  check(inner.h1 === 'Hello' && inner.ran === null, `HTML Split draws the page and runs none of its scripts: ${JSON.stringify(inner)}`);
  check(marks.rows.includes(3), `the span closed by </div> is marked on line 3: ${JSON.stringify(marks)}`);
  await page.screenshot({ path: join(SHOTS, 'formats-html-split.png') });
  await page.click('#fe-fe-pill [data-mode="raw"]');
  await page.click('#fe-fe-pill [data-act="done"]');
} finally {
  console.log(results.join('\n'));
  await h.close();
}
