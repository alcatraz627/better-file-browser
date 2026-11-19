// How Lights turns a light page's colours into dark ones.
//
// Every colour is moved in OKLCH, a colour space where lightness matches what an
// eye sees, so a hue survives the move: a pale blue panel becomes a dark blue
// panel rather than the orange an inverted filter would make it. Backgrounds
// fold toward dark, text toward light, and a colour whose job is unknown (a CSS
// variable with a vague name) is mirrored around the middle. Nothing here
// touches the page, so it is unit tested on its own.

/** What a colour is doing, which decides where its lightness goes. */
export type Role = 'bg' | 'text' | 'border' | 'any';

/** A colour in OKLCH, with alpha. L runs 0 (black) to 1 (white); H is degrees. */
export interface Oklch { l: number; c: number; h: number; a: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---- sRGB <-> OKLab (Björn Ottosson's matrices) ----

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function rgbToOklch(r: number, g: number, b: number, a: number): Oklch {
  const lr = toLinear(r / 255), lg = toLinear(g / 255), lb = toLinear(b / 255);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  const h = c < 1e-4 ? 0 : (Math.atan2(B, A) * 180 / Math.PI + 360) % 360;
  return { l: L, c, h, a };
}

/** Linear sRGB for an OKLCH colour, possibly outside 0..1 when out of gamut. */
function oklchToLinear({ l: L, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos(h * Math.PI / 180), B = c * Math.sin(h * Math.PI / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: number[]) => rgb.every(v => v >= -1e-4 && v <= 1 + 1e-4);

/** sRGB 0..255 for an OKLCH colour, lowering chroma until it fits the screen. */
export function oklchToRgb(col: Oklch): [number, number, number] {
  let lin = oklchToLinear(col);
  if (!inGamut(lin)) {
    let lo = 0, hi = col.c;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ ...col, c: mid }))) lo = mid; else hi = mid;
    }
    lin = oklchToLinear({ ...col, c: lo });
  }
  return lin.map(v => Math.round(clamp(fromLinear(clamp(v, 0, 1)), 0, 1) * 255)) as [number, number, number];
}

// ---- Parsing ----

// The CSS named colours, packed as name:hex pairs.
const NAMED_PACKED = 'aliceblue:f0f8ff antiquewhite:faebd7 aqua:00ffff aquamarine:7fffd4 azure:f0ffff beige:f5f5dc bisque:ffe4c4 black:000000 blanchedalmond:ffebcd blue:0000ff blueviolet:8a2be2 brown:a52a2a burlywood:deb887 cadetblue:5f9ea0 chartreuse:7fff00 chocolate:d2691e coral:ff7f50 cornflowerblue:6495ed cornsilk:fff8dc crimson:dc143c cyan:00ffff darkblue:00008b darkcyan:008b8b darkgoldenrod:b8860b darkgray:a9a9a9 darkgreen:006400 darkgrey:a9a9a9 darkkhaki:bdb76b darkmagenta:8b008b darkolivegreen:556b2f darkorange:ff8c00 darkorchid:9932cc darkred:8b0000 darksalmon:e9967a darkseagreen:8fbc8f darkslateblue:483d8b darkslategray:2f4f4f darkslategrey:2f4f4f darkturquoise:00ced1 darkviolet:9400d3 deeppink:ff1493 deepskyblue:00bfff dimgray:696969 dimgrey:696969 dodgerblue:1e90ff firebrick:b22222 floralwhite:fffaf0 forestgreen:228b22 fuchsia:ff00ff gainsboro:dcdcdc ghostwhite:f8f8ff gold:ffd700 goldenrod:daa520 gray:808080 green:008000 greenyellow:adff2f grey:808080 honeydew:f0fff0 hotpink:ff69b4 indianred:cd5c5c indigo:4b0082 ivory:fffff0 khaki:f0e68c lavender:e6e6fa lavenderblush:fff0f5 lawngreen:7cfc00 lemonchiffon:fffacd lightblue:add8e6 lightcoral:f08080 lightcyan:e0ffff lightgoldenrodyellow:fafad2 lightgray:d3d3d3 lightgreen:90ee90 lightgrey:d3d3d3 lightpink:ffb6c1 lightsalmon:ffa07a lightseagreen:20b2aa lightskyblue:87cefa lightslategray:778899 lightslategrey:778899 lightsteelblue:b0c4de lightyellow:ffffe0 lime:00ff00 limegreen:32cd32 linen:faf0e6 magenta:ff00ff maroon:800000 mediumaquamarine:66cdaa mediumblue:0000cd mediumorchid:ba55d3 mediumpurple:9370db mediumseagreen:3cb371 mediumslateblue:7b68ee mediumspringgreen:00fa9a mediumturquoise:48d1cc mediumvioletred:c71585 midnightblue:191970 mintcream:f5fffa mistyrose:ffe4e1 moccasin:ffe4b5 navajowhite:ffdead navy:000080 oldlace:fdf5e6 olive:808000 olivedrab:6b8e23 orange:ffa500 orangered:ff4500 orchid:da70d6 palegoldenrod:eee8aa palegreen:98fb98 paleturquoise:afeeee palevioletred:db7093 papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd powderblue:b0e0e6 purple:800080 rebeccapurple:663399 red:ff0000 rosybrown:bc8f8f royalblue:4169e1 saddlebrown:8b4513 salmon:fa8072 sandybrown:f4a460 seagreen:2e8b57 seashell:fff5ee sienna:a0522d silver:c0c0c0 skyblue:87ceeb slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa springgreen:00ff7f steelblue:4682b4 tan:d2b48c teal:008080 thistle:d8bfd8 tomato:ff6347 turquoise:40e0d0 violet:ee82ee wheat:f5deb3 white:ffffff whitesmoke:f5f5f5 yellow:ffff00 yellowgreen:9acd32';
const NAMED = new Map(NAMED_PACKED.split(' ').map(p => p.split(':') as [string, string]));

