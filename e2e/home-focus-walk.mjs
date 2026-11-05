// Home with a real amount in it: nothing is listed twice, no card scrolls inside
// itself or cuts a row, each count is the true total with a way to the rest, and a
// name keeps its room ahead of its tags.
//
//   node e2e/home-focus-walk.mjs [folder for screenshots]
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { launch, THEME } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const shots = process.argv[2];
const h = await launch();
try {
  const titles = ['Which arrangement for the settings page and its sections', 'Fresh ask', 'Tab strip rules', 'Notes hub on GitHub or the Pi', 'Android touch variants for the drawer', 'Short', 'Pricing copy for the release page, second round', 'Icons'];
  titles.forEach((title, i) => {
    const p = join(h.dpRegistry, `page-${i}`);
    mkdirSync(p, { recursive: true });
    writeFileSync(join(p, 'config.json'), JSON.stringify({ title, decisions: [{ id: 'D1', question: 'Q?', options: [{ code: 'a', label: 'A', rec: true }] }] }));
    const t = Date.now() / 1000 - i * 0.4 * 86400;
    utimesSync(join(p, 'config.json'), t, t); utimesSync(p, t, t);
  });
  const now = Date.now();
  await h.store.set('bfb-home-v1', homedir());
  await h.store.set('bfb-theme', THEME);
  await h.store.set('bfb-saved-v1', Array.from({ length: 24 }, (_, i) => ({ path: `${h.fixture}/saved-${i}/`, label: i % 5 ? `saved folder ${i}` : `a long saved folder name ${i}`, tags: i % 3 ? ['work'] : ['home', 'code'] })));
  await h.store.set('bfb-recents-v1', Array.from({ length: 30 }, (_, i) => ({ path: `${h.fixture}/recent-${i}/`, ts: now - i * 60000 })));
  for (let i = 0; i < 12; i++) writeFileSync(join(h.notesDir, `note-${i}.md`), `---\ntitle: Note number ${i}\n---\n\nWords\n`);
  await h.store.edit('bfb-settings-v1', s => ({ ...s, notesRoot: h.notesDir }));
  const tab = await h.browser.newPage();
  await tab.setViewport({ width: 1400, height: 900 });
  await tab.goto('file://' + homedir() + '/#home', { waitUntil: 'load' });
  await tab.waitForSelector('#fe-home-page .fe-home-row', { timeout: 15000 });
  await tab.waitForSelector('.fe-hp-card[data-card="notes"] .fe-hp-link', { timeout: 15000 });
  await wait(1500);

  const look = await tab.evaluate(() => {
    const titles = [...document.querySelectorAll('#fe-home-page .fe-home-row .fe-home-t')].map(t => t.textContent);
    const card = id => document.querySelector(`.fe-hp-card[data-card="${id}"]`);
    const n = id => Number(card(id)?.querySelector('.fe-grp-n')?.textContent);
    const inner = [...document.querySelectorAll('.fe-hp-card-b')].filter(b => b.scrollHeight > b.clientHeight + 1 || /auto|scroll/.test(getComputedStyle(b).overflowY)).map(b => b.parentElement.dataset.card);
    return { titles, waiting: !!card('waiting'), counts: { saved: n('saved'), notes: n('notes'), recent: n('recent'), decide: n('decide') },
      more: [...document.querySelectorAll('.fe-hp-rail .fe-home-more')].map(b => b.textContent), inner };
  });
  check(new Set(look.titles).size === look.titles.length && look.titles.length >= 8, `no decision is listed twice: ${look.titles.length} rows`);
  check(!look.waiting, 'with nothing but decisions waiting, there is one card for them');
  check(look.inner.length === 0, `no card scrolls inside itself: ${JSON.stringify(look.inner)}`);
  check(look.counts.saved === 24 && look.counts.recent >= 24 && look.counts.notes === 13, `a card counts all it holds, not what fits: ${JSON.stringify(look.counts)}`);
  check(look.more.some(m => m === '16 more in Saved') && look.more.some(m => /more in Notes/.test(m)) && look.more.some(m => /more in History/.test(m)), `and says where the rest are: ${JSON.stringify(look.more)}`);

  const names = await tab.$$eval('.fe-hp-card[data-card="saved"] .fe-hp-link-l', ls => ls.map(l => ({ t: l.textContent, cut: l.scrollWidth > l.clientWidth + 1 })));
  check(names.every(n => !n.cut), `a name is whole beside its tags: ${JSON.stringify(names.filter(n => n.cut))}`);
  const single = await tab.evaluate(() => [...document.querySelectorAll('.fe-hp-card[data-card="decide"] .badge')].length);
  check(single === 0, 'one question on a page needs no count beside it');
  if (shots) { await tab.screenshot({ path: join(shots, `home-after-${THEME}.png`) }); }

  await tab.setViewport({ width: 1728, height: 1000 });
  await wait(400);
  if (shots) await tab.screenshot({ path: join(shots, `home-after-wide-${THEME}.png`) });
  const pair = await tab.evaluate(() => { const a = document.querySelector('[data-card="repos"]').getBoundingClientRect(), b = document.querySelector('[data-card="chats"]').getBoundingClientRect(); return { sameTop: Math.abs(a.top - b.top) < 2, sameW: Math.abs(a.width - b.width) < 2 }; });
  check(pair.sameTop && pair.sameW, `Directions and Continue sit side by side at one width: ${JSON.stringify(pair)}`);
} finally {
  for (const r of results) console.log(r);
  console.log(`${results.filter(r => r.startsWith('PASS')).length} pass, ${results.filter(r => r.startsWith('FAIL')).length} fail`);
  await h.close();
}
