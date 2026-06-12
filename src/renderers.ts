// Rich preview renderers for the Quick Look overlay. Each function takes raw
// file text and returns an HTML string; nothing here touches the DOM or
// fetches anything, so every renderer is unit-testable in isolation.
import { esc } from './utils';

export const CODE_EXTS = new Set([
  'sh', 'bash', 'zsh', 'fish', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cpp', 'h', 'cs', 'php',
  'css', 'scss', 'less', 'html', 'htm', 'xml', 'svg', 'vue', 'svelte',
  'yaml', 'yml', 'toml', 'ini', 'conf', 'env', 'sql',
  'md', 'mdx', 'txt', 'log', 'rst', 'lock', 'gitignore', 'csv',
]);
export const TABLE_EXTS = new Set(['tsv', 'csv']);
export const JSONL_EXTS = new Set(['jsonl', 'ndjson']);

export const RENDER_CAPS = {
  codeChars:  300_000,
  tableRows:  5_000,
  jsonlLines: 2_000,
  treeNodes:  20_000,
};

/** True when the first chunk of a file looks like binary data, not text. */
export function sniffBinary(text: string): boolean {
  const probe = text.slice(0, 1000);
  if (probe.includes('\u0000')) return true;
  let weird = 0;
  for (const ch of probe) {
    const c = ch.charCodeAt(0);
    if (c < 9 || (c > 13 && c < 32) || c === 0xfffd) weird++;
  }
  return probe.length > 0 && weird / probe.length > 0.1;
}

// ── Syntax highlighting ─────────────────────────────────────────────
// One generic tokenizer driven by a small per-language table: comments,
// strings, variables, numbers, keywords. Deliberately approximate — this is
// a file *preview*, not an editor.

interface LangDef {
  line?:    string[];            // line-comment starters
  block?:   [string, string];    // block-comment delimiters
  strings:  string[];            // quote characters
  tickML?:  boolean;             // backtick strings may span lines (JS templates)
  vars?:    boolean;             // highlight $VAR / ${...} (shell)
  kw:       string[];
}

const KW_SH = 'if then elif else fi for while until do done case esac in function select local export readonly declare unset return exit break continue shift eval exec source alias trap set echo printf read cd test true false';
const KW_JS = 'const let var function return if else for while do switch case break continue new class extends super this typeof instanceof in of import export from default async await yield try catch finally throw delete void null undefined true false interface type enum implements private public protected readonly static namespace declare as is keyof never unknown any string number boolean object symbol';
const KW_PY = 'def class return if elif else for while break continue pass import from as with lambda try except finally raise yield global nonlocal assert del in is not and or None True False async await match self';
const KW_SQL = 'select from where insert into update delete join left right inner outer on group by order having limit offset create table drop alter index view as and or not null primary key foreign references distinct union all values set';
const KW_GO = 'func package import return if else for range switch case break continue defer go chan select map struct interface type var const nil true false make new len cap append';
const KW_RS = 'fn let mut pub use mod struct enum impl trait return if else for while loop match break continue ref self Self crate super move async await dyn where unsafe true false Some None Ok Err';

const LANGS: Record<string, LangDef> = {
  shell:  { line: ['#'],  strings: [`"`, `'`], vars: true,  kw: KW_SH.split(' ') },
  js:     { line: ['//'], block: ['/*', '*/'], strings: [`"`, `'`, '`'], tickML: true, kw: KW_JS.split(' ') },
  py:     { line: ['#'],  strings: [`"`, `'`], kw: KW_PY.split(' ') },
  go:     { line: ['//'], block: ['/*', '*/'], strings: [`"`, '`'], tickML: true, kw: KW_GO.split(' ') },
  rs:     { line: ['//'], block: ['/*', '*/'], strings: [`"`], kw: KW_RS.split(' ') },
  sql:    { line: ['--'], block: ['/*', '*/'], strings: [`'`, `"`], kw: KW_SQL.split(' ') },
  cfg:    { line: ['#', ';'], strings: [`"`, `'`], vars: true, kw: [] },
  cstyle: { line: ['//'], block: ['/*', '*/'], strings: [`"`, `'`], kw: KW_JS.split(' ') },
  css:    { block: ['/*', '*/'], strings: [`"`, `'`], kw: [] },
  plain:  { strings: [], kw: [] },
};

