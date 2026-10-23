// Ask with more than the page: files from the folder attach as chips (from
// the attach menu or dropped as a file link) and go with every question; an
// image is read by the local vision model; an image's own page asks about
// the image; @code sends one question to that model; and another model can
// check an answer as a second opinion. Runs over a stand-in lm and see.
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { launch, SHOTS, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sfx = THEME === 'light' ? '-light' : '';
const h = await launch({ lmStub: true });
const last = '#fe-ask-thread .fe-ask-turn:last-of-type';
const ready = p => p.waitForFunction(() => JSON.parse(document.getElementById('fe-ask-model')?.dataset.opts || '[]').length > 1, { timeout: 15000 });
const answered = (p, n) => p.waitForFunction(k => { const ts = document.querySelectorAll('#fe-ask-thread .fe-ask-turn'); return ts.length >= k && ts[ts.length - 1].querySelector('.fe-ask-meta')?.textContent; }, { timeout: 15000 }, n);
const send = async (p, text) => { await p.type('#fe-ask-q', text); await p.keyboard.press('Enter'); };
const turnsNow = p => p.$$eval('#fe-ask-thread .fe-ask-turn', t => t.length);
try {
  writeFileSync(join(h.fixture, 'shot.png'), Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201e2f2a6e40000000049454e44ae426082', 'hex'));
  await h.store.set('bfb-theme', THEME);
  await h.store.set('bfb-lens-v1', 'ask');
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await ready(page);

  // Attach two files from the menu; it stays open so several can be picked.
  await page.click('#fe-ask-attach');
  await page.waitForSelector('.fe-ask-qmenu .fe-ctx-item');
  const offered = await page.$$eval('.fe-ask-qmenu .fe-ctx-item', rs => rs.map(r => r.textContent.trim()));
  check(offered.includes('notes.txt') && offered.includes('shot.png') && !offered.includes('readme.md'), `the attach menu lists this folder's other files: ${JSON.stringify(offered)}`);
  for (const n of ['notes.txt', 'shot.png']) await page.$$eval('.fe-ask-qmenu .fe-ctx-item', (rs, name) => rs.find(r => r.textContent.trim() === name).click(), n);
  await page.screenshot({ path: join(SHOTS, `ask-attach-menu${sfx}.png`), clip: { x: 0, y: 40, width: 420, height: 860 } });
  await page.keyboard.press('Escape'); await sleep(150);
  const chips = await page.$$eval('#fe-ask-files .fe-ask-file', cs => cs.map(c => c.textContent.trim()));
  check(chips.join() === 'notes.txt,shot.png', `picked files show as chips above the box: ${chips}`);

  // A file link dropped on the box attaches too.
  await page.evaluate(url => {
    const dt = new DataTransfer(); dt.setData('text/uri-list', url);
    const box = document.querySelector('.fe-ask-box');
    box.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    box.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, 'file://' + h.fixture + '/code.py');
  const afterDrop = await page.$$eval('#fe-ask-files .fe-ask-file', cs => cs.map(c => c.textContent.trim()));
  check(afterDrop.join() === 'notes.txt,shot.png,code.py', `a dropped file link attaches: ${afterDrop}`);
  await page.click('#fe-ask-files [data-unattach$="code.py"]');
  check(await page.$$eval('#fe-ask-files .fe-ask-file', cs => cs.length) === 2, 'a chip can be removed');

  await send(page, 'Compare these');
  await answered(page, 1);
  const see = h.lmCalls().filter(c => c.args[0] === 'see');
  const q = h.lmCalls().filter(c => c.args[0] === 'q').at(-1);
  check(see.length === 1 && see[0].args[1].endsWith('/shot.png') && see[0].args.includes('Compare these'), `the image is read by the vision model with the question: ${JSON.stringify(see.map(c => c.args))}`);
  check(q.args.includes('readme.md and 2 attached files') && /=== notes\.txt ===\nplain text/.test(q.stdin) && /=== Image shot\.png \(read by minicpm-v4\.6\) ===\nA screenshot with a blue Save button\./.test(q.stdin),
    `the model gets the page, the text file and the image's reading: ${q.args.join(' ')}`);
  const turn = await page.$eval(last, t => ({ files: [...t.querySelectorAll('.fe-ask-qfiles .fe-ask-file')].map(c => c.textContent.trim()), work: t.querySelector('.fe-ask-work')?.textContent.trim() }));
  check(turn.files.join() === 'notes.txt,shot.png' && turn.work === 'Read shot.png', `the question shows its files and the answer the step it took: ${JSON.stringify(turn)}`);
  await page.screenshot({ path: join(SHOTS, `ask-files${sfx}.png`), clip: { x: 0, y: 40, width: 380, height: 860 } });

  // @code asks that model once.
  await send(page, '@code why does it loop?');
  await answered(page, 2);
  const mention = h.lmCalls().filter(c => c.args[0] === 'q').at(-1);
  const bubble = await page.$eval(last + ' .fe-ask-q', b => b.textContent);
  check(mention.args.includes('-m') && mention.args[mention.args.indexOf('-m') + 1] === 'code' && /why does it loop\?$/.test(mention.args.at(-1)) && bubble === '@code why does it loop?',
    `@code sends the question to the code model: ${mention.args.slice(-4).join(' ')}`);
  const picker = await page.$eval('#fe-ask-model', d => d.dataset.value);
  check(picker === '', `the picker stays on the default: ${JSON.stringify(picker)}`);

  // A second opinion from Gemini lands as its own turn.
  const n = await turnsNow(page);
  await page.hover(last); await sleep(100);
  await page.click(last + ' [data-act="other"]');
  await page.waitForSelector('.fe-ask-qmenu .fe-ctx-item');
  await page.$$eval('.fe-ask-qmenu .fe-ctx-item', rs => rs.find(r => /gemini-3\.8-flash/.test(r.textContent)).click());
  await answered(page, n + 1);
  const gem = h.lmCalls().filter(c => c.args[0] === 'gemini').at(-1);
  const via = await page.$eval(last, t => ({ via: t.querySelector('.fe-ask-via')?.textContent.trim(), a: t.querySelector('.fe-ask-a').textContent.trim() }));
  check(/Another model answered the question "why does it loop\?"/.test(gem?.args.at(-1) ?? '') && via.via === 'Second opinion from gemini-3.8-flash' && /Gemini says hello/.test(via.a),
    `another model checks the answer as a second opinion: ${JSON.stringify(via)}`);
  await page.screenshot({ path: join(SHOTS, `ask-second-opinion${sfx}.png`), clip: { x: 0, y: 40, width: 380, height: 860 } });

  // An image in the preview takes Ask too: Describe reads it with the vision model.
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('.fe-nm');
  await page.$$eval('.fe-nm', ns => ns.find(n => n.textContent.trim() === 'shot.png')?.click());
  await page.waitForFunction(() => document.getElementById('fe-ql-ai')?.style.display === '', { timeout: 10000 }).catch(() => null);
  const bar = await page.evaluate(() => ({ shown: document.getElementById('fe-ql-ai')?.style.display === '', exp: document.getElementById('fe-ql-ai-exp')?.textContent }));
  check(bar.shown && bar.exp === 'Describe', `an image preview offers Ask, with Describe: ${JSON.stringify(bar)}`);
  await page.click('#fe-ql-ai-exp');
  await page.waitForFunction(() => /Local answer/.test(document.getElementById('fe-ql-ai-out-body')?.textContent ?? ''), { timeout: 10000 }).catch(() => null);
  const seeImg = h.lmCalls().filter(c => c.args[0] === 'see').at(-1);
  const qImg = h.lmCalls().filter(c => c.args[0] === 'q').at(-1);
  const pvMeta = await page.$eval('#fe-ql-ai-out-meta', m => m.textContent);
  check(seeImg.args[1].endsWith('/shot.png') && /Describe this image/.test(seeImg.args[2]) && qImg.args.includes('shot.png') && /blue Save button/.test(qImg.stdin) && /in 1,204/.test(pvMeta),
    `Describe sends the image to the vision model and answers from its reading: ${pvMeta}`);
  await page.screenshot({ path: join(SHOTS, `ask-image-preview${sfx}.png`) });
  check(h.lmCalls().every(c => c.args[0] !== 'warm'), 'nothing warmed a model');
} finally {
  for (const r of results) console.log(r);
  await h.close();
}
