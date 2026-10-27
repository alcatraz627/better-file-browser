// The Home lens over a scratch registry, scratch repos and seeded chats (the
// live ones are never touched): what waits on the owner sits in one card with
// each repo's ask count as its doc head counts it, chats follow newest first
// with the start of their last answer, and the rest is under Quiet. Archived
// and answered pages and worktree copies stay out. Each row opens its thing.
//
//   node e2e/home-walk.mjs      (BFB_THEME=light for the light theme)
import { mkdirSync, writeFileSync, utimesSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, shot, applyTheme } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FIX = new URL('../tests/fixtures/directions/', import.meta.url).pathname;
const h = await launch();
try {
  // Repos: two with asks, one quiet, and a linked worktree that repeats one.
  const repo = (rel, fixture, worktree = false) => {
    const d = join(h.reposDir, rel);
    mkdirSync(join(d, 'docs', 'plan'), { recursive: true });
    if (worktree) writeFileSync(join(d, '.git'), 'gitdir: elsewhere\n'); else mkdirSync(join(d, '.git'), { recursive: true });
    const text = fixture ? readFileSync(join(FIX, fixture), 'utf8') : '# Directions\n\nLast updated: 2026-10-26\n\nNothing open.\n';
    writeFileSync(join(d, 'docs', 'plan', 'DIRECTIONS.md'), text);
    return join(d, 'docs', 'plan', 'DIRECTIONS.md');
  };
  const stdDoc = repo('Org/standard-repo', 'standard.md');
  repo('Org/standard-repo-wt', 'standard.md', true);
  repo('buckets-repo', 'buckets.md');
  repo('quiet-repo', null);

  // Decision pages: waiting unseen, waiting seen, waiting but archived by hand, never answered, answered.
  const reg = h.dpRegistry;
  const page = (slug, ageDays, cfg, ...dots) => {
    const d = join(reg, slug);
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'config.json'), JSON.stringify({ title: slug, decisions: [{ id: 'D1', question: 'Q?', options: [{ code: 'a', label: 'A', rec: true }] }], ...cfg }));
    const t = Date.now() / 1000 - ageDays * 86400;
    utimesSync(join(d, 'config.json'), t, t);
    for (const dot of dots) writeFileSync(join(d, dot), '{}');
    return d;
  };
  const freshPath = page('fresh-ask', 0.01, { title: 'Fresh ask', origin: { project: 'bfb' } });
  page('seen-ask', 0.2, { title: 'Seen ask' }, '.seen.json');
  page('put-away', 0.1, { title: 'Put away by hand' });
  page('old-quiet', 40, { title: 'Old and quiet' });
  page('answered-one', 1, { title: 'Answered one' }, '.answer.json');
  await h.store.set('bfb-dp-archived-v1', ['put-away']);

  // Seven chats, the newest about the fixture's readme.
  const now = Date.now();
  const chat = (id, minsAgo, title, a) => ({ id, at: now - minsAgo * 60000, title, turns: [{ q: title, a, model: 'm', ms: 1, at: now - minsAgo * 60000 }] });
  const history = { [h.fixture + '/readme.md']: [chat('c-new', 2, 'Newest chat', '**Bold** start of the last answer')] };
  for (let i = 1; i <= 6; i++) history[`/tmp/subject-${i}.md`] = [chat(`c${i}`, i * 60, `Older chat ${i}`, `Answer ${i}`)];
  await h.store.set('bfb-ask-history-v1', history);
  await h.store.set('bfb-lens-v1', 'home');

  const tab = await h.open(h.fixture);
  await tab.setViewport({ width: 1400, height: 900 });
  await applyTheme(tab);
  await tab.waitForSelector('.fe-home-row', { timeout: 15000 });
  await sleep(400);

  const rail = await tab.$$eval('#fe-rail .fe-rail-btn', bs => bs.map(b => b.dataset.lens));
  check(rail[0] === 'home' && await tab.$eval('#fe-rail-home', b => b.classList.contains('on')), `Home is first in the rail and open: ${rail.join(',')}`);

  const view = () => tab.evaluate(() => {
    const rows = sel => [...document.querySelectorAll(sel)].map(r => ({
      title: r.querySelector('.fe-home-t').textContent, sub: r.querySelector('.fe-home-s').textContent,
      you: r.querySelector('.fe-home-you')?.textContent ?? '', p: r.querySelector('.fe-home-p')?.textContent ?? '', unseen: r.classList.contains('unseen'),
    }));
    return {
      head: document.querySelector('.fe-home-head')?.textContent ?? '',
      cardN: document.querySelector('.fe-home-card .fe-grp-n')?.textContent ?? '',
      card: rows('.fe-home-card .fe-home-row'),
      chats: rows('[data-grp="chats"] .fe-home-row'),
      more: document.querySelector('[data-more]')?.textContent ?? '',
      quiet: rows('[data-grp="quiet"] .fe-home-row'),
    };
  });
  let v = await view();
  check(v.card.map(r => r.title).join('|') === 'Fresh ask|Seen ask|standard-repo|buckets-repo' && v.cardN === '4',
    `Needs you holds the waiting pages, newest first, then the repos with asks: ${JSON.stringify(v.card.map(r => r.title))}`);
  check(v.card.find(r => r.title === 'standard-repo')?.you === '3 on you' && v.card.find(r => r.title === 'buckets-repo')?.you === '1 on you' && /3 ready for an agent/.test(v.card.find(r => r.title === 'standard-repo')?.sub ?? ''),
    `each repo shows its asks and ready rows as its doc head counts them: ${JSON.stringify(v.card.slice(2))}`);
  check(v.card[0].unseen && !v.card[1].unseen, 'a page not yet opened is marked, a seen one is not');
  check(!JSON.stringify(v).includes('Put away by hand') && !JSON.stringify(v).includes('Answered one') && v.card.filter(r => r.title === 'standard-repo').length === 1,
    'archived and answered pages stay out, and a worktree copy of a repo is not listed twice');
  check(v.chats.length === 5 && v.chats[0].title === 'Newest chat' && v.chats[0].p === 'Bold start of the last answer' && v.more === 'Show all 7',
    `Continue lists five chats newest first with the start of the last answer, and offers the rest: ${JSON.stringify({ n: v.chats.length, first: v.chats[0], more: v.more })}`);
  check(v.quiet.map(r => r.title).join('|') === 'quiet-repo|Old and quiet', `Quiet holds the repo with nothing on you and the page never answered: ${JSON.stringify(v.quiet.map(r => r.title))}`);
  check(/^[A-Z][a-z]+day, [A-Z][a-z]{2} \d+$/.test(v.head), `the head names the day: ${JSON.stringify(v.head)}`);
  await shot(tab, 'home');

  await tab.click('[data-more]');
  v = await view();
  check(v.chats.length === 7 && !v.more, 'Show all lists every chat');

  // Each row opens its thing.
  const opens = async (selector, expectUrl) => {
    await tab.click(selector);
    await tab.waitForFunction(u => location.href.startsWith(u), { timeout: 10000 }, expectUrl).catch(() => null);
    const href = await tab.evaluate(() => location.href);
    await tab.goBack({ waitUntil: 'load' }).catch(() => null);
    await tab.waitForSelector('.fe-home-row', { timeout: 15000 }).catch(() => null);
    return href;
  };
  const docHref = await opens('.fe-home-card [data-doc*="standard-repo/"]', 'file://' + stdDoc);
  check(docHref.startsWith('file://' + stdDoc), `a repo row opens its directions doc: ${docHref}`);
  const pageHref = await opens('.fe-home-card [data-page$="fresh-ask"]', 'file://' + freshPath);
  check(pageHref.startsWith('file://' + freshPath + '/'), `a page row opens the decision page: ${pageHref}`);
  await tab.click('[data-grp="chats"] [data-chat="c-new"]');
  await tab.waitForFunction(() => /readme\.md#ask=c-new$/.test(location.href), { timeout: 10000 }).catch(() => null);
  await tab.waitForFunction(() => document.querySelector('#fe-rail-ask')?.classList.contains('on') && document.querySelectorAll('#fe-ask-thread .fe-ask-turn').length === 1, { timeout: 15000 }).catch(() => null);
  const asked = await tab.evaluate(() => ({ href: location.href, ask: document.querySelector('#fe-rail-ask')?.classList.contains('on'), q: document.querySelector('#fe-ask-thread .fe-ask-turn .fe-ask-q')?.textContent ?? '' }));
  check(/readme\.md#ask=c-new$/.test(asked.href) && asked.ask && /Newest chat/.test(asked.q), `a chat row opens its file with that chat in Ask: ${JSON.stringify(asked)}`);

  // With nothing waiting, the card says so instead of vanishing.
  writeFileSync(join(reg, 'fresh-ask', '.answer.json'), '{}');
  writeFileSync(join(reg, 'seen-ask', '.answer.json'), '{}');
  writeFileSync(stdDoc, '# Directions\n\nNothing open.\n');
  writeFileSync(join(h.reposDir, 'buckets-repo', 'docs', 'plan', 'DIRECTIONS.md'), '# Directions\n\nNothing open.\n');
  const calm = await h.open(h.fixture);
  await calm.setViewport({ width: 1400, height: 900 });
  await calm.waitForSelector('.fe-home-card', { timeout: 15000 });
  await sleep(400);
  const c = await calm.evaluate(() => ({ tone: document.querySelector('.fe-home-card').dataset.tone, text: document.querySelector('.fe-home-card').textContent.trim() }));
  check(c.tone === 'calm' && c.text === 'Nothing waits on you', `with nothing waiting the card says so: ${JSON.stringify(c)}`);
  await shot(calm, 'home-calm');
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
