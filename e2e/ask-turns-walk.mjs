// Ask's answers say what they cost and how they ended: the line under each
// names the model, tokens in and out and the time; an answer that fails says
// why with Retry, and stays in the chat's history; a stopped answer keeps the
// model that gave it; and an answer streams as markdown, so a code block is a
// code block before it ends. Runs over a stand-in lm.
import { join } from 'node:path';
import { launch, SHOTS, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sfx = THEME === 'light' ? '-light' : '';
const h = await launch({ lmStub: true });
const last = '#fe-ask-thread .fe-ask-turn:last-of-type';
const send = async (p, text) => { await p.type('#fe-ask-q', text); await p.keyboard.press('Enter'); };
try {
  await h.store.set('bfb-theme', THEME);
  await h.store.set('bfb-lens-v1', 'ask');
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await page.waitForFunction(() => JSON.parse(document.getElementById('fe-ask-model')?.dataset.opts || '[]').length > 1, { timeout: 15000 });

  await send(page, 'What is this file?');
  await page.waitForFunction(s => document.querySelector(s + ' .fe-ask-meta')?.textContent, { timeout: 10000 }, last);
  const meta = await page.$eval(last + ' .fe-ask-meta', m => m.textContent);
  check(meta === 'gemma4-e4b-warm · in 1,204 · out 388 · 1.2s', `the line under an answer names model, tokens and time: ${meta}`);

  // Mid-stream, the open code fence already draws as a code block.
  await send(page, 'Stream code');
  await page.waitForFunction(s => /const a/.test(document.querySelector(s + ' .fe-ask-a')?.textContent ?? ''), { timeout: 10000 }, last);
  const mid = await page.$eval(last + ' .fe-ask-a', a => ({ pre: !!a.querySelector('pre'), ticks: a.textContent.includes('```') }));
  check(mid.pre && !mid.ticks, `while it streams, an open code block draws as code: ${JSON.stringify(mid)}`);
  await page.screenshot({ path: join(SHOTS, `ask-streaming-code${sfx}.png`), clip: { x: 0, y: 40, width: 380, height: 760 } });

  // Stop it before it ends: the real model stays on the answer.
  await page.click('#fe-ask-go'); await sleep(200);
  const stoppedMeta = await page.$eval(last + ' .fe-ask-meta', m => m.textContent);
  check(/^gemma4-e4b-warm · .*stopped$/.test(stoppedMeta), `a stopped answer keeps its model: ${stoppedMeta}`);

  await send(page, 'Fail please');
  await page.waitForSelector(last + ' .fe-ask-err', { timeout: 10000 });
  const err = await page.$eval(last + ' .fe-ask-err', e => e.textContent.trim());
  check(/took too long/.test(err) && /Retry/.test(err), `a failed answer says why and offers Retry: ${err}`);
  await page.screenshot({ path: join(SHOTS, `ask-error${sfx}.png`), clip: { x: 0, y: 40, width: 380, height: 760 } });
  const before = await page.$$eval('#fe-ask-thread .fe-ask-turn', t => t.length);
  await page.click(last + ' [data-act="retry"]');
  await page.waitForFunction(n => document.querySelectorAll('#fe-ask-thread .fe-ask-turn').length > n, { timeout: 10000 }, before);
  await page.waitForSelector(last + ' .fe-ask-err', { timeout: 10000 });
  const retried = await page.$eval(last + ' .fe-ask-q', q => q.textContent);
  check(retried === 'Fail please', `Retry asks the same question again: ${retried}`);

  // Reopened from history, the failure and the stop still show as they were.
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-ask-hist-btn');
  await page.click('#fe-ask-hist-btn');
  await page.click('#fe-ask-hist .fe-ask-h-open'); await sleep(200);
  const back = await page.$$eval('#fe-ask-thread .fe-ask-turn', ts => ts.map(t => t.querySelector('.fe-ask-err') ? 'error' : t.querySelector('.fe-ask-meta').textContent));
  check(back.length === 4 && back[2] === 'error' && back[3] === 'error' &&/stopped$/.test(back[1]) && /in 1,204/.test(back[0]), `history keeps each turn as it ended: ${JSON.stringify(back)}`);
  const sent = h.lmCalls().filter(c => c.args[0] === 'q').at(-1);
  check(!/Fail please\nA:/.test(sent?.args.at(-1) ?? ''), 'a failed turn is not sent as part of the chat so far');
} finally {
  for (const r of results) console.log(r);
  await h.close();
}
