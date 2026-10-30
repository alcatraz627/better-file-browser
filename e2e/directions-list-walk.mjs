// A directions doc's List layout: every row in one list grouped by direction,
// showing exactly what the doc shows under the same view and state chip. A row
// jumps to its place in the doc, a group opens its section, the head's links
// find rows in the list, and the choice is kept per doc.
//
//   node e2e/directions-list-walk.mjs      (--light for the light theme)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, applyTheme, shot } from './harness.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The doc's own task rows that show now, by state, and the list's rows by state.
const counts = page => page.evaluate(() => {
  const by = rows => rows.reduce((t, r) => { const s = r.dataset.state || 'none'; t[s] = (t[s] ?? 0) + 1; return t; }, {});
  const md = document.querySelector('#fe-page .fe-md');
  const overviewCells = new Set([...md.querySelectorAll('tbody td a[href^="#"]')].map(a => a.closest('tr')));
  const doc = [...md.querySelectorAll(':scope > .fe-md-tablewrap tbody tr, :scope > table tbody tr')]
    .filter(r => !r.hidden && !r.hasAttribute('data-view-hide') && !overviewCells.has(r) && !r.closest('.fe-dir-list'));
  const list = [...md.querySelectorAll('.fe-dir-list tr[data-row]')];
  return { doc: by(doc), list: by(list), nDoc: doc.length, nList: list.length };
});
// The switches keep their value in the extension's world, so the walk presses their buttons like a person.
const setView = (page, v) => page.$eval(`#fe-dir-view [data-v="${v}"]`, b => b.click());
const setLayout = (page, v) => page.$eval(`#fe-dir-layout [data-v="${v}"]`, b => b.click());
const layoutOf = page => page.evaluate(() => document.querySelector('#fe-page .fe-md').dataset.dirLayout);

