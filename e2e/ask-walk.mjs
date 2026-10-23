// Ask: the model picker lists the local models by their lm alias and the
// Gemini models, says plainly when Gemini would read the file on Google's
// servers, keeps each chat about a file, carries the chat into a follow-up,
// and lists earlier chats to reopen or delete. Runs over a stand-in lm.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { launch, SHOTS, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sfx = THEME === 'light' ? '-light' : '';
const h = await launch({ lmStub: true });
const lastAnswer = p => p.$$eval('#fe-ask-thread .fe-ask-turn', ts => ts.length ? { a: ts.at(-1).querySelector('.fe-ask-a').textContent.trim(), meta: ts.at(-1).querySelector('.fe-ask-meta').textContent } : null);
// The model picker is a dropdown: open it and click the option.
const pickModel = async (p, v) => {
  await p.$eval('#fe-ask-model .fe-dd-btn', b => b.click());
  await p.waitForSelector(`.fe-dd-list [data-v="${v}"]`, { timeout: 3000 });
  await p.$eval(`.fe-dd-list [data-v="${v}"]`, o => o.click());
};
const askIt = async (p, text) => {
  await p.type('#fe-ask-q', text);
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => { const m = [...document.querySelectorAll('#fe-ask-thread .fe-ask-meta')].at(-1); return m && m.textContent; }, { timeout: 15000 }).catch(() => null);
  return lastAnswer(p);
};
try {
  await h.store.set('bfb-theme', THEME);
  await h.store.set('bfb-lens-v1', 'ask');
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await page.waitForSelector('#fe-ask-model');
  await page.waitForFunction(() => JSON.parse(document.getElementById('fe-ask-model').dataset.opts || '[]').length > 1, { timeout: 15000 }).catch(() => null);
  const opts = await page.$eval('#fe-ask-model', dd => {
    const groups = [];
    for (const o of JSON.parse(dd.dataset.opts)) if (o.group) { if (groups.at(-1)?.label !== o.group) groups.push({ label: o.group, opts: [] }); groups.at(-1).opts.push(o.value); }
    return groups;
  });
  check(opts.length === 2 && opts[0].opts.join() === 'small,big,code' && opts[1].opts.join() === 'gemini:gemini-3.8-flash,gemini:gemini-3.5-flash',
    `the picker lists the lm aliases and the Gemini models: ${JSON.stringify(opts)}`);
  check(await page.$eval('#fe-ask-cloud', c => c.hidden), 'no cloud note while a local model is picked');

  const one = await askIt(page, 'What is this file?');
  check(/Local answer from/.test(one?.a ?? ''), `a local model answers: ${JSON.stringify(one)}`);
  const two = await askIt(page, 'And the list?');
  check(/Seen the chat so far/.test(two?.a ?? ''), `a follow-up carries the chat so far: ${two?.a}`);

  await pickModel(page, 'big');
  const big = await askIt(page, 'Think harder');
  check(/from big/.test(big?.a ?? ''), `the big alias goes to lm as -m big: ${big?.a}`);

  await pickModel(page, 'gemini:gemini-3.5-flash');
  await page.$eval('#fe-ask-model .fe-dd-btn', b => b.click()); await sleep(200);
  const heads = await page.$$eval('.fe-dd-list .fe-dd-g', gs => gs.map(g => g.textContent));
  check(heads.length === 2 && /machine/.test(heads[0]) && /Gemini/.test(heads[1]), `the open list names its two groups: ${JSON.stringify(heads)}`);
  await page.screenshot({ path: join(SHOTS, `ask-model-list${sfx}.png`), clip: { x: 0, y: 40, width: 360, height: 420 } });
  await page.keyboard.press('Escape'); await sleep(150);
  const cloud = await page.$eval('#fe-ask-cloud', c => ({ shown: !c.hidden, text: c.textContent.trim() }));
  check(cloud.shown && /Google/.test(cloud.text), `picking Gemini says the text goes to Google: ${cloud.text}`);
  await page.screenshot({ path: join(SHOTS, `ask-gemini${sfx}.png`), clip: { x: 0, y: 40, width: 300, height: 760 } });
  const gem = await askIt(page, 'Summarize it');
  const gcall = h.lmCalls().find(c => c.args[0] === 'gemini' && c.args.includes('--json'));
  check(/Gemini says hello/.test(gem?.a ?? '') && gcall?.args.includes('gemini-3.5-flash') && /Fixture/.test(gcall?.stdin ?? '') && gcall.args.includes('300'),
    `Gemini answers through lm gemini with the file as context: ${JSON.stringify(gcall?.args)}`);

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-ask-hist-btn');
  // The model list arrives after the lens draws; the saved pick is applied then.
  await page.waitForFunction(() => JSON.parse(document.getElementById('fe-ask-model').dataset.opts || '[]').length > 1, { timeout: 15000 }).catch(() => null);
  const remembered = await page.$eval('#fe-ask-model', s => s.dataset.value);
  check(remembered === 'gemini:gemini-3.5-flash', `the picked model is remembered: ${JSON.stringify(remembered)}`);
  check(await page.$eval('#fe-ask-hist-n', n => n.textContent) === '1', 'the history button counts the chat');
  await page.click('#fe-ask-hist-btn');
  const rows = await page.$$eval('#fe-ask-hist .fe-ask-h', rs => rs.map(r => r.querySelector('.fe-ask-h-t').textContent));
  check(rows.join() === 'What is this file?', `history lists the chat by its first question: ${rows}`);
  await page.screenshot({ path: join(SHOTS, `ask-history${sfx}.png`), clip: { x: 0, y: 40, width: 300, height: 760 } });
  await page.click('#fe-ask-hist .fe-ask-h-open');
  const back = await page.$$eval('#fe-ask-thread .fe-ask-q', qs => qs.map(q => q.textContent));
  check(back.length === 4 && back[0] === 'What is this file?', `reopening a chat brings back its turns: ${back}`);

  await page.click('#fe-ask-new');
  check(await page.$$eval('#fe-ask-thread .fe-ask-turn', t => t.length) === 0, 'New chat starts empty');
  await page.click('#fe-ask-hist-btn');
  await page.hover('#fe-ask-hist .fe-ask-h');
  await page.click('#fe-ask-hist .fe-ask-h-del');
  check(await page.$$eval('#fe-ask-hist .fe-ask-h', r => r.length) === 0 && await page.$eval('#fe-ask-hist-n', n => n.textContent) === '', 'a chat can be deleted');
  // Only the Settings switch keeps a model loaded; asking, the lens and the
  // model list must never warm one by themselves.
  const warms = h.lmCalls().filter(c => c.args[0] === 'warm');
  check(warms.length === 0, `nothing ran lm warm during the walk: ${JSON.stringify(warms.map(c => c.args))}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'ask walk passes');
