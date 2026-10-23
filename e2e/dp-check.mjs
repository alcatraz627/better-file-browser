// Checks that every decision page renders in bfb: a copy of gcc's registry is
// opened page by page, and each must draw one card per decision and item,
// load every picture and mock page it names, and throw no page error. The
// Decisions lens must list them all, which proves the host round trip.
// Prints READY or FAIL per page, a SKIPPED line for what cannot be checked
// yet, and the runtime. The live registry is copied, never opened in place.
//
//   node e2e/dp-check.mjs [slug ...]     check all pages, or the ones named
//   node e2e/dp-check.mjs --self-test    prove a broken config and a dead host fail
//   add --shots to save a screenshot of each page as e2e/shots/dp-check-<slug>.png
import { cpSync, readdirSync, existsSync, writeFileSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { launch, shot } from './harness.mjs';

const LIVE = join(homedir(), '.claude/assets/decision-pages');
const args = process.argv.slice(2);
const selfTest = args.includes('--self-test');
const shots = args.includes('--shots');
const wanted = args.filter(a => !a.startsWith('--'));
const t0 = Date.now();
const lines = [];
let failed = 0;
const h = await launch();
try {
  const reg = h.dpRegistry;
  const slugs = selfTest ? [] : readdirSync(LIVE).filter(s => !s.startsWith('.') && existsSync(join(LIVE, s, 'config.json')) && (!wanted.length || wanted.includes(s)));
  for (const s of slugs) cpSync(join(LIVE, s), join(reg, s), { recursive: true, preserveTimestamps: true });
  if (selfTest) {
    mkdirSync(join(reg, 'good-page'));
    writeFileSync(join(reg, 'good-page', 'config.json'), JSON.stringify({ title: 'Good', decisions: [{ id: 'D1', question: 'Q?', options: [{ code: 'a', label: 'A', rec: true }] }] }));
    mkdirSync(join(reg, 'broken-page'));
    writeFileSync(join(reg, 'broken-page', 'config.json'), '{"title": "Broken", "decisions": [');
    slugs.push('good-page', 'broken-page');
  }

  const tab = await h.open(h.fixture);
  await tab.setViewport({ width: 1400, height: 900 });
  const errors = [];
  tab.on('pageerror', e => errors.push(String(e.message ?? e)));

  // Host round trip: the lens lists every page we copied.
  const lensCount = async () => {
    await tab.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
    await tab.click('#fe-rail-decisions');
    await tab.waitForSelector('.fe-dpl-row, #fe-dpl-list .empty:not([data-state="loading"])', { timeout: 10000 });
    await tab.evaluate(() => document.querySelectorAll('.fe-dpl-band').forEach(d => { d.open = true; }));
    return tab.evaluate(() => ({ rows: document.querySelectorAll('.fe-dpl-row').length, failed: !!document.querySelector('#fe-dpl-list .empty[data-state="failed"]'), text: document.querySelector('#fe-dpl-list .empty')?.textContent?.trim() ?? '' }));
  };
  const lens = await lensCount();
  const hostOk = lens.rows === slugs.length;
  lines.push(`${hostOk ? 'READY' : 'FAIL '} host: the Decisions lens lists ${lens.rows} of ${slugs.length} pages${lens.text ? ` (${lens.text})` : ''}`);
  if (!hostOk) failed++;

  for (const slug of slugs) {
    errors.length = 0;
    const why = [];
    let cfg = null;
    try { cfg = JSON.parse(readFileSync(join(reg, slug, 'config.json'), 'utf8')); } catch (e) { why.push(`config.json does not parse: ${e.message}`); }
    await tab.goto('file://' + join(reg, slug) + '/', { waitUntil: 'load' });
    if (cfg) {
      try { await tab.waitForSelector('#fe-dp:not([hidden]) .fe-dp-card', { timeout: 8000 }); }
      catch { why.push('the page never drew its cards'); }
      await tab.evaluate(() => document.querySelectorAll('#fe-dp img').forEach(i => { i.loading = 'eager'; }));
      await new Promise(r => setTimeout(r, 600));
      const got = await tab.evaluate(async () => {
        const imgs = [...document.querySelectorAll('#fe-dp img')];
        await Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 4000); })));
        return { cards: document.querySelectorAll('.fe-dp-card').length, broken: imgs.filter(i => !i.naturalWidth).map(i => decodeURIComponent(i.src.split('/').pop())), frames: document.querySelectorAll('#fe-dp iframe').length };
      });
      const want = (cfg.decisions?.length ?? 0) + (cfg.sections?.length ?? 0);
      if (got.cards !== want) why.push(`${got.cards} cards for ${want} decisions and items`);
      if (got.broken.length) why.push(`${got.broken.length} picture(s) did not load: ${[...new Set(got.broken)].slice(0, 4).join(', ')}`);
      if (errors.length) why.push(`page error: ${errors[0]}`);
      if (shots) await shot(tab, `dp-check-${slug}`);
      lines.push(`${why.length ? 'FAIL ' : 'READY'} ${slug}: ${why.length ? why.join('; ') : `${got.cards} cards${got.frames ? `, ${got.frames} live mock(s)` : ''}`}`);
    } else lines.push(`FAIL  ${slug}: ${why.join('; ')}`);
    if (why.length) failed++;
  }

  if (selfTest) {
    // A dead host: the registry disappears, and the lens must say so.
    renameSync(reg, reg + '-gone');
    const dead = await lensCount();
    renameSync(reg + '-gone', reg);
    const deadFails = dead.rows === 0 && /could not be listed/i.test(dead.text);
    lines.push(`${deadFails ? 'READY' : 'FAIL '} self-test: a dead host shows as a failure in the lens (${dead.text})`);
    const brokenFailed = lines.some(l => l.startsWith('FAIL  broken-page'));
    const goodReady = lines.some(l => l.startsWith('READY good-page'));
    lines.push(`${brokenFailed && goodReady ? 'READY' : 'FAIL '} self-test: a broken config fails and a good one passes`);
    failed = (deadFails ? 0 : 1) + (brokenFailed && goodReady ? 0 : 1);
  }
  lines.push('SKIPPED answer round trip (compose, submit, parse): gcc has not shipped those verbs on decision-page.sh yet');
} finally {
  await h.close();
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(lines.join('\n'));
  console.log(`\n${failed ? `${failed} check(s) failed` : selfTest ? 'self-test passed' : 'all pages READY'} · ${secs}s`);
  if (failed) process.exitCode = 1;
}
