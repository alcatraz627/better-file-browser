// Adversarial probe 2: per-frame state of the things a person sees settle
// after a page appears (lens opacity, Wrap button, notes rows), plus the
// stale-notes and theme-switch cases.
//
//   node e2e/adv-jank-probe2.mjs
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const h = await launch({ lmStub: true });
const out = [];
const log = s => { out.push(s); console.log(s); };

const REC = () => {
  const frames = [];
  window.__adv2 = frames;
  let last = '';
  const tick = () => {
    const t = Math.round(performance.now());
    const pre = !!document.getElementById('bfb-preload');
    const lens = [...document.querySelectorAll('.fe-lens')].find(l => !l.hidden);
    const wrap = document.getElementById('fe-fp-wrap');
    const s = {
      pre,
      fe: !!document.getElementById('fe'),
      lensOp: lens ? (+getComputedStyle(lens).opacity).toFixed(2) : null,
      lensTx: lens ? getComputedStyle(lens).transform : null,
      wrapOn: wrap ? wrap.classList.contains('on') : null,
      wrapBg: wrap ? getComputedStyle(wrap).backgroundColor : null,
      notes: [...document.querySelectorAll('#fe-nt-list .fe-nt-item')].map(n => n.textContent.trim().slice(0, 12)).join('|'),
      mer: document.querySelector('.fe-md-mermaid-view')?.textContent.slice(0, 18) ?? null,
      merSvg: !!document.querySelector('.fe-md-mermaid-view svg'),
      askTurns: document.querySelectorAll('#fe-ask [class*="turn"], #fe-ask [class*="msg"]').length,
    };
    const k = JSON.stringify(s);
    if (k !== last) { frames.push({ t, s }); last = k; }
    if (t < 2500) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

async function dump(page, label) {
  await sleep(2200);
  const fr = await page.evaluate(() => window.__adv2);
  log(`## ${label}`);
  const fv = fr.find(f => !f.s.pre && f.s.fe);
  for (const f of fr) if (f.s.fe) log(`  t=${f.t}${fv ? ` (+${f.t - fv.t})` : ''} ${JSON.stringify(f.s)}`);
}

try {
  const notesStore = join(h.fixture, 'nav-notes');
  mkdirSync(notesStore, { recursive: true });
  for (let i = 0; i < 4; i++) writeFileSync(join(notesStore, `n${i}.md`), `---\ntitle: "Note ${i}"\n---\nbody ${i}\n`);
  await h.store.set('bfb-settings-v1', { showSidebar: true, notesRoot: notesStore });
  await h.store.set('bfb-theme', 'light');
  const F = 'file://' + h.fixture;
  const page = await h.browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.evaluateOnNewDocument(REC);

  await page.goto(F + '/', { waitUntil: 'load' }); await sleep(1500);
  await page.goto(F + '/nested/', { waitUntil: 'load' }); await dump(page, 'folder -> folder (lens opacity per frame)');
  await page.goto(F + '/readme.md', { waitUntil: 'load' }); await dump(page, 'folder -> md (wrap button, diagram first time)');
  await page.goto(F + '/readme.md', { waitUntil: 'load' }); await dump(page, 'md reload (diagram cached)');

  // Theme toggle on a page with a diagram: does it go back to "Rendering diagram"?
  await page.evaluate(() => { window.__mer = []; const v = document.querySelector('.fe-md-mermaid-view'); new MutationObserver(() => window.__mer.push(v.textContent.slice(0, 20) + (v.querySelector('svg') ? '[svg]' : ''))).observe(v, { childList: true, subtree: true, characterData: true }); });
  await page.click('#fe-theme-btn'); await sleep(1500);
  log(`## theme toggle on md, diagram view states: ${JSON.stringify(await page.evaluate(() => window.__mer))}`);
  await page.click('#fe-theme-btn'); await sleep(1500);
  log(`## theme toggle back, diagram view states: ${JSON.stringify(await page.evaluate(() => window.__mer))}`);

  // Stale kept list: a note added and one removed on disk (Switchboard, the Pi, another app), then a move.
  writeFileSync(join(notesStore, 'n9.md'), '---\ntitle: "Added elsewhere"\n---\nx\n');
  rmSync(join(notesStore, 'n1.md'));
  await page.goto(F + '/nested/', { waitUntil: 'load' }); await dump(page, 'stale kept notes (one added, one deleted elsewhere)');
} finally {
  writeFileSync('/tmp/adv-jank/probe2.txt', out.join('\n'));
  await h.close();
}
