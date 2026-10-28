// Home as a full page: ~/#home shows Home in the main pane instead of the
// listing. The strip starts with a bare Home icon that never looks selected;
// closing the last tab, g h or e 0 lands on Home. The page has a greeting with
// chips, a path bar with suggestions and an open-link button, a band of
// numbers, and folding cards: decisions (recent only, never red), chats,
// directions, and quick links (Saved and Notes with a menu to open elsewhere
// or edit, Opened lately with a forget button). Data comes from a scratch
// registry, scratch repos, the harness notes folder and seeded chats; the
// home folder's listing is only read.
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
    utimesSync(p, t, t);
    for (const dot of dots) writeFileSync(join(p, dot), '{}');
  };
  page('fresh-ask', 0.01, { title: 'Fresh ask' });
  page('old-quiet', 40, { title: 'Old and quiet' });
  const now = Date.now();
  await h.store.set('bfb-ask-history-v1', { [h.fixture + '/readme.md']: [{ id: 'c-new', at: now - 60000, title: 'Newest chat', turns: [{ q: 'Newest chat', a: 'An answer', model: 'm', ms: 1, at: now - 60000 }] }] });
  await h.store.set('bfb-home-v1', HOME);
  await h.store.set('bfb-lens-v1', 'places');
  await h.store.set('bfb-saved-v1', [{ path: h.fixture + '/nested/', label: 'nested', tags: ['work'] }]);
  await h.store.set('bfb-recents-v1', [{ path: h.fixture + '/', ts: now - 60000 }, { path: h.fixture + '/nested/deeper/', ts: now - 90000 }]);
  await h.store.edit('bfb-settings-v1', s => ({ ...s, notesRoot: h.notesDir }));

  const tab = await h.browser.newPage();
  await tab.setViewport({ width: 1400, height: 900 });
  await tab.goto(homeUrl, { waitUntil: 'load' });
  await applyTheme(tab);
  await tab.waitForSelector('#fe-home-page .fe-home-row', { timeout: 15000 });
  await tab.waitForSelector('.fe-hp-card[data-card="notes"] .fe-hp-link', { timeout: 15000 }).catch(() => null);
  await sleep(400);

  const look = await tab.evaluate(() => {
    const shown = id => { const e = document.getElementById(id); return !!e && e.checkVisibility(); };
    const cards = [...document.querySelectorAll('.fe-hp-card')].map(c => ({
      id: c.dataset.card, tile: !!c.querySelector('summary .fe-dlg-tile'), title: c.querySelector('.fe-hp-card-tx b')?.textContent,
      sub: c.querySelector('.fe-hp-card-tx span')?.textContent, open: c.open,
      rows: [...c.querySelectorAll('.fe-home-t, .fe-hp-link-l')].map(t => t.textContent),
      border: getComputedStyle(c).borderTopColor, bg: getComputedStyle(c).backgroundColor,
    }));
    return {
      title: document.title, page: shown('fe-home-page'), listing: shown('fe-scroll'), toolbar: shown('fe-toolbar'), status: shown('fe-statusbar'),
      hello: document.querySelector('.fe-hp-hello h1')?.textContent ?? '', acts: [...document.querySelectorAll('.fe-hp-acts [data-hp-act]')].map(b => b.title),
      cards, stats: [...document.querySelectorAll('.fe-hp-stat')].map(s => ({ id: s.dataset.stat, button: s.tagName === 'BUTTON', tile: !!s.querySelector('.fe-dlg-tile'), v: s.querySelector('b').textContent, s: s.querySelector('.fe-hp-stat-s').textContent, hot: s.classList.contains('hot'), bars: s.querySelectorAll('.fe-hp-bars i').length })),
      cols: ['.fe-hp-main', '.fe-hp-rail'].map(q => Math.round(document.querySelector(q).getBoundingClientRect().width)),
      goBtns: [...document.querySelectorAll('.fe-hp-go button')].map(b => ({ icon: !!b.querySelector('svg'), text: b.textContent.trim() })),
    };
  });
  check(look.page && !look.listing && !look.toolbar && !look.status && look.title.startsWith('Home |'),
    `~/#home shows Home in the main pane; the listing, its toolbar and status bar are hidden: ${look.title}`);
  check(/^Good (morning|afternoon|evening|night)$/.test(look.hello) && JSON.stringify(look.acts) === JSON.stringify(['New note (n)', 'Ask about a file or folder', 'Open a file or folder from Finder (o)', 'Command palette (⌘K)', 'Keyboard map (?)', 'Settings (,)']),
    `the head greets and offers the actions that start work, each naming its key: ${JSON.stringify({ hello: look.hello, acts: look.acts })}`);
  check(look.goBtns.length === 3 && look.goBtns.every(b => b.icon && !b.text), `the path bar's buttons are icons: ${JSON.stringify(look.goBtns)}`);
  const card = id => look.cards.find(c => c.id === id) ?? {};
  check(JSON.stringify(look.cards.map(c => c.id)) === JSON.stringify(['decide', 'repos', 'chats', 'saved', 'notes', 'recent']) && look.cards.every(c => c.tile && c.title && c.sub && c.open),
    `every card has an icon, a title and a line under it, and starts open: ${JSON.stringify(look.cards.map(c => [c.id, c.title, c.sub]))}`);
  check(JSON.stringify(card('decide').rows) === JSON.stringify(['Fresh ask']) && !look.cards.some(c => c.id === 'never'),
    `Decisions lists only recent waiting pages; the old page is left to the Decisions lens: ${JSON.stringify(card('decide').rows)}`);
  check(card('decide').border === card('chats').border && card('decide').bg === card('chats').bg,
    `the Decisions card is drawn like every other card, not red: ${JSON.stringify([card('decide').border, card('decide').bg])}`);
  const fixtureLabel = h.fixture.split('/').pop();
  check(JSON.stringify(card('saved').rows) === JSON.stringify(['nested']) && JSON.stringify(card('notes').rows) === JSON.stringify(['Existing note']) && JSON.stringify(card('recent').rows) === JSON.stringify([fixtureLabel, 'deeper']),
    `quick links: Saved, then Notes, then places opened lately: ${JSON.stringify([card('saved').rows, card('notes').rows, card('recent').rows])}`);
  check(JSON.stringify(look.stats.map(s => [s.id, s.v, s.hot])) === JSON.stringify([['waiting', '1', true], ['asks', '3', true], ['asked', '1', false], ['opened', '2', false], ['saved', '1', false], ['notes', '1', false]])
    && look.stats.every(s => s.button && s.tile) && look.stats.filter(s => s.bars === 7).map(s => s.id).join() === 'asked,opened',
    `six numbers are buttons with icons, what needs you in the accent, seven days of bars on questions and places: ${JSON.stringify(look.stats)}`);
  check(look.cols[1] < look.cols[0] * 0.5, `the quick links sit in a narrow rail beside the main column: ${JSON.stringify(look.cols)}`);

  // The strip: a bare Home icon that never draws as selected.
  const strip = () => tab.evaluate(() => [...document.querySelectorAll('#fe-tab-home:not([hidden]), #fe-tabs .fe-tab')].map(a => ({
    home: a.id === 'fe-tab-home', on: a.classList.contains('on'), temp: a.classList.contains('temp'), label: a.textContent.trim(), aria: a.getAttribute('aria-label'),
    close: !!a.querySelector('.fe-tab-x'), w: Math.round(a.getBoundingClientRect().width), bg: getComputedStyle(a).backgroundColor,
  })));
  let s = await strip();
  check(s.length === 1 && s[0].home && !s[0].on && s[0].label === '' && s[0].aria === 'Home' && s[0].w <= 40 && s[0].bg === 'rgba(0, 0, 0, 0)',
    `on Home the strip holds only the Home icon: no label, no selection: ${JSON.stringify(s)}`);
  await shot(tab, 'home-page');

  // The numbers go where they count: Saved opens its lens; the head's gear opens Settings; l types a path here.
  await tab.click('.fe-hp-stat[data-stat="saved"]');
  await sleep(400);
  check(await tab.evaluate(() => !!document.querySelector('#fe-side .fe-pl-item')?.checkVisibility()), 'the saved number opens the Saved lens');
  await tab.click('.fe-hp-acts [data-hp-act="settings"]');
  await sleep(400);
  check(await tab.evaluate(() => !!document.getElementById('fe-settings-modal')?.checkVisibility()), 'the gear in the head opens Settings');
  await tab.keyboard.press('Escape'); await sleep(300);
  await tab.evaluate(() => document.activeElement?.blur());
  await tab.keyboard.press('l'); await sleep(200);
  check(await tab.evaluate(() => document.activeElement?.classList.contains('fe-hp-go-in')), 'l puts the cursor in the path bar on Home');
  await tab.evaluate(() => document.activeElement?.blur());

  // Cards fold, and stay folded across a reload.
  await tab.click('.fe-hp-card[data-card="chats"] > summary');
  await sleep(200);
  await tab.reload({ waitUntil: 'load' });
  await tab.waitForSelector('#fe-home-page .fe-hp-card', { timeout: 15000 });
  check(await tab.$eval('.fe-hp-card[data-card="chats"]', c => !c.open), 'a folded card stays folded after a reload');
  await tab.click('.fe-hp-card[data-card="chats"] > summary');
  await sleep(200);

  // The path bar suggests what is in the folder being typed, and opens a path.
  await tab.click('.fe-hp-go-in');
  await tab.keyboard.type(h.fixture + '/ne');
  await tab.waitForFunction(p => [...document.querySelectorAll('#fe-hp-go-list option')].some(o => o.value === p), { timeout: 5000 }, h.fixture + '/nested/').catch(() => null);
  const opts = await tab.$$eval('#fe-hp-go-list option', os => os.map(o => o.value));
  check(opts[0] === h.fixture + '/nested/', `typing a path suggests the folders in it: ${JSON.stringify(opts)}`);
  await shot(tab, 'home-path-bar');
  // A web address: the link button opens it in a new Chrome tab.
  await tab.$eval('.fe-hp-go-in', i => { i.value = ''; });
  await tab.type('.fe-hp-go-in', 'example.invalid/x');
  const linkTarget = h.browser.waitForTarget(t => t.url().startsWith('https://example.invalid/x'), { timeout: 8000 }).catch(() => null);
  await tab.click('.fe-hp-go-link');
  const linkTab = await linkTarget;
  check(!!linkTab, 'Open link opens what is typed as a web address in a new Chrome tab');
  if (linkTab) await (await linkTab.page())?.close();
  await tab.bringToFront();
  await tab.$eval('.fe-hp-go-in', i => { i.value = ''; });
  await tab.type('.fe-hp-go-in', h.fixture + '/nested');
  await tab.keyboard.press('Enter');
  await tab.waitForFunction(() => /\/nested\/$/.test(location.href), { timeout: 10000 }).catch(() => null);
  check(/\/nested\/$/.test(await tab.evaluate(() => location.href)), 'Enter in the path bar opens the path');

  // Keys: g h goes to Home from a folder.
  await tab.waitForSelector('#fe-tab-home:not([hidden])', { timeout: 10000 });
  await tab.evaluate(() => document.activeElement?.blur());
  await tab.keyboard.press('g'); await tab.keyboard.press('h');
  await tab.waitForFunction(u => location.href === u, { timeout: 8000 }, homeUrl).catch(() => null);
  check(await tab.evaluate(() => location.href) === homeUrl, 'g h goes to Home');
  s = await strip();
  check(s.some(t => !t.home && t.label.includes('nested')), `going Home keeps the folder you left as a tab: ${JSON.stringify(s.map(t => t.label))}`);

  // Opened lately: × forgets a place.
  await tab.waitForSelector('.fe-hp-card[data-card="recent"] [data-forget]', { timeout: 15000 });
  const before = await tab.$$eval('.fe-hp-card[data-card="recent"] .fe-hp-link-l', l => l.map(x => x.textContent));
  await tab.hover('.fe-hp-card[data-card="recent"] .fe-hp-link:last-child');
  await tab.click('.fe-hp-card[data-card="recent"] .fe-hp-link:last-child [data-forget]');
  await sleep(300);
  const after = await tab.$$eval('.fe-hp-card[data-card="recent"] .fe-hp-link-l', l => l.map(x => x.textContent));
  const stored = (await h.store.json('bfb-recents-v1', [])).map(r => r.path);
  check(before.includes('deeper') && !after.includes('deeper') && !stored.includes(h.fixture + '/nested/deeper/'), `× forgets a place opened lately: ${JSON.stringify({ before, after })}`);

  // Saved: the menu opens elsewhere and edits the name and tags.
  const savedMenu = async () => {
    await tab.hover('.fe-hp-card[data-card="saved"] .fe-hp-link');
    await tab.click('.fe-hp-card[data-card="saved"] [data-menu]');
    await tab.waitForSelector('.fe-hp-menu .fe-ctx-item', { timeout: 5000 });
  };
  await savedMenu();
  const items = await tab.$$eval('.fe-hp-menu .fe-ctx-item', i => i.map(x => x.textContent.trim()));
  check(JSON.stringify(items) === JSON.stringify(['Open', 'Open in a new Chrome tab', 'Show in the sidebar', 'Name and tags…', 'Remove from Saved']), `a saved link's menu: ${JSON.stringify(items)}`);
  await sleep(400);
  const layerLook = sel => tab.$eval(sel, el => { const cs = getComputedStyle(el); return { bg: cs.backgroundColor, op: cs.opacity }; });
  const opaque = l => l.op === '1' && !/rgba\(.*, 0(\.[0-4]\d*)?\)$/.test(l.bg) && l.bg !== 'transparent';
  const menuLook = await layerLook('.fe-hp-menu');
  check(opaque(menuLook), `the link menu is drawn solid over the page: ${JSON.stringify(menuLook)}`);
  await shot(tab, 'home-link-menu');
  await tab.click('.fe-hp-menu [data-act="edit"]');
  await tab.waitForSelector('.fe-hp-edit [name="label"]', { timeout: 5000 });
  await tab.$eval('.fe-hp-edit [name="label"]', i => { i.value = ''; });
  await tab.type('.fe-hp-edit [name="label"]', 'Nest');
  await tab.$eval('.fe-hp-edit [name="tags"]', i => { i.value = ''; });
  await tab.type('.fe-hp-edit [name="tags"]', 'work, deep');
  await sleep(300);
  const editLook = await layerLook('.fe-hp-edit');
  check(opaque(editLook), `the name and tags form is drawn solid over the page: ${JSON.stringify(editLook)}`);
  await shot(tab, 'home-link-edit');
  await tab.keyboard.press('Enter');
  await sleep(300);
  const savedNow = (await h.store.json('bfb-saved-v1', []))[0] ?? {};
  const shownNow = await tab.$eval('.fe-hp-card[data-card="saved"] .fe-hp-link', l => ({ label: l.querySelector('.fe-hp-link-l').textContent, tags: [...l.querySelectorAll('.fe-hp-link-tags i')].map(i => i.textContent) }));
  check(savedNow.label === 'Nest' && JSON.stringify(savedNow.tags) === JSON.stringify(['work', 'deep']) && shownNow.label === 'Nest' && shownNow.tags.join() === 'work,deep',
    `Name and tags saves both, and the link shows them: ${JSON.stringify({ savedNow, shownNow })}`);
  await savedMenu();
  await tab.click('.fe-hp-menu [data-act="side"]');
  await tab.waitForFunction(p => !!document.querySelector(`#fe-side .fe-pl-item[data-path="${p}"]`)?.checkVisibility(), { timeout: 5000 }, h.fixture + '/nested/').catch(() => null);
  check(await tab.evaluate(p => !!document.querySelector(`#fe-side .fe-pl-item[data-path="${p}"]`)?.checkVisibility(), h.fixture + '/nested/'), 'Show in the sidebar opens the Saved lens on that place');
  await savedMenu();
  const chromeTarget = h.browser.waitForTarget(t => t.url().endsWith('/nested/') && t.url().startsWith('file://'), { timeout: 8000 }).catch(() => null);
  await tab.click('.fe-hp-menu [data-act="chrome"]');
  const chromeTab = await chromeTarget;
  check(!!chromeTab, 'Open in a new Chrome tab opens the place in its own Chrome tab');
  if (chromeTab) await (await chromeTab.page())?.close();
  await tab.bringToFront();

  // Notes: the menu reaches the note's colour, pin and tags.
  await tab.hover('.fe-hp-card[data-card="notes"] .fe-hp-link');
  await tab.click('.fe-hp-card[data-card="notes"] [data-menu]');
  await tab.waitForSelector('.fe-hp-menu [data-act="props"]', { timeout: 5000 });
  await tab.click('.fe-hp-menu [data-act="props"]');
  check(!!await tab.waitForSelector('.fe-pmenu', { timeout: 5000 }).catch(() => null), 'a note link edits its colour, pin and tags');
  await tab.keyboard.press('Escape');

  // Closing tabs: the last one closes to Home.
  const fresh = await h.browser.newPage();
  await fresh.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await applyTheme(fresh);
  await fresh.waitForSelector('#fe-tabs .fe-tab.temp .fe-tab-x', { timeout: 15000 });
  await fresh.click('#fe-tabs .fe-tab.temp .fe-tab-x');
  await fresh.waitForFunction(u => location.href === u, { timeout: 8000 }, homeUrl).catch(() => null);
  check(await fresh.evaluate(() => location.href) === homeUrl, 'closing the only tab, not kept, lands on Home');
  await fresh.goto('file://' + h.fixture + '/nested/', { waitUntil: 'load' });
  await fresh.waitForSelector('#fe-tabs .fe-tab', { timeout: 15000 });
  await fresh.evaluate(() => document.activeElement?.blur());
  await fresh.keyboard.press('t');
  await sleep(200);
  await fresh.keyboard.press('w');
  await fresh.waitForFunction(u => location.href === u, { timeout: 8000 }, homeUrl).catch(() => null);
  const left = await fresh.evaluate(() => ({ href: location.href, tabs: document.querySelectorAll('#fe-tabs .fe-tab').length }));
  check(left.href === homeUrl && left.tabs === 0, `Home plus one kept tab: w closes it and lands on Home: ${JSON.stringify(left)}`);
  // e 0 is Home too.
  await fresh.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await fresh.waitForSelector('#fe-tab-home:not([hidden])', { timeout: 15000 });
  await fresh.evaluate(() => document.activeElement?.blur());
  await fresh.keyboard.press('e'); await fresh.keyboard.press('0');
  await fresh.waitForFunction(u => location.href === u, { timeout: 8000 }, homeUrl).catch(() => null);
  check(await fresh.evaluate(() => location.href) === homeUrl, 'e 0 goes to Home');
  await fresh.close();

  // A chat on Home opens its file with that chat in Ask.
  await tab.bringToFront();
  await tab.goto(homeUrl, { waitUntil: 'load' });
  await tab.waitForSelector('#fe-home-page [data-chat="c-new"]', { timeout: 15000 });
  await tab.click('#fe-home-page [data-chat="c-new"]');
  await tab.waitForFunction(() => /readme\.md#ask=c-new$/.test(location.href), { timeout: 10000 }).catch(() => null);
  await tab.waitForFunction(() => document.querySelectorAll('#fe-ask-thread .fe-ask-turn').length === 1, { timeout: 15000 }).catch(() => null);
  const asked = await tab.evaluate(() => ({ href: location.href, turns: document.querySelectorAll('#fe-ask-thread .fe-ask-turn').length }));
  check(/readme\.md#ask=c-new$/.test(asked.href) && asked.turns === 1, `a chat on Home opens its file in Ask: ${JSON.stringify(asked)}`);

  // The sidebar's Home lens is still there.
  check(await tab.$eval('#fe-rail .fe-rail-btn', b => b.dataset.lens) === 'home', 'the sidebar keeps its Home lens');
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