const num = (s: string, scale: number) => (s.endsWith('%') ? parseFloat(s) / 100 * scale : parseFloat(s));
const alpha = (s: string | undefined) => (s == null ? 1 : clamp(num(s, 1), 0, 1));

function hexToRgb(hex: string): [number, number, number, number] | null {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map(ch => ch + ch).join('');
  if (h.length !== 6 && h.length !== 8) return null;
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/** The function's arguments, split on commas, spaces and the slash before alpha. */
const args = (inner: string) => inner.trim().split(/\s*[,/]\s*|\s+/).filter(Boolean);

/**
 * One CSS colour as OKLCH, or null for anything this cannot read: keywords like
 * currentcolor, var() references, or newer forms such as color-mix(). A colour
 * it cannot read is left as the site wrote it.
 */
export function parseColor(text: string): Oklch | null {
  const t = text.trim().toLowerCase();
  if (t.startsWith('#')) {
    const rgb = hexToRgb(t);
    return rgb && rgbToOklch(...rgb);
  }
  const fn = /^([a-z]+)\((.*)\)$/s.exec(t);
  if (!fn) {
    const hex = NAMED.get(t);
    return hex ? parseColor('#' + hex) : null;
  }
  const [, name, inner] = fn;
  if (inner.includes('var(') || inner.includes('calc(') || inner.includes('from ')) return null;
  const p = args(inner);
  if (p.length < 3 || p.slice(0, 3).some(v => v === 'none' || Number.isNaN(parseFloat(v)))) return null;
  if (name === 'rgb' || name === 'rgba') {
    return rgbToOklch(num(p[0], 255), num(p[1], 255), num(p[2], 255), alpha(p[3]));
  }
  if (name === 'hsl' || name === 'hsla') {
    const [r, g, b] = hslToRgb(parseFloat(p[0]), num(p[1], 1) / (p[1].endsWith('%') ? 1 : 100), num(p[2], 1) / (p[2].endsWith('%') ? 1 : 100));
    return rgbToOklch(r, g, b, alpha(p[3]));
  }
  if (name === 'oklch') {
    return { l: num(p[0], 1), c: num(p[1], 0.4), h: parseFloat(p[2]) || 0, a: alpha(p[3]) };
  }
  return null;
}

// ---- Moving lightness ----

/**
 * Where a lightness goes in the dark page, by role. Backgrounds fold dark (a
 * black header stays dark, not white) and text folds light. Unknown colours
 * mirror around 0.55, so a white variable used as a background and a black one
 * used as text both land right, and mid-tone brand colours barely move.
 */
export function mapLightness(l: number, role: Role): number {
  switch (role) {
    case 'bg': return l > 0.5 ? 0.2 + (1 - l) * 0.36 : l * 0.76;
    case 'text': return l < 0.5 ? 0.92 - l * 0.36 : 0.74 + (l - 0.5) * 0.36;
    case 'border': return l > 0.5 ? 0.3 + (1 - l) * 0.4 : 0.3 + l * 0.4;
    case 'any': return clamp(1.1 - l, 0.18, 0.94);
  }
}

/** The same colour placed for the dark page. */
export function mapColor(col: Oklch, role: Role): Oklch {
  const l = mapLightness(col.l, role);
  // A pastel background turned dark reads as neon unless it is calmed a little.
  const c = role === 'bg' && col.l > 0.5 ? col.c * 0.8 : col.c;
  return { l, c, h: col.h, a: col.a };
}

const round = (v: number, places: number) => +v.toFixed(places);

/** CSS text for a colour, in the form it came in where that matters. */
export function formatColor(col: Oklch, asOklch: boolean): string {
  if (asOklch) {
    const a = col.a < 1 ? ` / ${round(col.a, 3)}` : '';
    return `oklch(${round(col.l, 4)} ${round(col.c, 4)} ${round(col.h, 2)}${a})`;
  }
  const [r, g, b] = oklchToRgb(col);
  return col.a < 1 ? `rgba(${r}, ${g}, ${b}, ${round(col.a, 3)})` : `rgb(${r}, ${g}, ${b})`;
}

// A colour token: a url() to skip, a hex, a colour function, or a bare word.
// Words joined to a hyphen are names (var(--white)), so they are skipped.
const TOKEN = /url\([^)]*\)|#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\([^()]*\)|(?<![-\w])[a-z]+(?![-\w(])/gi;