try {
  const docs = [['standard', join(ROOT, 'tests/fixtures/directions/standard.md')], ['links', join(ROOT, 'tests/fixtures/directions/links.md')], ['slack-automation', '/Users/alcatraz627/Code/Versable/slack-automation/docs/plan/DIRECTIONS.md']].filter(([, p]) => existsSync(p));
  for (const [name, src] of docs) {
    const doc = join(h.fixture, `${name}-DIRECTIONS.md`);
    writeFileSync(doc, readFileSync(src, 'utf8'));
    const page = await h.browser.newPage();
    await page.setViewport({ width: 1440, height: 950 });
    await page.goto('file://' + doc, { waitUntil: 'load' });
    await applyTheme(page);
    await page.waitForSelector('#fe-dir-layout', { timeout: 8000 });
    await sleep(300);

    await setLayout(page, 'list'); await sleep(200);
    const look = await page.evaluate(() => ({
      groups: [...document.querySelectorAll('.fe-dl-fold')].map(b => b.textContent),
      bodyHidden: [...document.querySelectorAll('#fe-page .fe-md > h2')].every(h => getComputedStyle(h).display === 'none'),
      head: getComputedStyle(document.querySelector('.fe-dir-next')).display !== 'none',
    }));
    check(look.groups.length >= 2 && look.bodyHidden && look.head, `${name}: List shows ${look.groups.length} groups in place of the doc body, under the same head: ${look.groups.join(' | ')}`);
    await shot(page, `directions-list-${name}`);

    // The same rows in both layouts, for every chip on its own and a pair.
    const chipsOn = async want => page.evaluate(want => {
      for (const c of document.querySelectorAll('.fe-dv-chip')) if ((c.getAttribute('aria-pressed') === 'true') !== want.includes(c.dataset.state)) c.click();
    }, want);
    for (const v of [[], ['needs'], ['ready'], ['needs', 'waiting']]) {
      await chipsOn(v); await sleep(150);
      await setLayout(page, 'doc'); await sleep(100);
      const d = await counts(page);
      await setLayout(page, 'list'); await sleep(100);
      const l = await counts(page);
      check(JSON.stringify(d.doc) === JSON.stringify(l.list), `${name} · ${v}: the list holds the rows the doc shows: doc ${JSON.stringify(d.doc)} list ${JSON.stringify(l.list)}`);
    }
    await chipsOn([]); await sleep(100);
    await page.click('.fe-dv-chip[data-state="ready"]'); await sleep(150);
    const chip = await counts(page);
    check(chip.nList > 0 && Object.keys(chip.list).join() === 'ready', `${name}: a state chip narrows the list too: ${JSON.stringify(chip.list)}`);
    await page.click('.fe-dv-chip[data-state="ready"]'); await sleep(150);

    // Overview folds every group to its heading; a fold opens one.
    await setView(page, 'overview'); await sleep(150);
    const folded = await page.$$eval('.fe-dir-list tr[data-row]', r => r.length);
    await page.click('.fe-dl-fold'); await sleep(150);
    const opened = await page.$$eval('.fe-dir-list tr[data-row]', r => r.length);
    check(folded === 0 && opened > 0, `${name}: Overview shows the groups folded, and a heading opens its rows: ${folded} → ${opened}`);
    await shot(page, `directions-list-overview-${name}`);
    await setView(page, 'full'); await sleep(150);

    // A list row jumps to its place in the doc.
    const picked = await page.$eval('.fe-dir-list tr[data-row] .fe-dl-tx', e => e.textContent);
    await page.click('.fe-dir-list tr[data-row]'); await sleep(900);
    const jumped = await page.evaluate(t => {
      const row = [...document.querySelectorAll('#fe-page .fe-md tbody tr[data-flash]')][0];
      const r = row?.getBoundingClientRect();
      return { layout: document.querySelector('#fe-page .fe-md').dataset.dirLayout, flash: !!row, inView: !!r && r.top > 0 && r.bottom < innerHeight, same: !!row && row.textContent.includes(t.slice(0, 20)) };
    }, picked);
    check(jumped.layout === 'doc' && jumped.flash && jumped.inView && jumped.same, `${name}: a list row opens the doc at that row and lights it: ${JSON.stringify(jumped)}`);

    // In the list, the head's links find the row in the list.
    await setLayout(page, 'list'); await sleep(200);
    await page.click('.fe-dir-next-i'); await sleep(700);
    const inList = await page.evaluate(() => ({ layout: document.querySelector('#fe-page .fe-md').dataset.dirLayout, flash: !!document.querySelector('.fe-dir-list tr[data-flash]') }));
    check(inList.layout === 'list' && inList.flash, `${name}: a "what to do next" item lights its row in the list: ${JSON.stringify(inList)}`);

    // A group's In doc opens its section.
    const go = await page.$('.fe-dl-go');
    if (go) {
      const sec = await page.$eval('.fe-dl-go', b => b.dataset.sec);
      await go.click(); await sleep(800);
      const at = await page.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return { top: Math.round(r.top), layout: document.querySelector('#fe-page .fe-md').dataset.dirLayout }; }, sec);
      check(at.layout === 'doc' && at.top >= 0 && at.top < 400, `${name}: In doc opens the group's section: ${JSON.stringify(at)}`);
    }

    // The choice survives a reload.
    await setLayout(page, 'list'); await sleep(100);
    await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#fe-dir-layout'); await sleep(300);
    check(await layoutOf(page) === 'list', `${name}: List is remembered for this doc`);

    // Each list row carries its doc row's links as chips; with no links anywhere the column is gone.
    const links = await page.evaluate(() => {
      const md = document.querySelector('#fe-page .fe-md');
      const docRows = [...md.querySelectorAll('tbody tr')].filter(r => !r.closest('.fe-dir-list'));
      const any = docRows.some(r => [...r.querySelectorAll('a[href]')].some(a => !a.getAttribute('href').startsWith('#')));
      // Every list row against its own row in the doc: the same text, the same distinct links.
      const off = [...document.querySelectorAll('.fe-dir-list tr[data-row]')].map(tr => {
        const text = tr.querySelector('.fe-dl-tx').textContent.trim().slice(0, 24);
        const src = docRows.find(r => r.textContent.includes(text));
        const want = src ? new Set([...src.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(x => !x.startsWith('#'))).size : -1;
        const n = tr.querySelectorAll('.fe-dl-link').length;
        return { text, want, n };
      });
      const n = off.map(x => x.n);
      const broken = [...document.querySelectorAll('.fe-dl-link')].filter(a => !a.querySelector('svg') || /undefined/.test(a.textContent)).map(a => a.textContent);
      return { col: !!document.querySelector('.fe-dl-links'), any, broken, wrong: off.filter(x => x.want !== x.n), kinds: [...new Set([...document.querySelectorAll('.fe-dl-link')].map(a => a.dataset.kind))].sort(), chips: n.reduce((a, b) => a + b, 0), multi: n.filter(x => x > 1).length, none: n.filter(x => x === 0).length };
    });
    if (!links.any) check(!links.col, `${name}: a doc without links has no links column`);
    else check(links.col && links.chips > 0 && !links.wrong.length, `${name}: each list row shows exactly its doc row's links: ${JSON.stringify({ chips: links.chips, several: links.multi, none: links.none, kinds: links.kinds, wrong: links.wrong.slice(0, 3) })}`);
    if (links.any) check(!links.broken.length, `${name}: every link chip has its icon and a real name: ${JSON.stringify(links.broken)}`);
    if (name === 'links') check(links.kinds.join() === 'commit,doc,file,issue,linear,pr,web' && links.multi === 2 && links.none === 2, `links: every kind shows, two rows have several links and two have none: ${JSON.stringify({ kinds: links.kinds, several: links.multi, none: links.none })}`);
    if (links.chips) {
      const before = (await h.browser.pages()).length;
      await page.click('.fe-dir-list .fe-dl-link'); await sleep(800);
      const after = (await h.browser.pages()).length;
      check(after === before + 1 && await layoutOf(page) === 'list', `${name}: a link chip opens its link in a new tab and the list stays put: tabs ${before} → ${after}`);
      await shot(page, `directions-list-links-${name}`);
    }
    await page.close();
  }
} finally {
  console.log(results.join('\n'));
  await h.close();
}
