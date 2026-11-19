// Reading a page's stylesheets for Lights.
//
// Smart mode copies every rule that sets a colour, with only its colour
// declarations, moved for a dark page. Native mode copies the site's own dark
// theme (its prefers-color-scheme: dark rules) so they apply unconditionally.
// Both keep each rule's surroundings (@media, @layer, @supports, nesting), so
// the copy wins exactly where the original would have.

import { mapValue, roleForProperty } from './site-lights-color';

/** Where a rule sits relative to the site's own light and dark themes. */
interface Ctx { dark: boolean; light: boolean }

/** The declarations to write for one rule in this context, or '' for none. */
type Visit = (style: CSSStyleDeclaration, ctx: Ctx) => string;

/** Rules of an @import, or null when they cannot be read. */
export type ImportReader = (rule: CSSImportRule) => CSSRuleList | null;

const DARK_FEATURE = /\(\s*prefers-color-scheme\s*:\s*dark\s*\)/gi;
const LIGHT_FEATURE = /\(\s*prefers-color-scheme\s*:\s*light\s*\)/gi;
// The grouping rules whose contents still apply in the copy. Keyframes,
// @font-face and @page carry no page colours worth moving.
const GROUPS = /^@(media|supports|layer|container|scope|starting-style)\b/;

const header = (rule: CSSRule) => rule.cssText.slice(0, rule.cssText.indexOf('{')).trim();

function rebuild(rules: ArrayLike<CSSRule>, visit: Visit, ctx: Ctx, imports: ImportReader, depth: number): string {
  if (depth > 24) return '';
  let out = '';
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i] as CSSRule & { style?: CSSStyleDeclaration; selectorText?: string; cssRules?: CSSRuleList };
    if (rule.style && rule.selectorText != null) {
      const decls = visit(rule.style, ctx);
      const nested = rule.cssRules?.length ? rebuild(rule.cssRules, visit, ctx, imports, depth + 1) : '';
      if (decls || nested) out += `${rule.selectorText}{${decls}${nested}}`;
      continue;
    }
    // Bare declarations inside a nested rule, after a child rule.
    if (rule.style) { out += visit(rule.style, ctx); continue; }
    if ('styleSheet' in rule && 'href' in rule) {
      const list = imports(rule as CSSImportRule);
      const inner = list ? rebuild(list, visit, ctx, imports, depth + 1) : '';
      const media = (rule as CSSImportRule).media?.mediaText;
      if (inner) out += media ? `@media ${media}{${inner}}` : inner;
      continue;
    }
    if (!rule.cssRules) continue;
    let head = header(rule);
    if (!GROUPS.test(head)) continue;
    let inner = ctx;
    if (head.startsWith('@media')) {
      const cond = (rule as CSSMediaRule).conditionText ?? (rule as CSSMediaRule).media.mediaText;
      const dark = DARK_FEATURE.test(cond), light = LIGHT_FEATURE.test(cond);
      DARK_FEATURE.lastIndex = 0; LIGHT_FEATURE.lastIndex = 0;
      inner = { dark: ctx.dark || dark, light: ctx.light || light };
      // A dark-theme block is copied to apply always, so its condition is made true.
      head = `@media ${cond.replace(DARK_FEATURE, '(min-width: 0px)')}`;
    }
    const body = rebuild(rule.cssRules, visit, inner, imports, depth + 1);
    if (!body) continue;
    // An unnamed layer cannot be reopened from another sheet, so its rules go unlayered.
    out += head === '@layer' ? body : `${head}{${body}}`;
  }
  return out;
}

