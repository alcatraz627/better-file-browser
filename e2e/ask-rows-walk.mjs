// Ask under the conditions that broke it in review: a data file's view, an answer
// stopped before any text, an idle local model picked mid-answer, typing the next
// question while one runs, a failed Gemini call, a long stream, a page change with
// files attached, deleting a chat, two tabs on one file.
//
//   node e2e/ask-rows-walk.mjs [folder for screenshots]
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const phase = async (name, fn) => { try { await fn(); } catch (e) { check(false, `${name} stopped: ${String(e.message).split('\n')[0]}`); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const shots = process.argv[2];
const h = await launch({ lmStub: true });
const sent = () => h.lmCalls().filter(c => c.stdin).at(-1)?.stdin ?? '';
const turns = p => p.$$eval('#fe-ask-thread .fe-ask-turn', ts => ts.map(t => t.querySelector('.fe-ask-a').textContent.trim()));
const openAsk = async (url, fresh = true) => {
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#fe-ask-model');
  await page.waitForFunction(() => JSON.parse(document.getElementById('fe-ask-model').dataset.opts || '[]').length > 1, { timeout: 15000 }).catch(() => null);
  await pickModel(page, 'small');
  if (fresh) await page.$eval('#fe-ask-new', b => b.click());
  await wait(100);
  return page;
};
const askIt = async (p, text) => {
  const before = (await turns(p)).length;
  await p.type('#fe-ask-q', text);
  await p.keyboard.press('Enter');
  await p.waitForFunction(n => { const m = [...document.querySelectorAll('#fe-ask-thread .fe-ask-meta')]; return m.length > n && m.at(-1).textContent; }, { timeout: 15000 }, before).catch(() => null);
};
const pickModel = async (p, v) => {
  await p.$eval('#fe-ask-model .fe-dd-btn', b => b.click());
  await p.waitForSelector(`.fe-dd-list [data-v="${v}"]`, { timeout: 3000 });
  await p.$eval(`.fe-dd-list [data-v="${v}"]`, o => o.click());
};
const running = p => p.waitForSelector('.fe-ask-send.stop', { timeout: 4000 }).catch(() => null);

try {
  await h.store.set('bfb-theme', THEME);
  await h.store.set('bfb-lens-v1', 'ask');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, notesRoot: h.notesDir }));
  const readme = 'file://' + join(h.fixture, 'readme.md');

  await phase('a data file', async () => {
    writeFileSync(join(h.fixture, 'stock.csv'), 'item,count\nmauve-otter-42,3\nteal-lantern,5\n');
    const p = await openAsk('file://' + h.fixture + '/#view=stock.csv');
    await askIt(p, 'List the item names');
    check(/mauve-otter-42/.test(sent()), `a data file's view sends the file, not the folder: ${sent().slice(0, 70).replace(/\n/g, ' ')}`);
    await p.close();
  });

  await phase('stopping before any text', async () => {
    const p = await openAsk(readme);
    await p.type('#fe-ask-q', 'Stream code first');
    await p.keyboard.press('Enter');
    await running(p);
    await p.click('.fe-ask-send.stop');
    await wait(300);
    await askIt(p, 'Second question');
    await askIt(p, 'Third question');
    const rows = await p.$$('#fe-ask-thread .fe-ask-turn');
    const save = async i => { await rows[i].hover(); await rows[i].$eval('[data-act="note"]', b => b.click()); await wait(500); };
    await save(rows.length - 2);
    const names = readdirSync(h.notesDir);
    check(names.some(n => /second-question/.test(n)), `saving the second answer saves that answer: ${names}`);
    await p.close();
  });

  await phase('picking an idle model mid-answer', async () => {
    const p = await openAsk(readme);
    await pickModel(p, 'gemini:gemini-3.5-flash');
    writeFileSync(h.lmDown, '');
    await p.type('#fe-ask-q', 'Stream code for me');
    await p.keyboard.press('Enter');
    await running(p);
    await pickModel(p, 'small');
    await wait(300);
    check(await p.$eval('.fe-ask-send', b => b.classList.contains('stop') && !b.disabled), 'Stop stays live when an idle model is picked during an answer');
    await p.$eval('.fe-ask-send', b => b.click());
    rmSync(h.lmDown, { force: true });
    await p.close();
  });

  await phase('typing the next question', async () => {
    const p = await openAsk(readme);
    await p.type('#fe-ask-q', 'Stream code again');
    await p.keyboard.press('Enter');
    await running(p);
    await p.type('#fe-ask-q', 'The next question');
    await p.keyboard.press('Enter');
    await wait(400);
    const asked = await p.$$eval('#fe-ask-thread .fe-ask-q, #fe-ask-thread .fe-ask-turn-q', q => q.map(x => x.textContent));
    check(asked.some(a => /The next question/.test(a)) && await p.$eval('#fe-ask-q', q => q.value === ''), `Enter mid-answer sends what was typed: ${JSON.stringify(asked)}`);
    await p.close();
  });

  await phase('a failure says why', async () => {
    const p = await openAsk(readme);
    await pickModel(p, 'gemini:gemini-3.5-flash');
    await askIt(p, 'Fail please');
    const said = (await turns(p)).at(-1) ?? '';
    check(/too large/i.test(said), `a Gemini failure shows the host's reason: ${said.slice(0, 100)}`);
    await p.close();
  });

  await phase('a long stream', async () => {
    const p = await openAsk(readme);
    await p.type('#fe-ask-q', 'Stream code once more');
    await p.keyboard.press('Enter');
    await running(p);
    await wait(900);
    const sel = await p.evaluate(async () => {
      const a = [...document.querySelectorAll('#fe-ask-thread .fe-ask-a')].at(-1);
      const n = a.querySelector('p') ?? a;
      const r = document.createRange(); r.selectNodeContents(n);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      const had = s.toString();
      await new Promise(res => setTimeout(res, 800));
      return { had, now: getSelection().toString() };
    });
    check(sel.had && sel.now === sel.had, `a selection survives the stream: ${JSON.stringify(sel)}`);
    await p.close();
  });

  await phase('leaving the page', async () => {
    const p = await openAsk(readme);
    await p.type('#fe-ask-q', 'Half typed');
    await p.evaluate(() => document.getElementById('fe-ask-attach')?.click());
    await p.waitForSelector('.fe-ask-qmenu .fe-ctx-item', { timeout: 3000 });
    await p.$eval('.fe-ask-qmenu .fe-ctx-item', r => r.click());
    await p.keyboard.press('Escape');
    await wait(100);
    const att = await p.$$eval('#fe-ask-files .chip, #fe-ask-files > *', c => c.length);
    check(att > 0, 'a file is attached');
    await p.reload({ waitUntil: 'load' });
    await p.waitForSelector('#fe-ask-q');
    await wait(300);
    check(await p.$eval('#fe-ask-q', q => q.value) === 'Half typed', 'the typed question survives a page change');
    check((await p.$$eval('#fe-ask-files > *', c => c.length)) === att, 'and so do the attached files');
    await pickModel(p, 'gemini:gemini-3.5-flash');
    await wait(100);
    check(/attached files/.test(await p.$eval('#fe-ask-cloud', c => c.innerText)), 'the note about what leaves the machine names the attached files');
    if (shots) await p.screenshot({ path: join(shots, `ask-rows-cloud-${THEME}.png`), clip: { x: 0, y: 40, width: 320, height: 860 } });
    await p.click('#fe-ask-new');
    await wait(100);
    check((await p.$$eval('#fe-ask-files > *', c => c.length)) === 0, 'New chat starts with no files');
    await pickModel(p, 'small');
    await p.$eval('#fe-ask-q', q => { q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.close();
  });

  await phase('second opinion menu and the chip', async () => {
    const p = await openAsk(readme);
    await askIt(p, 'A question for two');
    const turn = await p.$('#fe-ask-thread .fe-ask-turn');
    await turn.hover();
    await turn.$eval('[data-act="other"]', b => b.click());
    await p.waitForSelector('.fe-ask-qmenu');
    const menu = await p.$eval('.fe-ask-qmenu', m => ({ heads: [...m.querySelectorAll('.fe-dd-g')].map(g => g.textContent), text: m.innerText }));
    check(menu.heads.length >= 2, `the second opinion menu keeps the picker's groups: ${JSON.stringify(menu.heads)}`);
    check(/Sends the answer to Google/.test(menu.text), 'and says which rows send it away');
    if (shots) await p.screenshot({ path: join(shots, `ask-rows-menu-${THEME}.png`), clip: { x: 0, y: 40, width: 420, height: 860 } });
    await p.keyboard.press('Escape');
    await pickModel(p, 'gemini:gemini-3.8-flash');
    await wait(150);
    const chip = await p.$eval('#fe-ask-model .fe-dd-btn', b => {
      const s = b.querySelector('span') ?? b;
      const r = document.createRange(); r.selectNodeContents(s);
      const room = s.getBoundingClientRect();
      return { text: s.textContent, words: Math.round(r.getBoundingClientRect().width), room: Math.round(room.width), cut: r.getBoundingClientRect().right > room.right + 1 || room.width < 40 };
    });
    check(/gemini-3\.8/i.test(chip.text) && !chip.cut, `the chip names the model in full: ${JSON.stringify(chip)}`);
    await p.close();
  });

  await phase('deleting a chat', async () => {
    const p = await openAsk(readme);
    await askIt(p, 'A chat to delete');
    await p.click('#fe-ask-hist-btn');
    await p.waitForSelector('.fe-ask-h-del');
    await p.$eval('.fe-ask-h-del', b => b.click());
    await wait(200);
    const asked = await p.evaluate(() => [...document.querySelectorAll('.fe-dlg,[role="dialog"],[role="alertdialog"]')].filter(d => d.checkVisibility()).map(d => d.textContent).join(' '));
    check(/Delete this chat/.test(asked), 'deleting a chat asks first');
    await p.keyboard.press('Escape');
    await p.close();
  });

  await phase('two tabs on one file', async () => {
    const a = await openAsk(readme);
    await a.bringToFront();
    await askIt(a, 'Asked in tab A');
    const c = await openAsk(readme, false);
    await c.bringToFront();
    await wait(400);
    await a.bringToFront();
    await askIt(a, 'Asked in A again');
    await c.bringToFront();
    await c.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await wait(400);
    const seen = await c.$eval('#fe-ask-thread', t => t.textContent);
    check(/Asked in A again/.test(seen), 'a second tab shows what the first asked when it comes back');
    await a.close(); await c.close();
  });
} finally {
  for (const r of results) console.log(r);
  console.log(`${results.filter(r => r.startsWith('PASS')).length} pass, ${results.filter(r => r.startsWith('FAIL')).length} fail`);
  await h.close();
}
