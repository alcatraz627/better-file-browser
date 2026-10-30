// A directions doc opens with "What to do next": what waits on you (with what
// is needed and what happens if you say nothing), what an agent can pick up
// now, and whether the doc is stale. An item jumps to its row and lights it.
// Runs on the synthetic fixtures, then on the real docs when they are on disk
// (copied into the throwaway fixture; never written back).
// BFB_THEME=light runs it on the light theme.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, applyTheme, shot } from './harness.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const open = async (src, name) => {
  const dir = join(h.fixture, name.replace(/\W/g, '_'));
  const fs = await import('node:fs');
  fs.mkdirSync(dir, { recursive: true });
  const doc = join(dir, 'DIRECTIONS.md');
  writeFileSync(doc, readFileSync(src, 'utf8'));
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('.fe-md', { timeout: 8000 });
  await page.waitForSelector('.fe-dir-next', { timeout: 4000 }).catch(() => null);
  await sleep(300);
  return page;
};
const headOf = page => page.evaluate(() => {
  const g = k => [...document.querySelectorAll(`.fe-dir-next-g[data-g="${k}"] li`)].map(li => li.innerText.replace(/\s+/g, ' ').trim());
  const tips = k => [...document.querySelectorAll(`.fe-dir-next-g[data-g="${k}"] li .fe-dir-next-i`)].map(b => b.title);
  const head = document.querySelector('.fe-dir-next');
  const bar = document.querySelector('.fe-dir-sum');
  return { shown: !!head, above: !!head && !!bar && !!(head.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING), you: g('you'), youTips: tips('you'), ready: g('ready'), stale: document.querySelector('.fe-dir-next-stale')?.textContent ?? '', youN: document.querySelector('.fe-dir-next-g[data-g="you"] .fe-grp-n')?.textContent ?? '', needsChip: document.querySelector('.fe-dv-chip[data-state="needs"] b')?.textContent ?? '0', none: [...document.querySelectorAll('.fe-dir-next-none')].map(p => p.textContent) };
});

try {
  // The standard shape.
  let page = await open(join(ROOT, 'tests/fixtures/directions/standard.md'), 'standard');
  let hd = await headOf(page);
  check(hd.shown && hd.above, `the head sits above the state bar: ${JSON.stringify({ shown: hd.shown, above: hd.above })}`);
  check(hd.you.length === 3 && /^W1 Pick the moisture sensor A yes on model B/.test(hd.you[0]) && !/If you say nothing/.test(hd.you[0]) && /^A1/.test(hd.you[2]),
    `On you lists the asks first, one line each with what is needed: ${JSON.stringify(hd.you)}`);
  check(/If you say nothing: I order model B on Friday/.test(hd.youTips[0]), `what silence means reads on hover: ${JSON.stringify(hd.youTips[0])}`);
  check(hd.ready.map(t => t.split(' ')[0]).join() === 'S2,A3,S3', `Ready lists now before next: ${JSON.stringify(hd.ready)}`);
  check(/updated \d+ days ago/.test(hd.stale), `the doc says it is stale: "${hd.stale}"`);
  check(hd.youN === hd.needsChip, `On you counts the same rows as the needs-you chip: ${hd.youN} and ${hd.needsChip}`);
  await shot(page, 'directions-head');

  // An item jumps to its row and lights it.
  await page.click('.fe-dir-next-g[data-g="ready"] li:nth-child(2) .fe-dir-next-i');
  await sleep(150);
  const jump = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.fe-md tbody tr')].find(r => r.cells[0]?.textContent.trim() === 'A3');
    const r = row.getBoundingClientRect();
    return { flash: row.hasAttribute('data-flash'), anims: row.cells[0].getAnimations().length };
  });
  await sleep(900);
  const inView = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.fe-md tbody tr')].find(r => r.cells[0]?.textContent.trim() === 'A3');
    const r = row.getBoundingClientRect();
    return r.top > 0 && r.bottom < innerHeight;
  });
  check(jump.flash && jump.anims > 0 && inView, `a click jumps to the row and lights it: ${JSON.stringify({ ...jump, inView })}`);
  await page.close();

  // A doc with no Waiting section and no date.
  page = await open(join(ROOT, 'tests/fixtures/directions/buckets.md'), 'buckets');
  hd = await headOf(page);
  check(hd.shown && hd.you.length === 1 && /^H1 Crash on empty page/.test(hd.you[0]) && !hd.stale, `a doc without a Waiting section builds On you from its red rows: ${JSON.stringify(hd)}`);
  await page.close();

  // The real docs, when present: a head shows and every group is drawn.
  const real = [
    '/Users/alcatraz627/Code/Versable/versable-ingest/docs/plan/DIRECTIONS.md',
    '/Users/alcatraz627/Code/Versable/slack-automation/docs/plan/DIRECTIONS.md',
    '/Users/alcatraz627/Code/Versable/enhancement-product/frontend/.claude/notes/extractor-and-e2e-directions.md',
  ].filter(existsSync);
  for (const src of real) {
    page = await open(src, src.split('/').slice(-4).join('-'));
    hd = await headOf(page);
    const name = src.split('/Versable/')[1].split('/')[0];
    check(hd.shown && (hd.you.length + hd.ready.length) > 0, `${name}: the head shows ${hd.you.length} on you and ${hd.ready.length} ready${hd.stale ? `, "${hd.stale}"` : ''}`);
    check(hd.youN === hd.needsChip, `${name}: On you counts the same rows as the needs-you chip: ${hd.youN} and ${hd.needsChip}`);
    if (name === 'slack-automation') await shot(page, 'directions-head-real');
    await page.close();
  }
  if (!real.length) results.push('SKIP the real docs are not on this machine');
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
