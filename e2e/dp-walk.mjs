// Decision pages in bfb, walked on a copy of a real page folder (the live
// registry is never touched): the folder opens as the page, not a listing;
// Files and back switch views and the choice is kept for the tab; a folder
// whose config.json is not a decision page stays a plain listing.
//
//   node e2e/dp-walk.mjs      (BFB_THEME=light for the light theme)
import { cpSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { launch, shot, applyTheme } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const h = await launch();
try {
  const slug = join(h.fixture, 'dp-sample');
  cpSync(join(homedir(), '.claude/assets/decision-pages/bfb-open-asks'), slug, { recursive: true });
  const other = join(h.fixture, 'not-a-page');
  mkdirSync(other);
  writeFileSync(join(other, 'config.json'), '{"name":"some tool","version":1}');

  const page = await h.open(slug);
  await page.setViewport({ width: 1400, height: 900 });
  await applyTheme(page);
  await page.waitForSelector('#fe-dp:not([hidden]) .fe-dp-title', { timeout: 8000 });
  const first = await page.evaluate(() => ({
    title: document.querySelector('.fe-dp-title')?.textContent,
    origin: [...document.querySelectorAll('.fe-dp-origin .chip')].length,
    intro: !!document.querySelector('.fe-dp-intro'),
    count: document.querySelector('.fe-dp-count')?.textContent,
    listing: getComputedStyle(document.getElementById('fe-scroll')).display,
  }));
  check(first.title === JSON.parse(readFileSync(join(slug, 'config.json'), 'utf8')).title && first.listing === 'none' && /decision/.test(first.count ?? ''), `the folder opens as its decision page, listing out of sight: ${JSON.stringify(first)}`);
  const align = await page.evaluate(() => {
    const t = document.querySelector('.fe-dp-title').getBoundingClientRect().left;
    const p = document.querySelector('.fe-dp-intro p');
    const r = document.createRange(); r.selectNodeContents(p);
    return { title: Math.round(t), intro: Math.round(r.getClientRects()[0]?.left ?? -1), inner: p.firstElementChild?.outerHTML.slice(0, 80) };
  });
  check(Math.abs(align.title - align.intro) <= 2, `the intro lines up with the title: ${JSON.stringify(align)}`);
  await shot(page, 'dp-head');

  await page.click('#fe-dp-files');
  const files = await page.evaluate(() => ({ dp: document.getElementById('fe-dp').hidden, listing: getComputedStyle(document.getElementById('fe-scroll')).display, back: !document.getElementById('fe-dp-back').hidden }));
  check(files.dp && files.listing !== 'none' && files.back, `Files shows the listing with a way back: ${JSON.stringify(files)}`);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-dp-back', { timeout: 8000 });
  const kept = await page.evaluate(() => document.getElementById('fe-dp').hidden && !document.getElementById('fe-dp-back').hidden);
  check(kept, 'the listing choice is kept for this tab across a reload');
  await page.click('#fe-dp-back');
  check(await page.$eval('#fe-dp', e => !e.hidden), 'Decision page brings the page back');

  await page.goto('file://' + other + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr', { timeout: 8000 });
  const plain = await page.evaluate(() => ({ dp: document.getElementById('fe-dp')?.hidden, rows: document.querySelectorAll('#fe-tbody tr').length, pending: document.getElementById('fe').classList.contains('fe-dp-pending') }));
  check(plain.dp === true && plain.rows > 0 && !plain.pending, `a folder whose config.json is not a decision page stays a listing: ${JSON.stringify(plain)}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
