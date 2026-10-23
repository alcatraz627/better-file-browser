// Moving between pages draws the next page whole: the cover shown before it
// paints is the theme's own background (a light theme never flashes dark), the
// Notes list is there from the first frame, and a diagram seen before draws at
// once instead of after "Rendering diagram".
//
//   node e2e/nav-walk.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const results = [];
const check = (ok, msg) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${msg}`); if (!ok) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch();
try {
  const store = join(h.fixture, 'nav-notes');
  mkdirSync(store, { recursive: true });
  writeFileSync(join(store, 'one.md'), '---\ntitle: "First note"\n---\nbody\n');
  writeFileSync(join(store, 'two.md'), '---\ntitle: "Second note"\n---\nbody\n');
  await h.store.set('bfb-theme', 'light');
  await h.store.set('bfb-settings-v1', { showSidebar: true, notesRoot: store });
  await h.store.set('bfb-lens-v1', 'notes');
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  // Each page records what its cover looked like and whether the notes list
  // changed after the shell first appeared.
  await page.evaluateOnNewDocument(() => {
    const seen = { cover: '', notesLate: 0, diagramWait: false, shell: false };
    window.__nav = seen;
    new MutationObserver(list => {
      const pre = document.getElementById('bfb-preload');
      if (pre && !seen.cover) seen.cover = pre.textContent.match(/background:\s*([^!;]+)/)?.[1].trim() ?? '';
      if (!seen.shell && document.getElementById('fe-nt-list')) { seen.shell = true; seen.first = document.querySelectorAll('#fe-nt-list .fe-nt-item').length; return; }
      if (!seen.shell) return;
      for (const m of list) {
        if ((m.target.id === 'fe-nt-list' || m.target.closest?.('#fe-nt-list')) && m.type === 'childList') seen.notesLate++;
        if (m.target.classList?.contains('fe-md-mermaid-view') && /Rendering diagram/.test(m.target.textContent)) seen.diagramWait = true;
      }
      if (document.querySelector('.fe-md-mermaid-view')?.textContent.includes('Rendering diagram')) seen.diagramWait = true;
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });

  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.waitForSelector('#fe-nt-list .fe-nt-item', { timeout: 8000 });
  const bg = await page.$eval('#fe', e => getComputedStyle(e).backgroundColor);
  await sleep(300);

  await page.goto('file://' + h.fixture + '/nested/', { waitUntil: 'load' });
  await sleep(800);
  const second = await page.evaluate(() => window.__nav);
  check(second.cover === bg, `the cover before the next page paints is the page's own background: ${second.cover} vs ${bg}`);
  check(second.first === 2 && second.notesLate === 0, `the notes list is there from the first frame and does not redraw: ${JSON.stringify({ first: second.first, late: second.notesLate })}`);

  // A diagram met a second time draws straight away.
  await page.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('.fe-md-mermaid-view svg'), { timeout: 10000 });
  await page.goto('file://' + h.fixture + '/', { waitUntil: 'load' });
  await page.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('.fe-md-mermaid-view svg'), { timeout: 10000 });
  const again = await page.evaluate(() => window.__nav);
  check(!again.diagramWait, `a diagram seen before draws without "Rendering diagram": ${JSON.stringify({ wait: again.diagramWait })}`);
} finally {
  console.log(results.join('\n'));
  await h.close();
}
