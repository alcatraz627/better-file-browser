// Ask's answers outlive the page that asked: going to another page mid-answer
// does not stop it. Come back while it runs and it carries on in its chat; stay
// away until it ends and it is in the chat's history when you return. Runs over
// a stand-in lm whose "Stream code" answer takes about two and a half seconds.
import { join } from 'node:path';
import { launch, SHOTS, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sfx = THEME === 'light' ? '-light' : '';
const h = await launch({ lmStub: true });
const last = '#fe-ask-thread .fe-ask-turn:last-of-type';
const send = async (p, text) => { await p.type('#fe-ask-q', text); await p.keyboard.press('Enter'); };
const ready = p => p.waitForFunction(() => JSON.parse(document.getElementById('fe-ask-model')?.dataset.opts || '[]').length > 1, { timeout: 15000 });
const historyOf = async path => ((await h.store.json('bfb-ask-history-v1', {}))[path] ?? []);
try {
  await h.store.set('bfb-theme', THEME);
  await h.store.set('bfb-lens-v1', 'ask');
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const readme = h.fixture + '/readme.md';
  await page.goto('file://' + readme, { waitUntil: 'load' });
  await ready(page);

  // Leave mid-answer and come straight back: the answer is still coming, in its chat.
  await send(page, 'Stream code');
  await page.waitForFunction(s => /Here/.test(document.querySelector(s + ' .fe-ask-a')?.textContent ?? ''), { timeout: 10000 }, last);
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await sleep(300);
  await page.goto('file://' + readme, { waitUntil: 'load' });
  await page.waitForFunction(s => /Stream code/.test(document.querySelector(s + ' .fe-ask-q')?.textContent ?? ''), { timeout: 8000 }, last).catch(() => null);
  const back = await page.$eval(last, t => ({ q: t.querySelector('.fe-ask-q')?.textContent, a: t.querySelector('.fe-ask-a')?.textContent ?? '', stop: document.getElementById('fe-ask-go').classList.contains('stop') })).catch(() => null);
  check(!!back && back.q === 'Stream code' && /Here/.test(back.a) && back.stop, `back on the page, the running answer is there and still going: ${JSON.stringify(back)}`);
  await page.screenshot({ path: join(SHOTS, `ask-durable-resumed${sfx}.png`), clip: { x: 0, y: 40, width: 380, height: 760 } });
  await page.waitForFunction(s => /Done\./.test(document.querySelector(s + ' .fe-ask-a')?.textContent ?? ''), { timeout: 10000 }, last).catch(() => null);
  const finished = await page.$eval(last, t => ({ a: t.querySelector('.fe-ask-a').textContent, meta: t.querySelector('.fe-ask-meta').textContent, code: !!t.querySelector('.fe-ask-a pre') }));
  check(/Done\./.test(finished.a) && finished.code && /gemma4-e4b-warm/.test(finished.meta), `it finishes in place, with its code block and its line: ${JSON.stringify(finished)}`);
  const saved1 = (await historyOf(readme)).flatMap(c => c.turns).filter(t => t.q === 'Stream code');
  check(saved1.length === 1 && /Done\./.test(saved1[0].a) && !saved1[0].stopped, `the finished answer is saved once: ${saved1.length} turn(s)`);

  // Leave mid-answer and stay away until it ends: it lands in the chat history.
  await send(page, 'Stream code');
  await page.waitForFunction(s => /Here/.test(document.querySelector(s + ' .fe-ask-a')?.textContent ?? ''), { timeout: 10000 }, last);
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await sleep(3500);
  // Any bfb page files a parked answer; this one is the folder, not the file.
  await page.reload({ waitUntil: 'load' });
  await sleep(800);
  const saved2 = (await historyOf(readme)).flatMap(c => c.turns).filter(t => t.q === 'Stream code');
  check(saved2.length === 2 && /Done\./.test(saved2[1].a) && saved2[1].tokensOut === 388, `an answer that ended while away is in the history: ${JSON.stringify(saved2.map(t => t.a.slice(-6)))}`);
  const chats = await historyOf(readme);
  check(chats.length === 1 && chats[0].turns.length === 2, `both answers are in the same chat: ${chats.length} chat(s), ${chats[0]?.turns.length} turns`);

  // Stop still stops: a stopped answer does not come back as finished later.
  await page.goto('file://' + readme, { waitUntil: 'load' });
  await ready(page);
  await send(page, 'Stream code');
  await page.waitForFunction(s => /Here/.test(document.querySelector(s + ' .fe-ask-a')?.textContent ?? ''), { timeout: 10000 }, last);
  await page.click('#fe-ask-go');
  await sleep(3200);
  await page.reload({ waitUntil: 'load' });
  await sleep(800);
  const all = (await historyOf(readme)).flatMap(c => c.turns).filter(t => t.q === 'Stream code');
  const halted = all.filter(t => t.stopped);
  check(all.length === 3 && halted.length === 1 && !/Done\./.test(halted[0].a), `Stop ends the answer for good: ${JSON.stringify(all.map(t => !!t.stopped))}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
