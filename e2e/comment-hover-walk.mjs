// Commented words answer the pointer: the tint deepens smoothly with a dashed
// underline, resting on them for 3 seconds shows the comment above them, and a
// click on that preview opens the thread in the panel.
// BFB_THEME=light runs it on the light theme.
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
  const doc = join(h.fixture, 'hover.md');
  writeFileSync(doc, '# Hover\n\nSome plain words first.\n\nThe launch date moved to Friday, pending the smoke run.\n\nMore plain words after.\n');
  await h.store.edit('bfb-settings-v1', s => ({ ...s, editableFolders: [h.fixture] }));
  cli('--as', 'bfb', 'comments', 'new', doc, '--quote', 'launch date moved to Friday', 'Is Friday still realistic given the suite?');

  const page = await h.open(h.fixture);
  await applyTheme(page);
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('file://' + doc, { waitUntil: 'load' });
  await page.waitForSelector('#fe-page .fe-md');
  await page.click('#fe-fp-cm');
  await page.waitForSelector('#fe-cm .fe-cm-th', { timeout: 8000 });
  await page.click('#fe-fp-cm');   // hide the panel: the preview is for reading without it
  await sleep(400);

  const words = await page.evaluate(() => {
    const p = [...document.querySelectorAll('#fe-page .fe-md p')].find(x => /launch date/.test(x.textContent));
    const n = p.firstChild, i = n.textContent.indexOf('date moved');
    const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 4);
    const b = r.getBoundingClientRect(); const pb = p.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2, top: b.top, clip: { x: pb.left - 8, y: pb.top - 8, width: Math.min(560, pb.width + 16), height: pb.height + 16 } };
  });
  const hov = () => page.$eval('#fe-page', p => getComputedStyle(p).getPropertyValue('--cm-hov').trim());
  check(await hov() === '0%', 'the hover tint starts at nothing');
  await page.mouse.move(words.x - 200, words.y - 60);
  await sleep(100);
  await page.mouse.move(words.x, words.y);
  await sleep(70);
  const mid = parseFloat(await hov());
  await sleep(400);
  const end = parseFloat(await hov());
  check(mid > 0 && mid < 100 && end === 100, `the tint eases in rather than snapping: ${mid}% after 70 ms, ${end}% after 470 ms`);
  check(await page.$eval('#fe-page', p => getComputedStyle(p).cursor) === 'pointer', 'the pointer becomes a hand over the words');

  // The preview waits 3 seconds.
  await sleep(1000);
  check(await page.$eval('.fe-cm-peek', e => e.hidden), 'no preview after 1.5 s');
  await sleep(1800);
  const peek = await page.$eval('.fe-cm-peek', e => { const r = e.getBoundingClientRect(); return { hidden: e.hidden, text: e.innerText.replace(/\s+/g, ' ').trim(), bottom: r.bottom }; });
  check(!peek.hidden && /Friday still realistic/.test(peek.text) && /bfb/.test(peek.text), `after 3 s the comment shows: "${peek.text}"`);
  check(peek.bottom <= words.top + 1, `the preview sits above the words: ${JSON.stringify({ bottom: peek.bottom, wordsTop: words.top })}`);

  // Moving onto the preview keeps it; a click opens the thread.
  const pc = await page.$eval('.fe-cm-peek', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(pc.x, pc.y, { steps: 5 });
  await sleep(400);
  check(!(await page.$eval('.fe-cm-peek', e => e.hidden)), 'moving onto the preview keeps it open');
  await page.mouse.click(pc.x, pc.y);
  await sleep(500);
  const opened = await page.evaluate(() => ({
    rail: !document.getElementById('fe-toc-rail').hidden && document.getElementById('fe-toc-rail').dataset.tab === 'cm',
    on: !!document.querySelector('#fe-cm .fe-cm-th.on'),
    peek: document.querySelector('.fe-cm-peek').hidden,
  }));
  check(opened.rail && opened.on && opened.peek, `a click on the preview opens the thread in the panel and the preview goes: ${JSON.stringify(opened)}`);

  // Leaving the words before 3 s shows nothing.
  await page.click('#fe-cm .fe-cm-th.on .fe-cm-q');   // keep it open; move to plain text and back
  await page.keyboard.press('Escape');
  await sleep(200);
  await page.mouse.move(words.x, words.y + 200);
  await sleep(200);
  await page.mouse.move(words.x, words.y);
  await sleep(1500);
  await page.mouse.move(words.x, words.y + 200);
  await sleep(2000);
  check(await page.$eval('.fe-cm-peek', e => e.hidden), 'a pointer that leaves before 3 s gets no preview');

  // The underline, close up (a clipped screenshot counts as the pointer leaving, so it comes last).
  await page.mouse.move(words.x, words.y);
  await sleep(500);
  await page.screenshot({ path: join(SHOTS, `comment-hover-underline${THEME === 'light' ? '-light' : ''}.png`), clip: words.clip });
  await page.mouse.move(words.x + 2, words.y);
  await sleep(3300);
  await shot(page, 'comment-hover-peek');
} catch (e) {
  check(false, `walk stopped: ${String(e.message).split('\n')[0]}`);
} finally {
  await h.close();
  console.log(results.join('\n'));
}
