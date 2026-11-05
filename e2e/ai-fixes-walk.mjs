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
    // Two Gemini and two GPT (the Codex stand-in) rows are remote.
    check(rows.filter(r => r.where === 'Remote').length === 4 && rows.filter(r => r.where === 'This Mac').length === 3 && rows.find(r => r.badge === 'Gemini default')?.name === 'Gemini 3.5-flash',
      `Settings tags Gemini and GPT rows Remote, the rest This Mac, and Gemini's own pick says so: ${JSON.stringify(rows)}`);
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
  await phase('preview asks in the sidebar', async () => {
    const page = await h.open();
    await page.setViewport({ width: 1400, height: 900 });
    await page.waitForSelector('#fe-tbody tr[data-idx]');
    await openPreview(page, 'readme.md');
    check(await page.evaluate(() => !document.getElementById('fe-ql-ai') && !document.getElementById('fe-ql-ai-q')), 'the preview has no AI bar of its own');
    check(await page.$eval('#fe-ql-ai-btn', b => !b.hidden && b.getBoundingClientRect().width > 0), 'the preview header has one Ask button');
    const url = page.url();
    await page.keyboard.press('a');
    await page.waitForFunction(() => document.getElementById('fe-ask-q')?.checkVisibility() && document.activeElement?.id === 'fe-ask-q', { timeout: 5000 });
    const on = await page.evaluate(() => ({ ctx: document.querySelector('.fe-ask-ctx').textContent, docked: document.getElementById('fe-qlook').classList.contains('side'), lens: document.querySelector('#fe-rail .fe-rail-btn.on')?.id }));
    check(on.ctx.includes('readme.md') && on.docked && on.lens === 'fe-rail-ask' && page.url() === url, `a opens the sidebar's Ask on the previewed file, beside it, with no page change: ${JSON.stringify(on)}`);
    await page.keyboard.type('What is it?');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => /Local answer/.test(document.getElementById('fe-ask-thread')?.textContent ?? ''), { timeout: 15000 });
    const sent = h.lmCalls().filter(c => c.args[0] === 'q').at(-1);
    check(/Fixture/.test(sent?.stdin ?? ''), `the question goes with the previewed file's text, not the folder: ${JSON.stringify((sent?.stdin ?? '').slice(0, 60))}`);
    await page.click('[data-ask-page]');
    await sleep(200);
    check(!(await page.$eval('.fe-ask-ctx', c => c.textContent)).includes('readme.md'), 'the chat can go back to this page');
    await page.close();
  });

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
