// The answer side of a decision page, over a scratch registry (the live one is
// never touched): the panel shows the answer as gcc composes it and follows
// every pick and note; Copy and Submit send exactly that string; an answered
// page shows what was sent and fills the form from it; Replace confirms first;
// a page answered elsewhere, a page server that is down, and a wake that did
// not reach the agent each say so in their own words. gcc's command is the
// harness stand-in, which composes and parses with gcc's real composer.
// Rows are named for the hub's parity ledger (B8 to B20, C1 to C9).
//
//   node e2e/dp-answer-walk.mjs      (BFB_THEME=light for the light theme)
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { launch, shot, applyTheme } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const wait = ms => new Promise(res => setTimeout(res, ms));
const h = await launch();
const CFG = {
  title: 'Walk rulings page', copyHeader: 'walk rulings', origin: { project: 'bfb', session: 'walker' },
  decisions: [
    { id: 'D1', question: 'Which layout?', options: [{ code: 'a', label: 'Grid', rec: true }, { code: 'b', label: 'List' }] },
    { id: 'D2', question: 'Ship when?', none: true, noneLabel: 'Not yet', options: [{ code: 'a', label: 'Today', rec: true }, { code: 'b', label: 'Friday' }] },
  ],
  sections: [{ id: 's1', title: 'Spacing', read: 'Rows are 8px apart.' }, { id: 's2', title: 'Colours', read: 'Teal accent.' }],
};
const DRAFT = 'walk rulings:\nD1a D2a\nall items: agree as drafted';
try {
  const reg = h.dpRegistry;
  const mk = (slug, extra = {}) => { mkdirSync(join(reg, slug), { recursive: true }); writeFileSync(join(reg, slug, 'config.json'), JSON.stringify({ ...CFG, storageKey: slug, ...extra })); return join(reg, slug); };
  const calls = () => existsSync(h.dpCalls) ? readFileSync(h.dpCalls, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  await h.browser.defaultBrowserContext().overridePermissions('file://', ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']).catch(() => null);
  let dialogs = [], accept = true;
  const open = async dir => {
    const page = await h.open(dir);
    page.on('dialog', d => { dialogs.push(d.message()); void (accept ? d.accept() : d.dismiss()); });
    await page.setViewport({ width: 1400, height: 900 });
    await applyTheme(page);
    await page.waitForSelector('#fe-dp:not([hidden]) .fe-dp-title', { timeout: 8000 });
    await page.waitForFunction(() => document.getElementById('fe-dp-answer-text')?.textContent.length > 0, { timeout: 8000 });
    return page;
  };
  const panelText = page => page.$eval('#fe-dp-answer-text', e => e.textContent);
  const until = async (page, fn, arg, ms = 5000) => page.waitForFunction(fn, { timeout: ms }, arg).then(() => true).catch(() => false);
  const toast = page => page.$eval('#fe-toast', e => e.textContent).catch(() => '');
  const clip = page => page.evaluate(() => navigator.clipboard.readText()).catch(e => `(unreadable: ${e.message})`);
  const pick = (page, id, code) => page.evaluate((i, c) => document.querySelector(`.fe-dp-card[data-id="${i}"] input[type="radio"][value="${c}"]`).click(), id, code);
  const press = async (page, key) => { await page.evaluate(() => (document.activeElement)?.blur()); await page.keyboard.press(key); };

  // B8 the panel shows the composed answer and follows every change.
  const one = mk('walk-one');
  let page = await open(one);
  check(await page.$eval('#fe-dp-answer', e => e.hidden), 'B8 the answer panel starts closed');
  await press(page, 'p');
  check(!(await page.$eval('#fe-dp-answer', e => e.hidden)) && await page.$eval('#fe-dp-panel', e => e.getAttribute('aria-pressed')) === 'true', 'B8 p opens the panel and the Answer button reads pressed');
  check(await panelText(page) === DRAFT, `B8 C2 an untouched page composes as drafted: ${JSON.stringify(await panelText(page))}`);
  await pick(page, 'D1', 'b');
  const moved = await until(page, t => document.getElementById('fe-dp-answer-text').textContent === t, 'walk rulings:\nD1b D2a');
  const bar1 = await page.evaluate(() => ({ copy: document.getElementById('fe-dp-copy').textContent, progress: document.getElementById('fe-dp-progress').textContent }));
  check(moved && bar1.copy === 'Copy (1)' && /1 flagged/.test(bar1.progress), `B8 B9 B16 a changed pick updates the panel, the Copy count and the progress: ${JSON.stringify({ text: await panelText(page), ...bar1 })}`);
  await page.click('.fe-dp-card[data-id="s1"] .fe-dp-addnote');
  await page.type('.fe-dp-card[data-id="s1"] textarea[data-note]', 'tighter please');
  const noted = await until(page, t => document.getElementById('fe-dp-answer-text').textContent === t, 'walk rulings:\nD1b D2a\ns1: agree — tighter please');
  check(noted && /2 flagged/.test(await page.$eval('#fe-dp-progress', e => e.textContent)), `B20 C3 a note on an agreed item flags it and joins with a spaced em dash: ${JSON.stringify(await panelText(page))}`);
  await press(page, 'c');
  await until(page, () => /Copied/.test(document.getElementById('fe-toast')?.textContent || ''));
  check(await clip(page) === await panelText(page), `B9 c copies exactly what the panel shows: ${JSON.stringify(await clip(page))}`);
  await shot(page, 'dp-answer-panel');

  // C1 Submit sends the panel's string, says the page sent it, and the page turns answered.
  const sentText = await panelText(page);
  await press(page, 's');
  const answered = await until(page, () => !document.getElementById('fe-dp-sent').hidden, null, 8000);
  const sub = calls().filter(c => c.verb === 'submit' && c.slug === 'walk-one');
  const stored = existsSync(join(one, '.answer.json')) ? JSON.parse(readFileSync(join(one, '.answer.json'), 'utf8')) : null;
  check(answered && sub.length === 1 && sub[0].payload === sentText && sub[0].args.join(' ') === '--via page' && stored?.answer === sentText,
    `C1 s submits the exact answer once, marked as from the page, and gcc stores it: ${JSON.stringify({ args: sub[0]?.args, stored: stored?.answer })}`);
  check(/agent was woken/.test(await toast(page)), `C11 the toast says the agent was woken: ${await toast(page)}`);
  const banner = await page.evaluate(() => ({
    head: document.querySelector('.fe-dp-sent-head')?.textContent.replace(/\s+/g, ' ').trim(),
    chips: [...document.querySelectorAll('.fe-dp-sent-picks .chip')].map(c => ({ t: c.textContent, moved: c.dataset.tone === 'due' })),
    lines: [...document.querySelectorAll('.fe-dp-sent-lines li')].map(l => l.textContent),
    full: document.querySelector('.fe-dp-sent-full pre')?.textContent, button: document.getElementById('fe-dp-submit').textContent,
  }));
  check(/Answered just now/.test(banner.head) && /agent was woken/.test(banner.head) && JSON.stringify(banner.chips) === JSON.stringify([{ t: 'D1 · List', moved: true }, { t: 'D2 · Today', moved: false }])
    && banner.lines.join('|') === 'Spacing: tighter please' && banner.full === sentText && banner.button === 'Replace answer',
    `C5 C7 the banner shows when, who was told, picks by label with the moved one tinted, the note, the full text; Submit becomes Replace: ${JSON.stringify(banner)}`);
  await shot(page, 'dp-answer-sent');

  // C7 Replace asks first; cancel sends nothing, OK sends replace.
  accept = false; dialogs = [];
  await page.click('#fe-dp-submit');
  await wait(600);
  check(dialogs.length === 1 && calls().filter(c => c.verb === 'submit').length === 1, `C7 Replace asks first and Cancel sends nothing: ${JSON.stringify(dialogs)}`);
  accept = true;
  await pick(page, 'D2', 'b');
  await until(page, t => document.getElementById('fe-dp-answer-text').textContent.includes(t), 'D2b');
  await page.click('#fe-dp-submit');
  await until(page, () => document.querySelector('.fe-dp-sent-full pre')?.textContent.includes('D2b'), null, 8000);
  const rep = calls().filter(c => c.verb === 'submit');
  check(rep.length === 2 && rep[1].args.includes('--replace') && JSON.parse(readFileSync(join(one, '.answer.json'), 'utf8')).answer.includes('D1b D2b'),
    `C7 OK sends a replacement marked replace: ${JSON.stringify(rep.map(c => c.args))}`);
  await page.close();

  // C6 an answered page fills the form from the sent answer, not the recommendations.
  const two = mk('walk-two');
  writeFileSync(join(two, '.answer.json'), JSON.stringify({ answer: 'walk rulings:\nD1b D2z\ns2: DISAGREE — too loud', submitted_at: Math.floor(Date.now() / 1000) - 7200, via: 'cli' }));
  writeFileSync(join(two, '.notify.json'), JSON.stringify({ state: 'queued', at: new Date().toISOString() }));
  page = await open(two);
  const filled = await until(page, () => document.querySelector('.fe-dp-card[data-id="D2"] input[value="z"]')?.checked, null, 6000);
  await until(page, () => document.getElementById('fe-dp-answer-text').textContent.includes('D2z'), null, 4000);
  const two1 = await page.evaluate(() => ({
    d1: document.querySelector('.fe-dp-card[data-id="D1"] input:checked')?.value, d2: document.querySelector('.fe-dp-card[data-id="D2"] input:checked')?.value,
    s2: document.querySelector('.fe-dp-card[data-id="s2"] .fe-dp-agree-sw')?.checked, note: document.querySelector('.fe-dp-card[data-id="s2"] textarea[data-note]')?.value,
    head: document.querySelector('.fe-dp-sent-head')?.textContent.replace(/\s+/g, ' ').trim(), lines: [...document.querySelectorAll('.fe-dp-sent-lines li')].map(l => l.textContent),
    panel: document.getElementById('fe-dp-answer-text').textContent,
  }));
  check(filled && two1.d1 === 'b' && two1.d2 === 'z' && two1.s2 === false && two1.note === 'too loud', `C6 the form is filled from the sent answer, none option and disagreement included: ${JSON.stringify(two1)}`);
  check(/Answered 2 h ago/.test(two1.head) && /waits for the agent/.test(two1.head) && two1.lines.join('|') === 'Colours: disagreed, too loud', `C5 an older answer says how long ago and that the message waits: ${JSON.stringify(two1)}`);
  check(two1.panel === 'walk rulings:\nD1b D2z\ns2: DISAGREE — too loud', `C6 the refilled form composes back to the same string: ${JSON.stringify(two1.panel)}`);
  await page.close();

  // C8 answered somewhere else while this page was open.
  const three = mk('walk-three');
  page = await open(three);
  writeFileSync(join(three, '.answer.json'), JSON.stringify({ answer: 'walk rulings:\nD1a D2b', submitted_at: Math.floor(Date.now() / 1000), via: 'chat' }));
  const before = readFileSync(join(three, '.answer.json'), 'utf8');
  await press(page, 's');
  await until(page, () => /somewhere else/.test(document.getElementById('fe-toast')?.textContent || ''));
  await until(page, () => !document.getElementById('fe-dp-sent').hidden, null, 6000);
  const c8 = await page.evaluate(() => ({ banner: !document.getElementById('fe-dp-sent').hidden, button: document.getElementById('fe-dp-submit').textContent }));
  check(/Answered somewhere else already/.test(await toast(page)) && readFileSync(join(three, '.answer.json'), 'utf8') === before && c8.banner && c8.button === 'Replace answer',
    `C8 a page answered elsewhere says so, keeps that answer, and offers Replace: ${JSON.stringify({ toast: await toast(page), ...c8 })}`);
  await page.close();

  // C9 the page server is down: nothing is written, the picks line is on the clipboard.
  const four = mk('walk-four');
  writeFileSync(h.dpDown, '1');
  page = await open(four);
  await pick(page, 'D1', 'b');
  await page.click('.fe-dp-card[data-id="D1"] .fe-dp-addnote');
  await page.type('.fe-dp-card[data-id="D1"] textarea[data-note]', 'list reads faster');
  await until(page, () => document.getElementById('fe-dp-answer-text').textContent.includes('list reads faster'));
  const composed = await panelText(page);
  await press(page, 's');
  await until(page, () => /Not sent/.test(document.getElementById('fe-toast')?.textContent || ''));
  const c9 = await page.evaluate(() => ({ panel: !document.getElementById('fe-dp-answer').hidden, note: document.getElementById('fe-dp-answer-note').textContent, tone: document.getElementById('fe-dp-answer-note').dataset.tone, cause: document.getElementById('fe-dp-answer-note').title, disabled: document.getElementById('fe-dp-submit').disabled }));
  check(/Not sent\. Nothing was written/.test(await toast(page)) && !existsSync(join(four, '.answer.json')) && c9.panel && c9.tone === 'danger' && /server is not answering/.test(c9.note) && /nothing was written/.test(c9.cause) && !c9.disabled,
    `C9 a down server writes nothing and says so loudly, with gcc's words on hover; Submit stays for a retry: ${JSON.stringify({ toast: await toast(page), ...c9 })}`);
  check(await clip(page) === composed && composed === 'walk rulings:\nD1b D2a\nD1 note — list reads faster', `C9 the composed answer is on the clipboard to paste: ${JSON.stringify(await clip(page))}`);
  await shot(page, 'dp-answer-down');
  rmSync(h.dpDown);
  await press(page, 's');
  await until(page, () => !document.getElementById('fe-dp-sent').hidden, null, 8000);
  check(existsSync(join(four, '.answer.json')), 'C9 once the server is back, Submit again sends it');
  await page.close();

  // gcc cannot compose at all: the page writes the picks line itself, and nothing can be sent.
  const six = mk('walk-six');
  writeFileSync(h.dpBroken, '1');
  page = await open(six);
  await pick(page, 'D1', 'b');
  await page.click('.fe-dp-card[data-id="D1"] .fe-dp-addnote');
  await page.type('.fe-dp-card[data-id="D1"] textarea[data-note]', 'list reads faster');
  await until(page, () => document.getElementById('fe-dp-answer-text').textContent.includes('list reads faster'));
  const broken = await page.evaluate(() => ({ note: document.getElementById('fe-dp-answer-note').textContent, disabled: document.getElementById('fe-dp-submit').disabled, title: document.getElementById('fe-dp-submit').title }));
  await press(page, 's');
  await until(page, () => /Not sent/.test(document.getElementById('fe-toast')?.textContent || ''));
  check(/Answer path down/.test(broken.note) && broken.disabled && /cannot be reached/.test(broken.title) && !existsSync(join(six, '.answer.json')) && !calls().some(c => c.verb === 'submit' && c.slug === 'walk-six'),
    `gcc unable to compose disables Submit with the reason, and s sends nothing: ${JSON.stringify(broken)}`);
  check(await clip(page) === 'D1b D2a\nnotes (not composed, host down):\nD1: list reads faster' && /picks line/.test(await toast(page)),
    `C9 the picks line and the notes are on the clipboard: ${JSON.stringify(await clip(page))}`);
  rmSync(h.dpBroken);
  await page.close();

  // A wake that reached nobody is not a silent success.
  const five = mk('walk-five');
  writeFileSync(h.dpNotify, 'undelivered');
  page = await open(five);
  await press(page, 's');
  await until(page, () => !document.getElementById('fe-dp-sent').hidden, null, 8000);
  const c11 = await page.evaluate(() => ({ told: document.getElementById('fe-dp-sent').dataset.told, edge: getComputedStyle(document.getElementById('fe-dp-sent')).borderLeftColor }));
  check(/agent was not told/.test(await toast(page)) && c11.told === 'undelivered', `a failed wake says the agent was not told, and the banner keeps it: ${JSON.stringify({ toast: await toast(page), ...c11 })}`);
  rmSync(h.dpNotify);
  await page.close();

  // The answer bar sticks flush to the top edge: scrolled down, no card text shows above it.
  const long = mk('walk-long', { sections: Array.from({ length: 14 }, (v, i) => ({ id: `s${i + 1}`, title: `Section ${i + 1}`, read: 'A line of reading that is long enough to be seen if it slides above the bar. '.repeat(3) })) });
  page = await open(long);
  const flush = async () => {
    await page.evaluate(() => { document.getElementById('fe-dp').scrollTop = 900; });
    await wait(250);
    return page.evaluate(() => {
      const dp = document.getElementById('fe-dp').getBoundingClientRect(), bar = document.getElementById('fe-dp-bar').getBoundingClientRect();
      const above = [...document.querySelectorAll('.fe-dp-card')].filter(c => { const r = c.getBoundingClientRect(); return Math.min(r.bottom, bar.top) - Math.max(r.top, dp.top) > 0; }).length;
      const probe = document.elementFromPoint(bar.left + 4, Math.max(dp.top + 1, bar.top - 3));
      return { gap: Math.round(bar.top - dp.top), cardsAbove: above, scrolled: document.getElementById('fe-dp').scrollTop, probe: probe?.closest('.fe-dp-card') ? 'card text' : 'clear' };
    });
  };
  const fl = await flush();
  check(fl.scrolled > 0 && fl.gap <= 1 && fl.cardsAbove === 0, `the answer bar sticks flush to the top edge, with no card text above it: ${JSON.stringify(fl)}`);
  await shot(page, 'dp-bar-flush');
  await page.close();

  // The Decisions lens moves the page to Answered the moment it is sent, not at its next poll.
  const lensPage = mk('walk-lens');
  page = await open(lensPage);
  await page.click('#fe-rail-decisions');
  await page.waitForSelector('.fe-dpl-band[data-band="waiting"] .fe-dpl-row[data-slug="walk-lens"]', { timeout: 8000 });
  await press(page, 's');
  await until(page, () => !document.getElementById('fe-dp-sent').hidden, null, 8000);
  await wait(700);
  const lens = await page.evaluate(() => ({
    waiting: !!document.querySelector('.fe-dpl-band[data-band="waiting"] .fe-dpl-row[data-slug="walk-lens"]'),
    answered: !!document.querySelector('.fe-dpl-band[data-band="answered"] .fe-dpl-row[data-slug="walk-lens"]'),
    age: document.querySelector('.fe-dpl-row[data-slug="walk-lens"] .fe-dpl-age')?.textContent,
  }));
  check(!lens.waiting && lens.answered && lens.age === 'just now', `the lens shows a sent page under Answered within a second: ${JSON.stringify(lens)}`);
  await shot(page, 'dp-lens-answered');
  await page.close();

  // A page outside gcc's registry can be copied but not sent.
  const loose = join(h.fixture, 'loose-page');
  mkdirSync(loose);
  writeFileSync(join(loose, 'config.json'), JSON.stringify(CFG));
  page = await open(loose);
  const out = await page.evaluate(() => ({ disabled: document.getElementById('fe-dp-submit').disabled, title: document.getElementById('fe-dp-submit').title, text: document.getElementById('fe-dp-answer-text').textContent }));
  check(out.disabled && /not in gcc's registry/.test(out.title) && out.text === 'D1a D2a', `a page outside the registry offers Copy only, with the reason: ${JSON.stringify(out)}`);
  await page.close();
} finally {
  console.log(results.join('\n'));
  await h.close();
}
