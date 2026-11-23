// Icon rules have names, and "Try a name" says which rule gives a file name its
// icon, using the same matcher the listing uses. The walk names a rule, checks
// the name is saved, tries names that hit the first rule, a later rule, a rule
// switched off and no rule, and checks the winning row is marked.
//
//   node e2e/icon-rules-walk.mjs [folder for screenshots]   (BFB_THEME=light for the light theme)
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { launch, store, THEME } from './harness.mjs';

const h = await launch();
if (THEME === 'light') await store.set('bfb-theme', 'light');
const shots = process.argv[2];
let failed = 0;
const check = (ok, msg, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}${ok || got === undefined ? '' : `  got: ${JSON.stringify(got)}`}`); if (!ok) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rules = async () => JSON.parse((await store.get('bfb-icon-rules-v1')) ?? 'null');

try {
  // Two rules that both match "a.test.md": the first one listed must win.
  await store.set('bfb-icon-rules-v1', JSON.stringify([
    { id: 't1', name: 'Tests', pattern: '\\.test\\.', label: 'TST', color: '#40c057', enabled: true },
    { id: 't2', pattern: '\\.md$', label: 'MD', color: '#4a9eff', enabled: true },
    { id: 't3', name: 'Off rule', pattern: '\\.log$', label: 'LOG', color: '#ff6b6b', enabled: false },
  ]));
  const page = await h.open();
  await page.setViewport({ width: 1200, height: 860 });
  page.on('pageerror', e => check(false, `no page error (${e.message})`));
  await page.click('#fe-settings-btn');
  await page.waitForFunction(() => !document.getElementById('fe-settings-modal').hidden);
  await page.click('#fe-settings-modal .fe-dlg-tab[data-tab="tools"]');
  await page.waitForSelector('.fe-st-rule-name');

  const names = await page.$$eval('.fe-st-rule-name', xs => xs.map(x => x.value));
  check(JSON.stringify(names) === JSON.stringify(['Tests', '', 'Off rule']), 'each rule row shows its name', names);

  // Name the unnamed rule.
  await page.click('.fe-rule[data-idx="1"] .fe-st-rule-name');
  await page.keyboard.type('Markdown');
  await sleep(200);
  check((await rules())?.[1]?.name === 'Markdown', 'a typed name is saved', (await rules())?.[1]);

  const tryIt = async name => {
    await page.$eval('#fe-st-rule-try', i => { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('#fe-st-rule-try');
    if (name) await page.keyboard.type(name);
    await sleep(150);
    return page.evaluate(() => ({
      text: document.querySelector('#fe-st-rule-try-out span')?.textContent.trim() ?? '',
      icon: !!document.querySelector('#fe-st-rule-try-out svg'),
      win: [...document.querySelectorAll('.fe-rule.win')].map(r => r.dataset.idx),
    }));
  };

  let got = await tryIt('a.test.md');
  check(got.text === 'Tests wins' && got.icon && JSON.stringify(got.win) === '["0"]', 'two rules match: the first listed wins and its row is marked', got);
  await shot('icon-rules-try');
  got = await tryIt('notes.md');
  check(got.text === 'Markdown wins' && JSON.stringify(got.win) === '["1"]', 'a later rule wins when the first does not match, by its new name', got);
  got = await tryIt('server.log');
  check(got.text.startsWith('No rule matches') && got.win.length === 0, 'a rule switched off does not win', got);
  got = await tryIt('docs/');
  check(got.text.startsWith('No rule matches'), 'a folder is not given a file rule', got);
  got = await tryIt('');
  check(got.text === '' && got.win.length === 0, 'an empty box shows nothing and marks no row', got);

  // Switching the winner off moves the win to the next rule, live.
  await tryIt('a.test.md');
  await page.click('.fe-rule[data-idx="0"] .fe-st-rule-en');
  await sleep(150);
  got = await page.evaluate(() => ({ text: document.querySelector('#fe-st-rule-try-out span')?.textContent.trim() ?? '', win: [...document.querySelectorAll('.fe-rule.win')].map(r => r.dataset.idx) }));
  check(got.text === 'Markdown wins' && JSON.stringify(got.win) === '["1"]', 'switching the winner off updates the answer at once', got);

  // The listing agrees: the fixture's README.md gets the Markdown rule's icon.
  await page.keyboard.press('Escape');
  await sleep(300);
  const listIcon = await page.evaluate(() => {
    const row = [...document.querySelectorAll('[data-name]')].find(r => /\.md$/i.test(r.dataset.name));
    return row ? row.querySelector('svg text')?.textContent ?? null : 'no md file';
  });
  check(listIcon === 'MD' || listIcon === 'no md file', 'the listing uses the same rule', listIcon);

  // A stored rule whose pattern would hang on this file's name (an import or an
  // older version can leave one) is skipped, so the folder still draws, and
  // Settings marks it with the reason.
  writeFileSync(join(h.fixture, 'a'.repeat(30) + '!.txt'), 'x');
  await store.set('bfb-icon-rules-v1', JSON.stringify([
    { id: 's1', name: 'Hangs', pattern: '^(a+)+$', label: 'BAD', color: '#ff6b6b', enabled: true },
    { id: 's2', name: 'Text', pattern: '\\.txt$', label: 'TXT', color: '#4a9eff', enabled: true },
  ]));
  const page2 = await h.open();
  const t0 = Date.now();
  const longIcon = await Promise.race([
    page2.waitForSelector('[data-name^="aaaaaaaa"]', { timeout: 4000 }).then(() => page2.evaluate(() =>
      document.querySelector('[data-name^="aaaaaaaa"] svg text')?.textContent ?? null)),
    sleep(4000).then(() => 'page hung'),
  ]).catch(e => String(e.message));
  check(longIcon === 'TXT', `a rule that would hang is skipped and the next rule gives the icon (${Date.now() - t0} ms)`, longIcon);
  await page2.click('#fe-settings-btn');
  await page2.waitForFunction(() => !document.getElementById('fe-settings-modal').hidden);
  await page2.click('#fe-settings-modal .fe-dlg-tab[data-tab="tools"]');
  await page2.waitForSelector('.fe-st-rule-pattern');
  const marked = await page2.$eval('.fe-rule[data-idx="0"] .fe-st-rule-pattern', i => ({ invalid: i.getAttribute('aria-invalid'), why: i.title }));
  check(marked.invalid === 'true' && /freeze/.test(marked.why), 'Settings marks that pattern and says why', marked);
  if (shots) { await sleep(200); await page2.screenshot({ path: join(shots, `icon-rules-slow-${THEME}.png`) }); }

  async function shot(name) { if (shots) { await sleep(200); await page.screenshot({ path: join(shots, `${name}-${THEME}.png`) }); } }
} catch (err) {
  console.error(err);
  failed++;
} finally {
  await h.close();
  if (failed) { console.log(`${failed} failed`); process.exitCode = 1; }
}
