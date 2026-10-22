// One fixture of each kind, drawn on the file page and in the preview: both
// go through renderFile, so they agree except where a host differs on
// purpose (HTML live in the preview, source on the page; bad JSON explained
// inline in the preview, by the problems strip on the page; JSONC is code in both).
//   node e2e/renderers-walk.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };

// What a rendered body holds, by kind.
const look = (page, sel) => page.$eval(sel, b => ({
  md: b.querySelectorAll('.fe-md').length,
  nestedMd: b.querySelectorAll('.fe-md .fe-md').length,
  tree: b.querySelectorAll('.fe-jt-root').length > 0,
  jsonl: b.querySelectorAll('.fe-jl-line').length > 0,
  table: b.querySelectorAll('table').length > 0,
  code: b.querySelectorAll('.fe-code').length > 0,
  frame: b.querySelectorAll('iframe').length > 0,
  note: b.querySelectorAll('.fe-ql-note').length > 0,
})).catch(() => null);

const FIX = {
  'r.md': '# Title\n\nSome words.\n',
  'r.json': '{"a": 1, "b": [1, 2]}\n',
  'r.jsonc': '{\n  // a comment\n  "a": 1,\n}\n',
  'bad.json': '{"a": 1,}\n',
  'r.jsonl': '{"a":1}\n{"a":2}\n',
  'r.yaml': 'a: 1\nb: [x, y]\n',
  'r.csv': 'h1,h2\n1,2\n',
  'r.py': 'x = 1\n',
  'r.html': '<!doctype html><title>t</title><p>hi</p>\n',
  'empty.txt': '',
};
// What each host should show; the two differ only where noted.
const WANT = {
  'r.md': { page: { md: 1 }, preview: { md: 1 } },
  'r.json': { page: { tree: true }, preview: { tree: true } },
  'r.jsonc': { page: { code: true, tree: false }, preview: { code: true, note: false } },
  'bad.json': { page: { code: true, tree: false }, preview: { code: true, note: true } },
  'r.jsonl': { page: { jsonl: true }, preview: { jsonl: true } },
  'r.yaml': { page: { tree: true }, preview: { tree: true } },
  'r.csv': { page: { table: true }, preview: { table: true } },
  'r.py': { page: { code: true }, preview: { code: true } },
  'r.html': { page: { code: true, frame: false }, preview: { frame: true } },
  'empty.txt': { page: { note: true }, preview: { note: true } },
};
for (const [n, t] of Object.entries(FIX)) writeFileSync(join(h.fixture, n), t);
const fits = (got, want) => !!got && got.nestedMd === 0 && Object.entries(want).every(([k, v]) => got[k] === v);
try {
  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  for (const name of Object.keys(FIX)) {
    // Chrome downloads some types, and shows HTML as its own page unless takeover is on;
    // the explorer reaches both through #view=, as pageHref does.
    const viewUrl = 'file://' + h.fixture + '/#view=' + name;
    if (name.endsWith('.html')) await page.goto(viewUrl, { waitUntil: 'load' });
    else await page.goto('file://' + join(h.fixture, name), { waitUntil: 'load' }).catch(() => page.goto(viewUrl, { waitUntil: 'load' }));
    await page.waitForSelector('#fe-page', { timeout: 10_000 }); await sleep(500);
    const got = await look(page, '#fe-page');
    check(fits(got, WANT[name].page), `file page draws ${name}: ${JSON.stringify(got)}`);
  }
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr[data-idx]');
  for (const name of Object.keys(FIX)) {
    await page.click(`#fe-tbody tr[data-idx]:has(a[href$="/${name}"]) td.c-sz`); await sleep(150);
    await page.keyboard.press('Space'); await sleep(700);
    const got = await look(page, '#fe-ql-body');
    check(fits(got, WANT[name].preview), `preview draws ${name}: ${JSON.stringify(got)}`);
    await page.keyboard.press('Escape'); await sleep(250);
  }
} finally { await h.close(); }
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exitCode = failed ? 1 : 0;
