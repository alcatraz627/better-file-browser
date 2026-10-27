// Home as a full page: ~/#home shows Home in the main pane instead of the
// listing, the strip always starts with a Home tab that cannot be closed, and
// that tab takes you to Home from any page, keeping the page you were on as a
// tab. The sidebar's Home lens stays. Data comes from a scratch registry,
// scratch repos and seeded chats; the home folder's listing is only read.
//
//   node e2e/home-page-walk.mjs      (BFB_THEME=light for the light theme)
import { mkdirSync, writeFileSync, utimesSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { launch, shot, applyTheme } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FIX = new URL('../tests/fixtures/directions/', import.meta.url).pathname;
const HOME = homedir();
const homeUrl = 'file://' + HOME + '/#home';
const h = await launch();
try {
  const d = join(h.reposDir, 'asks-repo');
  mkdirSync(join(d, '.git'), { recursive: true });
  mkdirSync(join(d, 'docs', 'plan'), { recursive: true });
  writeFileSync(join(d, 'docs', 'plan', 'DIRECTIONS.md'), readFileSync(join(FIX, 'standard.md'), 'utf8'));
  const page = (slug, ageDays, cfg, ...dots) => {
    const p = join(h.dpRegistry, slug);
    mkdirSync(p, { recursive: true });
    writeFileSync(join(p, 'config.json'), JSON.stringify({ title: slug, decisions: [{ id: 'D1', question: 'Q?', options: [{ code: 'a', label: 'A', rec: true }] }], ...cfg }));
    const t = Date.now() / 1000 - ageDays * 86400;
    utimesSync(join(p, 'config.json'), t, t);
    for (const dot of dots) writeFileSync(join(p, dot), '{}');
  };
  page('fresh-ask', 0.01, { title: 'Fresh ask' });
  page('old-quiet', 40, { title: 'Old and quiet' });
  const now = Date.now();
  await h.store.set('bfb-ask-history-v1', { [h.fixture + '/readme.md']: [{ id: 'c-new', at: now - 60000, title: 'Newest chat', turns: [{ q: 'Newest chat', a: 'An answer', model: 'm', ms: 1, at: now - 60000 }] }] });
  await h.store.set('bfb-home-v1', HOME);
  await h.store.set('bfb-lens-v1', 'places');

  const tab = await h.browser.newPage();
  await tab.setViewport({ width: 1400, height: 900 });
  await tab.goto(homeUrl, { waitUntil: 'load' });
  await applyTheme(tab);
  await tab.waitForSelector('#fe-home-page .fe-home-row', { timeout: 15000 });
  await sleep(400);

  const look = await tab.evaluate(() => {
    const shown = id => { const e = document.getElementById(id); return !!e && e.checkVisibility(); };
    return {
      title: document.title, page: shown('fe-home-page'), listing: shown('fe-scroll'), toolbar: shown('fe-toolbar'), status: shown('fe-statusbar'),
      head: document.querySelector('.fe-hp-head h1')?.textContent ?? '', tally: document.querySelector('.fe-hp-head p')?.textContent ?? '',
      panels: [...document.querySelectorAll('.fe-hp-panel')].map(p => [p.dataset.panel, [...p.querySelectorAll('.fe-home-t')].map(t => t.textContent)]),
    };
  });
  check(look.page && !look.listing && !look.toolbar && !look.status && look.title.startsWith('Home |'),
    `~/#home shows Home in the main pane; the listing, its toolbar and status bar are hidden: ${JSON.stringify({ ...look, panels: undefined })}`);
  check(JSON.stringify(look.panels) === JSON.stringify([['decide', ['Fresh ask']], ['chats', ['Newest chat']], ['repos', ['asks-repo']], ['never', ['Old and quiet']]]),
    `the page holds decisions waiting and chats beside directions and pages never answered: ${JSON.stringify(look.panels)}`);
  check(/1 decision waiting on you · 3 asks in 1 repo · 1 chat/.test(look.tally), `the head says how the day stands: ${JSON.stringify(look.tally)}`);

  const strip = () => tab.evaluate(() => [...document.querySelectorAll('#fe-tab-home:not([hidden]), #fe-tabs .fe-tab')].map(a => ({
    home: a.id === 'fe-tab-home', on: a.classList.contains('on'), temp: a.classList.contains('temp'), label: a.textContent.trim(), close: !!a.querySelector('.fe-tab-x'),
  })));
  let s = await strip();
  check(s.length === 1 && s[0].home && s[0].on && s[0].label === 'Home' && !s[0].close, `on Home the strip holds only the Home tab, open, with no close button: ${JSON.stringify(s)}`);
  await shot(tab, 'home-page');

  // From a folder: Home is still the first tab, and takes you home keeping the folder.
  await tab.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await tab.waitForSelector('#fe-tab-home:not([hidden])', { timeout: 15000 });
  s = await strip();
  check(s[0].home && !s[0].on && s.some(t => t.temp), `on a folder Home is the first tab, not open, beside the folder: ${JSON.stringify(s)}`);
  await tab.click('#fe-tab-home', { button: 'middle' });
  await sleep(300);
  check((await strip())[0].home, 'a middle click does not close Home');
  await tab.click('#fe-tab-home');
  await tab.waitForFunction(u => location.href === u, { timeout: 10000 }, homeUrl).catch(() => null);
  await tab.waitForSelector('#fe-home-page .fe-home-row', { timeout: 15000 }).catch(() => null);
  s = await strip();
  const fixtureName = h.fixture.split('/').pop();
  check(await tab.evaluate(() => location.href) === homeUrl && s[0].on && s.some(t => !t.home && t.label.includes(fixtureName)),
    `the Home tab opens Home and keeps the folder you left as a tab: ${JSON.stringify(s)}`);

  // A chat on Home opens its file with that chat in Ask.
  await tab.click('#fe-home-page [data-chat="c-new"]');
  await tab.waitForFunction(() => /readme\.md#ask=c-new$/.test(location.href), { timeout: 10000 }).catch(() => null);
  await tab.waitForFunction(() => document.querySelectorAll('#fe-ask-thread .fe-ask-turn').length === 1, { timeout: 15000 }).catch(() => null);
  const asked = await tab.evaluate(() => ({ href: location.href, turns: document.querySelectorAll('#fe-ask-thread .fe-ask-turn').length, tabs: [...document.querySelectorAll('#fe-tab-home:not([hidden]), #fe-tabs .fe-tab')].map(a => a.textContent.trim()) }));
  check(/readme\.md#ask=c-new$/.test(asked.href) && asked.turns === 1 && !asked.tabs.includes(HOME.split('/').pop()) && asked.tabs[0] === 'Home',
    `a chat on Home opens its file in Ask, and the home folder is not kept as a tab: ${JSON.stringify(asked)}`);

  // The sidebar's Home lens is still there.
  check(await tab.$eval('#fe-rail .fe-rail-btn', b => b.dataset.lens) === 'home', 'the sidebar keeps its Home lens');
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
