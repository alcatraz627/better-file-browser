// Comment actions move instead of jumping: a thread opens by growing, a
// thread picked on the page glides into view and pulses, a reply rises into
// place, and a thread marked done folds away. With reduced motion asked for,
// all of it snaps.
// BFB_THEME=light runs it on the light theme.
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { launch, applyTheme } from './harness.mjs';

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

// The extension runs in its own world, so its animate calls cannot be hooked;
// the document's running animations are shared, so they are sampled instead.
const kindOf = k => k.some(f => 'boxShadow' in f) ? 'pulse' : k.some(f => f.height === '0px') ? 'collapse' : k.some(f => 'height' in f) ? 'grow' : k.some(f => 'transform' in f) ? 'rise' : 'other';
const sampling = page => page.evaluate(() => {
  window.__seen = new Map();
  window.__stop = false;
  const tick = () => {
    for (const a of document.getAnimations()) {
      if (window.__seen.has(a) || !a.effect?.target?.closest?.('#fe-cm')) continue;
      const t = a.effect.target;
      window.__seen.set(a, { k: a.effect.getKeyframes(), cls: String(t.className), id: t.dataset?.id || t.dataset?.c || '' });
    }
    if (!window.__stop) requestAnimationFrame(tick);
  };
  tick();
});
const watch = sampling;
const anims = async page => {
  const got = await page.evaluate(() => { const v = [...window.__seen.values()]; window.__seen.clear(); return v; });
  return got.map(g => ({ kind: kindOf(g.k), cls: g.cls, id: g.id })).filter(g => g.kind !== 'other');
};

async function run(reduced) {
  const doc = join(h.fixture, reduced ? 'still.md' : 'motion.md');
  writeFileSync(doc, '# Motion\n\nThe first paragraph has words to comment on.\n\nThe second paragraph also has words.\n');
  cli('comments', 'new', doc, '--quote', 'words to comment on', 'First thread.');
  cli('comments', 'new', doc, '--quote', 'also has words', 'Second thread.');
  const page = await h.open(h.fixture);
  await applyTheme(page);
  await page.setViewport({ width: 1400, height: 900 });
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-md');
  await page.click('#fe-fp-cm');
  await page.waitForSelector('#fe-cm .fe-cm-th', { timeout: 8000 });
  await sleep(300);
  await watch(page);
  const tag = reduced ? '[reduced] ' : '';

  // Open from the panel: the card grows.
  await page.click('#fe-cm .fe-cm-th:nth-of-type(1) .fe-cm-q');
  await sleep(300);
  let a = await anims(page);
  check(reduced ? a.length === 0 : a.some(x => x.kind === 'grow' && /fe-cm-th/.test(x.cls)), `${tag}opening a thread ${reduced ? 'snaps' : 'grows the card'}: ${JSON.stringify(a)}`);

  // Pick the other thread's words on the page: it glides in and pulses.
  const at = await page.evaluate(() => {
    const p = [...document.querySelectorAll('#fe-page .fe-md p')].find(x => /also has words/.test(x.textContent));
    const r = document.createRange(); const n = p.firstChild; const i = n.textContent.indexOf('also has words');
    r.setStart(n, i + 2); r.setEnd(n, i + 3);
    const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  await page.mouse.click(at.x, at.y);
  await sleep(300);
  a = await anims(page);
  check(reduced ? a.length === 0 : a.some(x => x.kind === 'pulse') && a.some(x => x.kind === 'grow'), `${tag}picking words on the page ${reduced ? 'snaps' : 'grows and pulses the card'}: ${JSON.stringify(a)}`);

  // Reply: the new comment rises in.
  const ta = '#fe-cm .fe-cm-th.on textarea';
  await page.click(ta);
  await page.type(ta, 'A reply');
  await page.click('#fe-cm .fe-cm-th.on [data-a="reply"]');
  await page.waitForFunction(() => [...document.querySelectorAll('#fe-cm .fe-cm-th.on .fe-cm-tx')].some(t => /A reply/.test(t.textContent)), { timeout: 5000 });
  await sleep(100);
  a = await anims(page);
  check(reduced ? a.length === 0 : a.some(x => x.kind === 'rise' && /fe-cm-c/.test(x.cls)), `${tag}a reply ${reduced ? 'appears at once' : 'rises into place'}: ${JSON.stringify(a)}`);

  // Done: the card folds away, then leaves the open list.
  const doneId = await page.$eval('#fe-cm .fe-cm-th.on', e => e.dataset.id);
  await page.click('#fe-cm .fe-cm-th.on [data-a="done"]');
  await sleep(500);
  a = await anims(page);
  const gone = await page.$$eval('#fe-cm .fe-cm-list > .fe-cm-th', (els, id) => !els.some(e => e.dataset.id === id), doneId);
  check(gone && (reduced ? a.length === 0 : a.some(x => x.kind === 'collapse' && x.id === doneId)), `${tag}done ${reduced ? 'removes the card at once' : 'folds the card away'}, and it leaves the open list: ${JSON.stringify({ gone, a })}`);
  await page.close();
}

try {
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture] }));
  await run(false);
  await run(true);
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
