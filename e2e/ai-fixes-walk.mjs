// The AI surfaces tell the truth and stay put: the model picker and Settings
// name the real default and tag what leaves the machine as remote; one
// "model is not running" message with a Retry on every surface; the floating
// preview shows its AI bar at once, folds it from a header button, and gives
// Stop, Retry and a kept answer; the Ask lens reopens its last chat; and a
// page whose extension was reloaded says so. Runs over a stand-in lm.
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { launch, SHOTS, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sfx = THEME === 'light' ? '-light' : '';
const h = await launch({ lmStub: true });
const shotAt = async (page, name, clip) => { await sleep(400); return page.screenshot({ path: join(SHOTS, `ai-fixes-${name}${sfx}.png`), ...(clip ? { clip } : {}) }); };
const pvOpen = page => page.$eval('#fe-qlook', q => q.style.display === 'flex');
const openPreview = async (page, name) => {
  await page.click(`#fe-tbody tr[data-idx]:has(a[href$="/${name}"]) td.c-sz`); await sleep(150);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('fe-qlook')?.style.display === 'flex', { timeout: 5000 });
};
const chipText = page => page.$eval('#fe-ql-ai-chip-txt', c => c.textContent);
const waitReady = page => page.waitForFunction(() => /ready|cold/.test(document.getElementById('fe-ql-ai-chip-txt')?.textContent ?? ''), { timeout: 15000 });
const barState = page => page.evaluate(() => {
  const bar = document.getElementById('fe-ql-ai');
  return { shown: !bar.hidden && bar.getBoundingClientRect().height > 0, bodyTop: Math.round(document.getElementById('fe-ql-body').getBoundingClientRect().top) };
});
// One part of the walk: a step that cannot run (a control that is not there) fails that part, not the whole run.
const phase = async (name, fn) => { try { await fn(); } catch (e) { check(false, `${name} stopped: ${String(e.message).split('\n')[0]}`); } };
let page, ask;
const DOWN = /The local model is not running\. Start it with lm in a terminal, then try again\./;
try {
  await h.store.set('bfb-theme', THEME);

  // 1. The picker and Settings name the real default, and mark what is remote.
  await phase('picker and Settings', async () => {
    await h.store.set('bfb-lens-v1', 'ask');
    ask = await h.browser.newPage();
    await ask.setViewport({ width: 1400, height: 900 });
    await ask.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
    await ask.waitForFunction(() => JSON.parse(document.getElementById('fe-ask-model')?.dataset.opts || '[]').length > 1, { timeout: 15000 });
    const opts = await ask.$eval('#fe-ask-model', dd => JSON.parse(dd.dataset.opts));
    const defaults = opts.filter(o => /\(default\)$/.test(o.label));
    check(defaults.length === 1 && defaults[0].value === '' && defaults[0].label === 'gemma4-e4b-warm (default)',
      `exactly one picker row is "(default)", and it names the model lm answers with: ${JSON.stringify(defaults)}`);
    const gem = opts.filter(o => o.value.startsWith('gemini:'));
    check(gem.length === 2 && gem.every(o => o.hint === 'remote') && gem.some(o => o.label === 'gemini-3.5-flash (Gemini default)'),
      `Gemini rows are tagged remote, and its own pick is called Gemini's: ${JSON.stringify(gem)}`);
    check(!opts.some(o => o.label === 'Default'), 'no row is just called "Default"');

    await ask.click('#fe-settings-btn');
    await ask.waitForSelector('#fe-settings-modal .fe-dlg-box');
    await ask.click('#fe-settings-modal .fe-dlg-tab[data-tab="ai"]');
    await ask.waitForFunction(() => document.querySelectorAll('#fe-st-ai-models .fe-ai-m').length >= 5, { timeout: 15000 });
    const rows = await ask.$$eval('#fe-st-ai-models .fe-ai-m', rs => rs.map(r => ({ name: r.querySelector('b').textContent, badge: r.querySelector('.fe-ai-def')?.textContent ?? '', where: r.querySelector('.fe-ai-where').textContent })));
    check(rows.filter(r => r.badge === 'default').length === 1 && rows.find(r => r.name === 'small')?.badge === 'default',
      `Settings marks one row "default", the one lm answers with: ${JSON.stringify(rows)}`);
    check(rows.filter(r => r.where === 'Remote').length === 2 && rows.filter(r => r.where === 'This Mac').length === 3 && rows.find(r => r.badge === 'Gemini default')?.name === 'Gemini 3.5-flash',
      'Settings tags Gemini rows Remote, the rest This Mac, and Gemini\'s own pick says so');
    await shotAt(ask, 'settings-models');
    const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');
    check(!/Fully local/i.test(readme) && /remote/i.test(readme), 'the README no longer claims AI is fully local, and names the remote models');
    await ask.keyboard.press('Escape');
  });

  // 2. The Ask lens reopens its last chat after leaving the page, unless it was put away.
  await phase('Ask lens reopens', async () => {
    await ask.type('#fe-ask-q', 'What is this file?');
    await ask.keyboard.press('Enter');
    await ask.waitForFunction(() => document.querySelector('#fe-ask-thread .fe-ask-meta')?.textContent, { timeout: 15000 });
    await ask.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
    await ask.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
    await ask.waitForSelector('#fe-ask-hist-btn');
    await ask.waitForFunction(() => document.querySelector('#fe-ask-thread .fe-ask-q'), { timeout: 8000 }).catch(() => null);
    const back = await ask.$$eval('#fe-ask-thread .fe-ask-q', qs => qs.map(q => q.textContent));
    check(back.join() === 'What is this file?', `coming back to the page, Ask shows the chat it had: ${JSON.stringify(back)}`);
    await shotAt(ask, 'ask-reopened', { x: 0, y: 40, width: 380, height: 700 });
    await ask.click('#fe-ask-new');
    await ask.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
    await ask.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
    await ask.waitForSelector('#fe-ask-hist-btn'); await sleep(1200);
    check(await ask.$$eval('#fe-ask-thread .fe-ask-turn', t => t.length) === 0, 'a chat put away with New chat is not reopened');
    await ask.close();
  });

  // 3. The floating preview: the AI bar is there at once, folds from the header, and answers can be stopped and retried.
  await phase('floating preview', async () => {
    await h.store.set('bfb-lens-v1', 'places');
    page = await h.open();
    await page.setViewport({ width: 1400, height: 900 });
    await page.waitForSelector('#fe-tbody tr[data-idx]');
    await openPreview(page, 'readme.md');
    const early = await barState(page);
    await waitReady(page);
    const late = await barState(page);
    check(early.shown && late.shown && early.bodyTop === late.bodyTop, `the AI bar is on screen the moment the preview opens and the file does not shift when the model answers: ${JSON.stringify({ early, late })}`);
    check(await page.$eval('#fe-ql-ai-btn', b => !b.hidden && b.getBoundingClientRect().width > 0), 'the floating preview header has an AI button');
    await shotAt(page, 'preview-bar');
    await page.click('#fe-ql-ai-btn');
    check(!(await barState(page)).shown, 'the header button folds the AI bar away');
    await page.click('#fe-ql-body'); await page.keyboard.press('a'); await sleep(150);
    check((await barState(page)).shown && await page.evaluate(() => document.activeElement?.id === 'fe-ql-ai-q'), 'a opens the bar and puts the cursor in its question box');

    await page.type('#fe-ql-ai-q', 'Stream code');
    await page.keyboard.press('Enter');
    check(await page.$eval('#fe-ql-ai-q', q => q.value) === '', 'the question box is empty once the question is sent');
    await page.waitForFunction(() => /const a/.test(document.getElementById('fe-ql-ai-out-body')?.textContent ?? ''), { timeout: 10000 });
    const mid = await page.evaluate(() => ({
      pre: !!document.querySelector('#fe-ql-ai-out-body pre'), ticks: document.getElementById('fe-ql-ai-out-body').textContent.includes('```'),
      stop: !document.getElementById('fe-ql-ai-stop').hidden, retry: !document.getElementById('fe-ql-ai-retry').hidden,
      asked: document.getElementById('fe-ql-ai-out-q').textContent,
    }));
    check(mid.pre && !mid.ticks && mid.stop && !mid.retry && mid.asked === 'Stream code', `mid-answer, the code block draws as code and Stop shows: ${JSON.stringify(mid)}`);
    await shotAt(page, 'preview-streaming');
    await page.keyboard.press('Escape'); await sleep(250);
    const stopped = await page.evaluate(() => ({ meta: document.getElementById('fe-ql-ai-out-meta').textContent, retry: !document.getElementById('fe-ql-ai-retry').hidden, stop: !document.getElementById('fe-ql-ai-stop').hidden }));
    check(await pvOpen(page) && /stopped$/.test(stopped.meta) && stopped.retry && !stopped.stop, `Esc in the box stops the answer first and keeps what came: ${JSON.stringify(stopped)}`);
    await shotAt(page, 'preview-stopped');
    await page.keyboard.press('Escape'); await sleep(250);
    check(!(await pvOpen(page)), 'the next Esc closes the preview');

    await openPreview(page, 'readme.md');
    const kept = await page.evaluate(() => ({ out: !document.getElementById('fe-ql-ai-out').hidden, q: document.getElementById('fe-ql-ai-out-q').textContent, body: document.getElementById('fe-ql-ai-out-body').textContent, retry: !document.getElementById('fe-ql-ai-retry').hidden }));
    check(kept.out && kept.q === 'Stream code' && /const a/.test(kept.body) && kept.retry, `a file opened again still has its last answer: ${JSON.stringify(kept)}`);
    await waitReady(page);
    const calls = h.lmCalls().filter(c => c.args[0] === 'q').length;
    await page.click('#fe-ql-ai-retry');
    await page.waitForFunction(() => /in 1,204/.test(document.getElementById('fe-ql-ai-out-meta')?.textContent ?? ''), { timeout: 15000 });
    check(h.lmCalls().filter(c => c.args[0] === 'q').length === calls + 1, 'Retry asks the same question again');

    await page.type('#fe-ql-ai-q', 'Second question');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => /in 1,204/.test(document.getElementById('fe-ql-ai-out-meta')?.textContent ?? '') && /Second/.test(document.getElementById('fe-ql-ai-out-q')?.textContent ?? ''), { timeout: 15000 });
    const second = await page.evaluate(() => ({ q: document.getElementById('fe-ql-ai-out-q').textContent, body: document.getElementById('fe-ql-ai-out-body').textContent, box: document.getElementById('fe-ql-ai-q').value }));
    check(second.box === '' && !/const a/.test(second.body) && /Local answer/.test(second.body), `a new question replaces the old answer and leaves the box empty: ${JSON.stringify(second)}`);
    const hist = await h.store.json('bfb-ask-history-v1', {});
    const pv = Object.entries(hist).filter(([k]) => k.endsWith('/readme.md')).flatMap(([, cs]) => cs).filter(c => c.id.startsWith('pv-'));
    check(pv.length === 2 && pv.some(c => c.turns.length === 1 && c.turns[0].q === 'Stream code'), `each opening of the preview files its questions as a chat of its own: ${JSON.stringify(pv.map(c => c.turns.map(t => t.q)))}`);
    await page.keyboard.press('Escape'); await sleep(200);
  });

  // 4. One "model is not running" message, with Retry, on every surface.
  await phase('model-down message', async () => {
    writeFileSync(h.lmDown, '');
    await openPreview(page, 'readme.md');
    await page.waitForFunction(() => /not running/.test(document.getElementById('fe-ql-ai-chip-txt')?.textContent ?? ''), { timeout: 15000 });
    const dn = await page.evaluate(() => ({
      chip: document.getElementById('fe-ql-ai-chip-txt').textContent, recheck: !document.getElementById('fe-ql-ai-recheck').hidden,
      btns: [...document.querySelectorAll('.fe-ql-ai-btn')].map(b => [b.disabled, b.title]), qDisabled: document.getElementById('fe-ql-ai-q').disabled,
    }));
    check(DOWN.test(dn.chip) && dn.recheck && dn.btns.every(([off, t]) => off && DOWN.test(t)) && dn.qDisabled, `with the model down the preview says why once, on the disabled buttons too, and offers Retry: ${JSON.stringify(dn)}`);
    await shotAt(page, 'preview-down');
    await page.keyboard.press('Escape'); await sleep(200);
    // A click while the check is still running waits for it, and a down model runs nothing.
    writeFileSync(h.lmSlowStatus, '');
    const before = h.lmCalls().filter(c => c.args[0] === 'q').length;
    await openPreview(page, 'readme.md');
    await page.waitForFunction(() => !document.getElementById('fe-ql-copy').disabled, { timeout: 5000 });
    const early = await page.evaluate(() => { const b = document.getElementById('fe-ql-ai-sum'); const was = document.getElementById('fe-ql-ai-chip-txt').textContent; b.click(); return was; });
    await page.waitForFunction(() => /not running/.test(document.getElementById('fe-ql-ai-chip-txt')?.textContent ?? ''), { timeout: 15000 });
    await sleep(300);
    const after = await page.evaluate(() => ({ out: !document.getElementById('fe-ql-ai-out').hidden, body: document.getElementById('fe-ql-ai-out-body').textContent }));
    const ran = h.lmCalls().filter(c => c.args[0] === 'q').length - before;
    check(/checking/.test(early) && !DOWN.test(after.body) && ran === 0, `Summarize clicked during the check runs nothing once the model is found down: ${JSON.stringify({ early, ...after, ran })}`);
    await page.keyboard.press('Escape'); await sleep(200);
    unlinkSync(h.lmDown);
    const before2 = h.lmCalls().filter(c => c.args[0] === 'q').length;
    await openPreview(page, 'readme.md');
    await page.waitForFunction(() => !document.getElementById('fe-ql-copy').disabled, { timeout: 5000 });
    const early2 = await chipText(page);
    await page.evaluate(() => document.getElementById('fe-ql-ai-sum').click());
    await waitReady(page);
    await page.waitForFunction(() => /Local answer/.test(document.getElementById('fe-ql-ai-out-body')?.textContent ?? '') && document.getElementById('fe-ql-ai-out-q').textContent === 'Summarize', { timeout: 15000 }).catch(() => {});
    const ran2 = h.lmCalls().filter(c => c.args[0] === 'q').length - before2;
    check(/checking/.test(early2) && ran2 === 1, `and once the model is found ready, the held click runs once: ${JSON.stringify({ early2, ran2 })}`);
    unlinkSync(h.lmSlowStatus);
    writeFileSync(h.lmDown, '');
    await page.keyboard.press('Escape'); await sleep(200);
    await page.click('#fe-settings-btn');
    await page.waitForSelector('#fe-settings-modal .fe-dlg-box');
    await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="ai"]');
    await page.waitForFunction(() => /not running/.test(document.getElementById('fe-st-ai-sub')?.textContent ?? ''), { timeout: 15000 });
    check(DOWN.test(await page.$eval('#fe-st-ai-sub', s => s.textContent)), 'Settings says the same thing');
    await page.keyboard.press('Escape');

    await h.store.set('bfb-lens-v1', 'ask');
    const down = await h.browser.newPage();
    await down.setViewport({ width: 1400, height: 900 });
    await down.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
    await down.waitForFunction(() => /Local model is off/.test(document.getElementById('fe-ask-state')?.textContent ?? ''), { timeout: 15000 });
    const ad = await down.evaluate(() => {
      const st = document.getElementById('fe-ask-status'), rb = document.getElementById('fe-ask-recheck');
      return {
        state: document.getElementById('fe-ask-state').textContent, tip: st.title, retry: !rb.hidden && !rb.textContent.trim() && !!rb.querySelector('svg'),
        oneLine: st.getBoundingClientRect().height < 30 && st.scrollWidth <= st.clientWidth + 1,
        chips: [...document.querySelectorAll('.fe-ask-chip')].map(c => [c.disabled, c.title]), go: [document.getElementById('fe-ask-go').disabled, document.getElementById('fe-ask-go').title],
      };
    });
    // Owner, 2026-10-27: the notice was too large; one terse line, the how-to in its tooltip, Retry as an icon.
    check(ad.state === 'Local model is off' && DOWN.test(ad.tip) && ad.retry && ad.oneLine && ad.chips.every(([off, t]) => off && /Local model is off/.test(t)) && ad.go[0] && /Local model is off/.test(ad.go[1]),
      `Ask says it in one terse line with the how-to on hover, Retry is an icon, and its disabled buttons say why: ${JSON.stringify(ad)}`);
    await shotAt(down, 'ask-down', { x: 0, y: 40, width: 420, height: 520 });
    unlinkSync(h.lmDown);
    await down.click('#fe-ask-recheck');
    await down.waitForFunction(() => !document.getElementById('fe-ask-q').disabled, { timeout: 15000 });
    check(await down.$eval('#fe-ask-status', s => s.hidden), 'Retry finds the model once it is running and the form wakes');
    // A remote model does not need the local one, so Ask shows no notice for it.
    writeFileSync(h.lmDown, '');
    await h.store.set('bfb-ask-model-v1', 'gemini:gemini-3.5-flash');
    await down.reload({ waitUntil: 'load' });
    await down.waitForFunction(() => !document.getElementById('fe-ask-q')?.disabled, { timeout: 15000 }).catch(() => null);
    await sleep(800);
    const gem = await down.evaluate(() => ({ hidden: document.getElementById('fe-ask-status').hidden, q: !document.getElementById('fe-ask-q').disabled }));
    check(gem.hidden && gem.q, `with Gemini picked and the local model down, Ask shows no notice and stays usable: ${JSON.stringify(gem)}`);
    unlinkSync(h.lmDown);
    await h.store.set('bfb-ask-model-v1', '');
    await down.close();
  });

  // 5. A page whose extension was reloaded says so, before anything fails.
  await phase('connection banner', async () => {
    await h.store.set('bfb-lens-v1', 'places');
    const stale = await h.open();
    await stale.setViewport({ width: 1400, height: 900 });
    check(!(await stale.$('#fe-conn')), 'no connection banner while the extension is there');
    await h.sw.evaluate(() => chrome.runtime.reload()).catch(() => null);
    await stale.waitForSelector('#fe-conn', { timeout: 15000 }).catch(() => null);
    const conn = await stale.evaluate(() => ({ text: document.getElementById('fe-conn')?.textContent ?? '', btn: !!document.getElementById('fe-conn-reload') }));
    check(/reloaded/.test(conn.text) && conn.btn, `the open page says the extension went away and offers a refresh: ${JSON.stringify(conn)}`);
    await shotAt(stale, 'connection-lost', { x: 0, y: 0, width: 1400, height: 160 });
  });

} finally {
  for (const r of results) console.log(r);
  if (existsSync(h.lmDown)) unlinkSync(h.lmDown);
  await h.close();
}
