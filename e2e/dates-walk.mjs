// Dates read as a person says them, never as ISO stamps: a comment's time and
// its hover, front matter values, and every title on the page.
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
const ISO = /\d{4}-\d\d-\d\dT\d\d:\d\d/;

try {
  const doc = join(h.fixture, 'dated.md');
  writeFileSync(doc, '---\ntitle: Dated\ncreated: 2026-10-20T09:15:00Z\n---\n\n# Dated\n\nA paragraph with words to comment on.\n');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture], tooltips: true }));
  cli('comments', 'new', doc, '--quote', 'words to comment on', 'When was this?');

  const page = await h.open(h.fixture);
  await applyTheme(page);
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-md');
  await page.click('#fe-fp-cm');
  await page.waitForSelector('#fe-cm .fe-cm-th', { timeout: 8000 }).catch(() => null);
  await page.click('#fe-cm .fe-cm-th');
  await sleep(300);

  const fm = await page.$eval('.fe-md-fm', e => e.innerText).catch(() => '');
  check(fm && !ISO.test(fm) && /Oct 20|Tue|Mon|Wed|Thu|Fri|Sat|Sun|Today|Yesterday/.test(fm), `front matter shows the date in words: ${JSON.stringify(fm)}`);

  const time = '#fe-cm .fe-cm-who time';
  await page.hover(time);
  await page.waitForSelector('#fe-hint.on', { timeout: 2000 }).catch(() => null);
  const tip = await page.$eval('#fe-hint', e => e.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
  check(tip && !ISO.test(tip) && /Today \d\d:\d\d/.test(tip), `a comment's time hovers as "Today hh:mm": "${tip}"`);
  await page.mouse.move(0, 0);
  await sleep(200);

  const leaks = await page.evaluate(iso => {
    const re = new RegExp(iso);
    const out = [];
    for (const el of document.querySelectorAll('#fe [title], #fe [aria-label]')) {
      const v = (el.getAttribute('title') || '') + ' ' + (el.getAttribute('aria-label') || '');
      if (re.test(v)) out.push(v.slice(0, 80));
    }
    const walker = document.createTreeWalker(document.getElementById('fe'), NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) if (re.test(n.textContent) && !n.parentElement.closest('pre, code, textarea')) out.push(n.textContent.trim().slice(0, 80));
    return out;
  }, ISO.source);
  check(leaks.length === 0, `no ISO stamp anywhere on the page, text or hover: ${JSON.stringify(leaks)}`);
  await shot(page, 'dates-file-page');
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