const EXT_LANG: Record<string, string> = {
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  js: 'js', mjs: 'js', cjs: 'js', ts: 'js', tsx: 'js', jsx: 'js',
  vue: 'js', svelte: 'js',
  py: 'py', rb: 'py',
  go: 'go', rs: 'rs',
  java: 'cstyle', kt: 'cstyle', swift: 'cstyle', c: 'cstyle', cpp: 'cstyle',
  h: 'cstyle', cs: 'cstyle', php: 'cstyle',
  css: 'css', scss: 'css', less: 'css',
  yaml: 'cfg', yml: 'cfg', toml: 'cfg', ini: 'cfg', conf: 'cfg', env: 'cfg',
  gitignore: 'cfg',
  sql: 'sql',
};

function reEsc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTokenRe(lang: LangDef): RegExp {
  const parts: string[] = [];
  if (lang.block) parts.push(`(?<cmt>${reEsc(lang.block[0])}[\\s\\S]*?(?:${reEsc(lang.block[1])}|$))`);
  if (lang.line?.length) {
    const starters = lang.line.map(reEsc).join('|');
    parts.push(lang.block
      ? `(?<lcmt>(?:${starters})[^\\n]*)`
      : `(?<cmt>(?:${starters})[^\\n]*)`);
  }
  for (let i = 0; i < (lang.strings?.length ?? 0); i++) {
    const q = lang.strings[i];
    const body = q === '`' && lang.tickML
      ? '(?:\\\\.|[^`\\\\])*(?:`|$)'
      : `(?:\\\\.|[^${reEsc(q)}\\\\\\n])*(?:${reEsc(q)}|\\n|$)`;
    parts.push(`(?<str${i}>${reEsc(q)}${body})`);
  }
  if (lang.vars) parts.push('(?<v>\\$\\{[^}\\n]*\\}?|\\$[\\w@#?!*-]+)');
  parts.push('(?<num>\\b(?:0[xX][0-9a-fA-F]+|\\d+(?:\\.\\d+)?)\\b)');
  parts.push('(?<word>[A-Za-z_$][\\w$]*)');
  return new RegExp(parts.join('|'), 'g');
}

/**
 * Highlight source text into HTML spans (tok-cmt / tok-str / tok-kw /
 * tok-num / tok-var). Unknown extensions come back as escaped plain text.
 */
export function highlightCode(src: string, ext: string): string {
  const langKey = EXT_LANG[ext.toLowerCase()] ?? 'plain';
  const lang = LANGS[langKey];
  if (langKey === 'plain') return esc(src);
  const kw = new Set(lang.kw);
  const re = buildTokenRe(lang);
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out += esc(src.slice(last, m.index));
    last = m.index + m[0].length;
    const g = m.groups ?? {};
    const text = esc(m[0]);
    if (g.cmt !== undefined || g.lcmt !== undefined) out += `<span class="tok-cmt">${text}</span>`;
    else if (g.v !== undefined)   out += `<span class="tok-var">${text}</span>`;
    else if (g.num !== undefined) out += `<span class="tok-num">${text}</span>`;
    else if (g.word !== undefined) out += kw.has(m[0]) ? `<span class="tok-kw">${text}</span>` : text;
    else out += `<span class="tok-str">${text}</span>`;   // any strN group
    if (m[0].length === 0) re.lastIndex++;                // safety: never stall
  }
  out += esc(src.slice(last));
  return out;
}

