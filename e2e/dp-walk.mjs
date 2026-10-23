// Decision pages in bfb, walked on a copy of a real page folder (the live
// registry is never touched): the folder opens as the page, not a listing;
// Files and back switch views and the choice is kept for the tab; a folder
// whose config.json is not a decision page stays a plain listing. Then a
// made-up page with every config field is answered by key and by mouse, the
// answers survive a reload, Reset puts them back, and notes:false hides
// every note surface. Rows are named for the hub's parity ledger.
//
//   node e2e/dp-walk.mjs      (BFB_THEME=light for the light theme)
import { cpSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { launch, shot, applyTheme } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const h = await launch();
try {
  const slug = join(h.fixture, 'dp-sample');
  cpSync(join(homedir(), '.claude/assets/decision-pages/bfb-open-asks'), slug, { recursive: true });
  const other = join(h.fixture, 'not-a-page');
  mkdirSync(other);
  writeFileSync(join(other, 'config.json'), '{"name":"some tool","version":1}');

  const page = await h.open(slug);
  await page.setViewport({ width: 1400, height: 900 });
  await applyTheme(page);
  await page.waitForSelector('#fe-dp:not([hidden]) .fe-dp-title', { timeout: 8000 });
  const first = await page.evaluate(() => ({
    title: document.querySelector('.fe-dp-title')?.textContent,
    origin: [...document.querySelectorAll('.fe-dp-origin .chip')].length,
    intro: !!document.querySelector('.fe-dp-intro'),
    count: document.querySelector('.fe-dp-count')?.textContent,
    listing: getComputedStyle(document.getElementById('fe-scroll')).display,
  }));
  check(first.title === JSON.parse(readFileSync(join(slug, 'config.json'), 'utf8')).title && first.listing === 'none' && /decision/.test(first.count ?? ''), `the folder opens as its decision page, listing out of sight: ${JSON.stringify(first)}`);
  const align = await page.evaluate(() => {
    const t = document.querySelector('.fe-dp-title').getBoundingClientRect().left;
    const p = document.querySelector('.fe-dp-intro p');
    const r = document.createRange(); r.selectNodeContents(p);
    return { title: Math.round(t), intro: Math.round(r.getClientRects()[0]?.left ?? -1), inner: p.firstElementChild?.outerHTML.slice(0, 80) };
  });
  check(Math.abs(align.title - align.intro) <= 2, `the intro lines up with the title: ${JSON.stringify(align)}`);
  await shot(page, 'dp-head');

  await page.click('#fe-dp-files');
  const files = await page.evaluate(() => ({ dp: document.getElementById('fe-dp').hidden, listing: getComputedStyle(document.getElementById('fe-scroll')).display, back: !document.getElementById('fe-dp-back').hidden }));
  check(files.dp && files.listing !== 'none' && files.back, `Files shows the listing with a way back: ${JSON.stringify(files)}`);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-dp-back', { timeout: 8000 });
  const kept = await page.evaluate(() => document.getElementById('fe-dp').hidden && !document.getElementById('fe-dp-back').hidden);
  check(kept, 'the listing choice is kept for this tab across a reload');
  await page.click('#fe-dp-back');
  check(await page.$eval('#fe-dp', e => !e.hidden), 'Decision page brings the page back');

  await page.goto('file://' + other + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-tbody tr', { timeout: 8000 });
  const plain = await page.evaluate(() => ({ dp: document.getElementById('fe-dp')?.hidden, rows: document.querySelectorAll('#fe-tbody tr').length, pending: document.getElementById('fe').classList.contains('fe-dp-pending') }));
  check(plain.dp === true && plain.rows > 0 && !plain.pending, `a folder whose config.json is not a decision page stays a listing: ${JSON.stringify(plain)}`);

  // A page with every field the ledger lists.
  const full = join(h.fixture, 'dp-full');
  mkdirSync(full);
  cpSync(join(homedir(), '.claude/assets/decision-pages/bfb-design-directions/listing.png'), join(full, 'a.png'));
  writeFileSync(join(full, 'config.json'), JSON.stringify({
    title: 'Walk page', storageKey: 'walk-k', accent: '#7c3aed', intro: 'Intro text.',
    groups: { Look: { context: 'See https://example.com/x for more.', color: '#d97706' } },
    decisions: [
      { id: 'D1', question: 'First?', context: 'Para one\nsame para\n\nPara two', images: ['a.png', '../x.png'], options: [{ code: 'a', label: 'Plain A' }, { code: 'b', label: 'Plain B', rec: true, why: 'because' }] },
      { id: 'D2', question: 'Second?', note: 'why?', none: true, noneLabel: 'Neither', options: [{ code: 'a', label: 'Tile A', images: ['a.png'], rec: true }, { code: 'b', label: 'Tile B', images: ['a.png'] }, { code: 'c', label: 'Tile C', images: ['a.png'] }] },
    ],
    sections: [
      { id: 's1', group: 'Look', title: 'S one', prio: 'P1', read: 'Read me', slots: { KEEP: 'k', CHANGE: 'c' }, images: ['a.png', 'a.png'] },
      { id: 's2', group: 'Look', title: 'S two', pre: 'raw  text    spaced' },
      { id: 's3', group: 'Other', title: 'S three', note: 'seed' },
    ],
  }));
  await page.goto('file://' + full + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-dp:not([hidden]) .fe-dp-card', { timeout: 8000 });
  const r = await page.evaluate(() => {
    const card = id => document.querySelector(`.fe-dp-card[data-id="${id}"]`);
    const checked = id => card(id).querySelector('input[type="radio"]:checked')?.value;
    const grps = [...document.querySelectorAll('.fe-dp-grp')].map(g => g.querySelector('summary').textContent.trim());
    const tiles = [...card('D2').querySelectorAll('.fe-dp-opt.tile')].map(t => Math.round(t.getBoundingClientRect().top));
    const none = card('D2').querySelector('.fe-dp-opt.none');
    const gal = card('D2').querySelector('.fe-dp-opts').getBoundingClientRect().width;
    const look = [...document.querySelectorAll('.fe-dp-grp')].find(g => g.dataset.grp === 's:Look');
    const pre = card('s2').querySelector('.fe-dp-pre');
    return {
      decisions: document.querySelectorAll('.fe-dp-card[data-kind="decision"]').length, d1: checked('D1'), d2: checked('D2'),
      recs: document.querySelectorAll('.fe-dp-rec').length, recOn: [...document.querySelectorAll('.fe-dp-rec')].map(b => b.closest('.fe-dp-opt').dataset.code).join(''),
      ctxParas: card('D1').querySelectorAll('.fe-dp-md p').length, d1Strip: card('D1').querySelectorAll('.fe-dp-strip img').length,
      tileTops: tiles, noneCode: none?.dataset.code, noneLabel: none?.querySelector('.fe-dp-opt-lbl').textContent, noneFull: Math.abs(none.getBoundingClientRect().width - gal) < 2,
      d2Note: { open: !card('D2').querySelector('.fe-dp-note').hidden, text: card('D2').querySelector('textarea').value },
      s3Note: { open: !card('s3').querySelector('.fe-dp-note').hidden, text: card('s3').querySelector('textarea').value },
      s1: { title: card('s1').querySelector('.fe-dp-q').textContent, prio: card('s1').querySelector('.fe-dp-prio')?.textContent, read: card('s1').querySelector('.fe-dp-md')?.textContent.trim(), slots: card('s1').querySelectorAll('.fe-dp-slot').length, agree: card('s1').querySelector('.fe-dp-agree-sw').checked, imgs: card('s1').querySelectorAll('.fe-dp-strip img').length },
      grps, lookColor: getComputedStyle(look.querySelector('summary')).color, lookLink: !!look.querySelector('.fe-dp-grp-ctx a[href^="https://example.com"]'),
      pre: { font: getComputedStyle(pre).fontFamily, ws: getComputedStyle(pre).whiteSpace, text: pre.textContent },
      end: !!document.getElementById('fe-dp-endnotes'),
      selBorder: getComputedStyle(card('D1').querySelector('.fe-dp-opt:has(input:checked)')).borderColor,
      progress: document.getElementById('fe-dp-progress').textContent,
    };
  });
  check(r.decisions === 2 && r.d1 === 'b' && r.d2 === 'a' && r.recs === 2 && r.recOn === 'ba', `A10 A12 each decision starts on its recommended option, tagged: ${JSON.stringify([r.decisions, r.d1, r.d2, r.recs, r.recOn])}`);
  check(r.ctxParas === 2, `A11 decision context keeps its paragraphs: ${r.ctxParas}`);
  check(r.d1Strip === 1, `A13 decision images show as a strip, and a ../ path is refused: ${r.d1Strip}`);
  check(r.tileTops.length === 3 && new Set(r.tileTops).size === 1, `A14 imaged options sit side by side as tiles: ${JSON.stringify(r.tileTops)}`);
  check(r.noneCode === 'z' && r.noneLabel === 'Neither' && r.noneFull, `A15 A16 None of these is coded z, renamed, and spans the gallery: ${JSON.stringify([r.noneCode, r.noneLabel, r.noneFull])}`);
  check(r.d2Note.open && r.d2Note.text === 'why?' && r.s3Note.open && r.s3Note.text === 'seed', `A17 A22 seeded notes show open: ${JSON.stringify([r.d2Note, r.s3Note])}`);
  check(r.s1.title === 'S one' && r.s1.prio === 'P1' && r.s1.read === 'Read me' && r.s1.slots === 2 && r.s1.agree && r.s1.imgs === 2, `A19 A23 an item shows title, priority, text, slots, images, agreed: ${JSON.stringify(r.s1)}`);
  check(r.grps.length === 3 && /^Decisions\s*2$/.test(r.grps[0]) && /^Look\s*2$/.test(r.grps[1]) && /^Other\s*1$/.test(r.grps[2]), `A20 groups band the cards with counts: ${JSON.stringify(r.grps)}`);
  check(r.lookColor === 'rgb(217, 119, 6)' && r.lookLink, `A8 a group's colour tints its heading and its context links: ${JSON.stringify([r.lookColor, r.lookLink])}`);
  check(/mono|Menlo|Courier/i.test(r.pre.font) && r.pre.ws === 'pre' && r.pre.text === 'raw  text    spaced', `A21 pre text is verbatim and monospace: ${JSON.stringify(r.pre)}`);
  check(r.end, 'A24 the Notes for Claude card is there');
  check(r.selBorder === 'rgb(124, 58, 237)', `A5 accent colours the selected option: ${r.selBorder}`);
  check(r.progress === '5 items · all as drafted', `B16 the progress line starts as drafted: ${r.progress}`);
  await shot(page, 'dp-cards');

  const cur = () => page.evaluate(() => document.querySelector('.fe-dp-card.current')?.dataset.id ?? null);
  await page.evaluate(() => document.activeElement?.blur());
  for (let i = 0; i < 3; i++) await page.keyboard.press('j');
  await new Promise(res => setTimeout(res, 600));
  const centred = await page.evaluate(() => {
    const c = document.querySelector('.fe-dp-card.current'), b = c.getBoundingClientRect(), s = document.getElementById('fe-dp').getBoundingClientRect();
    return { id: c.dataset.id, focused: document.activeElement === c, off: Math.round((b.top + b.bottom) / 2 - (s.top + s.bottom) / 2) };
  });
  check(centred.id === 's1' && centred.focused && Math.abs(centred.off) < 60, `B1 j three times lands on the third card, focused and centred: ${JSON.stringify(centred)}`);
  await page.keyboard.press('g');
  const firstCard = await cur();
  await page.keyboard.down('Shift'); await page.keyboard.press('G'); await page.keyboard.up('Shift');
  check(firstCard === 'D1' && await cur() === 's3', `B1 g and G go to the first and last card: ${firstCard}`);

  await page.click('.fe-dp-card[data-id="D1"] .fe-dp-q');
  await page.keyboard.press('1');
  await new Promise(res => setTimeout(res, 400));
  const picked = await page.evaluate(() => {
    const c = document.querySelector('.fe-dp-card[data-id="D1"]');
    return { cur: c.classList.contains('current'), v: c.querySelector('input:checked')?.value, flag: c.dataset.flag, edge: getComputedStyle(c).borderLeftColor, nums: [...c.querySelectorAll('.fe-dp-num')].map(n => getComputedStyle(n).visibility), progress: document.getElementById('fe-dp-progress').textContent };
  });
  const gold = await page.evaluate(() => { const d = document.createElement('i'); d.style.color = 'var(--gold)'; document.getElementById('fe').append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
  check(picked.cur && picked.v === 'a' && picked.flag === 'changed' && picked.progress === '5 items · 1 flagged', `B15 B2 B16 clicking a card then 1 picks its first option: ${JSON.stringify(picked)}`);
  check(picked.edge === gold, `B17 a changed card gets the amber edge: ${picked.edge} vs ${gold}`);
  check(picked.nums.every(v => v === 'visible'), `A18 the focused decision shows its option numbers: ${JSON.stringify(picked.nums)}`);

  await page.click('.fe-dp-card[data-id="s1"] .fe-dp-q');
  await page.keyboard.press('a');
  const dis = await page.evaluate(() => { const c = document.querySelector('.fe-dp-card[data-id="s1"]'); return { on: c.querySelector('.fe-dp-agree-sw').checked, flag: c.dataset.flag, cls: c.classList.contains('disagree') }; });
  check(!dis.on && dis.flag === 'changed' && dis.cls, `B3 a flips agree on the focused item: ${JSON.stringify(dis)}`);

  await page.click('.fe-dp-card[data-id="s2"] .fe-dp-q');
  await page.keyboard.press('n');
  const noteFocus = await page.evaluate(() => document.activeElement?.dataset?.note);
  await page.keyboard.type('hello j');
  const typed = await page.evaluate(() => ({ v: document.activeElement.value, cur: document.querySelector('.fe-dp-card.current')?.dataset.id }));
  await page.keyboard.press('Escape');
  await new Promise(res => setTimeout(res, 400));
  const left = await page.evaluate(() => { const c = document.querySelector('.fe-dp-card[data-id="s2"]'); return { focus: document.activeElement === c, flag: c.dataset.flag, edge: getComputedStyle(c).borderLeftColor, ac: getComputedStyle(document.getElementById('fe-dp')).getPropertyValue('--ac').trim() }; });
  check(noteFocus === 's2', `B4 n opens the note on the focused card, focused: ${noteFocus}`);
  check(typed.v === 'hello j' && typed.cur === 's2', `B14 typing j in a note types it and moves nothing: ${JSON.stringify(typed)}`);
  check(left.focus && left.flag === 'noted', `B4 Esc leaves the note for its card; a noted card is flagged as noted: ${JSON.stringify(left)}`);
  check(left.edge === 'rgb(124, 58, 237)', `B17 a note-only card gets the accent edge: ${left.edge}`);

  await page.keyboard.press('m');
  const allOpen = await page.evaluate(() => [...document.querySelectorAll('.fe-dp-note')].filter(n => !n.hidden).length);
  await page.keyboard.press('m');
  const someOpen = await page.evaluate(() => [...document.querySelectorAll('.fe-dp-card')].filter(c => !c.querySelector('.fe-dp-note').hidden).map(c => c.dataset.id).join(','));
  check(allOpen === 5 && someOpen === 'D2,s2,s3', `B5 m shows a note on every card, and again keeps only those with text: ${allOpen} then ${someOpen}`);

  await page.keyboard.down('Shift'); await page.keyboard.press('N'); await page.keyboard.up('Shift');
  check(await page.evaluate(() => document.activeElement?.id) === 'fe-dp-endnotes', 'B6 N goes to the Notes for Claude box');
  await page.keyboard.type('end words');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('f');
  const flagged = await page.evaluate(() => ({ cards: [...document.querySelectorAll('.fe-dp-card')].filter(c => c.offsetParent).map(c => c.dataset.id).join(','), grps: [...document.querySelectorAll('.fe-dp-grp')].filter(g => g.offsetParent).length }));
  check(flagged.cards === 'D1,s1,s2' && flagged.grps === 2, `B7 f shows only changed or noted cards and hides empty groups: ${JSON.stringify(flagged)}`);
  await shot(page, 'dp-flagged');
  await page.keyboard.press('f');

  const before = await page.evaluate(() => document.getElementById('fe').dataset.theme);
  await page.keyboard.press('t');
  const after = await page.evaluate(() => document.getElementById('fe').dataset.theme);
  await page.keyboard.press('t');
  check(before !== after, `B11 t switches dark and light: ${before} to ${after}`);

  await page.click('.fe-dp-grp[data-grp="s:Other"] > summary');
  await new Promise(res => setTimeout(res, 400));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-dp:not([hidden]) .fe-dp-card', { timeout: 8000 });
  const kept2 = await page.evaluate(() => {
    const card = id => document.querySelector(`.fe-dp-card[data-id="${id}"]`);
    return { d1: card('D1').querySelector('input:checked')?.value, s1: card('s1').querySelector('.fe-dp-agree-sw').checked, s2: { open: !card('s2').querySelector('.fe-dp-note').hidden, v: card('s2').querySelector('textarea').value }, end: document.getElementById('fe-dp-endnotes').value, other: document.querySelector('.fe-dp-grp[data-grp="s:Other"]').open, progress: document.getElementById('fe-dp-progress').textContent };
  });
  check(kept2.d1 === 'a' && !kept2.s1 && kept2.end === 'end words' && kept2.progress === '5 items · 3 flagged', `A2 answers are kept across a reload: ${JSON.stringify(kept2)}`);
  check(kept2.s2.open && kept2.s2.v === 'hello j', `B18 a saved note shows open after a reload: ${JSON.stringify(kept2.s2)}`);
  check(kept2.other === false, 'A9 a folded group stays folded after a reload');

  page.once('dialog', d => d.accept());
  await page.click('#fe-dp-reset');
  const reset = await page.evaluate(() => ({ d1: document.querySelector('.fe-dp-card[data-id="D1"] input:checked')?.value, flags: document.querySelectorAll('.fe-dp-card[data-flag]').length, progress: document.getElementById('fe-dp-progress').textContent, end: document.getElementById('fe-dp-endnotes').value }));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#fe-dp:not([hidden]) .fe-dp-card', { timeout: 8000 });
  const resetKept = await page.evaluate(() => document.querySelector('.fe-dp-card[data-id="D1"] input:checked')?.value);
  check(reset.d1 === 'b' && reset.flags === 0 && reset.progress === '5 items · all as drafted' && reset.end === '' && resetKept === 'b', `B19 Reset puts every answer back as drafted and it stays so: ${JSON.stringify(reset)} ${resetKept}`);

  // notes:false hides every note surface.
  const quiet = join(h.fixture, 'dp-quiet');
  mkdirSync(quiet);
  writeFileSync(join(quiet, 'config.json'), JSON.stringify({ title: 'Quiet', notes: false, decisions: [{ id: 'D1', question: 'Q?', options: [{ code: 'a', label: 'A', rec: true }] }] }));
  await page.goto('file://' + quiet + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-dp:not([hidden]) .fe-dp-card', { timeout: 8000 });
  await page.click('.fe-dp-card .fe-dp-q');
  await page.keyboard.press('n');
  await page.keyboard.press('m');
  const q = await page.evaluate(() => ({ add: document.querySelectorAll('.fe-dp-addnote, .fe-dp-note, #fe-dp-notes').length, end: !!document.getElementById('fe-dp-end'), typing: document.activeElement?.tagName }));
  check(q.add === 0 && !q.end && q.typing !== 'TEXTAREA', `A6 notes:false hides every note surface and n, m do nothing: ${JSON.stringify(q)}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