/** Each colour declaration in a rule, moved for the dark page. */
function smartVisit(style: CSSStyleDeclaration, ctx: Ctx): string {
  // The site's own dark theme is already dark; moving it again would lighten it.
  if (ctx.dark) return '';
  let out = '';
  for (let i = 0; i < style.length; i++) {
    const prop = style[i];
    const role = roleForProperty(prop);
    if (!role) continue;
    const value = style.getPropertyValue(prop);
    // A url() inside a copied rule would resolve against the page, not the sheet.
    if (!value || /url\(/i.test(value)) continue;
    const moved = mapValue(value, role);
    if (moved) out += `${prop}:${moved}${style.getPropertyPriority(prop) ? ' !important' : ''};`;
  }
  return out;
}

/** The whole rule, when it belongs to the site's dark theme. */
function nativeVisit(style: CSSStyleDeclaration, ctx: Ctx): string {
  return ctx.dark ? style.cssText : '';
}

const START: Ctx = { dark: false, light: false };

/** The Smart override for one sheet's rules. */
export function smartCss(rules: ArrayLike<CSSRule>, imports: ImportReader): string {
  return rebuild(rules, smartVisit, START, imports, 0);
}

/** The site's own dark theme in one sheet, made to apply always. */
export function nativeCss(rules: ArrayLike<CSSRule>, imports: ImportReader): string {
  return rebuild(rules, nativeVisit, START, imports, 0);
}

/** A switch a site's stylesheet uses to turn on its own dark theme. */
export interface ThemeHook { on: 'html' | 'body'; kind: 'class' | 'attr'; name: string; value?: string }

const ATTR_HOOK = /\[(data-[\w-]*(?:theme|mode|scheme)[\w-]*|theme)\s*[~|^]?=\s*["']?dark["']?\s*\]/gi;
// A class at the very start of a selector, followed by a descendant or child
// combinator, is a switch on an ancestor: `.dark .card`, `html.theme-night > p`.
// A class that styles the element itself (`.btn-dark:hover`) is not.
const CLASS_HOOK = /^\s*(?::(?:is|where)\()?(?:(html|:root|body))?\.((?:[\w-]*[-_])?(?:dark|night)(?:[-_][\w-]*)?)(?=\s*[\s>~+])/i;

/**
 * The dark-theme switches a site's selectors mention often enough to be real,
 * such as `.dark` (Tailwind), `html.skin-theme-clientpref-night` (Wikipedia) or
 * `[data-theme="dark"]`. Setting one turns on a theme the site already ships.
 * The most used class switch wins, since a site has one dark theme.
 */
export function findThemeHooks(selectors: string[]): ThemeHook[] {
  const counts = new Map<string, { hook: ThemeHook; n: number }>();
  const bump = (hook: ThemeHook) => {
    const key = `${hook.on}|${hook.kind}|${hook.name}|${hook.value ?? ''}`;
    const seen = counts.get(key);
    if (seen) seen.n++; else counts.set(key, { hook, n: 1 });
  };
  for (const list of selectors) {
    for (const sel of list.split(',')) {
      const c = CLASS_HOOK.exec(sel);
      if (c) bump({ on: c[1]?.toLowerCase() === 'body' ? 'body' : 'html', kind: 'class', name: c[2] });
      for (const m of sel.matchAll(ATTR_HOOK)) {
        const onBody = /body\s*$/.test(sel.slice(0, m.index));
        bump({ on: onBody ? 'body' : 'html', kind: 'attr', name: m[1].toLowerCase(), value: 'dark' });
      }
    }
  }
  const real = [...counts.values()].filter(c => c.n >= 3);
  const classes = real.filter(c => c.hook.kind === 'class').sort((a, b) => b.n - a.n).slice(0, 1);
  return [...classes, ...real.filter(c => c.hook.kind === 'attr')].map(c => c.hook);
}

/** The light-theme classes that pair with a dark one, to take off while it is on. */
export function oppositeClasses(dark: string): string[] {
  const swaps = [dark.replace(/dark/i, 'light'), dark.replace(/night/i, 'day'), dark.replace(/night/i, 'light')];
  return [...new Set(['light', 'light-mode', 'theme-light', 'light-theme', ...swaps])].filter(n => n !== dark);
}

/** Every selector in a sheet, for finding theme switches and background pictures. */
export function collectSelectors(rules: ArrayLike<CSSRule>, imports: ImportReader, out: string[] = [], bgImages: string[] = [], depth = 0): { selectors: string[]; bgImages: string[] } {
  if (depth > 24) return { selectors: out, bgImages };
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i] as CSSRule & { style?: CSSStyleDeclaration; selectorText?: string; cssRules?: CSSRuleList };
    if (rule.selectorText != null) {
      out.push(rule.selectorText);
      const bg = rule.style?.getPropertyValue('background-image') ?? '';
      if (/url\(/i.test(bg) && rule.selectorText.length < 200) bgImages.push(rule.selectorText);
    }
    if ('styleSheet' in rule && 'href' in rule) {
      const list = imports(rule as CSSImportRule);
      if (list) collectSelectors(list, imports, out, bgImages, depth + 1);
    } else if (rule.cssRules) {
      collectSelectors(rule.cssRules, imports, out, bgImages, depth + 1);
    }
  }
  return { selectors: out, bgImages };
}
