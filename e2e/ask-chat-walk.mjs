// A chat in the Ask lens can be copied whole as markdown, saved to Notes whole
// or one answer at a time, and opened large over the page and put back
// without losing anything.
// BFB_THEME=light runs it on the light theme.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, applyTheme, shot } from './harness.mjs';

const h = await launch({ lmStub: true });
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  await h.browser.defaultBrowserContext().overridePermissions('file://', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']).catch(() => null);
  await h.store.edit('bfb-settings-v1', s => ({ ...s, notesRoot: h.notesDir, tooltips: true }));
  await h.store.set('bfb-lens-v1', 'ask');
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('#fe-ask-q', { timeout: 15000 });
  await sleep(600);
  check(await page.$eval('#fe-ask-copyall', b => b.disabled), 'with no chat yet, Copy chat is off');
  const top = await page.evaluate(() => {
    const m = document.querySelector('.fe-ask-model .fe-dd-btn').getBoundingClientRect();
    const first = document.getElementById('fe-ask-copyall').getBoundingClientRect();
    const row = document.querySelector('.fe-ask-top').getBoundingClientRect();
    return { modelRight: Math.round(m.right), firstLeft: Math.round(first.left), rowH: Math.round(row.height) };
  });
  check(top.modelRight <= top.firstLeft && top.rowH < 40, `the model picker and the header buttons share one row without overlapping: ${JSON.stringify(top)}`);

  await page.type('#fe-ask-q', 'What is this file?');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => { const a = document.querySelector('.fe-ask-turn .fe-ask-a'); return a && !a.querySelector('.fe-ask-wait') && a.textContent.trim().length > 3; }, { timeout: 20000 });
  await page.waitForFunction(() => !!document.querySelector('.fe-ask-turn .fe-ask-meta')?.textContent.trim(), { timeout: 20000 }).catch(() => null);
  await sleep(300);
  const answer = await page.$eval('.fe-ask-turn .fe-ask-a', a => a.textContent.trim().slice(0, 40));

  // Copy the whole chat.
  await page.click('#fe-ask-copyall');
  await sleep(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  const checked = await page.$eval('#fe-ask-copyall', b => b.hasAttribute('data-done'));
  check(/^# What is this file\?/.test(clip) && /## What is this file\?/.test(clip) && /readme\.md/.test(clip) && checked, `Copy chat puts the chat on the clipboard as markdown and shows the check: ${JSON.stringify(clip.slice(0, 120))}`);

  // Save one answer, then the whole chat, to Notes.
  const before = readdirSync(h.notesDir).filter(f => f.startsWith('chat-'));
  await page.hover('.fe-ask-turn');
  await page.click('.fe-ask-turn [data-act="note"]');
  await page.waitForFunction(() => /Saved to Notes as chat-/.test(document.getElementById('fe-toast')?.textContent ?? ''), { timeout: 5000 }).catch(() => null);
  const toast = await page.$eval('#fe-toast', t => t.textContent).catch(() => '');
  const saved = readdirSync(h.notesDir).filter(f => f.startsWith('chat-') && !before.includes(f));
  const text = saved[0] ? readFileSync(join(h.notesDir, saved[0]), 'utf8') : '';
  check(saved.length === 1 && /## What is this file\?/.test(text) && text.includes(answer.slice(0, 15)), `an answer saves to Notes as its own note: ${JSON.stringify({ toast, saved, head: text.slice(0, 80) })}`);
  await sleep(1200);
  await page.click('#fe-ask-save');
  await sleep(800);
  check(readdirSync(h.notesDir).filter(f => f.startsWith('chat-')).length === before.length + 2, 'the whole chat saves to Notes too');

  // Large and back.
  await page.click('#fe-ask-large');
  await sleep(400);
  const big = await page.evaluate(() => {
    const boxEl = document.querySelector('.fe-ask-large-box');
    const t = document.querySelector('.fe-ask-large-box #fe-ask-thread');
    return { open: !!boxEl, w: Math.round(boxEl?.getBoundingClientRect().width ?? 0), turns: t?.querySelectorAll('.fe-ask-turn').length ?? 0, pressed: document.getElementById('fe-ask-large').getAttribute('aria-pressed') };
  });
  check(big.open && big.w >= 900 && big.turns === 1 && big.pressed === 'true', `Open large moves the same chat into a wide panel: ${JSON.stringify(big)}`);
  await shot(page, 'ask-chat-large');
  await page.keyboard.press('Escape');
  await sleep(400);
  const back = await page.evaluate(() => ({ gone: !document.querySelector('.fe-ask-large'), inSide: !!document.querySelector('#fe-side #fe-ask-thread, #fe-sidebar #fe-ask-thread, aside #fe-ask-thread') || !!document.getElementById('fe-ask-thread')?.closest('[id*="side"]'), turns: document.querySelectorAll('#fe-ask-thread .fe-ask-turn').length }));
  check(back.gone && back.turns === 1, `Esc puts the chat back in the sidebar with nothing lost: ${JSON.stringify(back)}`);
  await shot(page, 'ask-chat-side');
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
