// Measures every list row and every floating surface in the shell, so the row
// spec and the popover spec can be checked as numbers instead of by eye. Each
// family's rows must share height, inset, radius, font size, icon size and the
// hover wash; each floating surface must share radius, border, shadow and fill.
// Prints a table per family and fails on any value outside the spec.
//
// BFB_THEME=light runs it on the light theme.
import { join } from 'node:path';
import { launch, SHOTS, applyTheme } from './harness.mjs';

const ROW = { height: 32, radius: 8, font: 13, icon: 16, padX: 10 };
const POP = { radius: 12 };

const h = await launch();
const fails = [];
const report = [];
try {
  await h.store.set('bfb-saved-v1', [
    { path: h.fixture + '/', label: 'Fixture', tags: ['work'] },
    { path: h.fixture + '/readme.md', label: 'Readme', tags: [] },
  ]);
  await h.store.set('bfb-tags-v1', [{ name: 'work', color: '#3fb950' }]);
  // The second entry is damaged on purpose: History must skip it, not crash.
  await h.store.set('bfb-recents-v1', [{ path: h.fixture + '/nested/', ts: Date.now() - 60000 }, { url: 'x' }]);
  let page = await h.open();
  await applyTheme(page);
  await page.waitForSelector('#fe-rail-places');

  // Rows: the first visible element of each family, measured at rest and hovered.
  // A header (group head, rail tab) is not a list row: only its corner and
  // hover wash have to match.
  async function rows(family, selector, { header = false } = {}) {
    const handles = await page.$$(selector);
    const vis = [];
    for (const el of handles) if (await el.evaluate(e => e.getBoundingClientRect().height > 0)) vis.push(el);
    if (!vis.length) { report.push(`${family}: none visible (${selector})`); return; }
    const el = vis[0];
    const rest = await el.evaluate(e => getComputedStyle(e).backgroundColor);
    await el.hover();
    await new Promise(r => setTimeout(r, 250));
    const m = await el.evaluate(e => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      const ic = e.querySelector(':scope > .fe-si-link > svg, :scope > svg');
      const icr = ic ? ic.getBoundingClientRect() : null;
      return {
        h: Math.round(r.height), padL: parseFloat(s.paddingLeft), padR: parseFloat(s.paddingRight),
        rad: parseFloat(s.borderTopLeftRadius), font: parseFloat(s.fontSize),
        icon: icr ? Math.round(icr.width) : null, gap: s.columnGap, hover: s.backgroundColor,
        insetL: Math.round(r.left - (e.offsetParent?.getBoundingClientRect().left ?? 0)),
      };
    });
    report.push(`${family.padEnd(14)} h=${m.h} pad=${m.padL}/${m.padR} r=${m.rad} font=${m.font} icon=${m.icon} gap=${m.gap} inset=${m.insetL} hover=${m.hover} rest=${rest}`);
    const bad = [];
    if (m.rad !== ROW.radius) bad.push(`radius ${m.rad}`);
    if (!header) {
      if (m.h !== ROW.height) bad.push(`height ${m.h}`);
      if (m.font !== ROW.font) bad.push(`font ${m.font}`);
      if (m.icon !== null && m.icon !== ROW.icon) bad.push(`icon ${m.icon}`);
      if (m.padL !== ROW.padX) bad.push(`padding-left ${m.padL}`);
    }
    if (m.hover === rest) bad.push('no hover wash');
    if (bad.length) fails.push(`${family}: ${bad.join(', ')}`);
  }

  async function surface(name, selector) {
    const m = await page.$eval(selector, e => {
      const s = getComputedStyle(e);
      return { rad: parseFloat(s.borderTopLeftRadius), border: s.borderTopWidth + ' ' + s.borderTopColor, shadow: s.boxShadow !== 'none', bg: s.backgroundColor, blur: s.backdropFilter, pad: s.paddingTop };
    }).catch(() => null);
    if (!m) { report.push(`${name}: not found`); return; }
    report.push(`${name.padEnd(14)} r=${m.rad} border=${m.border} shadow=${m.shadow} bg=${m.bg} blur=${m.blur} pad=${m.pad}`);
    if (m.rad !== POP.radius) fails.push(`${name}: radius ${m.rad}`);
    if (!m.shadow) fails.push(`${name}: no shadow`);
  }

  await page.click('#fe-rail-places');
  // Places fills in once the native host says where home is.
  await page.waitForSelector('#fe-lens-places .fe-si', { timeout: 5000 }).catch(() => null);
  await rows('places', '#fe-lens-places .fe-si');
  await page.click('#fe-rail-notes'); await new Promise(r => setTimeout(r, 300));
  await rows('saved', '#fe-sv-list .fe-bm-item');
  await rows('group head', '#fe-sv-list details.fe-grp > summary', { header: true });
  await page.screenshot({ path: join(SHOTS, 'census-notes.png'), clip: { x: 0, y: 0, width: 520, height: 600 } });
  await page.click('#fe-rail-history'); await new Promise(r => setTimeout(r, 300));
  await rows('history', '#fe-lens-history .fe-si');
  await rows('rail button', '.fe-rail-btn', { header: true });

  await page.click('.fe-crumb-dd'); await page.waitForSelector('.fe-dd-item');
  await rows('path menu', '#fe-crumb-menu .fe-dd-item');
  await surface('path menu', '#fe-crumb-menu');
  await page.screenshot({ path: join(SHOTS, 'census-crumb.png'), clip: { x: 0, y: 0, width: 900, height: 500 } });
  await page.keyboard.press('Escape');
  await page.mouse.click(700, 60);

  const row = await page.$('#fe-tbody tr[data-tip], #fe-tbody [data-tip]');
  if (row) {
    await row.hover(); await page.mouse.move(400, 300); await row.hover();
    await new Promise(r => setTimeout(r, 600));
    await surface('tooltip', '#fe-tip');
    await page.screenshot({ path: join(SHOTS, 'census-tip.png') });
  }

  const idx = await page.$$eval('#fe-scroll [data-idx]', es => es.find(e => e.textContent.includes('readme.md'))?.dataset.idx);
  await page.click(`#fe-scroll [data-idx="${idx}"] .fe-nm`, { button: 'right' });
  await page.waitForSelector('#fe-ctx .fe-ctx-item');
  await rows('context menu', '#fe-ctx .fe-ctx-item');
  await surface('context menu', '#fe-ctx');
  await page.keyboard.press('Escape');

  // Type scale: every visible piece of shell text, file page included, sits on
  // one of the five steps. Reading text (markdown, code) has its own sizes.
  const SCALE = [10, 11, 12, 13, 15];
  async function typeScale(where) {
    const off = await page.evaluate(scale => {
      const seen = new Map();
      for (const el of document.querySelectorAll('#fe *, #fe-settings-modal *')) {
        if (el.closest('.fe-md, .fe-code-wrap, .fe-ql-font, svg, iframe, #fe-fe-paint, #fe-fe-ta')) continue;
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const px = parseFloat(getComputedStyle(el).fontSize);
        if (!scale.includes(px)) seen.set(`${px}px`, (seen.get(`${px}px`) || []).concat(el.id ? '#' + el.id : '.' + [...el.classList].join('.')));
      }
      return [...seen].map(([px, els]) => `${px} on ${[...new Set(els)].slice(0, 4).join(' ')}`);
    }, SCALE);
    report.push(`type scale (${where}): ${off.length ? off.join('; ') : 'all on 10/11/12/13/15'}`);
    if (off.length) fails.push(`type scale (${where}): ${off.join('; ')}`);
  }
  await typeScale('listing');
  await page.click('#fe-rail-notes'); await new Promise(r => setTimeout(r, 300));
  await typeScale('notes lens');
  await page.click('#fe-settings-btn');
  await page.waitForSelector('#fe-settings-modal .fe-dlg-tab');
  for (const tab of await page.$$('#fe-settings-modal .fe-dlg-tab')) {
    await tab.click(); await new Promise(r => setTimeout(r, 150));
    await typeScale(`settings ${await tab.evaluate(t => t.querySelector('b')?.textContent || t.textContent.trim())}`);
  }
  await page.keyboard.press('Escape');
  const fp = await h.open();
  await fp.goto('file://' + h.fixture + '/readme.md', { waitUntil: 'load' });
  await fp.waitForSelector('#fe.fe-file-page');
  await applyTheme(fp);
  const listing = page;
  page = fp;
  await typeScale('file page');
  page = listing;

  console.log(report.join('\n'));
  console.log(fails.length ? 'FAIL\n  ' + fails.join('\n  ') : 'PASS every row and surface is on spec');
  if (fails.length) process.exitCode = 1;
} finally { await h.close(); }
