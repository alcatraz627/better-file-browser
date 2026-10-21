// A narrow window keeps the side card out of the text, but the Contents and
// Comments buttons still open it, and a #comments link (from the Comments
// lens) still shows the comments. A pasted path that is not there says so in
// the path box instead of leaving the app.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, SHOTS, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sfx = THEME === 'light' ? '-light' : '';
const h = await launch();
const card = p => p.evaluate(() => {
  const r = document.getElementById('fe-toc-rail');
  const b = r.getBoundingClientRect();
  return { shown: getComputedStyle(r).display !== 'none' && b.width > 100, tab: r.dataset.tab, inView: b.right <= innerWidth && b.left >= 0 };
});
try {
  await h.store.set('bfb-theme', THEME);
  const doc = join(h.fixture, 'narrow.md');
  writeFileSync(doc, '# Narrow\n\n## One\n\nText.\n\n## Two\n\nMore text.\n');
  const page = await h.browser.newPage();
  await page.setViewport({ width: 700, height: 800 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-toc');
  await sleep(300);
  check(!(await card(page)).shown, 'at 700px the card stays out of the text until asked');
  await page.click('#fe-fp-toc');
  await sleep(300);
  const toc = await card(page);
  check(toc.shown && toc.tab === 'toc' && toc.inView, `the Contents button opens it over the text: ${JSON.stringify(toc)}`);
  await page.click('#fe-fp-cm');
  await sleep(300);
  const cm = await card(page);
  check(cm.shown && cm.tab === 'cm', `the Comments button switches it to comments: ${JSON.stringify(cm)}`);
  await page.screenshot({ path: join(SHOTS, `narrow-card${sfx}.png`) });
  await page.click('#fe-fp-cm');
  await sleep(300);
  check(!(await card(page)).shown, 'pressing it again puts it away');

  await page.goto('file://' + doc + '#comments', { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-cm');
  await sleep(600);
  const linked = await card(page);
  check(linked.shown && linked.tab === 'cm', `a #comments link on the same page shows the comments at 700px: ${JSON.stringify(linked)}`);
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.goto('file://' + doc + '#comments', { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-cm');
  await sleep(600);
  const loaded = await card(page);
  check(loaded.shown && loaded.tab === 'cm', `a #comments link from another page shows them too: ${JSON.stringify(loaded)}`);

  await page.setViewport({ width: 1400, height: 800 });
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-open-path');
  await page.click('#fe-open-path');
  await page.waitForSelector('#fe-goto input');
  await page.$eval('#fe-goto input', i => { i.value = ''; });
  await page.type('#fe-goto input', h.fixture + '/no-such-file.md');
  await page.keyboard.press('Enter');
  await sleep(800);
  const msg = await page.$eval('#fe-goto .fe-goto-msg', m => ({ shown: !m.hidden, text: m.textContent })).catch(() => null);
  check(page.url().startsWith('file://') && msg?.shown && /Nothing at/.test(msg.text), `a path that is not there says so and stays in the app: ${JSON.stringify(msg)}`);
  await page.$eval('#fe-goto input', i => { i.value = ''; });
  await page.type('#fe-goto input', h.fixture + '/narrow.md');
  await Promise.all([page.waitForNavigation({ timeout: 6000 }).catch(() => null), page.keyboard.press('Enter')]);
  check(decodeURIComponent(page.url()).endsWith('/narrow.md'), `a path that is there still opens: ${page.url()}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'narrow card walk passes');
