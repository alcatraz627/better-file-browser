// The text formats the file page can show richly and check for mistakes:
// Markdown, JSON, JSON Lines, YAML and HTML. Each one supplies a rich view
// and a checker that returns line-numbered errors and warnings. The reading
// page, the editor's Rich and Split views and the problem markers all go
// through this one table, so a new format is one entry here.
//
// Rich views are best effort: a file with mistakes still renders whatever
// can be read, and only falls back to plain source when nothing can.
import { parseAllDocuments, LineCounter } from 'yaml';
import { esc } from './utils';
import { renderMarkdown, renderJsonTree, renderJsonl, renderValueTree, renderCode, unrenderableNote, parseDSV, numericCols, renderDSVTable, TABLE_EXTS } from './renderers';
import { detailOf } from './errors';

export type Severity = 'error' | 'warn';
/** One mistake found in a file, at a 1-based line (and column when known). */
export interface Diagnostic { line: number; col?: number; severity: Severity; message: string }

export interface Format {
  id: string;
  label: string;
  exts: string[];
  /** The rendered view. `href` resolves relative links and images. */
  rich(text: string, href: string): string;
  check(text: string): Diagnostic[];
}

/** 1-based line and column of a character offset. */
function lineCol(text: string, offset: number): { line: number; col: number } {
  let line = 1, last = -1;
  for (let i = text.indexOf('\n'); i !== -1 && i < offset; i = text.indexOf('\n', i + 1)) { line++; last = i; }
  return { line, col: offset - last };
}

// ── JSON ────────────────────────────────────────────────────────────

/** The offset where strict JSON stops being valid, found by walking it,
 *  since some engines' JSON.parse errors name no position. */
function jsonFaultAt(s: string): number {
  let i = 0;
  const ws = () => { while (i < s.length && ' \t\n\r'.includes(s[i])) i++; };
  const fail = () => { throw i; };
  const value = (): void => {
    ws();
    const c = s[i];
    if (c === '{') {
      i++; ws();
      if (s[i] === '}') { i++; return; }
      for (;;) { ws(); if (s[i] !== '"') fail(); str(); ws(); if (s[i] !== ':') fail(); i++; value(); ws(); if (s[i] === ',') { i++; continue; } if (s[i] === '}') { i++; return; } fail(); }
    }
    if (c === '[') {
      i++; ws();
      if (s[i] === ']') { i++; return; }
      for (;;) { value(); ws(); if (s[i] === ',') { i++; continue; } if (s[i] === ']') { i++; return; } fail(); }
    }
    if (c === '"') return str();
    const lit = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(s.slice(i, i + 64));
    if (!lit) fail();
    i += lit![0].length;
  };
  const str = () => {
    i++;
    while (i < s.length && s[i] !== '"') { if (s[i] === '\\') i++; else if (s[i] === '\n') fail(); i++; }
    if (s[i] !== '"') fail();
    i++;
  };
  try { value(); ws(); if (i < s.length) fail(); return -1; }
  catch (at) { return typeof at === 'number' ? Math.min(at, s.length) : 0; }
}

function jsonErrorAt(text: string): { line: number; col?: number } {
  const at = jsonFaultAt(text);
  return at < 0 ? { line: 1 } : lineCol(text, at);
}

/** JSON with comments and trailing commas removed, for tsconfig-style files. */
function stripJsonc(text: string): string {
  return text
    .replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (m, s) => s ?? m.replace(/[^\n]/g, ' '))
    .replace(/,(\s*[}\]])/g, ' $1');
}

function checkJson(text: string): Diagnostic[] {
  if (!text.trim()) return [];
  try { JSON.parse(text); return []; }
  catch (err) {
    const at = jsonErrorAt(text);
    try {
      JSON.parse(stripJsonc(text));
      return [{ ...at, severity: 'warn', message: 'Comments or trailing commas: fine for tsconfig and editor settings, not for strict JSON' }];
    } catch { /* a real mistake */ }
    const message = (err as Error).message.replace(/^JSON\.parse: /, '').replace(/,? ?(?:in JSON )?at position \d+.*$/, '').replace(/, "[\s\S]*" is not valid JSON$/, '');
    return [{ ...at, severity: 'error', message }];
  }
}