/** Full code-view HTML: line-number gutter + highlighted <pre>. */
export function renderCode(src: string, ext: string): string {
  let truncNote = '';
  if (src.length > RENDER_CAPS.codeChars) {
    src = src.slice(0, RENDER_CAPS.codeChars);
    truncNote = `<div class="fe-ql-note">Showing first ${RENDER_CAPS.codeChars.toLocaleString()} characters — open the raw file for the rest.</div>`;
  }
  const lines = src.split('\n').length;
  const gutter = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
  return `${truncNote}<div class="fe-code-wrap"><pre class="fe-code-gut">${gutter}</pre><pre class="fe-code">${highlightCode(src, ext)}</pre></div>`;
}

// ── Delimiter-separated values (.tsv / .csv) ────────────────────────

/** Parse TSV/CSV into rows of cells. Quote-aware ("" escapes, embedded newlines). */
export function parseDSV(text: string, delim: '\t' | ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQ = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') {
      inQ = true;
    } else if (ch === delim) {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  // Drop a trailing fully-empty row (file ends with newline)
  if (rows.length && rows[rows.length - 1].every(c => c === '')) rows.pop();
  return rows;
}

/** Column indexes whose non-empty values are overwhelmingly numeric. */
export function numericCols(rows: string[][]): Set<number> {
  const out = new Set<number>();
  if (rows.length < 2) return out;
  const width = rows[0].length;
  for (let c = 0; c < width; c++) {
    let seen = 0, num = 0;
    for (let r = 1; r < Math.min(rows.length, 200); r++) {
      const v = (rows[r][c] ?? '').trim();
      if (!v) continue;
      seen++;
      if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v.replace(/,/g, ''))) num++;
    }
    if (seen > 0 && num / seen > 0.8) out.add(c);
  }
  return out;
}

