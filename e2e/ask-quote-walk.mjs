// Ask, beyond the question: a model's thinking folds into one row above its
// answer, an answer or one part of it can be copied, and quoted into this
// chat or into another file's chat, by button or by q. Runs over a stand-in lm.
import { join } from 'node:path';
import { launch, SHOTS, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sfx = THEME === 'light' ? '-light' : '';
const h = await launch({ lmStub: true });
const ready = p => p.waitForFunction(() => JSON.parse(document.getElementById('fe-ask-model')?.dataset.opts || '[]').length > 1, { timeout: 15000 }).catch(() => null);
const askIt = async (p, text) => {
  const n = await p.$$eval('#fe-ask-thread .fe-ask-turn', ts => ts.length);
  await p.type('#fe-ask-q', text);
  await p.keyboard.press('Enter');
  await p.waitForFunction(k => { const ts = document.querySelectorAll('#fe-ask-thread .fe-ask-turn'); return ts.length > k && ts[ts.length - 1].querySelector('.fe-ask-meta').textContent; }, { timeout: 15000 }, n).catch(() => null);
};
const menuRows = p => p.$$eval('.fe-ask-qmenu .fe-ctx-item', rs => rs.map(r => r.querySelector('span span').textContent));
try {
  await h.store.set('bfb-theme', THEME);
  await h.store.set('bfb-lens-v1', 'ask');
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // A chat about code.py, kept as a tab, so there is another chat to quote into.
  await page.goto('file://' + h.fixture + '/code.py', { waitUntil: 'load' });
  await ready(page);
  await askIt(page, 'What is this file?');
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('t'); await sleep(200);

  await page.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await ready(page);
  await askIt(page, 'Show your thinking');
  const think = await page.$eval('#fe-ask-thread .fe-ask-turn:last-of-type', t => ({
    row: t.querySelector('.fe-ask-think summary')?.textContent.replace(/\s+/g, ' ').trim(),
    open: t.querySelector('.fe-ask-think')?.open,
    items: [...t.querySelectorAll('.fe-ask-a > .fe-md > ul li')].map(li => li.textContent),
  }));
  check(/Thought it through/.test(think.row ?? '') && /5 words/.test(think.row ?? '') && think.open === false,
    `thinking folds into one closed row with its word count: ${JSON.stringify(think)}`);
  check(think.items.join('|') === 'point one|point two', `the answer after the thinking renders as markdown: ${think.items}`);
  await page.click('#fe-ask-thread .fe-ask-turn:last-of-type .fe-ask-think summary'); await sleep(150);
  const shown = await page.$eval('#fe-ask-thread .fe-ask-turn:last-of-type .fe-ask-think', d => ({ open: d.open, text: d.querySelector('.fe-md').textContent.trim() }));
  check(shown.open && shown.text === 'Weigh the two points first.', `clicking the row shows the thinking: ${JSON.stringify(shown)}`);
  await sleep(400);
  await page.screenshot({ path: join(SHOTS, `ask-thinking${sfx}.png`), clip: { x: 0, y: 40, width: 380, height: 760 } });

  // One part of the answer: the bar appears over the list, Quote offers this chat first.
  await page.hover('#fe-ask-thread .fe-ask-turn:last-of-type .fe-ask-a > .fe-md > ul'); await sleep(150);
  const bar = await page.$eval('.fe-ask-blk', b => !b.hidden);
  check(bar, 'hovering a part of the answer shows its Copy and Quote buttons');
  await page.click('.fe-ask-blk [data-act="quote"]'); await sleep(200);
  const rows = await menuRows(page);
  check(rows[0] === 'This chat' && rows.some(r => /code\.py/.test(r)), `Quote offers this chat, then the other file's chat: ${JSON.stringify(rows)}`);
  await page.screenshot({ path: join(SHOTS, `ask-quote-menu${sfx}.png`), clip: { x: 0, y: 40, width: 420, height: 760 } });
  await page.click('.fe-ask-qmenu .fe-ctx-item[data-i="0"]'); await sleep(150);
  const box = await page.$eval('#fe-ask-q', q => q.value);
  check(box.startsWith('> From readme.md:') && box.includes('> point one') && !box.includes('Weigh'),
    `quoting into this chat puts only that part in the box: ${JSON.stringify(box)}`);
  await page.$eval('#fe-ask-q', q => { q.value = ''; });

  // q over an answer opens the same menu; picking the other file's chat goes there with the quote.
  await page.hover('#fe-ask-thread .fe-ask-turn:last-of-type .fe-ask-q'); await sleep(100);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('q'); await sleep(200);
  const viaKey = await menuRows(page);
  check(viaKey[0] === 'This chat', `q over a turn opens the quote menu: ${JSON.stringify(viaKey)}`);
  const other = await page.$$eval('.fe-ask-qmenu .fe-ctx-item', rs => rs.findIndex(r => /code\.py/.test(r.textContent)));
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.click(`.fe-ask-qmenu .fe-ctx-item[data-i="${other}"]`)]);
  await page.waitForFunction(() => document.getElementById('fe-ask-q')?.value.startsWith('> From readme.md:'), { timeout: 5000 }).catch(() => null);
  const there = await page.evaluate(() => ({ path: location.pathname, box: document.getElementById('fe-ask-q').value, turns: document.querySelectorAll('#fe-ask-thread .fe-ask-turn').length }));
  check(there.path.endsWith('/code.py') && there.box.includes('> - point one') && there.turns === 1,
    `picking another file's chat opens it with the quote in its box: ${JSON.stringify(there)}`);
  await page.reload({ waitUntil: 'load' }); await sleep(400);
  check(await page.$eval('#fe-ask-q', q => q.value === ''), 'the quote lands once, not again on reload');

  // Copy on an answer says so.
  await page.hover('#fe-ask-thread .fe-ask-turn:last-of-type'); await sleep(100);
  await page.click('#fe-ask-thread .fe-ask-turn:last-of-type .fe-ask-acts [data-act="copy"]'); await sleep(200);
  const toast = await page.$eval('#fe-toast', t => t.textContent);
  check(/Cop(ied|y failed)/.test(toast), `Copy on an answer reports what happened: ${toast}`);
} finally {
  for (const r of results) console.log(r);
  await h.close();
}