/**
 * A declaration value with every colour in it moved for the dark page, or null
 * when nothing in it changed. Gradients, shadows and var() fallbacks keep their
 * shape; only the colours inside move.
 */
export function mapValue(value: string, role: Role): string | null {
  if (!value || value.length > 4000) return null;
  let changed = false;
  const out = value.replace(TOKEN, tok => {
    if (/^url\(/i.test(tok)) return tok;
    const col = parseColor(tok);
    if (!col) return tok;
    changed = true;
    return formatColor(mapColor(col, role), /^oklch/i.test(tok));
  });
  return changed ? out : null;
}

// ---- Which properties hold which kind of colour ----

const BG_PROPS = new Set(['background-color', 'background-image', 'box-shadow', 'text-shadow']);
const TEXT_PROPS = new Set(['color', 'caret-color', '-webkit-text-fill-color', '-webkit-text-stroke-color', 'text-decoration-color', 'text-emphasis-color', 'fill', 'stroke', 'accent-color']);

/** What a custom property's colour is for, guessed from its name. */
export function roleForVariable(name: string): Role {
  const n = name.toLowerCase();
  if (/border|divider|outline|ring|stroke|separator|rule\b|-line\b/.test(n)) return 'border';
  if (/(^|-)(text|fg|foreground|ink|heading|title|body-color|link|on-)/.test(n)) return 'text';
  if (/(bg|background|surface|canvas|paper|card|panel|popover|backdrop|base|fill|shade|well)/.test(n)) return 'bg';
  return 'any';
}

/** The role of a longhand property's colours, or null for a property that holds none. */
export function roleForProperty(prop: string): Role | null {
  if (prop.startsWith('--')) return roleForVariable(prop);
  if (BG_PROPS.has(prop)) return 'bg';
  if (TEXT_PROPS.has(prop)) return 'text';
  if (/^(border(-(top|right|bottom|left|block|inline)(-(start|end))?)?-color|outline-color|column-rule-color)$/.test(prop)) return 'border';
  return null;
}

/** True for a colour dark enough that a page painted with it is already dark. */
export function isDark(col: Oklch): boolean {
  return col.l < 0.45;
}
