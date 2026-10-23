// Adversarial probe: records, frame by frame, what each page looks like from
// its first animation frame, and reports every visible change after the first
// frame the owner can see (cover gone). Also collects layout-shift entries.
//
//   node e2e/adv-jank-probe.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './harness.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const scenario = process.env.ADV_SCEN || 'all';
const h = await launch({ lmStub: true });
const out = [];
const log = s => { out.push(s); console.log(s); };

const RECORDER = () => {
  const frames = [];
  const shifts = [];
  window.__adv = { frames, shifts, t0: performance.now() };
  try {
    new PerformanceObserver(l => {
      for (const e of l.getEntries()) shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), src: (e.sources || []).map(s => (s.node && (s.node.id || s.node.className || s.node.nodeName)) + '').slice(0, 4) });
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) { /* none */ }
  const q = s => document.querySelector(s);
  const sig = () => {
    const pre = !!document.getElementById('bfb-preload');
    const fe = q('#fe');
    const body = document.body;
    const vis = !pre && !!body && getComputedStyle(body).opacity !== '0';
    if (!fe) return { vis, pre, fe: false, htmlBg: getComputedStyle(document.documentElement).backgroundColor };
    const side = q('#fe-side');
    const lens = [...document.querySelectorAll('.fe-lens')].find(l => !l.hidden && l.offsetParent);
    const tabs = q('#fe-tabs');
    const main = q('#fe-main');
    const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
    return {
      vis, pre, fe: true,
      htmlBg: getComputedStyle(document.documentElement).backgroundColor,
      feBg: getComputedStyle(fe).backgroundColor,
      theme: fe.dataset.theme, palette: fe.dataset.palette,
      side: side ? (getComputedStyle(side).display === 'none' ? 'none' : side.offsetWidth) : null,
      lens: lens ? lens.dataset.lens : null,
      lensRows: lens ? lens.querySelectorAll('.row, .fe-nt-item, .fe-si, .fe-empty, .fe-ask-msg, [class*="turn"]').length : null,
      lensH: lens ? lens.scrollHeight : null,
      tabs: tabs ? tabs.children.length : null,
      tabsW: r(tabs),
      rows: document.querySelectorAll('#fe-tbody tr').length,
      main: r(main),
      mainText: main ? Math.round(main.innerText.length / 20) : null,
      scrollTop: (q('#fe-scroll') || {}).scrollTop ?? null,
      fileH: (q('.fe-fp-body, .fe-md, #fe-fp') || {}).scrollHeight ?? null,
      mermaid: (q('.fe-md-mermaid-view') || {}).textContent?.slice(0, 20) ?? null,
      fonts: document.fonts.status,
      bar: r(q('#fe-bar')), tool: r(q('#fe-toolbar')), status: r(q('#fe-statusbar')),
    };
  };
  let last = '';
  const tick = () => {
    const t = Math.round(performance.now());
    let s; try { s = sig(); } catch (e) { s = { err: String(e) }; }
    const k = JSON.stringify(s);
    if (k !== last) { frames.push({ t, s }); last = k; }
    if (t < 3000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

function diff(a, b) {
  const d = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) d.push(`${k}: ${JSON.stringify(a[k])} -> ${JSON.stringify(b[k])}`);
  return d;
}

async function report(page, label) {
  await sleep(2600);
  const r = await page.evaluate(() => window.__adv);
  if (!r) { log(`## ${label}: no recorder`); return; }
  const fr = r.frames;
  const firstVis = fr.findIndex(f => f.s.vis);
  log(`## ${label}`);
  const pre = fr.slice(0, Math.max(firstVis, 0)).map(f => `t=${f.t} pre=${f.s.pre} htmlBg=${f.s.htmlBg}`);
  if (pre.length) log('  before visible: ' + pre.join(' | '));
  if (firstVis < 0) { log('  never visible'); return; }
  const fv = fr[firstVis];
  log(`  first visible t=${fv.t} theme=${fv.s.theme} feBg=${fv.s.feBg} lens=${fv.s.lens} lensRows=${fv.s.lensRows} tabs=${fv.s.tabs} rows=${fv.s.rows} side=${fv.s.side} fonts=${fv.s.fonts}`);
  for (let i = firstVis + 1; i < fr.length; i++) {
    const d = diff(fr[i - 1].s, fr[i].s).filter(x => !x.startsWith('fonts:'));
    if (d.length) log(`  +${fr[i].t - fv.t}ms ${d.join('; ')}`);
  }
  const cls = r.shifts.reduce((a, s) => a + s.v, 0);
  log(`  layout shifts: ${r.shifts.length} total=${cls.toFixed(4)} ${r.shifts.slice(0, 6).map(s => `${s.t}:${s.v}:${s.src.join(',')}`).join(' ')}`);
}

async function navTo(page, url, label) {
  await page.goto(url, { waitUntil: 'load' });
  await report(page, label);
}

try {
  const notesStore = join(h.fixture, 'nav-notes');
  mkdirSync(notesStore, { recursive: true });
  for (let i = 0; i < 6; i++) writeFileSync(join(notesStore, `n${i}.md`), `---\ntitle: "Note ${i}"\n---\nbody ${i}\n`);
  const F = 'file://' + h.fixture;
  const settings = { showSidebar: true, notesRoot: notesStore };

  const page = await h.browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  await page.evaluateOnNewDocument(RECORDER);

  // 1. First-ever page in a fresh profile with the light theme already chosen.
  await h.store.set('bfb-theme', 'light');
  await h.store.set('bfb-settings-v1', settings);
  await navTo(page, F + '/', 'fresh profile, light theme, first page (no kept bg)');
  await navTo(page, F + '/nested/', 'light: folder -> folder');
  await navTo(page, F + '/readme.md', 'light: folder -> md file');
  await navTo(page, F + '/code.py', 'light: md -> code file');
  await navTo(page, F + '/', 'light: file -> folder');
  await page.goBack({ waitUntil: 'load' }); await report(page, 'light: back to code file');

  for (const lens of ['saved', 'history', 'ask', 'comments', 'search', 'places']) {
    await h.store.set('bfb-lens-v1', lens);
    await navTo(page, F + '/nested/', `light, lens=${lens}: -> folder`);
  }
  await h.store.set('bfb-lens-v1', 'notes');

  // 2. Palettes and dark.
  for (const [theme, palette] of [['dark', 'slate'], ['dark', 'violet'], ['light', 'sand'], ['dark', 'ink']]) {
    await h.store.set('bfb-theme', theme);
    await h.store.set('bfb-palette', palette);
    await navTo(page, F + '/', `${theme}/${palette}: first page after the switch`);
    await navTo(page, F + '/nested/', `${theme}/${palette}: folder -> folder`);
  }

  // 3. System mode: kept colour from dark, system now light.
  await h.store.set('bfb-palette', 'slate');
  await h.store.set('bfb-theme', 'dark');
  await navTo(page, F + '/', 'dark set, page drawn');
  await h.store.set('bfb-theme', 'system');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await navTo(page, F + '/nested/', 'system mode (OS light), last kept bg was dark');

  // 4. Sidebar hidden setting, then a tab strip with several tabs.
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await h.store.set('bfb-theme', 'dark');
  await h.store.set('bfb-settings-v1', { ...settings, showSidebar: false });
  await navTo(page, F + '/', 'sidebar hidden: folder');
  await navTo(page, F + '/readme.md', 'sidebar hidden: md');
  await h.store.set('bfb-settings-v1', settings);

  // 5. Scroll position on back: a long folder, scroll down, open a file, come back.
  const big = join(h.fixture, 'big');
  mkdirSync(big, { recursive: true });
  for (let i = 0; i < 200; i++) writeFileSync(join(big, `f${String(i).padStart(3, '0')}.txt`), 'x');
  await navTo(page, F + '/big/', 'big folder');
  await page.evaluate(() => { const s = document.querySelector('#fe-scroll'); if (s) s.scrollTop = 2000; });
  const before = await page.evaluate(() => document.querySelector('#fe-scroll')?.scrollTop);
  await page.goto(F + '/big/f150.txt', { waitUntil: 'load' });
  await sleep(800);
  await page.goBack({ waitUntil: 'load' });
  await sleep(1500);
  const after = await page.evaluate(() => document.querySelector('#fe-scroll')?.scrollTop);
  log(`## back to scrolled folder: scrollTop before=${before} after=${after}`);
  // long md file scroll on back
  writeFileSync(join(h.fixture, 'long.md'), Array.from({ length: 300 }, (_, i) => `Paragraph ${i} with some text to wrap.\n`).join('\n'));
  await page.goto(F + '/long.md', { waitUntil: 'load' });
  await sleep(1200);
  const mdScroll = await page.evaluate(() => { const c = [...document.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 200 && /auto|scroll/.test(getComputedStyle(e).overflowY)); if (!c) return null; c.scrollTop = 3000; return { id: c.id || c.className, top: c.scrollTop }; });
  await page.goto(F + '/', { waitUntil: 'load' });
  await sleep(600);
  await page.goBack({ waitUntil: 'load' });
  await sleep(1500);
  const mdAfter = await page.evaluate(() => { const c = [...document.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 200 && /auto|scroll/.test(getComputedStyle(e).overflowY)); return c ? { id: c.id || c.className, top: c.scrollTop } : null; });
  log(`## back to scrolled md: before=${JSON.stringify(mdScroll)} after=${JSON.stringify(mdAfter)}`);
} finally {
  mkdirSync('/tmp/adv-jank', { recursive: true });
  writeFileSync('/tmp/adv-jank/probe.txt', out.join('\n'));
  await h.close();
}
