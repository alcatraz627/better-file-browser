// Commenting from a markdown file page: select words, press the floating
// Comment button, complete a mention and a tag, set a due date, post; reply,
// mark done and reopen, remove a tag and the date; open a thread from a #c=
// link; move between threads and comment with the keyboard. While editing,
// the gutter marks commented lines and follows typing, a thread selects its
// words, and a save keeps the comment exactly on its words. Rewriting the
// quoted words moves the thread to Moved or Detached; an edit elsewhere in
// another program keeps the others exact.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { launch, SHOTS, THEME } from './harness.mjs';

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
const sfx = THEME === 'light' ? '-light' : '';
try {
  const doc = join(h.fixture, 'plan.md');
  writeFileSync(doc, `# Release plan

## Timing

We agreed to ship on **Friday** after the [smoke run](notes.txt), unless the suite is red.

The lens rail landed yesterday and looks good.

## Risks

Parsing large files could still be slow on old machines.

| Typed in a comment | Effect |
|---|---|
| a tag | adds it |

\`\`\`js
const alpha = 1;
const beta = 2;
\`\`\`
`);
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture] }));
  await h.store.set('bfb-theme', THEME);
  await h.store.set('bfb-comments-filter-v1', 'open');
  const seed = cli('--as', 'bfb', 'comments', 'new', doc, '--quote', 'lens rail landed yesterday', 'Can we demo it? #schedule').results[0].thread;
  const all = () => cli('comments', 'list', doc, '--all');
  const byText = t => all().find(x => x.comments.some(c => c.text.includes(t)));

  const page = await h.open();
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-fp-cm');
  await page.click('#fe-fp-cm');
  await page.waitForSelector('#fe-cm .fe-cm-th', { timeout: 8000 });

  const select = words => page.evaluate(w => {
    const root = document.querySelector('#fe-page .fe-md');
    const nodes = [];
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) nodes.push(tw.currentNode);
    const at = nodes.map(n => n.data).join('').indexOf(w);
    if (at < 0) return false;
    const place = k => { for (const n of nodes) { if (k <= n.data.length) return [n, k]; k -= n.data.length; } };
    const r = document.createRange();
    r.setStart(...place(at)); r.setEnd(...place(at + w.length));
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    return true;
  }, words);
  const cmd = async key => { await page.keyboard.down('Meta'); await page.keyboard.press(key); await page.keyboard.up('Meta'); };

  // Select, then the floating button.
  check(await select('ship on Friday after the smoke run'), 'the words to comment on are on the page');
  await page.waitForFunction(() => !document.getElementById('fe-cm-add').hidden, { timeout: 3000 }).catch(() => null);
  const btn = await page.evaluate(() => { const b = document.getElementById('fe-cm-add'); const r = b.getBoundingClientRect(); const s = getSelection().getRangeAt(0).getBoundingClientRect(); return { shown: !b.hidden, above: r.bottom <= s.top + 2, near: Math.abs(r.left + r.width / 2 - s.right) < 120 }; });
  check(btn.shown && btn.above && btn.near, `a Comment button floats just above the end of the selection: ${JSON.stringify(btn)}`);
  await page.screenshot({ path: join(SHOTS, `comment-select${sfx}.png`) });
  await page.click('#fe-cm-add');
  await page.waitForSelector('#fe-cm .fe-cm-new textarea', { timeout: 4000 });
  const composer = await page.evaluate(() => ({
    quote: document.querySelector('.fe-cm-new .fe-cm-q').textContent,
    focused: document.activeElement?.dataset?.for,
    marked: [...(CSS.highlights.get('bfb-cm-on') ?? [])][0]?.toString(),
  }));
  check(composer.quote === 'ship on Friday after the smoke run' && composer.focused === 'new' && composer.marked === 'ship on Friday after the smoke run',
    `the composer opens focused, quoting and marking the selected words: ${JSON.stringify(composer)}`);

  // Completion for @ and #.
  await page.keyboard.type('Is this firm? @b');
  const ac1 = await page.$$eval('.fe-cm-ac [data-v]', els => els.map(e => e.dataset.v));
  check(ac1.includes('bfb'), `typing @b offers the agent who commented here: ${ac1.join(',')}`);
  const acBox = await page.evaluate(() => { const l = document.querySelector('.fe-cm-ac').getBoundingClientRect(), t = document.querySelector('.fe-cm-new textarea').getBoundingClientRect(); return { below: l.top >= t.bottom - 1, left: Math.abs(l.left - t.left) < 2 }; });
  check(acBox.below && acBox.left, `the suggestions sit right under the box: ${JSON.stringify(acBox)}`);
  await page.keyboard.press('Enter');
  await page.keyboard.type('please check #sch');
  const ac2 = await page.$$eval('.fe-cm-ac [data-v]', els => els.map(e => e.dataset.v));
  check(ac2.join(',') === 'schedule', `typing #sch offers the file's tag: ${ac2.join(',')}`);
  await page.keyboard.press('Tab');
  await page.keyboard.type('@due 2026-11-03');
  const typed = await page.$eval('.fe-cm-new textarea', t => t.value);
  check(typed === 'Is this firm? @bfb please check #schedule @due 2026-11-03', `picks insert the whole word: ${JSON.stringify(typed)}`);
  await page.screenshot({ path: join(SHOTS, `comment-compose${sfx}.png`) });
  await cmd('Enter');
  await page.waitForFunction(() => document.querySelector('#fe-cm .fe-cm-th.on')?.textContent.includes('Is this firm?'), { timeout: 6000 }).catch(() => null);
  let t = byText('Is this firm?');
  check(t && t.anchor.exact === 'ship on **Friday** after the [smoke run](notes.txt)', `the stored quote is the source of the selected words, markup included: ${JSON.stringify(t?.anchor.exact)}`);
  check(t && t.comments[0].author.kind === 'human' && t.mentions.includes('bfb') && t.tags.includes('schedule') && t.due === '2026-11-03',
    `the comment is the owner's, with its mention, tag and due date: ${JSON.stringify(t && { a: t.comments[0].author, m: t.mentions, g: t.tags, d: t.due })}`);
  check(readFileSync(doc, 'utf8').includes('ship on **Friday**'), 'the document itself is unchanged');
  const id = t.id;

  // Reply, done, reopen, untag, clear the date.
  await page.click(`#fe-cm .fe-cm-th.on textarea`);
  await page.keyboard.type('- first point');
  await page.keyboard.down('Shift'); await page.keyboard.press('Enter'); await page.keyboard.up('Shift');
  await page.keyboard.type('- second point');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Following up.');
  await cmd('Enter');
  await page.waitForFunction(i => document.querySelectorAll(`#fe-cm .fe-cm-th[data-id="${i}"] .fe-cm-c`).length === 2, { timeout: 6000 }, id).catch(() => null);
  check(byText('Following up.')?.comments.length === 2, 'a reply from the page lands on the thread');
  const shape = await page.evaluate(i => { const c = [...document.querySelectorAll(`#fe-cm .fe-cm-th[data-id="${i}"] .fe-cm-tx`)].pop(); return { li: c?.querySelectorAll('li').length, p: c?.querySelector('p')?.textContent }; }, id);
  check(shape.li === 2 && shape.p === 'Following up.', `a reply keeps its lines and its list: ${JSON.stringify(shape)}`);
  // Edit the owner's own comment.
  await page.hover(`#fe-cm .fe-cm-th.on .fe-cm-c`);
  await page.click(`#fe-cm .fe-cm-th.on .fe-cm-c [data-a="edit"]`);
  await page.waitForSelector('#fe-cm textarea[data-for^="edit:"]', { timeout: 3000 }).catch(() => null);
  await page.$eval('#fe-cm textarea[data-for^="edit:"]', t => { t.value = 'Is this firm? Edited. @bfb #schedule @due 2026-11-03'; });
  await cmd('Enter');
  await page.waitForFunction(() => document.querySelector('#fe-cm .fe-cm-th.on')?.textContent.includes('Edited.'), { timeout: 6000 }).catch(() => null);
  t = all().find(x => x.id === id);
  check(t?.comments[0].text.includes('Edited.') && !!t.comments[0].edited, `the owner can edit their own comment and it is marked edited: ${JSON.stringify(t?.comments[0].text)}`);
  await page.screenshot({ path: join(SHOTS, `comment-thread${sfx}.png`) });
  await page.click(`#fe-cm .fe-cm-th.on [data-a="done"]`);
  await page.waitForFunction(i => document.querySelector(`#fe-cm details.fe-cm-done .fe-cm-th[data-id="${i}"]`), { timeout: 6000 }, id).catch(() => null);
  check(all().find(x => x.id === id)?.status === 'done', 'Done closes the thread and it moves to the Done group');
  await page.click(`#fe-cm .fe-cm-th.on [data-a="reopen"]`);
  await page.waitForFunction(i => document.querySelector(`#fe-cm .fe-cm-list > .fe-cm-th[data-id="${i}"]`), { timeout: 6000 }, id).catch(() => null);
  check(all().find(x => x.id === id)?.status === 'open', 'Reopen brings it back');
  await page.click(`#fe-cm .fe-cm-th.on [data-a="untag"][data-v="schedule"]`);
  await page.waitForFunction(() => !document.querySelector('#fe-cm .fe-cm-th.on [data-a="untag"]'), { timeout: 6000 }).catch(() => null);
  await page.click(`#fe-cm .fe-cm-th.on [data-a="undue"]`);
  await page.waitForFunction(() => !document.querySelector('#fe-cm .fe-cm-th.on .fe-cm-chip.due'), { timeout: 6000 }).catch(() => null);
  t = all().find(x => x.id === id);
  check(t && !t.tags.includes('schedule') && !t.due, `a chip's x removes the tag and clears the due date: ${JSON.stringify(t && { g: t.tags, d: t.due })}`);
  await page.click(`#fe-cm .fe-cm-th.on [data-a="due"]`);
  await page.$eval('#fe-cm .fe-cm-date', el => { el.value = '2026-12-01'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelector('#fe-cm .fe-cm-th.on .fe-cm-chip.due'), { timeout: 6000 }).catch(() => null);
  check(all().find(x => x.id === id)?.due === '2026-12-01', 'the Due button sets a date from a date field');

  // Keyboard: Esc, Alt+Down and Up, Shift+C, c with a selection.
  await page.click('#fe-page');
  await page.keyboard.press('Escape');
  await page.keyboard.down('Alt'); await page.keyboard.press('ArrowDown'); await page.keyboard.up('Alt');
  const k1 = await page.$eval('#fe-cm .fe-cm-th.on', e => e.dataset.id).catch(() => null);
  await page.keyboard.down('Alt'); await page.keyboard.press('ArrowDown'); await page.keyboard.up('Alt');
  const k2 = await page.$eval('#fe-cm .fe-cm-th.on', e => e.dataset.id).catch(() => null);
  check(k1 === id && k2 === seed, `Alt+Down walks the open threads in document order: ${k1 === id} ${k2 === seed}`);
  await page.click('#fe-page');
  await page.keyboard.down('Shift'); await page.keyboard.press('C'); await page.keyboard.up('Shift');
  const folded = await page.evaluate(() => document.getElementById('fe-toc-rail').dataset.tab !== 'cm' || document.getElementById('fe-toc-rail').hidden);
  await page.keyboard.down('Shift'); await page.keyboard.press('C'); await page.keyboard.up('Shift');
  const back = await page.evaluate(() => document.getElementById('fe-toc-rail').dataset.tab === 'cm' && !document.getElementById('fe-toc-rail').hidden);
  check(folded && back, `Shift+C hides and shows the comments: ${folded} ${back}`);
  await select('Parsing large files');
  await page.keyboard.press('c');
  const fresh = await page.$eval('.fe-cm-new textarea', t => t.value).catch(() => null);
  check(fresh === '', `a second comment starts with an empty box: ${JSON.stringify(fresh)}`);
  await page.keyboard.type('@cl');
  const ac3 = await page.$$eval('.fe-cm-ac [data-v]', els => els.map(e => e.dataset.v));
  check(ac3[0] === 'claude', `@cl offers the generic @claude first: ${ac3.slice(0, 4).join(',')}`);
  await page.keyboard.press('Escape');
  await page.waitForSelector('#fe-cm .fe-cm-new textarea', { timeout: 3000 }).catch(() => null);
  const viaKey = await page.evaluate(() => document.querySelector('.fe-cm-new .fe-cm-q')?.textContent);
  await page.keyboard.press('Escape');
  const gone = await page.evaluate(() => !document.querySelector('.fe-cm-new'));
  check(viaKey === 'Parsing large files' && gone, `c comments on the selection and Esc cancels: ${viaKey} ${gone}`);

  // The pane buttons right of find, hover on commented words, table headers, code lines.
  const panes = await page.evaluate(() => {
    const ff = document.getElementById('fe-ff').getBoundingClientRect(), cm = document.getElementById('fe-fp-cm').getBoundingClientRect(), toc = document.getElementById('fe-fp-toc').getBoundingClientRect();
    return { right: toc.left >= ff.right && cm.left > toc.left, iconOnly: !document.getElementById('fe-fp-cm').textContent.replace(/\d/g, '').trim(), fold: !!document.getElementById('fe-toc-fold') };
  });
  check(panes.right && panes.iconOnly && !panes.fold, `Contents and Comments are icon buttons right of find, and the rail has no fold button: ${JSON.stringify(panes)}`);
  await page.click('#fe-fp-toc');
  const tocTab = await page.evaluate(() => document.getElementById('fe-toc-rail').dataset.tab);
  await page.click('#fe-fp-cm');
  check(tocTab === 'toc' && await page.evaluate(() => document.getElementById('fe-toc-rail').dataset.tab === 'cm'), 'each button shows its own pane');
  const hov = await page.evaluate(() => { const r = [...CSS.highlights.get('bfb-cm')].find(x => x.toString().includes('lens rail')); const b = r.getBoundingClientRect(); return { x: b.left + 8, y: b.top + b.height / 2 }; });
  await page.mouse.move(hov.x, hov.y);
  await sleep(150);
  check(await page.evaluate(() => (CSS.highlights.get('bfb-cm-hover')?.size ?? 0) === 1), 'commented words darken under the pointer');
  await page.mouse.move(5, 5);
  check(await select('Typed in a comment'), 'a table header can be selected');
  await page.keyboard.press('c');
  await page.waitForSelector('.fe-cm-new', { timeout: 3000 }).catch(() => null);
  const thQuote = await page.evaluate(() => document.querySelector('.fe-cm-new .fe-cm-q')?.textContent);
  await page.keyboard.press('Escape');
  check(thQuote === 'Typed in a comment', `a table header can be commented on: ${JSON.stringify(thQuote)}`);
  const th = await page.evaluate(() => { const h = document.querySelector('.fe-md-table th').getBoundingClientRect().height, d = document.querySelector('.fe-md-table td').getBoundingClientRect().height; return { h, d, upper: getComputedStyle(document.querySelector('.fe-md-table th')).textTransform }; });
  check(Math.abs(th.h - th.d) <= 2 && th.upper === 'none', `table headers are as tall as the rows and not in capitals: ${JSON.stringify(th)}`);
  const code = await page.evaluate(() => {
    const pre = document.querySelector('.fe-md-code .fe-md-pre');
    const r = document.createRange(); r.selectNodeContents(pre);
    getSelection().removeAllRanges(); getSelection().addRange(r);
    const out = { lines: pre.querySelectorAll('.fe-md-l').length, sel: getSelection().toString(), num: getComputedStyle(pre.querySelector('.fe-md-l'), '::before').content };
    getSelection().removeAllRanges();
    return out;
  });
  check(code.lines === 2 && code.sel === 'const alpha = 1;\nconst beta = 2;' && code.num.includes('counter'), `code lines are numbered and a selection copies only the code: ${JSON.stringify(code)}`);
  await page.screenshot({ path: join(SHOTS, `comment-code-table${sfx}.png`) });

  // A #c= link opens its thread.
  const linked = await h.open();
  await linked.setViewport({ width: 1400, height: 900 });
  await linked.goto(`file://${doc}#c=${id}`, { waitUntil: 'load' });
  await linked.waitForFunction(i => document.querySelector(`#fe-cm .fe-cm-th.on[data-id="${i}"]`), { timeout: 8000 }, id).catch(() => null);
  check(await linked.evaluate(i => !!document.querySelector(`#fe-cm .fe-cm-th.on[data-id="${i}"]`) && !document.getElementById('fe-toc-rail').hidden, id), 'a #c= link opens the page on that thread');
  await linked.close();

  // Editing: gutter markers follow typing; a save keeps the comment on its words.
  await page.click('#fe-fp-edit');
  await page.waitForSelector('#fe-fe-ta', { timeout: 6000 });
  await sleep(300);
  const rows = () => page.evaluate(() => [...document.querySelectorAll('#fe-fe-paint .fe-fe-row')].map((r, i) => r.classList.contains('cm') ? i : -1).filter(i => i >= 0));
  const before = await rows();
  check(before.join(',') === '4,6', `the gutter marks the lines where open comments start: ${before.join(',')}`);
  await page.focus('#fe-fe-ta');
  await page.evaluate(() => { const t = document.getElementById('fe-fe-ta'); t.setSelectionRange(0, 0); });
  await page.keyboard.type('Intro line.\n\n');
  const typing = await rows();
  check(typing.join(',') === '6,8', `while typing above, the markers move with the text: ${typing.join(',')}`);
  await page.screenshot({ path: join(SHOTS, `comment-gutter${sfx}.png`) });
  await page.waitForFunction(() => document.getElementById('fe-fe-state').className === 'saved', { timeout: 6000 }).catch(() => null);
  await sleep(3500);
  t = all().find(x => x.id === id);
  check(t && t.place.state === 'anchored' && t.place.line === 7 && t.anchor.exact === 'ship on **Friday** after the [smoke run](notes.txt)',
    `after the save the thread is still exactly on its words, two lines down: ${JSON.stringify(t && t.place)}`);
  await page.click(`#fe-cm .fe-cm-th[data-id="${seed}"]`);
  await sleep(200);
  const sel = await page.evaluate(() => { const t = document.getElementById('fe-fe-ta'); return t.value.slice(t.selectionStart, t.selectionEnd); });
  check(sel === 'lens rail landed yesterday', `opening a thread while editing selects its words in the text: ${JSON.stringify(sel)}`);
  const gut = await page.evaluate(() => {
    const ta = document.getElementById('fe-fe-ta');
    const row = document.querySelectorAll('#fe-fe-paint .fe-fe-row')[6].getBoundingClientRect();
    return { x: ta.getBoundingClientRect().left + 10, y: row.top + row.height / 2 };
  });
  await page.mouse.click(gut.x, gut.y);
  await sleep(200);
  check(await page.$eval('#fe-cm .fe-cm-th.on', e => e.dataset.id).catch(() => null) === id, 'a click on a gutter marker opens its thread');
  await page.click('#fe-fe-pill [data-act="done"]');
  await page.waitForFunction(() => document.getElementById('fe-page').style.display !== 'none', { timeout: 4000 }).catch(() => null);

  // Edits in another program.
  const now = readFileSync(doc, 'utf8');
  writeFileSync(doc, 'Added elsewhere.\n\n' + now.replace('The lens rail landed yesterday and looks good.', 'The rail went out with mixed reviews from everyone.'));
  await page.waitForFunction(() => /Moved|Detached/.test(document.getElementById('fe-cm').textContent), { timeout: 8000 }).catch(() => null);
  const groups = await page.$$eval('#fe-cm .fe-cm-group', g => g.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  check(groups.some(g => /^(Moved|Detached) 1$/.test(g)), `rewriting the quoted words moves that thread out of the open list: ${groups.join(' | ')}`);
  t = all().find(x => x.id === id);
  check(t && t.place.state === 'anchored' && t.place.line === 9, `an outside edit above keeps the other thread exact: ${JSON.stringify(t && t.place)}`);
  await page.screenshot({ path: join(SHOTS, `comment-moved${sfx}.png`) });

  // A detached thread is attached to new words: select them, open the thread, Attach.
  await select('The rail went out with mixed reviews');
  await page.click(`#fe-cm .fe-cm-th[data-id="${seed}"] .fe-cm-q`);
  await page.waitForSelector(`#fe-cm .fe-cm-th.on[data-id="${seed}"] [data-a="attach"]`, { timeout: 3000 }).catch(() => null);
  await page.click(`#fe-cm .fe-cm-th.on [data-a="attach"]`);
  await page.waitForSelector('#fe-cm .fe-cm-new', { timeout: 3000 }).catch(() => null);
  const attachQuote = await page.evaluate(() => document.querySelector('.fe-cm-new .fe-cm-q')?.textContent);
  await page.click('#fe-cm .fe-cm-new [data-a="post"]').catch(() => null);
  await page.waitForFunction(() => !document.querySelector('#fe-cm .fe-cm-group'), { timeout: 6000 }).catch(() => null);
  t = all().find(x => x.id === seed);
  check(attachQuote === 'The rail went out with mixed reviews' && t?.place.state === 'anchored' && t.anchor.exact === 'The rail went out with mixed reviews',
    `Attach to selection moves a detached thread onto the selected words: ${JSON.stringify({ attachQuote, place: t?.place.state, exact: t?.anchor.exact })}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
assert.ok(results.every(r => !r.startsWith('FAIL')), 'comments compose walk passes');
