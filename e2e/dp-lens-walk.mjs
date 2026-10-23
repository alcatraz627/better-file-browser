// The Decisions lens over a scratch registry (the live one is never touched):
// pages band into waiting, answered and never answered, newest first, with
// origin, item count and age; a waiting page never opened carries a dot; a
// new page shows up without a reload; opening a page tells gcc it was seen.
// gcc's command is a stand-in here that logs each call (harness.mjs).
// Rows are named for the hub's parity ledger (E2 to E5).
//
//   node e2e/dp-lens-walk.mjs      (BFB_THEME=light for the light theme)
import { mkdirSync, writeFileSync, utimesSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, shot, applyTheme } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(res => setTimeout(res, ms));
const h = await launch();
try {
  const reg = h.dpRegistry;
  const page = (slug, ageDays, cfg, ...dots) => {
    const d = join(reg, slug);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'config.json'), JSON.stringify({ title: slug, decisions: [{ id: 'D1', question: 'Q?', options: [{ code: 'a', label: 'A', rec: true }] }], ...cfg }));
    const t = Date.now() / 1000 - ageDays * 86400;
    utimesSync(join(d, 'config.json'), t, t);
    for (const dot of dots) writeFileSync(join(d, dot), '{}');
  };
  page('fresh-ask', 0.01, { title: 'Fresh ask', origin: { project: 'bfb', topic: 'gallery' }, sections: [{ id: 's1' }, { id: 's2' }] });
  page('listed-old', 30, { title: 'Listed but old' });
  page('answered-one', 2, { title: 'Answered one' }, '.answer.json', '.seen.json');
  page('old-quiet', 40, { title: 'Old and quiet' });
  writeFileSync(join(reg, '.pending.txt'), 'listed-old\n');

  const tab = await h.open(h.fixture);
  await tab.setViewport({ width: 1400, height: 900 });
  await applyTheme(tab);
  await tab.click('#fe-rail-decisions');
  await tab.waitForSelector('.fe-dpl-row', { timeout: 8000 });
  const read = () => tab.evaluate(() => [...document.querySelectorAll('.fe-dpl-band')].map(b => ({
    band: b.dataset.band, open: b.open, label: b.querySelector('summary').textContent.trim(),
    rows: [...b.querySelectorAll('.fe-dpl-row')].map(r => ({
      slug: r.dataset.slug, title: r.querySelector('.fe-dpl-title').textContent, origin: r.querySelector('.fe-dpl-origin')?.textContent ?? '',
      age: r.querySelector('.fe-dpl-age').textContent, ageTip: r.querySelector('.fe-dpl-age').title, n: r.querySelector('.fe-dpl-n')?.textContent ?? '',
      unseen: r.classList.contains('unseen'), dot: !!r.querySelector('.fe-dpl-dot'), bg: getComputedStyle(r).backgroundColor,
    })),
  })));
  let bands = await read();
  const by = slug => bands.flatMap(b => b.rows).find(r => r.slug === slug);
  check(bands.map(b => b.label).join('|') === 'Waiting on you2|Answered1|Never answered1' && bands[2].open === false,
    `E2 three bands with counts, never-answered folded: ${JSON.stringify(bands.map(b => [b.label, b.open]))}`);
  check(bands[0].rows.map(r => r.slug).join() === 'fresh-ask,listed-old', `E2 newest first inside a band: ${bands[0].rows.map(r => r.slug)}`);
  check(by('listed-old') && bands[0].rows.some(r => r.slug === 'listed-old'), 'E3 a page gcc lists as pending waits even when old');
  check(bands[0].rows.some(r => r.slug === 'fresh-ask'), 'E3 a fresh unanswered page waits even when nobody listed it');
  const fresh = by('fresh-ask');
  check(fresh.n === '3' && fresh.age === '14 min' && /\d{4}/.test(fresh.ageTip), `E2 a row shows its item count and age, full date on hover: ${JSON.stringify({ n: fresh.n, age: fresh.age, tip: fresh.ageTip })}`);
  check(fresh.origin === 'bfb · gallery', `E5 a row shows where it came from: ${fresh.origin}`);
  check(fresh.unseen && fresh.dot && by('answered-one').unseen === false && !by('answered-one').dot && fresh.bg !== by('answered-one').bg,
    `E4 a waiting page never opened has a dot and an amber wash; an opened one has neither: ${JSON.stringify([fresh.bg, by('answered-one').bg])}`);
  const lefts = await tab.evaluate(() => [...document.querySelectorAll('.fe-dpl-row')].filter(r => r.offsetParent).map(r => Math.round(r.querySelector('.fe-dpl-title').getBoundingClientRect().left)));
  check(new Set(lefts).size === 1, `every row's title starts at the same place, dot or not: ${JSON.stringify(lefts)}`);
  await shot(tab, 'dp-lens');
  await tab.click('#fe-dpl-q');
  await tab.keyboard.type('gallery');
  const filtered = await tab.$$eval('.fe-dpl-row', r => r.map(x => x.dataset.slug));
  await tab.keyboard.press('Escape');
  const cleared = await tab.evaluate(() => ({ q: document.getElementById('fe-dpl-q').value, rows: document.querySelectorAll('.fe-dpl-row').length }));
  check(filtered.join() === 'fresh-ask' && cleared.q === '' && cleared.rows === 4, `the filter matches a page's topic, and Esc clears it: ${JSON.stringify({ filtered, cleared })}`);

  // A new ask appears on the next poll, no reload.
  page('brand-new', 0, { title: 'Brand new ask' });
  let appeared = false;
  for (let i = 0; i < 14 && !appeared; i++) { await wait(1000); appeared = await tab.$('.fe-dpl-row[data-slug="brand-new"]') !== null; }
  check(appeared, 'E2 a new page shows up without a reload');

  // Opening a page goes there, draws it as a decision page and tells gcc it was seen.
  await tab.click('.fe-dpl-row[data-slug="fresh-ask"]');
  await tab.waitForSelector('#fe-dp:not([hidden]) .fe-dp-title', { timeout: 8000 });
  const readCalls = () => existsSync(h.dpCalls) ? readFileSync(h.dpCalls, 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
  const t0 = Date.now();
  let calls = readCalls();
  while (!calls.length && Date.now() - t0 < 6000) { await wait(200); calls = readCalls(); }
  results.push(`info seen call arrived after ${Date.now() - t0} ms`);
  check(tab.url().endsWith('/decision-pages/fresh-ask/') && calls.filter(c => c.verb === 'seen' && c.slug === 'fresh-ask').length === 1,
    `opening a page from the lens shows it and asks gcc to mark it seen once: ${JSON.stringify(calls)}`);
  await tab.click('#fe-rail-decisions');
  await wait(1500);
  bands = await read();
  check(by('fresh-ask') && !by('fresh-ask').dot, 'E4 once opened, its dot is gone');
  await tab.goBack({ waitUntil: 'load' });
} finally {
  console.log(results.join('\n'));
  await h.close();
}
