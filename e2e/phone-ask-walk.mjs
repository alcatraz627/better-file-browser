// Ask on a phone: the question goes to the Mac's AI host (here over a stand-in lm)
// through the phone server, the answer streams back, and it survives the page
// leaving, the stream breaking, and a reload that starts from the Mac's settings.
// A TCP relay sits between the phone page and the server so the walk can cut a
// live stream, as a phone losing signal does.
import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { chmodSync, mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import { findChrome, makeFixture, makeNotesDir, SHOTS } from './harness.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const fixture = makeFixture(), notesDir = makeNotesDir();
const tmp = mkdtempSync(join(tmpdir(), 'bfb-phone-ask-'));
const seed = join(tmp, 'seed.json'), orphans = join(tmp, 'orphans.json'), fakeLm = join(tmp, 'lm'), calls = join(tmp, 'lm-calls.jsonl');
const readme = `${fixture}/readme.md`;
const macChat = { id: 'mac-1', at: 1000, title: 'Asked on the Mac', turns: [{ q: 'Asked on the Mac', a: 'An answer from the Mac.', model: 'gemma4-e4b-warm', ms: 10, at: 1000 }] };
const LIGHT = process.env.BFB_THEME === 'light' || process.argv.includes('--light');
writeFileSync(seed, JSON.stringify({ kv: {
  ...(LIGHT ? { 'bfb-theme': 'light' } : {}),
  'bfb-settings-v1': JSON.stringify({ editableFolders: [fixture], notesRoot: notesDir }),
  'bfb-ask-history-v1': JSON.stringify({ [readme]: [macChat] }),
} }));
// A stand-in lm: "Stream code" answers a piece at a time for about 2.4 seconds, anything else at once.
writeFileSync(fakeLm, `#!/usr/bin/env python3
import json, sys, time
args = sys.argv[1:]
open(${JSON.stringify(calls)}, 'a').write(json.dumps(args) + '\\n')
if args[:2] == ['status', '--json']:
    print(json.dumps({'api_version': 1, 'server': 'up', 'default_model': 'gemma4-e4b-warm', 'warm': True, 'latency_class': 'warm'}))
elif args[:2] == ['models', '--json']:
    print(json.dumps({'default': 'gemma4-e4b-warm', 'resident': [], 'available': [], 'tiers': [{'alias': 'small', 'model': 'gemma4-e4b-warm'}, {'alias': 'big', 'model': 'gemma4:26b'}], 'gemini': []}))
elif args[:1] == ['q']:
    sys.stdin.read()
    q = args[-1]
    if 'Stream code' in q:
        for part in ['Here:\\n\\n', '\`\`\`js\\n', 'const a = 1;\\n', 'const b = 2;\\n']:
            print(json.dumps({'t': 'chunk', 'text': part}), flush=True)
            time.sleep(0.6)
        print(json.dumps({'t': 'chunk', 'text': '\`\`\`\\n\\nDone.'}))
    else:
        print(json.dumps({'t': 'chunk', 'text': 'Phone answer.'}))
    print(json.dumps({'t': 'done', 'model': 'gemma4-e4b-warm', 'ms': 1234, 'truncated': False, 'tokens_in': 10, 'tokens_out': 5}))
`);
chmodSync(fakeLm, 0o755);

const server = spawn('python3', [join(ROOT, 'native/web_server.py'), '--port', '0'], { env: { ...process.env, BFB_PHONE_SEED: seed, BFB_PHONE_ORPHANS: orphans, BFB_LM_BIN: fakeLm } });
const port = await new Promise((res, rej) => {
  server.stdout.on('data', d => { const m = /127\.0\.0\.1:(\d+)/.exec(String(d)); if (m) res(m[1]); });
  server.on('exit', c => rej(new Error(`server exited ${c}`)));
  setTimeout(() => rej(new Error('server did not start')), 8000);
});
// The relay: everything passes through until dropAll() cuts every open connection.
const open = new Set();
const relay = createServer(c => {
  const u = connect(Number(port), '127.0.0.1');
  open.add(c); open.add(u);
  c.pipe(u); u.pipe(c);
  const gone = () => { c.destroy(); u.destroy(); open.delete(c); open.delete(u); };
  c.on('error', gone); u.on('error', gone); c.on('close', gone); u.on('close', gone);
});
await new Promise(r => relay.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${relay.address().port}`;
const dropAll = () => { for (const s of [...open]) s.destroy(); };

const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-first-run', '--disable-gpu'] });   // without it a mobile-emulated screenshot can hang in headless Chrome
const last = '#fe-ask-thread .fe-ask-turn:last-of-type';
const stored = page => page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem('bfbweb:local:bfb-ask-history-v1') || '"{}"')));
const turnsOf = async page => ((await stored(page))[readme] ?? []).flatMap(c => c.turns);
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(12_000);
  await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  const openAsk = async () => {
    await page.goto(`${BASE}${readme}`, { waitUntil: 'load' });
    await page.waitForSelector('#fe-page .fe-md h1');
    await page.tap('#fe-rail-ask');
    await page.waitForFunction(() => JSON.parse(document.getElementById('fe-ask-model')?.dataset.opts || '[]').length > 1, { timeout: 15000 });
  };
  const ask = async text => { await page.type('#fe-ask-q', text); await page.keyboard.press('Enter'); };

  // Ask is on the phone: the model is found through the Mac, a question is answered, and it is filed in the chat history.
  await openAsk();
  const models = await page.$eval('#fe-ask-model', e => JSON.parse(e.dataset.opts || '[]').map(o => o.label ?? o.value ?? o.name ?? o));
  check(models.length > 1, `the models are found through the Mac: ${JSON.stringify(models)}`);
  await ask('What is this?');
  await page.waitForFunction(s => /Phone answer/.test(document.querySelector(s + ' .fe-ask-a')?.textContent ?? ''), {}, last);
  const meta = await page.$eval(last + ' .fe-ask-meta', e => e.textContent);
  check(/gemma4-e4b-warm/.test(meta), `a question gets its answer, with the model's line: "${meta}"`);
  await page.screenshot({ path: join(SHOTS, `phone-ask${LIGHT ? '-light' : ''}.png`) });
  const paint = await page.evaluate(() => { const lum = c => { const m = c.match(/\d+(\.\d+)?/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; }; const bg = el => lum(getComputedStyle(el).backgroundColor); const tx = el => lum(getComputedStyle(el).color); return { page: bg(document.body), thread: tx(document.querySelector('#fe-ask-thread .fe-ask-a')), q: tx(document.querySelector('#fe-ask-thread .fe-ask-q')) }; });
  check(LIGHT ? paint.page > 0.8 && paint.thread < 0.4 && paint.q < 0.4 : paint.page < 0.2 && paint.thread > 0.5, `the Ask screen is drawn in the ${LIGHT ? 'light' : 'dark'} theme, text against its background: ${JSON.stringify(paint)}`);
  await sleep(300);
  let turns = await turnsOf(page);
  check(turns.some(t => t.q === 'What is this?' && /Phone answer/.test(t.a)), 'the answer is in the chat history on the phone');

  // A reload starts from the Mac's settings and must not drop the chat asked on the phone, nor the Mac's own chat.
  await page.reload({ waitUntil: 'load' });
  await sleep(600);
  turns = await turnsOf(page);
  check(turns.some(t => t.q === 'What is this?') && turns.some(t => t.q === 'Asked on the Mac'), `after a reload both the phone's chat and the Mac's chat are kept: ${JSON.stringify(turns.map(t => t.q))}`);

  // The page leaves mid-answer and stays away: the answer finishes on the Mac and is filed when a page comes back.
  await openAsk();
  await ask('Stream code one');
  await page.waitForFunction(s => /Here/.test(document.querySelector(s + ' .fe-ask-a')?.textContent ?? ''), {}, last);
  await page.goto(`${BASE}${fixture}/`, { waitUntil: 'load' });
  await sleep(3600);
  await page.reload({ waitUntil: 'load' });
  await sleep(900);
  turns = await turnsOf(page);
  const away = turns.filter(t => t.q === 'Stream code one');
  check(away.length === 1 && /Done\./.test(away[0].a) && !away[0].stopped, `an answer that ended while the phone was away is in the history, once: ${JSON.stringify(away.map(t => t.a.slice(-6)))}`);

  // The page comes back while it is still running: it carries on in its chat.
  await openAsk();
  await ask('Stream code two');
  await page.waitForFunction(s => /Here/.test(document.querySelector(s + ' .fe-ask-a')?.textContent ?? ''), {}, last);
  await page.goto(`${BASE}${fixture}/`, { waitUntil: 'load' });
  await sleep(300);
  await page.goto(`${BASE}${readme}`, { waitUntil: 'load' });
  await page.tap('#fe-rail-ask');
  await page.waitForFunction(s => /Stream code two/.test(document.querySelector(s + ' .fe-ask-q')?.textContent ?? ''), {}, last).catch(() => null);
  const back = await page.$eval(last, t => ({ q: t.querySelector('.fe-ask-q')?.textContent, a: t.querySelector('.fe-ask-a')?.textContent ?? '' })).catch(() => null);
  check(!!back && back.q === 'Stream code two' && /Here/.test(back.a), `coming back mid-answer shows it still running: ${JSON.stringify(back && { q: back.q, a: back.a.slice(0, 30) })}`);
  await page.waitForFunction(s => /Done\./.test(document.querySelector(s + ' .fe-ask-a')?.textContent ?? ''), {}, last);
  await sleep(300);
  const two = (await turnsOf(page)).filter(t => t.q === 'Stream code two');
  check(two.length === 1 && /Done\./.test(two[0].a), `it finishes in place and is filed once: ${two.length}`);

  // The connection breaks mid-answer, as a phone losing signal does: the page picks the answer up again, whole, once.
  await openAsk();
  await ask('Stream code three');
  await page.waitForFunction(s => /Here/.test(document.querySelector(s + ' .fe-ask-a')?.textContent ?? ''), {}, last);
  dropAll();
  await page.waitForFunction(s => /Done\./.test(document.querySelector(s + ' .fe-ask-a')?.textContent ?? ''), { timeout: 20000 }, last).catch(() => null);
  const cut = await page.$eval(last + ' .fe-ask-a', e => e.textContent).catch(() => '');
  check(/Here/.test(cut) && /Done\./.test(cut) && (cut.match(/const a = 1/g) ?? []).length === 1, `after the connection is cut the answer is whole, nothing doubled: ${JSON.stringify(cut.slice(0, 80))}`);
  await sleep(400);
  const three = (await turnsOf(page)).filter(t => t.q === 'Stream code three');
  check(three.length === 1 && !three[0].error, `and it is filed once, as a finished answer: ${JSON.stringify(three.map(t => t.error ?? 'ok'))}`);

  // Stop stops the model on the Mac, and the stopped answer stays stopped.
  await openAsk();
  await ask('Stream code four');
  await page.waitForFunction(s => /Here/.test(document.querySelector(s + ' .fe-ask-a')?.textContent ?? ''), {}, last);
  await page.tap('#fe-ask-go');
  await sleep(3200);
  await page.reload({ waitUntil: 'load' });
  await sleep(900);
  const four = (await turnsOf(page)).filter(t => t.q === 'Stream code four');
  check(four.length === 1 && four[0].stopped && !/Done\./.test(four[0].a), `Stop ends the answer for good: ${JSON.stringify(four.map(t => ({ stopped: !!t.stopped, tail: t.a.slice(-6) })))}`);
  const parked = existsSync(orphans) ? JSON.parse(readFileSync(orphans, 'utf8')) : [];
  check(parked.length === 0, `nothing is left parked on the Mac: ${parked.length}`);
  check(!errors.length, `no page errors: ${errors.join(' | ') || 'none'}`);
} finally {
  console.log(results.join('\n'));
  await browser.close();
  relay.close();
  server.kill();
}