/** Sort data rows (header excluded by caller) on one column. */
export function sortDSVRows(rows: string[][], col: number, dir: 'asc' | 'desc', numeric: boolean): string[][] {
  const sorted = [...rows].sort((a, b) => {
    const va = (a[col] ?? '').trim(), vb = (b[col] ?? '').trim();
    const cmp = numeric
      ? (parseFloat(va.replace(/,/g, '')) || 0) - (parseFloat(vb.replace(/,/g, '')) || 0)
      : va.localeCompare(vb);
    return dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

export function renderDSVTable(header: string[], dataRows: string[][], numCols: Set<number>, sort?: { col: number; dir: 'asc' | 'desc' }): string {
  let truncNote = '';
  let rows = dataRows;
  if (rows.length > RENDER_CAPS.tableRows) {
    rows = rows.slice(0, RENDER_CAPS.tableRows);
    truncNote = `<div class="fe-ql-note">Showing first ${RENDER_CAPS.tableRows.toLocaleString()} of ${dataRows.length.toLocaleString()} rows.</div>`;
  }
  const ths = header.map((h, i) => {
    const arrow = sort?.col === i ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
    return `<th data-col="${i}" class="${numCols.has(i) ? 'num' : ''}${sort?.col === i ? ' sorted' : ''}" title="Click to sort">${esc(h)}${arrow}</th>`;
  }).join('');
  const trs = rows.map(r =>
    `<tr>${header.map((_, i) => `<td class="${numCols.has(i) ? 'num' : ''}">${esc(r[i] ?? '')}</td>`).join('')}</tr>`
  ).join('');
  return `${truncNote}<table class="fe-ql-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

// ── Markdown ────────────────────────────────────────────────────────
// Small hand-rolled renderer covering the constructs READMEs actually use.
// Everything passes through esc() before any tags are added.

function badUrl(url: string): boolean {
  return /^\s*(javascript|data|vbscript):/i.test(url);
}

// READMEs routinely open with raw HTML (centered logo divs, badge imgs).
// Rather than escaping them into tag soup, keep a safe subset.
const HTML_TAGS = new Set([
  'div', 'span', 'p', 'br', 'hr', 'img', 'a', 'strong', 'em', 'b', 'i', 'u', 's',
  'code', 'pre', 'center', 'sub', 'sup', 'details', 'summary', 'kbd', 'picture', 'source',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote',
]);
const HTML_ATTRS = new Set(['src', 'href', 'alt', 'title', 'width', 'height', 'align']);
const VOID_TAGS  = new Set(['br', 'hr', 'img', 'source']);

/** Reduce arbitrary HTML to a whitelisted subset; unknown tags are unwrapped. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return esc(node.textContent ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const kids = Array.from(el.childNodes).map(walk).join('');
    if (!HTML_TAGS.has(tag)) return kids;
    let attrs = '';
    for (const a of Array.from(el.attributes)) {
      if (!HTML_ATTRS.has(a.name)) continue;
      if ((a.name === 'src' || a.name === 'href') && badUrl(a.value)) continue;
      attrs += ` ${a.name}="${esc(a.value)}"`;
    }
    if (tag === 'a' && /^https?:/i.test(el.getAttribute('href') ?? '')) {
      attrs += ' target="_blank" rel="noopener"';
    }
    return VOID_TAGS.has(tag) ? `<${tag}${attrs}>` : `<${tag}${attrs}>${kids}</${tag}>`;
  };
  return Array.from(doc.body.childNodes).map(walk).join('');
}

/** Inline markdown: code spans, images, links, bold, italic, strikethrough. */
export function mdInline(s: string): string {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+?)\)/g, (_m, alt, url) =>
    badUrl(url) ? alt : `<img src="${url}" alt="${alt}" loading="lazy">`);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+?)\)/g, (_m, t, url) =>
    badUrl(url) ? t
      : `<a href="${url}"${/^https?:/i.test(url) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return out;
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) { out.push(`<p>${mdInline(para.join(' '))}</p>`); para = []; }
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      flush();
      const buf: string[] = []; i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      const code = buf.join('\n');
      out.push(`<pre class="fe-md-pre">${fence[1] ? highlightCode(code, fence[1]) : esc(code)}</pre>`);
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flush(); const n = h[1].length; out.push(`<h${n}>${mdInline(h[2])}</h${n}>`); i++; continue; }

    // Raw HTML block: consume until the next blank line, keep a safe subset
    if (/^\s*<[a-zA-Z!/]/.test(line)) {
      flush();
      const buf: string[] = [];
      while (i < lines.length && !/^\s*$/.test(lines[i])) buf.push(lines[i++]);
      out.push(`<div class="fe-md-html">${sanitizeHtml(buf.join('\n'))}</div>`);
      continue;
    }

    if (para.length === 0 && /^\s*(?:\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      flush(); out.push('<hr>'); i++; continue;
    }

    if (/^\s*>/.test(line)) {
      flush();
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${renderMarkdown(buf.join('\n'))}</blockquote>`);
      continue;
    }

    const li = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (li) {
      flush();
      const ordered = /\d/.test(li[2]);
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
        if (!m) break;
        // Nesting is rendered as indentation, not nested lists — close enough
        // for a preview and far simpler than tracking list stacks.
        const depth = Math.min(Math.floor(m[1].length / 2), 4);
        items.push(`<li style="margin-left:${depth * 18}px">${mdInline(m[3])}</li>`);
        i++;
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*\s*$/.test(lines[i + 1])) {
      flush();
      const cells = (l: string) =>
        l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => mdInline(c.trim()));
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) rows.push(cells(lines[i++]));
      out.push(`<table class="fe-md-table"><thead><tr>${
        head.map(c => `<th>${c}</th>`).join('')
      }</tr></thead><tbody>${
        rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')
      }</tbody></table>`);
      continue;
    }

    if (/^\s*$/.test(line)) { flush(); i++; continue; }
    para.push(line.trim()); i++;
  }
  flush();
  return `<div class="fe-md">${out.join('\n')}</div>`;
}

// ── JSON / JSONL ────────────────────────────────────────────────────

function jsonLeaf(v: unknown): string {
  if (v === null) return `<span class="tok-kw">null</span>`;
  switch (typeof v) {
    case 'string': {
      const s = v.length > 500 ? v.slice(0, 500) + '…' : v;
      return `<span class="tok-str">"${esc(s)}"</span>`;
    }
    case 'number':  return `<span class="tok-num">${v}</span>`;
    case 'boolean': return `<span class="tok-kw">${v}</span>`;
    default:        return esc(String(v));
  }
}

function jsonNode(key: string | null, v: unknown, depth: number, budget: { n: number }): string {
  if (budget.n-- <= 0) return `<div class="fe-jt-row">…</div>`;
  const keyHtml = key !== null ? `<span class="fe-jt-key">${esc(key)}</span><span class="fe-jt-colon">: </span>` : '';
  if (v !== null && typeof v === 'object') {
    const isArr = Array.isArray(v);
    const entries = isArr ? (v as unknown[]).map((x, i) => [String(i), x] as const)
                          : Object.entries(v as Record<string, unknown>);
    const badge = isArr ? `[${entries.length}]` : `{${entries.length}}`;
    if (!entries.length) return `<div class="fe-jt-row">${keyHtml}<span class="fe-jt-badge">${isArr ? '[]' : '{}'}</span></div>`;
    const open = depth < 2 ? ' open' : '';
    return `<details class="fe-jt"${open}><summary>${keyHtml}<span class="fe-jt-badge">${badge}</span></summary><div class="fe-jt-kids">${
      entries.map(([k, x]) => jsonNode(k, x, depth + 1, budget)).join('')
    }</div></details>`;
  }
  return `<div class="fe-jt-row">${keyHtml}${jsonLeaf(v)}</div>`;
}

export function renderJsonTree(text: string): string {
  let v: unknown;
  try { v = JSON.parse(text); }
  catch (err) {
    return `<div class="fe-ql-note err">Invalid JSON — ${esc((err as Error).message)}</div><div class="fe-code-wrap"><pre class="fe-code">${esc(text.slice(0, RENDER_CAPS.codeChars))}</pre></div>`;
  }
  return `<div class="fe-jt-root">${jsonNode(null, v, 0, { n: RENDER_CAPS.treeNodes })}</div>`;
}

/** One collapsible row per JSONL line; malformed lines render raw with a badge. */
export function renderJsonl(text: string): string {
  const lines = text.split('\n').filter(l => l.trim() !== '');
  let truncNote = '';
  let shown = lines;
  if (lines.length > RENDER_CAPS.jsonlLines) {
    shown = lines.slice(0, RENDER_CAPS.jsonlLines);
    truncNote = `<div class="fe-ql-note">Showing first ${RENDER_CAPS.jsonlLines.toLocaleString()} of ${lines.length.toLocaleString()} lines.</div>`;
  }
  const body = shown.map((line, i) => {
    try {
      const v = JSON.parse(line);
      const compact = JSON.stringify(v);
      const preview = compact.length > 140 ? compact.slice(0, 140) + '…' : compact;
      return `<details class="fe-jl-line"><summary><span class="fe-jl-n">${i + 1}</span><span class="fe-jl-prev">${esc(preview)}</span></summary><div class="fe-jt-kids">${jsonNode(null, v, 1, { n: 2000 })}</div></details>`;
    } catch {
      return `<div class="fe-jl-line bad"><span class="fe-jl-n">${i + 1}</span><span class="fe-jl-err">not JSON</span><span class="fe-jl-prev">${esc(line.slice(0, 200))}</span></div>`;
    }
  }).join('');
  return `${truncNote}<div class="fe-jl-root">${body}</div>`;
}
