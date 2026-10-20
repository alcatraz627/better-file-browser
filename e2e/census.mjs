// A census of the rendered UI: every visible control and text style on the
// explorer (with preview docked and floating), the file page and Settings,
// in dark and light. It measures the consistency the owner asked for, so a
// slice of the redesign can show its effect as a before/after number.
//
// Output: e2e/census/<name>.json (raw rows) and a printed summary.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './harness.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'census');
mkdirSync(OUT, { recursive: true });
const name = process.argv[2] || 'current';

// Runs in the page: one row per visible control, one per text style.
function collect(surface) {
  const visible = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight; };
  const where = e => { for (let n = e; n; n = n.parentElement) if (n.id && n.id !== e.id) return '#' + n.id; return ''; };
  const controls = [...document.querySelectorAll('button, a[role="button"], [role="button"], select, input:not([type="hidden"]), #fe a[id]')]
    .filter(visible)
    .map(e => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      const text = (e.innerText || '').trim();
      const hasIcon = !!e.querySelector('svg, img');
      return {
        surface, id: e.id || '', cls: (e.className && e.className.baseVal === undefined ? e.className : '').toString().slice(0, 40), in: where(e), tag: e.tagName.toLowerCase(),
        iconOnly: hasIcon && !text, text: text.slice(0, 24),
        label: e.getAttribute('title') || e.getAttribute('aria-label') || '',
        w: Math.round(r.width), h: Math.round(r.height),
        radius: s.borderTopLeftRadius, border: s.borderTopWidth !== '0px' && s.borderTopStyle !== 'none' && !/rgba\(0, 0, 0, 0\)|transparent/.test(s.borderTopColor) ? s.borderTopWidth : '0',
        bg: s.backgroundColor, font: s.fontSize, weight: s.fontWeight, transition: s.transitionDuration,
      };
    });
  // Text styles: every leaf-ish element that paints text.
  const seen = new Map();
  for (const e of document.querySelectorAll('#fe *')) {
    if (!visible(e)) continue;
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const s = getComputedStyle(e);
    const key = `${s.fontSize}|${s.fontWeight}|${s.lineHeight}|${s.fontFamily.split(',')[0]}|${s.textTransform}|${s.letterSpacing}`;
    const row = seen.get(key) || { surface, size: s.fontSize, weight: s.fontWeight, lh: s.lineHeight, family: s.fontFamily.split(',')[0], transform: s.textTransform, spacing: s.letterSpacing, count: 0, samples: [] };
    row.count++;
    if (row.samples.length < 4) row.samples.push(`${where(e)} ${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]}`);
    seen.set(key, row);
  }
  return { controls, text: [...seen.values()] };
}

const h = await launch();
const rows = { controls: [], text: [] };
const add = r => { rows.controls.push(...r.controls); rows.text.push(...r.text); };
try {
  for (const theme of ['dark', 'light']) {
    await h.store.set('bfb-theme', theme);
    await h.store.set('bfb-preview-layout-v1', { mode: 'side', sideW: 640 });
    const page = await h.open();
    await page.setViewport({ width: 1519, height: 860 });
    add(await page.evaluate(collect, `${theme}:explorer`));
    await (await page.$('#fe-tbody tr[data-idx]:has(a[href$="readme.md"]) td.c-nm')).click();
    await page.waitForSelector('#fe-qlook.side', { timeout: 5_000 }).catch(() => null);
    await new Promise(r => setTimeout(r, 400));
    add(await page.evaluate(collect, `${theme}:preview-docked`));
    await page.click('#fe-settings-btn').catch(() => null);
    await new Promise(r => setTimeout(r, 300));
    add(await page.evaluate(collect, `${theme}:settings`));
    await page.keyboard.press('Escape');
    await page.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
    await page.waitForSelector('#fe.fe-file-page', { timeout: 8_000 }).catch(() => null);
    add(await page.evaluate(collect, `${theme}:file-page`));
    await page.close();
  }
} finally {
  await h.close();
}
writeFileSync(join(OUT, `${name}.json`), JSON.stringify(rows, null, 1));

// Summary, deduplicated by control id or class within the dark surfaces.
const dark = rows.controls.filter(c => c.surface.startsWith('dark'));
const uniq = new Map(); for (const c of dark) uniq.set(c.id || `${c.in}/${c.cls}/${c.text}`, c);
const ctl = [...uniq.values()];
const count = (xs, f) => { const m = new Map(); for (const x of xs) { const k = f(x); m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); };
const unlabelled = ctl.filter(c => c.iconOnly && !c.label);
const buttons = ctl.filter(c => c.tag === 'button' || c.tag === 'a');
console.log(`census "${name}": ${ctl.length} distinct controls, ${rows.text.filter(t => t.surface.startsWith('dark')).length} text styles (dark)`);
console.log(`icon-only controls: ${ctl.filter(c => c.iconOnly).length}, with no label: ${unlabelled.length}`, unlabelled.map(c => c.id || `${c.in} ${c.cls}`));
console.log('button sizes (w×h):', count(buttons, c => `${c.w}x${c.h}`).slice(0, 12));
console.log('button radius:', count(buttons, c => c.radius));
console.log('button border:', count(buttons, c => c.border));
console.log('button font size:', count(buttons, c => c.font));
console.log('text sizes:', count(rows.text.filter(t => t.surface.startsWith('dark')), t => t.size).map(([k, n]) => `${k}×${n}`).join(' '));
console.log('no transition:', ctl.filter(c => c.transition === '0s').length, 'of', ctl.length);
console.log(`rows written to ${join(OUT, name + '.json')}`);
