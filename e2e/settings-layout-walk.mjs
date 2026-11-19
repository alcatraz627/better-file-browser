// Layout defects in every Settings pane that pass every behaviour check and
// only show to the eye: a list laid out one item per line while its row has room
// for several (the App icon grid did), a card row starting at a different left
// edge from its siblings, and a section heading taller than the rest because of
// its buttons, which pushes its card lower.
//
//   node e2e/settings-layout-walk.mjs   (BFB_THEME=light for the light theme)
import { launch, store, THEME } from './harness.mjs';

const TABS = ['look', 'folders', 'files', 'sidebar', 'tools', 'web', 'notes', 'ai', 'data'];
const h = await launch();
if (THEME === 'light') await store.set('bfb-theme', 'light');
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failed++; };
try {
  const page = await h.open();
  await page.setViewport({ width: 1200, height: 860 });
  await page.click('#fe-settings-btn');
  await page.waitForFunction(() => !document.getElementById('fe-settings-modal').hidden);
  for (const tab of TABS) {
    await page.click(`#fe-settings-modal .fe-dlg-tab[data-tab="${tab}"]`);
    await new Promise(r => setTimeout(r, 300));
    const found = await page.evaluate(t => {
      const pane = document.querySelector(`.fe-dlg-pane[data-tab="${t}"]`);
      const out = [];
      const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '');
      for (const el of pane.querySelectorAll('*')) {
        const kids = [...el.children].filter(k => k.getBoundingClientRect().width > 0);
        if (kids.length < 3 || el.matches('.fe-set-card, .card, ul, ol, [role="listbox"]')) continue;
        const cs = getComputedStyle(el);
        if (!/flex|grid/.test(cs.display) || cs.flexDirection === 'column') continue;
        const boxes = kids.map(k => k.getBoundingClientRect());
        const maxW = Math.max(...boxes.map(b => b.width));
        // The room is the parent's: a box that shrank to its content is the defect itself.
        const room = (el.parentElement ?? el).getBoundingClientRect().width;
        const stacked = boxes.every((b, i) => Math.abs(b.left - boxes[0].left) < 2 && (i === 0 || b.top >= boxes[i - 1].bottom - 1));
        if (stacked && room > maxW * 3) out.push(`${name(el)} lays ${kids.length} items one per line in ${Math.round(room)}px`);
      }
      for (const card of pane.querySelectorAll('.fe-set-card')) {
        const cardL = card.getBoundingClientRect().left;
        const edges = [...card.children].filter(r => r.getBoundingClientRect().height > 0).map(r => {
          const first = [...r.querySelectorAll('*')].find(e => e.children.length === 0 && e.getBoundingClientRect().width > 0 && (e.textContent.trim() || e.matches('input,svg,img')));
          return first ? [name(r), Math.round(first.getBoundingClientRect().left - cardL)] : null;
        }).filter(Boolean);
        const tally = new Map();
        for (const [, l] of edges) tally.set(l, (tally.get(l) ?? 0) + 1);
        const common = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0];
        for (const [n, l] of edges) if (Math.abs(l - common) > 2) out.push(`${n} starts at ${l}px, its card's rows at ${common}px`);
      }
      const heads = [...pane.querySelectorAll('.fe-set-h')].map(hd => [hd.textContent.trim(), Math.round(hd.getBoundingClientRect().height)]);
      const plain = heads.map(x => x[1]).sort((a, b) => a - b)[0];
      for (const [n, ht] of heads) if (ht !== plain) out.push(`heading "${n}" is ${ht}px, the others ${plain}px`);
      return out;
    }, tab);
    check(!found.length, `Settings ${tab}: no layout defects${found.length ? '\n      ' + found.join('\n      ') : ''}`);
  }
} catch (err) {
  console.error(err);
  failed++;
} finally {
  await h.close();
}
console.log(failed ? `\n${failed} pane(s) with defects` : '\nAll Settings panes clean');
process.exit(failed ? 1 : 0);