function checkJsonl(text: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  text.split('\n').forEach((l, i) => {
    if (!l.trim()) return;
    try { JSON.parse(l); }
    catch (err) { out.push({ line: i + 1, severity: 'error', message: `Not JSON: ${detailOf(err)}` }); }
  });
  return out;
}

// ── YAML ────────────────────────────────────────────────────────────

function yamlDocs(text: string) {
  const lineCounter = new LineCounter();
  const docs = parseAllDocuments(text, { lineCounter, prettyErrors: false, uniqueKeys: true, logLevel: 'silent' });
  return { docs: Array.isArray(docs) ? docs : [], lineCounter };
}

function checkYaml(text: string, lineOffset = 0): Diagnostic[] {
  if (!text.trim()) return [];
  const { docs, lineCounter } = yamlDocs(text);
  const out: Diagnostic[] = [];
  for (const d of docs) {
    for (const [list, severity] of [[d.errors, 'error'], [d.warnings, 'warn']] as const) {
      for (const e of list) {
        const p = lineCounter.linePos(e.pos[0]);
        out.push({ line: p.line + lineOffset, col: p.col, severity, message: e.message.split('\n')[0] });
      }
    }
  }
  const tab = /^\t+/m.exec(text);
  if (tab && !out.some(d => d.message.includes('Tab'))) out.push({ ...lineCol(text, tab.index), severity: 'error', message: 'YAML cannot indent with tabs' });
  return out;
}

function richYaml(text: string): string {
  const { docs } = yamlDocs(text);
  const values = docs.map(d => { try { return d.toJS({ maxAliasCount: 100 }); } catch { return undefined; } });
  if (!values.some(v => v !== undefined)) return renderCode(text, 'yaml');
  return values.map(v => renderValueTree(v ?? null)).join('<hr class="fe-yaml-sep">');
}

// ── Markdown ────────────────────────────────────────────────────────

function checkMarkdown(text: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const lines = text.split('\n');
  let start = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, i) => i > 0 && /^(---|\.\.\.)\s*$/.test(l));
    if (end === -1) out.push({ line: 1, severity: 'error', message: 'The front matter opened here is never closed with ---' });
    // The page still reads every value it can, so a strict YAML complaint is a warning here.
    else { out.push(...checkYaml(lines.slice(1, end).join('\n'), 1).map(d => ({ ...d, severity: 'warn' as const }))); start = end + 1; }
  }
  let fence: { mark: string; line: number } | null = null;
  let lastLevel = 0;
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(l);
    if (f) {
      if (!fence) fence = { mark: f[1], line: i + 1 };
      else if (f[1][0] === fence.mark[0] && f[1].length >= fence.mark.length && !l.slice(f.index + f[1].length).trim()) fence = null;
      continue;
    }
    if (fence) continue;
    const h = /^(#{1,6})\s/.exec(l);
    if (h) {
      const level = h[1].length;
      if (lastLevel && level > lastLevel + 1) out.push({ line: i + 1, severity: 'warn', message: `Heading jumps from level ${lastLevel} to ${level}` });
      lastLevel = level;
    }
  }
  if (fence) out.push({ line: fence.line, severity: 'warn', message: 'This code block is never closed, so the rest of the file reads as code' });
  return out;
}

// ── HTML ────────────────────────────────────────────────────────────

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
// Elements whose closing tag the HTML parser supplies on its own.
const OPTIONAL_CLOSE = new Set(['p', 'li', 'td', 'th', 'tr', 'thead', 'tbody', 'tfoot', 'option', 'optgroup', 'dt', 'dd', 'html', 'head', 'body', 'colgroup', 'caption', 'rt', 'rp']);

function checkHtml(text: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  const stack: { name: string; line: number }[] = [];
  const re = /<!--[\s\S]*?(?:-->|$)|<(script|style|textarea|title)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)|<(\/?)([a-zA-Z][\w:-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[0].startsWith('<!--')) {
      if (!m[0].endsWith('-->')) out.push({ ...lineCol(text, m.index), severity: 'error', message: 'This comment is never closed' });
      continue;
    }
    if (m[1]) {
      if (!new RegExp(`</${m[1]}\\s*>$`, 'i').test(m[0])) out.push({ ...lineCol(text, m.index), severity: 'error', message: `<${m[1].toLowerCase()}> is never closed` });
      continue;
    }
    const name = m[3].toLowerCase();
    if (VOID.has(name) || m[4] === '/') continue;
    const at = lineCol(text, m.index);
    if (!m[2]) { stack.push({ name, line: at.line }); continue; }
    const i = stack.map(s => s.name).lastIndexOf(name);
    if (i === -1) { out.push({ ...at, severity: 'error', message: `</${name}> closes nothing that is open` }); continue; }
    for (const s of stack.splice(i).slice(1)) {
      if (!OPTIONAL_CLOSE.has(s.name)) out.push({ line: s.line, severity: 'warn', message: `<${s.name}> is closed implicitly by </${name}> on line ${at.line}` });
    }
  }
  for (const s of stack) if (!OPTIONAL_CLOSE.has(s.name)) out.push({ line: s.line, severity: 'warn', message: `<${s.name}> is never closed` });
  return out;
}

