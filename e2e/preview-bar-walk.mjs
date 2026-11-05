// The preview's bars: icons with tooltips, dividers between groups, Open in app as a
// split button listing the other ways to open it, and an HTML page's Page and Source
// switch in the header, where it stays while the source scrolls.
//
//   node e2e/preview-bar-walk.mjs [folder for screenshots]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const shots = process.argv[2];
const h = await launch();
try {
  await h.store.set('bfb-theme', THEME);
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  writeFileSync(join(h.fixture, 'pic.png'), Buffer.from(png, 'base64'));
  writeFileSync(join(h.fixture, 'page.html'), `<!doctype html>\n<html>\n<head>\n<style>\n.card { color: #fff; margin: 12px; }\n</style>\n</head>\n<body>\n${'<p>line</p>\n'.repeat(200)}</body>\n</html>\n`);
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const snap = async name => { if (shots) { await wait(300); await page.screenshot({ path: join(shots, `${name}-${THEME}.png`) }); } };
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr');
  await wait(300);
  const peek = async name => {
    await page.evaluate(n => [...document.querySelectorAll('#fe-tbody tr')].find(r => r.textContent.includes(n)).querySelector('a')?.click(), name);
    await wait(500);
  };
  const iconOnly = sel => page.$$eval(`${sel} .btn`, bs => bs.filter(b => b.checkVisibility()).map(b => ({ t: b.textContent.trim(), tip: !!(b.title || b.getAttribute('aria-label')), svg: !!b.querySelector('svg') })).filter(b => b.t || !b.tip || !b.svg));
  const seps = sel => page.$$eval(`${sel} .bar-sep`, s => s.filter(x => x.checkVisibility()).length);

  await peek('readme.md');
  check((await iconOnly('#fe-ql-hdr')).length === 0, 'every header button is an icon with a tooltip');
  check(await seps('#fe-ql-hdr') >= 2, 'dividers sit between the header groups');
  check(await page.$eval('#fe-ql-app', b => b.checkVisibility()) && await page.$eval('#fe-ql-app-more', b => b.checkVisibility()), 'a text file has Open in app as a split button in the header');
  check(await page.$eval('#fe-ql-modes', m => m.hidden), 'a file with no modes shows no switch');
  await page.click('#fe-ql-app-more');
  await page.waitForSelector('.fe-export-menu [data-act="ow:zed"]');
  const rows = await page.$$eval('.fe-export-menu .fe-ctx-item', r => r.map(x => x.textContent));
  check(rows.some(t => /Finder/.test(t)) && rows.some(t => /VS Code/.test(t)) && rows.some(t => /bash/i.test(t)), `its arrow lists the other ways to open it: ${rows.join(', ')}`);
  await snap('preview-text');
  await page.keyboard.press('Escape');
  await wait(100);

  await peek('pic.png');
  const imgBad = await iconOnly('.fe-ql-imgbar');
  check(imgBad.length === 0, `the picture bar is icons with tooltips: ${JSON.stringify(imgBad)}`);
  check(await seps('.fe-ql-imgbar') === 3, 'dividers set apart zoom, transform, copy and open');
  check(!(await page.$eval('#fe-ql-app-group', g => g.checkVisibility())), 'a picture has one Open button, in its own bar');
  await page.click('[data-img="open-more"]');
  await page.waitForSelector('.fe-export-menu [data-act="ow:finder"]');
  check(true, 'the picture bar\'s arrow lists the other ways to open it');
  await snap('preview-image');
  await page.keyboard.press('Escape');
  await wait(100);

  await peek('page.html');
  check(await page.$eval('#fe-ql-modes', m => !m.hidden && m.querySelectorAll('button svg').length === 2), 'an HTML page has Page and Source as icons in the header');
  await page.click('#fe-ql-modes [data-v="src"]');
  await wait(300);
  await page.$eval('#fe-ql-body', b => { b.scrollTop = 2000; });
  await wait(100);
  const stay = await page.evaluate(() => {
    const m = document.getElementById('fe-ql-modes').getBoundingClientRect(), h = document.getElementById('fe-ql-hdr').getBoundingClientRect();
    return { inside: m.top >= h.top && m.bottom <= h.bottom, scrolled: document.getElementById('fe-ql-body').scrollTop > 0 || [...document.querySelectorAll('#fe-ql-body *')].some(e => e.scrollTop > 0) };
  });
  check(stay.inside, `the switch stays in the header while the source scrolls: ${JSON.stringify(stay)}`);
  const colours = await page.$eval('#fe-ql-body', b => ({ key: [...b.querySelectorAll('.tok-key')].some(k => k.textContent === 'color'), num: [...b.querySelectorAll('.tok-num')].some(k => k.textContent === '#fff') }));
  check(colours.key && colours.num, `CSS inside the page's source is coloured as CSS: ${JSON.stringify(colours)}`);
  await page.$eval('#fe-ql-body', b => { b.scrollTop = 0; });
  await snap('preview-html');
  await page.click('#fe-ql-modes [data-v="page"]');
  await wait(300);
  check(!!(await page.$('#fe-ql-body iframe.fe-ql-html')), 'Page shows the page again');
  await peek('readme.md');
  check(await page.$eval('#fe-ql-modes', m => m.hidden), 'the switch leaves with the HTML file');
} finally {
  for (const r of results) console.log(r);
  console.log(`${results.filter(r => r.startsWith('PASS')).length} pass, ${results.filter(r => r.startsWith('FAIL')).length} fail`);
  await h.close();
}
