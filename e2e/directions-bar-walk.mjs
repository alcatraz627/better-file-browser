// The directions bar: one soft panel of pill controls, with icon-only Doc/List
// and Overview/Full switches; switching Doc and List leaves everything above
// the bar exactly where it was; and the doc's "How to read this" section folds
// into a legend at the bar's end.
//
//   node e2e/directions-bar-walk.mjs      (--light for the light theme)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, applyTheme, shot } from './harness.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  // The standard fixture (it has a "How to read this" section) with front matter added, the shape of the docs-site plan.
  const md = readFileSync(join(ROOT, 'tests/fixtures/directions/standard.md'), 'utf8')
    .replace(/^# /m, '---\nreader: the owner\nstatus: live\n---\n\n# ');
  const doc = join(h.fixture, 'DIRECTIONS.md');
  writeFileSync(doc, md);
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('#fe-dir-layout', { timeout: 8000 });
  await sleep(300);

  // Above the bar, Doc and List are the same page.
  const above = () => page.evaluate(() => {
    const r = sel => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.height), getComputedStyle(e).display]; };
    return { fm: r('#fe-page .fe-md-fm'), h1: r('#fe-page .fe-md > h1'), head: r('.fe-dir-next'), bar: r('.fe-dir-sum') };
  });
  const inDoc = await above();
  await page.click('#fe-dir-layout [data-v="list"]'); await sleep(250);
  const inList = await above();
  check(inDoc.fm && inDoc.fm[2] !== 'none' && JSON.stringify(inDoc) === JSON.stringify(inList), `switching to List moves nothing above the bar: ${JSON.stringify({ inDoc, inList })}`);
  await page.click('#fe-dir-layout [data-v="doc"]'); await sleep(250);
  check(JSON.stringify(await above()) === JSON.stringify(inDoc), 'and switching back moves nothing either');

  // The switches are icon pills; their tooltips name them.
  const seg = await page.evaluate(() => [...document.querySelectorAll('#fe-dir-layout .fe-seg-b, #fe-dir-view .fe-seg-b')].map(b => ({ text: b.textContent.trim(), svg: !!b.querySelector('svg'), title: b.title, radius: getComputedStyle(b).borderRadius })));
  check(seg.length === 4 && seg.every(b => !b.text && b.svg && /^(Doc|List|Overview|Full):/.test(b.title)), `Doc/List and Overview/Full are icons with named tooltips: ${seg.map(b => b.title.split(':')[0]).join(', ')}`);
  const panel = await page.$eval('.fe-dir-sum', b => ({ bg: getComputedStyle(b).backgroundColor, page: getComputedStyle(document.getElementById('fe-page')).backgroundColor, radius: getComputedStyle(b).borderTopLeftRadius }));
  check(panel.bg !== 'rgba(0, 0, 0, 0)' && parseFloat(panel.radius) > 10, `the bar sits on a soft rounded panel: ${JSON.stringify(panel)}`);

  // "How to read this" is a legend, not a section.
  const guide = await page.evaluate(() => ({
    heading: [...document.querySelectorAll('#fe-page .fe-md > h2')].filter(h => h.offsetParent).map(h => h.textContent).some(t => /how to read/i.test(t)),
    toc: [...document.querySelectorAll('#fe-toc a')].some(a => /how to read/i.test(a.textContent)),
    legend: !!document.querySelector('.fe-dir-sum .fe-dir-legend'),
    shown: !!document.querySelector('.fe-dir-legend-body')?.checkVisibility(),
  }));
  check(!guide.heading && !guide.toc && guide.legend && !guide.shown, `the reading guide leaves the doc and the contents, folded into the bar: ${JSON.stringify(guide)}`);
  await page.click('.fe-dir-legend-b'); await sleep(200);
  const open = await page.$eval('.fe-dir-legend-body', b => ({ shown: b.checkVisibility(), text: b.textContent.replace(/\s+/g, ' ').trim().slice(0, 70) }));
  check(open.shown && /^How to read this\S/.test(open.text) && open.text.length > 30, `the legend opens with the doc's own words: "${open.text}"`);
  const keyShown = await page.$$eval('.fe-dir-legend-body li', ls => ls.filter(l => l.checkVisibility()).map(l => l.textContent.slice(0, 6)));
  check(keyShown.some(t => /^Marks/.test(t)) && keyShown.some(t => /^When/.test(t)), `the legend shows the marks key too: ${JSON.stringify(keyShown)}`);
  await shot(page, 'directions-bar-legend');
  await page.mouse.click(700, 700); await sleep(200);
  check(!(await page.$eval('.fe-dir-legend', d => d.open)), 'a click elsewhere closes it');
  await page.$eval('#fe-page', p => { p.scrollTop = 0; });
  await sleep(150);
  await shot(page, 'directions-bar');
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
