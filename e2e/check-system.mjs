// The component system's source check (docs/plan/component-system.md, 13.2).
// It counts every kind of one-off the system forbids: raw sizes and colours in
// the stylesheet, key and click-outside listeners, page changes, storage calls
// and native controls outside their owners. Counts may only go down: the run
// fails if any rule counts more than e2e/system-baseline.json allows.
//
//   node e2e/check-system.mjs              check against the baseline
//   node e2e/check-system.mjs --update     lower the baseline to today's counts
//   node e2e/check-system.mjs --self-test  prove each rule fires on a planted violation
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const BASELINE = join(ROOT, 'e2e', 'system-baseline.json');
const FIXTURES = join(ROOT, 'e2e', 'fixtures', 'system-violations');

// CSS declarations only, with custom-property definitions left out: a token
// block may hold raw values, a rule may not.
const decls = css => css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{};]+:[^{};]+/g)?.filter(d => !/^\s*--/.test(d)) ?? [];
const count = (text, re) => (text.match(re) ?? []).length;

// Each rule reads the stylesheet text or the code text, skipping files it names.
const RULES = [
  { id: 'css-radius-px', css: d => /^\s*border-radius\s*:.*\d+px/.test(d) },
  { id: 'css-height-px', css: d => /^\s*(min-|max-)?height\s*:\s*\d+(\.\d+)?px/.test(d) },
  { id: 'css-space-px', css: d => /^\s*(padding|gap|row-gap|column-gap|margin)[\w-]*\s*:.*\d+px/.test(d) },
  // Page layers come from the --z tokens (or the top layer); a single digit,
  // or -1, orders a part's own children inside its stacking context and is fine.
  { id: 'css-zindex', css: d => /^\s*z-index\s*:\s*(-?\d{2,}|-[2-9])/.test(d) },
  { id: 'css-font-px', css: d => /^\s*font(-size)?\s*:.*\d+px/.test(d) },
  { id: 'css-duration', css: d => /^\s*(transition|animation)[\w-]*\s*:.*\b\d+(\.\d+)?m?s\b/.test(d) },
  { id: 'css-raw-colour', css: d => /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/.test(d) },
  { id: 'css-important', css: d => /!important/.test(d) },
  { id: 'css-media', text: (css) => count(css, /@(media|container)\b/g), on: 'css' },
  { id: 'css-dup-selector', text: css => dupSelectors(css), on: 'css' },
  { id: 'css-dead-decl', text: css => deadDecls(css), on: 'css' },
  { id: 'css-part-paint', text: css => partPaint(css), on: 'css' },
  { id: 'css-row-paint', text: css => rowPaint(css), on: 'css' },
  { id: 'js-keydown', code: /addEventListener\(\s*['"]keydown['"]/g, skip: ['layer.ts', 'resize.ts'] },
  // A press caught at the document is how a part closes itself on an outside
  // click; the layer service owns that (openLayer, or dismissOutside for a part
  // that stays in the page). Presses on an element are drags and selection
  // guards, so they are not counted. Left today: the column drag, the Alt-hint
  // hider, the copy-button delegate and the download-link rewrite.
  { id: 'js-outside-click', code: /document\.addEventListener\(\s*['"](mousedown|pointerdown|click)['"]/g, skip: ['layer.ts'] },
  { id: 'js-navigation', code: /location\.(href\s*=|assign|replace|reload)|history\.(push|replace)State|window\.open\(/g, skip: ['nav.ts'] },
  { id: 'js-storage', code: /\bkv(Get|Set)\(|\b(local|session)Storage\./g, skip: ['kv.ts', 'storage.ts'] },
  { id: 'js-native-control', code: /<select\b|type="checkbox"/g, skip: ['renderers.ts', 'controls.ts'] },
  // The design-system page draws each token by setting it inline; that is its job.
  { id: 'js-inline-style', code: /\sstyle="/g, skip: ['design-page.ts'] },
  { id: 'js-inline-svg', code: /<svg\b/g, skip: ['icons.ts', 'control-icons.ts'] },
  // errors.ts owns the words, and keeps an unknown failure's own message behind a lead.
  { id: 'js-message-shown', code: /toast\([^\n]*\.message\b|\$\{(?!d\.message|esc\(d\.message)[^}\n]*\.message\b/g, skip: ['errors.ts'] },
  { id: 'js-home-literal', code: /\/Users\/alcatraz627|\\\/Users\\\/alcatraz627/g },
];

// The same selector written twice at the top level (outside any @media), where
// the later rule silently overrides the earlier.
function dupSelectors(css) {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const seen = new Map();
  for (const m of flat.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (const sel of m[1].split(',').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean)) seen.set(sel, (seen.get(sel) ?? 0) + 1);
  }
  let dups = 0;
  for (const n of seen.values()) if (n > 1) dups += n - 1;
  return dups;
}

// A declaration that can never apply: a later top-level rule sets the same
// property for every selector in its group, so the earlier value is dead
// weight that reads as if it mattered. Commas inside :is() or :has() do not
// split a group.
function deadDecls(css) {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const split = s => { const out = []; let depth = 0, cur = ''; for (const c of s) { if (c === '(') depth++; if (c === ')') depth--; if (c === ',' && !depth) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out.map(x => x.trim().replace(/\s+/g, ' ')).filter(Boolean); };
  const rules = [...flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({
    sels: split(m[1]),
    props: m[2].split(';').filter(d => d.includes(':') && !/!important/.test(d)).map(d => d.slice(0, d.indexOf(':')).trim()),
  }));
  let n = 0;
  rules.forEach((r, i) => {
    for (const p of r.props) if (r.sels.every(s => rules.some((l, j) => j > i && l.sels.includes(s) && l.props.includes(p)))) n++;
  });
  return n;
}

// The icon-button classes that moved onto the button part keep only where
// they sit and when they show; size, colour, borders, display and transitions
// come from .btn. So does any rule that reaches a .btn through its context
// (`#bar .btn{height:…}`). Two exceptions: a tab's buttons over its label
// keep their backing, and a glyph drawn inside a button (::before) is content.
const OLD_BUTTONS = /\.(fe-ibtn|fe-lens-ib|fe-ask-ib|fe-act-btn|fe-cm-ib|fe-cm-x|fe-tab-x|fe-tab-more|fe-dlg-close|fe-rm-btn|fe-tag-btn|fe-ask-send|fe-nt-props|fe-nt-tab|fe-md-copy|fe-ask-h-del|fe-st-rule-del|fe-in-chip|fe-lens-depth)(?![\w-])/;
// Fields, chips and badges that moved onto their parts; their place may still set a width.
const OLD_FIELDS = /\.(fe-st-input|fe-tl-input|fe-km-q|fe-dd-search|fe-st-rule-pattern|fe-rp-label|fe-rp-hex|fe-cm-date|fe-lens-tag|fe-cm-chip|fe-row-cm|fe-find-badge|fe-doc-n|fe-ask-n|fe-rt-n)(?![\w-])/;
const CONTEXT_BTN = /\S\s+[^\s>+~]*\.(btn|tb|chip|badge)(?![\w-])[^\s]*$|\S\s*>\s*[^\s]*\.(btn|tb|chip|badge)(?![\w-])[^\s]*$/;
const TAB_BACKING = /^\.fe-tab:not\(\.on\) \.fe-tab-(x|more)(:hover)?$/;
const PAINT = /^\s*(?:(?:width|height|min-width|min-height|padding[\w-]*|border(?:-[\w-]+)?|background(?:-[\w-]+)?|color|font(?:-[\w-]+)?|line-height|cursor|transition|place-items)\s*:|display\s*:\s*(?:inline-)?(?:grid|flex|block)\b)/;
const WIDTH = /^\s*(?:min-|max-)?width\s*:/;
function partPaint(css) {
  let n = 0;
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1].split(',').map(s => s.trim()).filter(Boolean);
    // A .btn inside :has() only says what the element holds; the rule styles the holder.
    const fair = sels.filter(s => !s.includes('::') && !TAB_BACKING.test(s));
    const btn = fair.some(s => OLD_BUTTONS.test(s) || /\.btn(?![\w-])/.test(s.replace(/:has\([^)]*\)/g, '')) && CONTEXT_BTN.test(s.replace(/:has\([^)]*\)/g, '')));
    const field = fair.some(s => OLD_FIELDS.test(s) || CONTEXT_BTN.test(s.replace(/:has\([^)]*\)/g, '')));
    if (btn) n += m[2].split(';').filter(d => PAINT.test(d)).length;
    else if (field) n += m[2].split(';').filter(d => PAINT.test(d) && !WIDTH.test(d)).length;
  }
  return n;
}

// List rows take their hover, keyboard-cursor and selected looks from .row
// (docs/system/list-row.md): a row kind's own rule for one of those states may
// not set a background or a colour.
const ROW_STATE = /(?:\.(?:fe-si|fe-si-link|fe-bm-item|fe-dd-item|fe-ctx-item|fe-dd-opt|fe-km-i|fe-doc-row|fe-ask-h|fe-pal-i|fe-hist-row|fe-tree-row)|#fe-toc a)(?![\w-])[^\s,]*(?::hover|\.kb|\.on|\.active|\.selected|\[aria-(?:selected|current))/;
const ROW_PAINT = /^\s*(?:background(?:-color)?|color)\s*:/;
function rowPaint(css) {
  let n = 0;
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].split(',').some(s => ROW_STATE.test(s.trim()))) n += m[2].split(';').filter(d => ROW_PAINT.test(d)).length;
  }
  return n;
}

function measure(files) {
  const css = files.filter(f => f.css).map(f => f.text).join('\n');
  const out = {};
  for (const r of RULES) {
    if (r.css) out[r.id] = decls(css).filter(r.css).length;
    else if (r.text) out[r.id] = r.text(css);
    else out[r.id] = files.filter(f => !f.css && !(r.skip ?? []).includes(f.name)).reduce((n, f) => n + count(f.text, r.code), 0);
  }
  return out;
}

const srcFiles = () => readdirSync(SRC).filter(n => n.endsWith('.ts')).map(name => {
  const text = readFileSync(join(SRC, name), 'utf8');
  return { name, text, css: name.startsWith('styles') };
});

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  // Every rule must count at least one violation in the planted fixtures,
  // or the rule cannot fail and proves nothing.
  const files = readdirSync(FIXTURES).map(name => ({ name, text: readFileSync(join(FIXTURES, name), 'utf8'), css: name.endsWith('.css') }));
  const got = measure(files);
  const dead = RULES.filter(r => !got[r.id]).map(r => r.id);
  if (dead.length) { console.log(`FAIL rules that did not fire on a planted violation: ${dead.join(', ')}`); process.exit(1); }
  console.log(`ok   self-test: all ${RULES.length} rules fire on planted violations`);
  process.exit(0);
}

const now = measure(srcFiles());
const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;
if (args.includes('--update')) {
  // Lowering is always allowed; raising needs the reason in the commit and --force.
  const rose = base ? Object.keys(now).filter(k => now[k] > (base[k] ?? 0)) : [];
  if (rose.length && !args.includes('--force')) { console.log(`FAIL refusing to raise the baseline for: ${rose.join(', ')} (add --force and say why in the commit)`); process.exit(1); }
  writeFileSync(BASELINE, JSON.stringify(now, null, 2) + '\n');
  console.log(`ok   baseline written: ${Object.values(now).reduce((a, b) => a + b, 0)} violations across ${RULES.length} rules`);
  process.exit(0);
}
if (!base) { console.log('FAIL no baseline: run with --update once'); process.exit(1); }
let failed = 0;
for (const id of Object.keys(now)) {
  const allowed = base[id] ?? 0, n = now[id];
  if (n > allowed) { failed++; console.log(`FAIL ${id}: ${n} (baseline ${allowed})`); }
  else if (n < allowed) console.log(`down ${id}: ${n} (baseline ${allowed}); run --update to lock it in`);
}
console.log(failed ? `${failed} rule(s) rose above the baseline` : `ok   no rule above the baseline (${Object.values(now).reduce((a, b) => a + b, 0)} violations left)`);
process.exit(failed ? 1 : 0);
