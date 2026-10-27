// Ask can answer with GPT models through the local Codex sign-in: the picker
// lists them from Codex's own cache, the remote notice names OpenAI, @gpt
// reaches Codex's default, each call runs read-only and leaves no session,
// and a failed sign-in says what to do.
// BFB_THEME=light runs it on the light theme.
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { launch, applyTheme, shot } from './harness.mjs';

const h = await launch({ lmStub: true });
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const codexCalls = () => h.lmCalls().filter(c => c.args[0] === 'codex');

async function openAsk() {
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForFunction(() => JSON.parse(document.getElementById('fe-ask-model')?.dataset.opts || '[]').length > 1, { timeout: 15000 });
  await sleep(300);
  return page;
}
async function askAndWait(page, text) {
  const before = await page.$$eval('.fe-ask-turn', t => t.length);
  await page.click('#fe-ask-q', { clickCount: 3 });
  await page.type('#fe-ask-q', text);
  await page.keyboard.press('Enter');
  await page.waitForFunction(n => {
    const turns = document.querySelectorAll('.fe-ask-turn');
    const a = turns[n]?.querySelector('.fe-ask-a');
    return a && !a.querySelector('.fe-ask-wait') && a.textContent.trim().length > 3;
  }, { timeout: 20000 }, before);
  return page.evaluate(n => document.querySelectorAll('.fe-ask-turn')[n].querySelector('.fe-ask-a').textContent.trim(), before);
}

try {
  await h.store.set('bfb-lens-v1', 'ask');
  let page = await openAsk();

  const opts = await page.$eval('#fe-ask-model', dd => JSON.parse(dd.dataset.opts));
  const gpt = opts.filter(o => o.value.startsWith('gpt:'));
  check(gpt.length === 2 && gpt.every(o => o.hint === 'remote') && gpt.find(o => o.value === 'gpt:gpt-6-astra')?.label === 'GPT-6-Astra (Codex default)' && !gpt.some(o => o.value === 'gpt:gpt-internal'),
    `the picker lists the GPT models Codex offers, hidden ones left out, its own default tagged: ${JSON.stringify(gpt)}`);

  await h.store.set('bfb-ask-model-v1', 'gpt:gpt-6.1-sol');
  await page.close();
  page = await openAsk();
  const notice = await page.$eval('#fe-ask-cloud', c => ({ hidden: c.hidden, text: c.textContent.trim() }));
  check(!notice.hidden && /to OpenAI$/.test(notice.text), `with GPT picked, the remote notice names OpenAI: ${JSON.stringify(notice)}`);

  const answer = await askAndWait(page, 'What is this file?');
  const call = codexCalls().at(-1);
  check(/GPT answer from gpt-6\.1-sol\./.test(answer), `the answer comes back from the picked GPT model: ${JSON.stringify(answer)}`);
  const args = call?.args ?? [];
  check(args.includes('--ephemeral') && args.includes('--ignore-user-config') && args[args.indexOf('-s') + 1] === 'read-only' && args[args.indexOf('-m') + 1] === 'gpt-6.1-sol',
    `Codex runs read-only, leaves no session, skips the user's config and gets the picked model: ${JSON.stringify(args.slice(0, 14))}`);
  check(/# Fixture/.test(call?.stdin ?? '') && /What is this file\?/.test(args.at(-1) ?? '') && /codex-home$/.test(call?.home ?? ''),
    `the page goes in on stdin, the question in the prompt, and Codex's own folder is used: ${JSON.stringify({ stdin: (call?.stdin ?? '').slice(0, 40), home: call?.home })}`);
  const meta = await page.$eval('.fe-ask-turn:last-of-type .fe-ask-meta', m => m.textContent);
  check(/gpt-6\.1-sol/.test(meta), `the answer is filed under the GPT model: ${JSON.stringify(meta)}`);

  // A GPT pick needs no local model.
  writeFileSync(h.lmDown, '');
  await page.close();
  page = await openAsk();
  await sleep(600);
  const off = await page.evaluate(() => ({ status: document.getElementById('fe-ask-status').hidden, q: !document.getElementById('fe-ask-q').disabled }));
  check(off.status && off.q, `with GPT picked and the local model down, Ask shows no notice and stays usable: ${JSON.stringify(off)}`);
  unlinkSync(h.lmDown);

  // @gpt sends one question to Codex's default from a local pick.
  await h.store.set('bfb-ask-model-v1', '');
  await page.close();
  page = await openAsk();
  const n = codexCalls().length;
  const viaMention = await askAndWait(page, '@gpt summarize this');
  const mcall = codexCalls().at(-1);
  check(codexCalls().length === n + 1 && mcall.args[mcall.args.indexOf('-m') + 1] === 'gpt-6-astra' && /GPT answer from gpt-6-astra/.test(viaMention),
    `@gpt asks Codex's default model for that one question: ${JSON.stringify(viaMention)}`);

  // A failed sign-in says what to do.
  writeFileSync(h.codexFail, '');
  const failed = await askAndWait(page, '@gpt again please');
  check(/GPT did not answer\. Check codex login in a terminal/.test(failed), `a failed Codex turn says to check codex login: ${JSON.stringify(failed)}`);
  unlinkSync(h.codexFail);

  // Settings lists the GPT models as remote, sent to OpenAI.
  await page.click('#fe-settings-btn');
  await page.waitForSelector('#fe-settings-modal .fe-dlg-box');
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="ai"]');
  await page.waitForFunction(() => document.querySelectorAll('#fe-st-ai-models .fe-ai-m').length >= 7, { timeout: 15000 });
  const rows = await page.$$eval('#fe-st-ai-models .fe-ai-m', rs => rs.map(r => ({ name: r.querySelector('b').textContent, badge: r.querySelector('.fe-ai-def')?.textContent ?? '', tip: r.querySelector('.fe-ai-where').title })));
  const gptRows = rows.filter(r => r.tip === 'Sent to OpenAI');
  check(gptRows.length === 2 && gptRows.find(r => r.badge === 'Codex default')?.name === 'GPT-6-Astra', `Settings lists the GPT models as sent to OpenAI, Codex's default marked: ${JSON.stringify(gptRows)}`);
  await shot(page, 'ask-gpt-settings');
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  for (const f of [h.lmDown, h.codexFail]) if (existsSync(f)) unlinkSync(f);
  await h.close();
  console.log(results.join('\n'));
}