/** The page drawn in a frame that runs no scripts; relative links resolve against the file. */
function richHtml(text: string, href: string): string {
  const base = `<base href="${esc(href)}">`;
  const doc = /<head[^>]*>/i.test(text) ? text.replace(/<head([^>]*)>/i, `<head$1>${base}`) : base + text;
  return `<iframe class="fe-html-frame" sandbox="allow-same-origin" title="Rendered page" srcdoc="${esc(doc)}"></iframe>`;
}

// ── The table ───────────────────────────────────────────────────────

/** Runs a rich view; if it throws, shows the source with a note instead of nothing. */
const safely = (f: Format['rich'], ext: string): Format['rich'] => (text, href) => {
  try { return f(text, href); }
  catch (err) { return `<div class="notice fe-ql-note">Could not render this file (${esc(detailOf(err))}), so here is its text.</div>${renderCode(text, ext)}`; }
};

export const FORMATS: Format[] = [
  { id: 'markdown', label: 'Markdown', exts: ['md', 'mdx', 'markdown'], rich: safely((t, h) => renderMarkdown(t, h), 'md'), check: checkMarkdown },
  // A file that is not strict JSON shows as text; the problems strip says why.
  { id: 'json', label: 'JSON', exts: ['json', 'jsonc', 'json5'], rich: safely(t => { try { JSON.parse(t); return renderJsonTree(t); } catch { return renderCode(t, 'jsonc'); } }, 'json'), check: checkJson },
  { id: 'jsonl', label: 'JSON Lines', exts: ['jsonl', 'ndjson'], rich: safely(t => renderJsonl(t), 'json'), check: checkJsonl },
  { id: 'yaml', label: 'YAML', exts: ['yaml', 'yml'], rich: safely(t => richYaml(t), 'yaml'), check: t => checkYaml(t) },
  { id: 'html', label: 'HTML', exts: ['html', 'htm', 'xhtml'], rich: safely(richHtml, 'html'), check: checkHtml },
];

/**
 * Where a file is shown. The two differ on purpose: the file page has a
 * problems strip, so a bad JSON file shows as text and the strip says why,
 * and it shows HTML as source; the preview explains bad JSON inline and runs
 * HTML live (preview.ts), and opens every markdown link in a new tab.
 */
export type Host = 'page' | 'preview';

/** A file's text drawn for a host: a note for binary or empty text, a table, the format's rich view, or highlighted code. */
export function renderFile(text: string, ext: string, href: string, host: Host): string {
  const note = unrenderableNote(text);
  if (note) return note;
  if (TABLE_EXTS.has(ext)) {
    const rows = parseDSV(text, ext === 'tsv' ? '\t' : ',');
    return rows.length ? renderDSVTable(rows[0], rows.slice(1), numericCols(rows)) : unrenderableNote('');
  }
  const fmt = formatFor(ext);
  if (fmt?.id === 'html' && host === 'page') return renderCode(text, ext);
  if (fmt?.id === 'json' && host === 'preview') return ext === 'json' ? renderJsonTree(text) : renderCode(text, ext);
  return fmt ? fmt.rich(text, href) : renderCode(text, ext);
}

/** The format for a file extension, or null when the file is plain text or code. */
export function formatFor(ext: string): Format | null {
  const e = ext.toLowerCase();
  return FORMATS.find(f => f.exts.includes(e)) ?? null;
}

/** The checker's findings, sorted by line, never throwing. */
export function diagnose(ext: string, text: string): Diagnostic[] {
  const f = formatFor(ext);
  if (!f) return [];
  try { return f.check(text).sort((a, b) => a.line - b.line); }
  catch { return []; }
}
