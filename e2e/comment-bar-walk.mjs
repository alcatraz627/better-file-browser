// An open thread's tools sit in one row of icons: each tooltip names the
// action and its key, Reply and Send to an agent look different, and the two
// agent actions form one group on a soft panel. Opening a thread glides the
// page to its words, done ones included, and a done thread's words carry only
// a faint dashed underline while open ones stay tinted.
//   node e2e/comment-bar-walk.mjs [--light]   → e2e/shots/comment-bar*.png
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { launch, applyTheme, shot, SHOTS, THEME } from './harness.mjs';

const CLI = resolve(new URL('..', import.meta.url).pathname, 'native', 'bfb_docs.py');
const h = await launch();
const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_') && !k.startsWith('BFB_'))), BFB_DOCS_HOME: h.docsHome };
const cli = (...args) => {
  const r = spawnSync('python3', [CLI, '--json', ...args], { env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`bfb-docs ${args.join(' ')}: ${r.stderr}`);
  return JSON.parse(r.stdout);
};

try {
  const doc = join(h.fixture, 'bar.md');
  const paras = Array.from({ length: 90 }, (_, i) => `Paragraph ${i + 1} says something worth reading about item ${i + 1}.`);
  writeFileSync(doc, '# Bar\n\n' + paras.join('\n\n') + '\n');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture], tooltips: true }));
  await h.store.set('bfb-comments-filter-v1', 'all');
  const top = cli('comments', 'new', doc, '--quote', 'Paragraph 2 says', 'Near the top.').results[0].thread;
  const low = cli('comments', 'new', doc, '--quote', 'Paragraph 80 says', 'Far down, still open.').results[0].thread;
  const settled = cli('comments', 'new', doc, '--quote', 'Paragraph 45 says', 'Settled already.').results[0].thread;
  cli('comments', 'done', doc, settled);

  await h.browser.defaultBrowserContext().overridePermissions('file://', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']).catch(() => null);
  const page = await h.open(h.fixture);
  await applyTheme(page);
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-md');
  await page.click('#fe-fp-cm');
  await page.waitForSelector('#fe-cm .fe-cm-th', { timeout: 8000 });
  await sleep(400);

  // Done words: in their own highlight, not in the tinted one.
  const hl = await page.evaluate(() => ({ open: CSS.highlights.get('bfb-cm')?.size ?? -1, done: CSS.highlights.get('bfb-cm-done')?.size ?? -1, counts: [...document.querySelectorAll('#fe-page [data-cm]')].map(b => b.dataset.cm) }));
  check(hl.open === 2 && hl.done === 1 && hl.counts.join() === '1,1', `two open threads are tinted, the done one is only underlined, and block counts count open ones: ${JSON.stringify(hl)}`);

  // Opening the far thread glides the page: several in-between positions, ending with its words in view.
  const scroller = '#fe-page';
  const glide = async id => {
    await page.evaluate(sel => { document.querySelector(sel).scrollTop = 0; }, scroller);
    await sleep(150);
    await page.evaluate(() => { window.__tops = []; const s = document.getElementById('fe-page'); const tick = () => { window.__tops.push(Math.round(s.scrollTop)); if (window.__tops.length < 60) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await page.click(`#fe-cm .fe-cm-th[data-id="${id}"] .fe-cm-q`);
    await sleep(1200);
    return page.evaluate(i => {
      const tops = window.__tops, end = tops[tops.length - 1];
      const mid = new Set(tops.filter(t => t > 0 && t < end)).size;
      const words = [...document.querySelectorAll('#fe-page [data-sl]')].find(b => b.textContent.includes(i));
      const r = words?.getBoundingClientRect(), pg = document.getElementById('fe-page').getBoundingClientRect();
      return { end, mid, inView: !!r && r.top >= pg.top && r.bottom <= pg.bottom };
    }, id === low ? 'Paragraph 80 says' : 'Paragraph 45 says');
  };
  const g1 = await glide(low);
  check(g1.end > 0 && g1.mid >= 3 && g1.inView, `opening a thread far down glides the page to its words: ${JSON.stringify(g1)}`);
  const g2 = await glide(settled);
  check(g2.end > 0 && g2.mid >= 3 && g2.inView, `a done thread glides there too: ${JSON.stringify(g2)}`);
  const onDone = await page.evaluate(() => CSS.highlights.get('bfb-cm-on')?.size ?? 0);
  check(onDone === 1, 'an opened done thread shows the strong highlight on its words');
  await shot(page, 'comment-bar-done');
  // With nothing open, the done words show only their underline.
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Escape');
  await sleep(300);
  const crop = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#fe-page [data-sl]')].find(x => x.textContent.includes('Paragraph 45 says'));
    const r = b.getBoundingClientRect();
    return { x: r.x - 8, y: r.y - 8, width: 420, height: r.height + 16, on: CSS.highlights.get('bfb-cm-on')?.size ?? 0 };
  });
  check(crop.on === 0, 'Escape lets go of the thread, so no strong highlight remains');
  await page.screenshot({ path: join(SHOTS, `comment-bar-done-words-${THEME}.png`), clip: { x: crop.x, y: crop.y, width: crop.width, height: crop.height } });

  // Words already in view do not move the page.
  await page.evaluate(sel => { document.querySelector(sel).scrollTop = 0; }, scroller);
  await sleep(300);
  await page.click(`#fe-cm .fe-cm-th[data-id="${top}"] .fe-cm-q`);
  await sleep(800);
  const still = await page.$eval(scroller, s => Math.round(s.scrollTop));
  check(still === 0, `a thread whose words are in view leaves the page where it is: scrollTop ${still}`);

  // The bar: one row of icon buttons, no labels.
  const bar = await page.evaluate(() => {
    const t = document.querySelector('#fe-cm .fe-cm-th.on > .fe-cm-tools');
    const btns = [...t.querySelectorAll('button')];
    const tops = new Set(btns.map(b => Math.round(b.getBoundingClientRect().top)));
    const icon = a => t.querySelector(`[data-a="${a}"] svg`)?.innerHTML ?? '';
    const grp = t.querySelector('.fe-cm-grp');
    return {
      n: btns.length, rows: tops.size, labels: btns.filter(b => b.textContent.trim()).map(b => b.textContent.trim()),
      noSvg: btns.filter(b => !b.querySelector('svg')).length,
      distinct: !!icon('reply') && !!icon('send-agent') && icon('reply') !== icon('send-agent'),
      group: grp ? [...grp.querySelectorAll('[data-a]')].map(b => b.dataset.a) : [],
      groupBg: grp ? getComputedStyle(grp).backgroundColor : '', cardBg: getComputedStyle(t.closest('.fe-cm-th')).backgroundColor,
      groupRadius: grp ? getComputedStyle(grp).borderRadius : '',
    };
  });
  check(bar.rows === 1 && bar.labels.length === 0 && bar.noSvg === 0, `the bar is one row of icon buttons with no labels: ${JSON.stringify({ n: bar.n, rows: bar.rows, labels: bar.labels, noSvg: bar.noSvg })}`);
  check(bar.distinct, 'Reply and Send to an agent have different icons');
  check(bar.group.join() === 'brief,send-agent' && bar.groupBg !== bar.cardBg && bar.groupBg !== 'rgba(0, 0, 0, 0)', `copy-brief and send sit in one group on a soft panel: ${JSON.stringify({ group: bar.group, bg: bar.groupBg, card: bar.cardBg, r: bar.groupRadius })}`);

  // Every tooltip names its action and its key.
  const want = { done: '⌘⇧↵', due: '⇧U', link: '⇧K', brief: '⇧B', 'send-agent': '⇧S', reply: '⌘↵' };
  const tips = {};
  for (const a of Object.keys(want)) {
    await page.mouse.move(0, 0); await sleep(100);
    await page.hover(`#fe-cm .fe-cm-th.on > .fe-cm-tools [data-a="${a}"]`);
    await page.waitForSelector('#fe-hint.on', { timeout: 2000 }).catch(() => null);
    tips[a] = await page.$eval('#fe-hint', e => ({ title: e.querySelector('b')?.textContent ?? '', keys: [...e.querySelectorAll('kbd')].map(k => k.textContent).join('') })).catch(() => ({ title: '', keys: '' }));
  }
  const bad = Object.entries(want).filter(([a, k]) => !tips[a].title || tips[a].keys.replace('↩', '↵') !== k);
  check(!bad.length, `each tooltip has a title and its key: ${JSON.stringify(tips)}`);
  await page.hover('#fe-cm .fe-cm-th.on > .fe-cm-tools [data-a="send-agent"]');
  await page.waitForSelector('#fe-hint.on', { timeout: 2000 }).catch(() => null);
  await page.screenshot({ path: join(SHOTS, `comment-bar-${THEME}.png`), clip: await page.$eval('#fe-cm', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) });
  await page.mouse.move(0, 0);

  // The keys do what the tooltips say.
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.down('Shift'); await page.keyboard.press('U'); await page.keyboard.up('Shift');
  await sleep(250);
  check(await page.$('#fe-cm .fe-cm-th.on .fe-cm-date') !== null, '⇧U opens the due date field');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement?.blur());
  await page.click(`#fe-cm .fe-cm-th[data-id="${top}"] .fe-cm-q`).catch(() => {});
  await sleep(200);
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.down('Shift'); await page.keyboard.press('S'); await page.keyboard.up('Shift');
  await page.waitForSelector('.fe-cm-send', { timeout: 3000 }).catch(() => null);
  check(await page.$('.fe-cm-send') !== null, '⇧S opens the Send to menu');
  await page.keyboard.press('Escape');
  await sleep(150);
  await page.evaluate(() => document.activeElement?.blur());
  await page.evaluate(() => navigator.clipboard.writeText('x')).catch(() => {});
  await page.keyboard.down('Shift'); await page.keyboard.press('B'); await page.keyboard.up('Shift');
  await sleep(400);
  const brief = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  check(brief.includes('Near the top.') && !brief.includes('Far down') && !brief.includes('Settled already'), `⇧B with a thread open copies that thread alone: ${brief.replace(/\s+/g, ' ').slice(0, 80)}`);
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
