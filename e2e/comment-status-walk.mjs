// A thread shows whether it is open or done as a coloured icon, not a "Done"
// label: in the corner of a folded card, and left of the toggle in an open
// one. Reply is an icon with a tooltip that names its key.
// BFB_THEME=light runs it on the light theme.
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { launch, applyTheme, shot } from './harness.mjs';

const CLI = resolve(new URL('..', import.meta.url).pathname, 'native', 'bfb_docs.py');
const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_') && !k.startsWith('BFB_'))), BFB_DOCS_HOME: h.docsHome };
const cli = (...args) => {
  const r = spawnSync('python3', [CLI, '--json', ...args], { env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`bfb-docs ${args.join(' ')}: ${r.stderr}`);
  return JSON.parse(r.stdout);
};

try {
  const doc = join(h.fixture, 'status.md');
  writeFileSync(doc, '# Status\n\nOne paragraph to comment on.\n\nAnother paragraph that is settled.\n');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture], tooltips: true }));
  cli('comments', 'new', doc, '--quote', 'One paragraph', 'Still open.');
  const settled = cli('comments', 'new', doc, '--quote', 'Another paragraph', 'Settled.').results[0].thread;
  cli('comments', 'done', doc, settled);

  const page = await h.open(h.fixture);
  await applyTheme(page);
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-md');
  await page.click('#fe-fp-cm');
  await page.waitForSelector('#fe-cm .fe-cm-th', { timeout: 8000 });
  await sleep(300);

  const colourOf = sel => page.$eval(sel, e => getComputedStyle(e).color).catch(() => '');
  const tone = name => page.evaluate(n => { const d = document.createElement('i'); d.style.color = `var(${n})`; document.getElementById('fe').appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }, name);
  const warn = await tone('--tone-warn'), ok = await tone('--tone-ok');

  // Folded open thread: an open icon in its corner, no Done label anywhere.
  const folded = await page.$eval('#fe-cm .fe-cm-list > .fe-cm-th', th => {
    const s = th.querySelector(':scope > .fe-cm-status'); const r = s?.getBoundingClientRect(), c = th.getBoundingClientRect();
    return { state: s?.dataset.state, corner: !!r && c.right - r.right < 16 && r.top - c.top < 16, label: /\bDone\b/.test(th.innerText) };
  });
  check(folded.state === 'open' && folded.corner && !folded.label, `a folded open thread shows the open icon in its corner and no Done label: ${JSON.stringify(folded)}`);
  check(await colourOf('#fe-cm .fe-cm-list > .fe-cm-th > .fe-cm-status') === warn, 'the open icon is in the waiting colour');

  // Done group: the done icon, in the done colour.
  await page.click('#fe-cm .fe-cm-done > summary');
  await sleep(200);
  const doneCard = '#fe-cm .fe-cm-done .fe-cm-th > .fe-cm-status';
  check(await page.$eval(doneCard, e => e.dataset.state).catch(() => '') === 'done' && await colourOf(doneCard) === ok, 'a done thread shows the done icon in the done colour');
  check(!(await page.$$eval('#fe-cm .fe-cm-chip', cs => cs.some(c => /Done/.test(c.textContent)))), 'no "Done" chip is drawn');

  // Open thread: the icon sits left of the toggle, in the tools row.
  await page.click('#fe-cm .fe-cm-list > .fe-cm-th .fe-cm-q');
  await sleep(400);
  const row = await page.evaluate(() => {
    const th = document.querySelector('#fe-cm .fe-cm-th.on');
    const s = th.querySelector('.fe-cm-tools .fe-cm-status'), t = th.querySelector('.fe-cm-tools [data-a="done"]');
    const a = s?.getBoundingClientRect(), b = t?.getBoundingClientRect();
    return { status: s?.dataset.state, left: !!a && !!b && a.right <= b.left + 1 && Math.abs((a.top + a.height / 2) - (b.top + b.height / 2)) < 3, corner: !!th.querySelector(':scope > .fe-cm-status'), toggle: t?.getAttribute('aria-label'), text: t?.textContent.trim() };
  });
  check(row.status === 'open' && row.left && !row.corner && /^Mark done/.test(row.toggle) && row.text === '', `in an open thread the icon sits left of the Mark done icon: ${JSON.stringify(row)}`);

  // The toggle flips it: the icon turns done and the toggle reads Reopen.
  await page.click('#fe-cm .fe-cm-filters [data-f="all"]');
  await sleep(300);
  await page.click(`#fe-cm .fe-cm-th[data-id="${settled}"] .fe-cm-q`);
  await sleep(300);
  const reopen = await page.$eval('#fe-cm .fe-cm-th.on', th => ({ s: th.querySelector('.fe-cm-tools .fe-cm-status')?.dataset.state, t: th.querySelector('.fe-cm-tools [data-a="reopen"]')?.getAttribute('aria-label') }));
  check(reopen.s === 'done' && /^Reopen/.test(reopen.t ?? ''), `a done thread shows the done icon beside Reopen: ${JSON.stringify(reopen)}`);
  // Reply is an icon; its tooltip names it and its key.
  const rb = '#fe-cm .fe-cm-th.on [data-a="reply"]';
  const rInfo = await page.$eval(rb, b => ({ text: b.textContent.trim(), svg: !!b.querySelector('svg'), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }));
  check(rInfo.text === '' && rInfo.svg && Math.abs(rInfo.w - rInfo.h) <= 2, `Reply is a square icon button: ${JSON.stringify(rInfo)}`);
  await page.hover(rb);
  await page.waitForSelector('#fe-hint.on', { timeout: 2000 }).catch(() => null);
  const rTip = await page.$eval('#fe-hint', e => ({ text: e.innerText.replace(/\s+/g, ' ').trim(), kbd: [...e.querySelectorAll('kbd, .fe-hint-key, [class*="key"]')].map(k => k.textContent.trim()) })).catch(() => ({ text: '', kbd: [] }));
  check(/^Reply/.test(rTip.text) && /⌘\s*↵/.test(rTip.text) && !/\(⌘/.test(rTip.text), `the Reply tooltip names its key in the keys row: ${JSON.stringify(rTip)}`);
  await page.mouse.move(0, 0);
  await shot(page, 'comment-status');
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
