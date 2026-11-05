// A table or code block saved as a picture opens anywhere: the SVG is plain shapes
// and text with no embedded web page, the PNG holds real pixels, and a table copies
// as Markdown. Pass a real document to run it on that too.
//
//   node e2e/block-picture-walk.mjs [real.md] [folder for screenshots]
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, THEME } from './harness.mjs';

const [real, shots] = process.argv.slice(2);
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
const newFile = async (before, ext) => {
  for (let i = 0; i < 40; i++) {
    const got = readdirSync(h.downloads).filter(f => f.endsWith(ext) && !before.includes(f));
    if (got.length) return join(h.downloads, got[0]);
    await wait(150);
  }
  return null;
};
try {
  await h.store.set('bfb-theme', THEME);
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const menu = async (block, fmt) => {
    await page.evaluate(b => { const x = document.querySelector(b); x.scrollIntoView({ block: 'center' }); }, block);
    await page.hover(block);
    await page.$eval(`${block} .fe-blk-x`, b => b.click());
    await page.waitForSelector(`.fe-export-menu [data-fmt="${fmt}"]`);
    await page.$eval(`.fe-export-menu [data-fmt="${fmt}"]`, b => b.click());
  };
  const inspect = async (file, want) => page.evaluate(async (svg, want) => {
    const bad = new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror');
    const img = new Image();
    const drawn = await new Promise(res => { img.onload = () => res(img.naturalWidth); img.onerror = () => res(0); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
    return { wellFormed: !bad, drawn, plain: !/<foreignObject|<style|<script|xhtml/.test(svg), hasWords: want.every(w => svg.includes(w)), colours: !/oklch|color-mix|color\(/.test(svg) };
  }, readFileSync(file, 'utf8'), want);
  await h.browser.defaultBrowserContext().overridePermissions('file://', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']).catch(() => null);
  const copied = () => page.evaluate(() => navigator.clipboard.readText()).catch(() => '');

  const walkDoc = async (name, block, want) => {
    await page.goto('file://' + join(h.fixture, name), { waitUntil: 'load' });
    await page.waitForSelector(block);
    await wait(500);

    let before = readdirSync(h.downloads);
    await menu(block, 'svg');
    const svg = await newFile(before, '.svg');
    check(!!svg, `${name}: the SVG downloads`);
    if (svg) {
      const r = await inspect(svg, want);
      check(r.wellFormed && r.drawn > 0, `${name}: the SVG is well formed and draws: ${JSON.stringify({ w: r.wellFormed, d: r.drawn })}`);
      check(r.plain && r.colours, `${name}: it is plain shapes and text, in plain colours, so other apps can import it`);
      check(r.hasWords, `${name}: it holds the table's words`);
    }
    before = readdirSync(h.downloads);
    await menu(block, 'png');
    const png = await newFile(before, '.png');
    check(!!png && readFileSync(png).length > 500, `${name}: the PNG downloads with pixels in it: ${png && readFileSync(png).length}`);
    if (png && shots) copyFileSync(png, join(shots, `block-${name}-${THEME}.png`));
    await menu(block, 'md');
    await wait(200);
    return copied();
  };

  writeFileSync(join(h.fixture, 'tables.md'), '# Tables\n\n| Name | Link |\n|---|---|\n| **Alpha** & co | [site](http://example.com) |\n| `beta` | a \\| b |\n');
  const md = await walkDoc('tables.md', '.fe-md-tablewrap', ['Alpha', '&amp; co', 'beta']);
  check(md.startsWith('| Name | Link |\n| --- | --- |\n') && md.includes('| **Alpha** & co | [site](http://example.com) |') && md.includes('| `beta` | a \\| b |'), `a table copies as Markdown: ${JSON.stringify(md)}`);

  // A code block has no Markdown row, since it copies already.
  writeFileSync(join(h.fixture, 'code.md'), '# Code\n\n```js\nconst a = 1;\n```\n');
  await page.goto('file://' + join(h.fixture, 'code.md'), { waitUntil: 'load' });
  await page.waitForSelector('.fe-md-code');
  await wait(400);
  await page.hover('.fe-md-code');
  await page.$eval('.fe-md-code .fe-blk-x', b => b.click());
  await page.waitForSelector('.fe-export-menu');
  check(!(await page.$('.fe-export-menu [data-fmt="md"]')), 'a code block offers pictures only');
  await page.keyboard.press('Escape');

  if (real) {
    copyFileSync(real, join(h.fixture, 'real.md'));
    const out = await walkDoc('real.md', '.fe-md-tablewrap', []);
    check(out.split('\n')[1]?.startsWith('| ---'), `the real document's table copies as Markdown: ${JSON.stringify(out.slice(0, 80))}`);
    if (shots) await page.screenshot({ path: join(shots, `block-real-page-${THEME}.png`) });
  }
} finally {
  for (const r of results) console.log(r);
  console.log(`${results.filter(r => r.startsWith('PASS')).length} pass, ${results.filter(r => r.startsWith('FAIL')).length} fail`);
  await h.close();
}
