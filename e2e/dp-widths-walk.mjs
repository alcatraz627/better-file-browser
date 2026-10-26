// Every real decision page at a phone, a tablet and a desktop width, in both
// themes: nothing may run past the page, and picture tiles keep their size
// whenever the column has room for it. The live registry is copied, never
// opened in place. Prints one line per failure and a PASS/FAIL per width.
//
//   node e2e/dp-widths-walk.mjs [slug ...]
import { cpSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { launch, store } from './harness.mjs';

const LIVE = join(homedir(), '.claude/assets/decision-pages');
const WIDTHS = [390, 768, 1400];
const wanted = process.argv.slice(2).filter(a => !a.startsWith('--'));
let failed = 0;
const h = await launch();
try {
  const reg = h.dpRegistry;
  const slugs = readdirSync(LIVE).filter(s => !s.startsWith('.') && existsSync(join(LIVE, s, 'config.json')) && (!wanted.length || wanted.includes(s)));
  for (const s of slugs) cpSync(join(LIVE, s), join(reg, s), { recursive: true });
  const tab = await h.open(h.fixture);
  const errors = [];
  tab.on('pageerror', e => errors.push(String(e.message ?? e)));
  for (const theme of ['dark', 'light']) {
    await store.set('bfb-theme', theme);
    for (const width of WIDTHS) {
      await tab.setViewport({ width, height: 900 });
      const bad = [];
      for (const slug of slugs) {
        errors.length = 0;
        await tab.goto('file://' + join(reg, slug) + '/', { waitUntil: 'load' });
        try { await tab.waitForSelector('#fe-dp:not([hidden]) .fe-dp-card', { timeout: 8000 }); }
        catch { bad.push(`${slug}: never drew`); continue; }
        const m = await tab.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          // A part inside the column that scrolls sideways on purpose (a wide table, a pre)
          // may hold wider content; the page's own scroller above the column excuses nothing.
          const colEl = document.querySelector('.fe-dp-col');
          const inScroller = e => { for (let p = e.parentElement; p && p !== colEl; p = p.parentElement) if (['auto', 'scroll'].includes(getComputedStyle(p).overflowX)) return true; return false; };
          const edge = Math.min(vw, colEl?.getBoundingClientRect().right ?? vw);
          const over = [...document.querySelectorAll('.fe-dp-col *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > edge + 1 && getComputedStyle(e).position !== 'fixed' && !inScroller(e); });
          const col = colEl?.getBoundingClientRect().width ?? 0;
          const tiles = [...document.querySelectorAll('.fe-dp-opt.tile')].map(t => Math.round(t.getBoundingClientRect().width)).filter(w => w > 0);
          return { pageOver: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth, over: over.slice(0, 2).map(e => `${e.className.toString().slice(0, 28) || e.tagName}@${Math.round(e.getBoundingClientRect().right)}`), col: Math.round(col), minTile: tiles.length ? Math.min(...tiles) : null };
        });
        const why = [];
        if (m.pageOver > 0) why.push(`page scrolls sideways by ${m.pageOver}px`);
        if (m.over.length) why.push(`past the edge: ${m.over.join(', ')}`);
        // A tile may only be under 220px when the whole column is too narrow for one that size.
        if (m.minTile !== null && m.minTile < 220 && m.col >= 260) why.push(`a tile is ${m.minTile}px in a ${m.col}px column`);
        if (errors.length) why.push(`page error: ${errors[0]}`);
        if (why.length) bad.push(`${slug}: ${why.join('; ')}`);
      }
      for (const b of bad) console.log(`  ${theme} ${width}  ${b}`);
      console.log(`${bad.length ? 'FAIL' : 'PASS'} ${theme} at ${width}px: ${slugs.length - bad.length} of ${slugs.length} pages fit`);
      if (bad.length) failed++;
    }
  }
} finally {
  await h.close();
  if (failed) process.exitCode = 1;
}
