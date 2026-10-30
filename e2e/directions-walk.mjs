// A directions doc reads as a plan: a bar counts each state mark and narrows
// every table to one mark on a click, each section shows a meter of its rows,
// and each row's edge takes its state's tone. Runs on a copy of a real doc.
//
//   node e2e/directions-walk.mjs      (BFB_THEME=light for the light theme)
import { copyFileSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { launch, shot, applyTheme, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const h = await launch();
try {
  const real = '/Users/alcatraz627/Code/Versable/slack-automation/docs/plan/DIRECTIONS.md';
  const doc = join(h.fixture, 'DIRECTIONS.md');
  if (existsSync(real)) copyFileSync(real, doc);
  else writeFileSync(doc, '# Directions\n\nMarks: 🔴 needs you · 🟠 waiting · 🟢 ready\n\n## Waiting on you\n\n| id | ask |\n| --- | --- |\n| x | a key |\n\n## Now\n\n| id | state | task |\n| --- | --- | --- |\n| a | 🔴 | one |\n| b | 🟢 | two |\n| c | ✅ | three |\n');
  // Two pictures at the end, so the doc's pictures open large as one set.
  const pic = join(homedir(), '.claude/assets/decision-pages/bfb-design-directions/listing.png');
  copyFileSync(pic, join(h.fixture, 'one.png'));
  copyFileSync(pic, join(h.fixture, 'two.png'));
  writeFileSync(doc, readFileSync(doc, 'utf8') + '\n\n## Pictures\n\n![First](one.png)\n\n![Second](two.png)\n');
  await h.store.set('bfb-theme', THEME);
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await applyTheme(page);
  await page.waitForSelector('.fe-dir-sum', { timeout: 8000 });
  const sum = await page.evaluate(() => ({
    chips: [...document.querySelectorAll('.fe-dv-chip')].map(c => [c.dataset.state, Number(c.querySelector('b').textContent)]),
    rows: document.querySelectorAll('.fe-md tbody tr[data-state]').length,
    meters: document.querySelectorAll('.fe-md h2 .fe-dv-meter, .fe-md h3 .fe-dv-meter').length,
    edge: getComputedStyle(document.querySelector('.fe-md tbody tr[data-state] td')).boxShadow,
  }));
  const counted = sum.chips.reduce((n, [, c]) => n + c, 0);
  check(sum.chips.length >= 2 && counted === sum.rows, `the bar counts every marked row by state: ${JSON.stringify(sum.chips)} over ${sum.rows} rows`);
  // Headings stay plain and rows carry no edge: the pills, the overview's meters and the Contents counts say it once.
  check(sum.meters === 0, `section headings carry no meter: ${sum.meters}`);
  check(!/inset/.test(sum.edge), `a marked row has no coloured edge beside its pill: ${sum.edge}`);
  await shot(page, 'directions');
  const linked = await page.$$eval('.fe-md tbody td a[href^="#"] + .fe-dv-meter', els => els.length);
  check(linked >= 2, `the overview's direction names link to their sections, each with a meter: ${linked}`);
  await page.evaluate(() => document.querySelectorAll('.fe-md h3')[0]?.scrollIntoView({ block: 'start' }));
  await shot(page, 'directions-section');

  await page.click('.fe-dv-chip[data-state="needs"]');
  const narrowed = await page.evaluate(() => ({
    shown: [...document.querySelectorAll('.fe-md tbody tr')].filter(r => !r.hidden).map(r => r.dataset.state),
    pressed: document.querySelector('.fe-dv-chip[data-state="needs"]').getAttribute('aria-pressed'),
  }));
  check(narrowed.pressed === 'true' && narrowed.shown.length > 0 && narrowed.shown.every(s => s === 'needs'), `a chip narrows every table to its mark: ${narrowed.shown.length} rows`);
  await shot(page, 'directions-needs');
  await page.click('.fe-dv-chip[data-state="needs"]');
  const back = await page.evaluate(() => [...document.querySelectorAll('.fe-md tbody tr')].filter(r => r.hidden).length);
  check(back === 0, `clicking it again shows every row: ${back} hidden`);

  // The doc's key to its marks steps back; a bare mark reads as a named pill; a waiting-on-you table counts.
  const look = await page.evaluate(() => {
    const key = [...document.querySelectorAll('.fe-md > p')].find(p => /^\s*Marks\s*:/.test(p.textContent));
    const ask = [...document.querySelectorAll('.fe-md h2')].find(h => /waiting on you/i.test(h.textContent));
    let t = ask?.nextElementSibling;
    while (t && !t.querySelector?.('tbody') && t.tagName !== 'TABLE') t = t.nextElementSibling;
    const askRows = t ? [...t.querySelectorAll('tbody tr')] : [];
    const pills = [...document.querySelectorAll('.fe-md td .fe-dv-pill')];
    return {
      keyHidden: !!key && key.hidden, pills: pills.length, pillText: pills[0]?.textContent.trim(),
      bareMarks: [...document.querySelectorAll('.fe-md tbody td')].filter(td => /^(🔴|🟠|🟢|💤|✅)$/.test(td.textContent.trim())).length,
      askRows: askRows.length, askNeeds: askRows.filter(r => r.dataset.state === 'needs').length,
    };
  });
  check(look.keyHidden, `the doc's key to its marks is folded away: ${JSON.stringify(look)}`);
  check(look.pills > 0 && look.bareMarks === 0 && /\w/.test(look.pillText ?? ''), `every bare mark became a named pill: ${look.pills} pills, ${look.bareMarks} bare, first "${look.pillText}"`);
  check(look.askRows > 0 && look.askNeeds === look.askRows, `rows under "Waiting on you" count as needing you: ${look.askNeeds}/${look.askRows}`);

  // A picture in the doc opens large, ← → through the doc's pictures, and Esc closes it.
  await page.evaluate(() => document.querySelector('.fe-md img[alt="First"]').scrollIntoView({ block: 'center' }));
  await page.click('.fe-md img[alt="First"]');
  await page.waitForSelector('.fe-dv-view .fe-dv-view-title', { timeout: 5000 });
  const title = () => page.$eval('.fe-dv-view-title', e => e.textContent);
  const t1 = await title();
  await page.keyboard.press('ArrowRight');
  const t2 = await title();
  const tabs = (await h.browser.pages()).length;
  check(/1 of 2/.test(t1) && /2 of 2/.test(t2), `a doc picture opens large and → steps to the next: ${t1} → ${t2}`);
  await new Promise(res => setTimeout(res, 600));
  const solid = await page.$eval('.fe-dv-view-box', e => getComputedStyle(e).opacity);
  check(solid === '1', `the large view is solid over the doc once open: opacity ${solid}`);
  await shot(page, 'directions-picture');
  await page.keyboard.press('Escape');
  await new Promise(res => setTimeout(res, 400));
  check(!(await page.$('.fe-dv-view')) && (await h.browser.pages()).length === tabs, 'Esc closes the large view, and no new tab was opened');

  // Other docs write a mark followed by its name ("ready") or more words, and keep
  // their key as a "State:" list item or a key row in a table. Each shape gets
  // pills, a hidden key, and counts of task rows only.
  const shapes = {
    'list-key-directions.md': '# Plan\n\n- Marks: 🧭 direction · ✅ accepted when\n- State: 🔴 needs you · 🟠 waiting · 💤 parked · 🟢 ready · ✅ done\n\n## Now\n\n| id | state | task |\n| --- | --- | --- |\n| A1 | ✅ done | push main |\n| A2 | 🟢 ready | deploy |\n| A3 | 🟠 waiting | alert |\n',
    'table-key-directions.md': '# Plan\n\n| | |\n| --- | --- |\n| **state** | 🔴 needs you · 🟠 waiting · 💤 parked · 🟢 ready · ✅ done |\n\n## Buckets\n\n| # | bucket | state |\n| --- | --- | --- |\n| 1 | hardening | 🔴 needs you |\n| 2 | logging | 💤 parked |\n\n## Holes\n\n| id | what | next |\n| --- | --- | --- |\n| H1 | unsaved code | 🟢 [PR #35](https://example.com) merged, so main holds it |\n',
  };
  const others = { 'versable-ingest-directions.md': '/Users/alcatraz627/Code/Versable/versable-ingest/docs/plan/DIRECTIONS.md', 'extractor-and-e2e-directions.md': '/Users/alcatraz627/Code/Versable/enhancement-product/frontend/.claude/notes/extractor-and-e2e-directions.md' };
  for (const [name, text] of Object.entries(shapes)) writeFileSync(join(h.fixture, name), text);
  for (const [name, from] of Object.entries(others)) if (existsSync(from)) copyFileSync(from, join(h.fixture, name));
  for (const name of [...Object.keys(shapes), ...Object.keys(others).filter(n => existsSync(join(h.fixture, n)))]) {
    await page.goto('file://' + join(h.fixture, name), { waitUntil: 'load' });
    await page.waitForSelector('.fe-dir-sum', { timeout: 8000 });
    const got = await page.evaluate(() => {
      const marks = ['🔴', '🟠', '🟢', '💤', '✅'];
      // checkVisibility, since words inside a closed <details> (the ⓘ legend) still report boxes.
      const visible = e => !e.closest('[hidden]') && e.checkVisibility();
      const keyShown = [...document.querySelectorAll('.fe-md p, .fe-md li, .fe-md tbody tr')].filter(visible).filter(e => marks.filter(m => e.textContent.includes(m)).length >= 3).length;
      const bare = [...document.querySelectorAll('.fe-md tbody tr[data-state] td')].filter(td => marks.some(m => td.textContent.trim().startsWith(m))).length;
      const chips = [...document.querySelectorAll('.fe-dv-chip')].reduce((n, c) => n + Number(c.querySelector('b').textContent), 0);
      const link = !!document.querySelector('.fe-md tbody tr[data-state] td a[href]');
      return { pills: document.querySelectorAll('.fe-md tbody .fe-dv-pill').length, bare, keyShown, chips, rows: document.querySelectorAll('.fe-md tbody tr[data-state]').length, link };
    });
    check(got.pills > 0 && got.bare === 0 && got.keyShown === 0 && got.chips === got.rows, `${name}: marks read as pills, the key steps back and only task rows count: ${JSON.stringify(got)}`);
    if (name === 'table-key-directions.md') check(got.rows === 3 && got.link, `${name}: the key row is not counted, and a pill keeps the words and link after it: ${JSON.stringify(got)}`);
    await shot(page, `directions-${name.replace(/\.md$/, '')}`);
  }
} finally {
  console.log(results.join('\n'));
  await h.close();
}
