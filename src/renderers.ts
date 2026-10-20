// Rich preview renderers for the Quick Look overlay. Each function takes raw
// file text and returns an HTML string; nothing here touches the DOM or
// fetches anything, so every renderer is unit-testable in isolation.
import { esc } from './utils';
import { CHEVRON_DOWN } from './icons';
import { UI_ICON } from './control-icons';
import { COL_HANDLE } from './col-resize';

export const CODE_EXTS = new Set([
  'sh', 'bash', 'zsh', 'fish', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cpp', 'h', 'cs', 'php',
  'css', 'scss', 'less', 'html', 'htm', 'xml', 'svg', 'vue', 'svelte',
  'yaml', 'yml', 'toml', 'ini', 'conf', 'env', 'sql',
  'md', 'mdx', 'txt', 'log', 'rst', 'lock', 'gitignore', 'csv',
  'diff', 'patch', 'dockerfile', 'containerfile', 'makefile', 'jsonc', 'graphql', 'gql', 'proto',
]);
export const TABLE_EXTS = new Set(['tsv', 'csv']);
export const JSONL_EXTS = new Set(['jsonl', 'ndjson']);

export const RENDER_CAPS = {
  codeChars:  300_000,
  tableRows:  5_000,
  jsonlLines: 2_000,
  treeNodes:  20_000,
};

/** The one note an empty file or a binary one gets, on the file page and in
 *  the preview alike; '' when the text is fine to render. */
export function unrenderableNote(text: string): string {
  if (!text.trim()) return '<div class="fe-ql-note">Empty file.</div>';
  if (sniffBinary(text)) return '<div class="fe-ql-note">Binary file, no text to show.</div>';
  return '';
}

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
  strRules?: string[];           // extra string patterns BEFORE the per-quote ones (triple-quotes, prefixed/raw)
  deco?:    boolean;             // highlight @decorator / @Annotation
  regexLiterals?: boolean;
  namedTypes?: boolean;
  caseless?: boolean;            // keywords match in any case (SQL)
  prose?: boolean;               // running text: leave bare numbers uncoloured
  special?: Rule[];
  kw:       string[];            // generic keywords (→ tok-kw)
  kwCats?: {                     // overlays on kw: words here get a richer class
    ctrl?:    string[];          // control flow → tok-kw-ctrl
    type?:    string[];          // type names/keywords → tok-type
    builtin?: string[];          // builtins → tok-builtin
    lit?:     string[];          // literals → tok-lit
  };
}

const sp = (s: string) => s.split(' ');

// Resolve each keyword to its CSS class: generic kw first, then category
// overlays win. Words absent from this map render as plain identifiers.
function wordClasses(lang: LangDef): Map<string, string> {
  const m = new Map<string, string>();
  for (const w of lang.kw) m.set(w, 'tok-kw');
  const c = lang.kwCats;
  if (c) {
    for (const w of c.ctrl ?? [])    m.set(w, 'tok-kw-ctrl');
    for (const w of c.type ?? [])    m.set(w, 'tok-type');
    for (const w of c.builtin ?? []) m.set(w, 'tok-builtin');
    for (const w of c.lit ?? [])     m.set(w, 'tok-lit');
  }
  return m;
}

const KW_SH = 'if then elif else fi for while until do done case esac in function select local export readonly declare unset return exit break continue shift eval exec source alias trap set echo printf read cd test true false';
const KW_JS = 'const let var function return if else for while do switch case break continue new class extends super this typeof instanceof in of import export from default async await yield try catch finally throw delete void null undefined true false interface type enum implements private public protected readonly static namespace declare as is keyof never unknown any string number boolean object symbol';
const KW_PY = 'def class return if elif else for while break continue pass import from as with lambda try except finally raise yield global nonlocal assert del in is not and or None True False async await match self';
const KW_SQL = 'select from where insert into update delete join left right inner outer full cross on using group by order having limit offset create table drop alter add column index view as and or not null primary key foreign references distinct union all values set default check constraint unique case when then else end exists between like ilike in is with returning interval asc desc cascade if replace begin commit rollback grant';
const KW_GO = 'func package import return if else for range switch case break continue defer go chan select map struct interface type var const nil true false make new len cap append';
const KW_RS = 'fn let mut pub use mod struct enum impl trait return if else for while loop match break continue ref self Self crate super move async await dyn where unsafe true false Some None Ok Err';
const KW_GQL = 'query mutation subscription fragment on type interface union enum input scalar directive schema implements extend true false null';
const KW_PROTO = 'syntax package import message enum service rpc returns option repeated optional required oneof map reserved public weak true false';

const CATS_JS = {
  ctrl: sp('return if else for while do switch case break continue new throw try catch finally yield await delete in of'),
  type: sp('interface type enum implements string number boolean object symbol any unknown never void keyof readonly as is namespace'),
  builtin: sp('this super console'),
  lit: sp('true false null undefined'),
};
const CATS_PY = {
  ctrl: sp('return if elif else for while break continue pass raise yield try except finally with assert del in is not and or match async await'),
  builtin: sp('self print len range'),
  lit: sp('None True False'),
};
const CATS_GO = {
  ctrl: sp('return if else for range switch case break continue defer go select'),
  type: sp('chan map struct interface type'),
  builtin: sp('make new len cap append'),
  lit: sp('nil true false'),
};
const CATS_RS = {
  ctrl: sp('return if else for while loop match break continue move async await unsafe where'),
  type: sp('struct enum impl trait mod dyn'),
  lit: sp('true false Some None Ok Err self Self'),
};
const CATS_SQL = {
  ctrl: sp('select from where insert into update delete join on group by order having limit union with returning case when then else end'),
  type: sp('table view index text varchar char int integer bigint smallint serial bigserial boolean bool numeric decimal real float double precision date time timestamp timestamptz interval json jsonb uuid bytea'),
  builtin: sp('count sum avg min max coalesce now array_agg jsonb_build_object'),
  lit: sp('null true false'),
};

const LANGS: Record<string, LangDef> = {
  shell:  { line: ['#'],  strings: [`"`, `'`], vars: true,  kw: KW_SH.split(' '),
            kwCats: { ctrl: sp('if then elif else fi for while until do done case esac return exit break continue'), builtin: sp('echo printf read cd test eval exec source'), lit: sp('true false') } },
  js:     { line: ['//'], block: ['/*', '*/'], strings: [`"`, `'`, '`'], tickML: true, deco: true, regexLiterals: true, namedTypes: true, kw: KW_JS.split(' '), kwCats: CATS_JS },
  py:     { line: ['#'],  strings: [], deco: true, kw: KW_PY.split(' '), kwCats: CATS_PY,
            strRules: [
              '[rbfuRBFU]{0,2}"""[\\s\\S]*?"""',
              "[rbfuRBFU]{0,2}'''[\\s\\S]*?'''",
              '[rbfuRBFU]{0,2}"(?:\\\\.|[^"\\\\\\n])*"',
              "[rbfuRBFU]{0,2}'(?:\\\\.|[^'\\\\\\n])*'",
            ] },
  go:     { line: ['//'], block: ['/*', '*/'], strings: [`"`, '`'], tickML: true, namedTypes: true, kw: KW_GO.split(' '), kwCats: CATS_GO },
  rs:     { line: ['//'], block: ['/*', '*/'], strings: [], namedTypes: true, kw: KW_RS.split(' '), kwCats: CATS_RS,
            strRules: ['r#+"[\\s\\S]*?"#+', 'r"[^"\\n]*"', 'b?"(?:\\\\.|[^"\\\\\\n])*"'] },
  sql:    { line: ['--'], block: ['/*', '*/'], strings: [`'`, `"`], caseless: true, kw: KW_SQL.split(' '), kwCats: CATS_SQL,
            special: [{ kind: 'var', pattern: '(?<!:):[A-Za-z_]\\w*|\\$\\d+' }] },
  json:   { strings: [`"`], kw: [], kwCats: { lit: sp('true false null') },
            special: [{ kind: 'key', pattern: '"(?:\\\\.|[^"\\\\\\n])*"(?=[ \\t]*:)' }] },
  http:   { line: ['#'], strings: [`"`], kw: sp('GET POST PUT PATCH DELETE HEAD OPTIONS HTTP'), kwCats: { lit: sp('true false null') },
            special: [{ kind: 'key', pattern: '^[A-Za-z][\\w-]*(?=:[ \\t])' }, { kind: 'key', pattern: '"(?:\\\\.|[^"\\\\\\n])*"(?=[ \\t]*:)' }] },
  md:     { strings: [], kw: [], prose: true, special: [
              { kind: 'cmt', pattern: '<!--[\\s\\S]*?(?:-->|$)' },
              { kind: 'meta', pattern: '^[ \\t]*(?:```|~~~)[^\\n]*' },
              { kind: 'section', pattern: '^#{1,6}[ \\t][^\\n]*' },
              { kind: 'cmt', pattern: '^>[^\\n]*' },
              { kind: 'tag', pattern: '^[ \\t]*(?:[-*+]|\\d+[.)])(?=[ \\t])' },
              { kind: 'str', pattern: '`[^`\\n]+`' },
              { kind: 'key', pattern: '!?\\[[^\\]\\n]*\\]\\([^)\\n]*\\)' },
              { kind: 'deco', pattern: '\\*\\*[^*\\n]+\\*\\*|__[^_\\n]+__' },
              { kind: 'meta', pattern: '^[ \\t]*\\|?(?:[ \\t]*:?-{3,}:?[ \\t]*\\|)+[^\\n]*' },
            ] },
  cfg:    { line: ['#', ';'], strings: [`"`, `'`], vars: true, kw: [] },
  cstyle: { line: ['//'], block: ['/*', '*/'], strings: [`"`, `'`], deco: true, namedTypes: true, kw: KW_JS.split(' '), kwCats: CATS_JS },
  css:    { block: ['/*', '*/'], strings: [`"`, `'`], kw: [] },
  jsonc:  { line: ['//'], block: ['/*', '*/'], strings: [`"`], kw: [], kwCats: { lit: sp('true false null') } },
  graphql:{ line: ['#'], strings: [`"`], kw: sp(KW_GQL), kwCats: { ctrl: sp('query mutation subscription fragment on'), type: sp('type interface union enum input scalar'), lit: sp('true false null') } },
  proto:  { line: ['//'], block: ['/*', '*/'], strings: [`"`], kw: sp(KW_PROTO), namedTypes: true,
            kwCats: { ctrl: sp('import rpc returns'), type: sp('message enum service oneof map'), lit: sp('true false') } },
  html:   { block: ['<!--', '-->'], strings: [], kw: [], special: [{ kind: 'tag', pattern: '<\\/?[A-Za-z][^>\\n]*>' }] },
  // Keys, anchors and plain values each get a colour; indentation and the list
  // dash stay outside the key, and an unquoted value like it's is one value.
  yaml:   { line: ['#'], strings: [`"`, `'`], kw: [], kwCats: { lit: sp('true false null yes no True False Null') },
            special: [
              { kind: 'meta', pattern: '^(?:---|\\.\\.\\.)[ \\t]*$' },
              { kind: 'key', pattern: '(?<=^[ \\t]*(?:-[ \\t]+)?)[A-Za-z_][\\w.-]*(?=[ \\t]*:(?:[ \\t]|$))' },
              { kind: 'deco', pattern: '(?<=[:\\s-][ \\t]*)[&*][A-Za-z_][\\w-]*' },
              { kind: 'str', pattern: '(?<=:[ \\t]+|^[ \\t]*-[ \\t]+)(?![\'"#&*|>\\[{]|(?:true|false|null|yes|no|True|False|Null|~|[-+]?\\d[\\d_.]*)[ \\t]*(?:#|$))[^\\n#]*[^\\s#]' },
            ] },
  toml:   { line: ['#'], strings: [`"`, `'`], kw: [], kwCats: { lit: sp('true false') },
            special: [{ kind: 'section', pattern: '^\\[[^\\]\\n]+\\]' }, { kind: 'key', pattern: '^[ \\t]*[A-Za-z_][\\w.-]*(?=[ \\t]*=)' }] },
  diff:   { strings: [], kw: [], special: [
              { kind: 'meta', pattern: '^(?:@@|diff |index |\\+\\+\\+ |--- )[^\\n]*' },
              { kind: 'add', pattern: '^\\+[^\\n]*' }, { kind: 'del', pattern: '^-[^\\n]*' },
            ] },
  dockerfile: { line: ['#'], strings: [`"`, `'`], vars: true,
            kw: sp('FROM RUN CMD COPY ADD WORKDIR ENV ARG EXPOSE USER ENTRYPOINT VOLUME LABEL HEALTHCHECK SHELL STOPSIGNAL ONBUILD') },
  makefile: { line: ['#'], strings: [`"`, `'`], vars: true, kw: sp('include define endef ifeq ifneq ifdef ifndef else endif export override private'),
            special: [{ kind: 'key', pattern: '^[A-Za-z0-9_./%-]+(?=[ \\t]*:)' }] },
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
  ini: 'cfg', conf: 'cfg', env: 'cfg',
  gitignore: 'cfg',
  sql: 'sql',
  diff: 'diff', patch: 'diff',
  dockerfile: 'dockerfile', containerfile: 'dockerfile', makefile: 'makefile',
  jsonc: 'jsonc', graphql: 'graphql', gql: 'graphql', proto: 'proto',
  html: 'html', htm: 'html', xml: 'html',
  yaml: 'yaml', yml: 'yaml', toml: 'toml',
  json: 'json', json5: 'json', geojson: 'json', http: 'http', md: 'md', mdx: 'md', markdown: 'md',
};

// Code-fence labels people actually write, mapped to the extension the
// table above knows. Unlisted labels fall through to the label itself.
const FENCE_ALIAS: Record<string, string> = {
  javascript: 'js', typescript: 'ts', node: 'js', python: 'py', python3: 'py', py3: 'py', ruby: 'rb',
  shell: 'sh', shellscript: 'sh', console: 'sh', terminal: 'sh', ps: 'sh', golang: 'go', rust: 'rs',
  kotlin: 'kt', csharp: 'cs', 'c++': 'cpp', 'c#': 'cs', objc: 'c', postgres: 'sql', postgresql: 'sql',
  psql: 'sql', mysql: 'sql', sqlite: 'sql', plpgsql: 'sql', https: 'http', rest: 'http', svg: 'xml',
  docker: 'dockerfile', make: 'makefile', dotenv: 'env', properties: 'ini', cfg: 'ini', patch: 'diff',
};

function reEsc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// `word` is resolved to keyword-or-plain at match time.
type TokKind = 'cmt' | 'str' | 'var' | 'num' | 'word' | 'deco' | 'regex' | 'tag' | 'key' | 'section' | 'add' | 'del' | 'meta';
interface Rule { kind: TokKind; pattern: string; }   // pattern: a regex fragment, no capture groups

// Ordered rules per language. Order IS the greedy guarantee: comments and
// strings come before `word`/`num`, so a `//` inside a string stays a string —
// the property Prism's `greedy` flag buys, free from single-regex alternation.
function buildRules(lang: LangDef): Rule[] {
  const rules: Rule[] = [];
  if (lang.block) rules.push({ kind: 'cmt', pattern: `${reEsc(lang.block[0])}[\\s\\S]*?(?:${reEsc(lang.block[1])}|$)` });
  if (lang.line?.length) {
    const starters = lang.line.map(reEsc).join('|');
    rules.push({ kind: 'cmt', pattern: `(?:${starters})[^\\n]*` });
  }
  if (lang.regexLiterals) rules.push({ kind: 'regex', pattern: String.raw`(?:(?<=^)|(?<=[=(,:;!&|?{}\n][ \t]{0,16})|(?<=\breturn[ \t]{1,16}))/(?:\\.|[^/\\\n])+/[dgimsuvy]*` });
  rules.push(...(lang.special ?? []));
  for (const p of lang.strRules ?? []) rules.push({ kind: 'str', pattern: p });
  for (const q of lang.strings ?? []) {
    const body = q === '`' && lang.tickML
      ? '(?:\\\\.|[^`\\\\])*(?:`|$)'
      : `(?:\\\\.|[^${reEsc(q)}\\\\\\n])*(?:${reEsc(q)}|\\n|$)`;
    rules.push({ kind: 'str', pattern: `${reEsc(q)}${body}` });
  }
  if (lang.vars) rules.push({ kind: 'var', pattern: '\\$\\{[^}\\n]*\\}?|\\$[\\w@#?!*-]+' });
  if (lang.deco) rules.push({ kind: 'deco', pattern: '@[A-Za-z_][\\w.]*' });
  if (!lang.prose) rules.push({ kind: 'num',  pattern: '\\b(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][+-]?\\d+)?)\\b' });
  rules.push({ kind: 'word', pattern: '[A-Za-z_$][\\w$]*' });
  return rules;
}

function compile(rules: Rule[]): { re: RegExp; kinds: TokKind[] } {
  const kinds: TokKind[] = [];
  const parts = rules.map((r, i) => { kinds[i] = r.kind; return `(?<g${i}>${r.pattern})`; });
  return { re: new RegExp(parts.join('|'), 'gm'), kinds };
}

const KIND_CLASS: Partial<Record<TokKind, string>> = {
  cmt: 'tok-cmt', str: 'tok-str', var: 'tok-var', num: 'tok-num', deco: 'tok-deco',
  regex: 'tok-regex', tag: 'tok-type', key: 'tok-key', section: 'tok-section',
  add: 'tok-add', del: 'tok-del', meta: 'tok-cmt',
};

/**
 * Highlight source text into HTML spans (tok-cmt / tok-str / tok-kw /
 * tok-num / tok-var). Unknown extensions come back as escaped plain text.
 */
export function highlightCode(src: string, ext: string): string {
  const key = ext.toLowerCase();
  const langKey = EXT_LANG[FENCE_ALIAS[key] ?? key] ?? 'plain';
  const lang = LANGS[langKey];
  if (langKey === 'plain') return esc(src);
  const wmap = wordClasses(lang);
  const { re, kinds } = compile(buildRules(lang));
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    out += esc(src.slice(last, m.index));
    last = m.index + m[0].length;
    const g = m.groups ?? {};
    let kind: TokKind | undefined;
    for (let i = 0; i < kinds.length; i++) if (g[`g${i}`] !== undefined) { kind = kinds[i]; break; }
    const text = esc(m[0]);
    if (kind === 'word') {
      const before = src.slice(Math.max(0, m.index - 32), m.index);
      const declaration = /\b(?:function|def|func|fn)\s+$/.test(before);
      const call = /^\s*\(/.test(src.slice(last, last + 12));
      const type = lang.namedTypes && /^[A-Z]/.test(m[0]) && /(?:\bnew|\bextends|\bimplements|[:<,])\s*$/.test(before);
      const cls = wmap.get(lang.caseless ? m[0].toLowerCase() : m[0]) ?? (declaration || call ? 'tok-fn' : type ? 'tok-type' : undefined);
      out += cls ? `<span class="${cls}">${text}</span>` : text;
    }
    else if (kind)         out += `<span class="${KIND_CLASS[kind]}">${text}</span>`;
    else                   out += text;
    if (m[0].length === 0) re.lastIndex++;   // safety: never stall on a zero-width match
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
  // A row longer than the header still shows every cell, under a numbered
  // column, rather than silently losing the extra ones.
  const width = rows.reduce((w, r) => Math.max(w, r.length), header.length);
  const cols = Array.from({ length: width }, (_, i) => header[i] ?? `(${i + 1})`);
  const ths = cols.map((h, i) => {
    const arrow = sort?.col === i ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
    return `<th data-col="${i}" class="${numCols.has(i) ? 'num' : ''}${sort?.col === i ? ' sorted' : ''}" title="Click to sort">${esc(h)}${arrow}${COL_HANDLE}</th>`;
  }).join('');
  const trs = rows.map(r =>
    `<tr>${cols.map((_, i) => `<td class="${numCols.has(i) ? 'num' : ''}">${esc(r[i] ?? '')}</td>`).join('')}</tr>`
  ).join('');
  return `${truncNote}<table class="fe-ql-table fe-rz"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

// ── Markdown ────────────────────────────────────────────────────────
// Small hand-rolled renderer covering the constructs READMEs actually use.
// Everything passes through esc() before any tags are added.

function badUrl(url: string): boolean {
  return /^\s*(javascript|data|vbscript):/i.test(url);
}

function localFileUrl(path: string): string {
  const filePath = path.replace(/:\d+(?::\d+)?$/, '');
  return 'file://' + filePath.split('/').map(encodeURIComponent).join('/');
}

// Resolve a markdown image/link target against the file's own URL so relative
// paths (logo.svg, ./docs/x.md, ../y.png) point at the right file:// location.
// URLs that already carry a scheme, protocol-relative //, or #anchors pass through.
export function resolveMdUrl(base: string, url: string): string {
  if (/^\/Users\/alcatraz627(?:\/|$)/.test(url)) return localFileUrl(url);
  if (!base) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//') || url.startsWith('#')) return url;
  try { return new URL(url, base).href; } catch { return url; }
}

// READMEs routinely open with raw HTML (centered logo divs, badge imgs).
// Rather than escaping them into tag soup, keep a safe subset.
const HTML_TAGS = new Set([
  'div', 'span', 'p', 'br', 'hr', 'img', 'a', 'strong', 'em', 'b', 'i', 'u', 's',
  'code', 'pre', 'center', 'sub', 'sup', 'details', 'summary', 'kbd', 'picture', 'source',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote',
]);
const HTML_ATTRS = new Set(['src', 'href', 'alt', 'title', 'width', 'height', 'align', 'colspan', 'rowspan', 'start']);
const HTML_BOOL_ATTRS = new Set(['open', 'reversed']);
const VOID_TAGS  = new Set(['br', 'hr', 'img', 'source']);

/** Reduce arbitrary HTML to a whitelisted subset; unknown tags are unwrapped. */
export function sanitizeHtml(html: string, baseUrl = ''): string {
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
      if (HTML_BOOL_ATTRS.has(a.name)) { attrs += ` ${a.name}`; continue; }
      if (!HTML_ATTRS.has(a.name)) continue;
      let val = a.value;
      if (a.name === 'src' || a.name === 'href') {
        if (badUrl(val)) continue;
        val = resolveMdUrl(baseUrl, val);
      }
      attrs += ` ${a.name}="${esc(val)}"`;
    }
    if (tag === 'a' && /^(?:https?:|file:\/\/\/Users\/alcatraz627(?:\/|$))/i.test(resolveMdUrl(baseUrl, el.getAttribute('href') ?? ''))) {
      attrs += ' target="_blank" rel="noopener"';
    }
    return VOID_TAGS.has(tag) ? `<${tag}${attrs}>` : `<${tag}${attrs}>${kids}</${tag}>`;
  };
  return Array.from(doc.body.childNodes).map(walk).join('');
}

/** Inline markdown: code spans, images, links, bold, italic, strikethrough. */
export function mdInline(s: string, baseUrl = ''): string {
  const htmlTags: string[] = [];
  let source = '';
  let codeTicks = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '`') {
      let end = i;
      while (s[end] === '`') end++;
      const count = end - i;
      if (!codeTicks) codeTicks = count;
      else if (codeTicks === count) codeTicks = 0;
      source += s.slice(i, end);
      i = end - 1;
      continue;
    }
    if (s[i] !== '<' || codeTicks || !/^<\/?[a-z][\w-]*\b/i.test(s.slice(i))) { source += s[i]; continue; }
    let end = i + 1, quote = '';
    for (; end < s.length; end++) {
      if (quote) { if (s[end] === quote) quote = ''; }
      else if (s[end] === '"' || s[end] === "'") quote = s[end];
      else if (s[end] === '>') break;
    }
    if (end === s.length) { source += s[i]; continue; }
    const raw = s.slice(i, end + 1);
    const name = raw.match(/^<\/?([a-z][\w-]*)/i)![1].toLowerCase();
    if (!HTML_TAGS.has(name)) { source += raw; i = end; continue; }
    const safe = sanitizeHtml(raw.startsWith('</') ? `<${name}></${name}>` : `${raw}${VOID_TAGS.has(name) ? '' : `</${name}>`}`, baseUrl);
    const tag = raw.startsWith('</') ? `</${name}>` : safe.slice(0, safe.indexOf('>') + 1);
    htmlTags.push(tag);
    source += `\uE000${htmlTags.length - 1}\uE001`;
    i = end;
  }
  let out = esc(source);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+?)\)/g, (_m, alt, url) => {
    if (badUrl(url)) return alt;
    return `<img src="${resolveMdUrl(baseUrl, url)}" alt="${alt}" loading="lazy">`;
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+?)\)/g, (_m, t, url) => {
    if (badUrl(url)) return t;
    const u = resolveMdUrl(baseUrl, url);
    return `<a href="${u}"${/^(?:https?:|file:\/\/\/Users\/alcatraz627(?:\/|$))/i.test(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
  });
  // <https://…> autolinks lose their brackets; the bare-URL pass links them.
  out = out.replace(/&lt;((?:https?|file):\/\/[^\s<>]+?)&gt;/gi, '$1');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  // Underscores emphasise only at word edges, so snake_case_names stay whole,
  // and never inside code, a tag (a link's address) or a bare URL.
  out = out.split(/(<code>[\s\S]*?<\/code>|<[^>]+>|\b(?:https?|file):\/\/\S+)/).map((part, i) => i % 2 ? part : part
    .replace(/(^|[^\w])__([^_\s][^_]*?)__(?!\w)/g, '$1<strong>$2</strong>')
    .replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>')).join('');
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return out.replace(/\uE000(\d+)\uE001/g, (_m, index) => htmlTags[Number(index)]);
}

// Bare web and file:// addresses in prose become links, the way GitHub and
// most readers treat them. Trailing sentence punctuation stays outside the
// link, and a closing bracket only belongs to the URL when it opened one.
const BARE_URL = /\b(?:https?|file):\/\/[^\s<>"'`]+/gi;

function trimUrl(url: string): string {
  let u = url.replace(/[.,;:!?*_]+$/, '');
  for (const [open, close] of [['(', ')'], ['[', ']']]) {
    while (u.endsWith(close) && u.split(open).length < u.split(close).length) u = u.slice(0, -1).replace(/[.,;:!?*_]+$/, '');
  }
  return u;
}

function linkBareUrls(root: DocumentFragment): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  for (const node of textNodes) {
    if (node.parentElement?.closest('a, pre, svg, style, script')) continue;
    const value = node.textContent || '';
    BARE_URL.lastIndex = 0;
    if (!BARE_URL.test(value)) continue;
    BARE_URL.lastIndex = 0;
    const replacement = document.createDocumentFragment();
    let cursor = 0;
    for (const m of value.matchAll(BARE_URL)) {
      const url = trimUrl(m[0]);
      const start = m.index ?? 0;
      replacement.append(value.slice(cursor, start));
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = url;
      replacement.append(link);
      cursor = start + url.length;
    }
    replacement.append(value.slice(cursor));
    node.parentNode?.replaceChild(replacement, node);
  }
}

function linkLocalPaths(html: string): string {
  if (!html.includes('/Users/alcatraz627') && !/(?:https?|file):\/\//i.test(html)) return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  linkBareUrls(template.content);
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  for (const node of textNodes) {
    if (node.parentElement?.closest('a, pre, svg, style, script')) continue;
    const value = node.textContent || '';
    const replacement = document.createDocumentFragment();
    let cursor = 0;
    while (cursor < value.length) {
      const start = value.indexOf('/Users/alcatraz627', cursor);
      if (start < 0) break;
      const afterHome = value[start + '/Users/alcatraz627'.length];
      if ((start && /[\w/:]/.test(value[start - 1])) || (afterHome && afterHome !== '/' && !/\s|[),.;!?]/.test(afterHome))) {
        replacement.append(value.slice(cursor, start + 1));
        cursor = start + 1;
        continue;
      }
      let end = start + '/Users/alcatraz627'.length;
      let depth = 0;
      const opener = start ? value[start - 1] : '';
      const delimiter = opener === '"' || opener === "'" ? opener : opener === '<' ? '>' : '';
      const delimited = node.parentElement?.tagName === 'CODE' || !!delimiter;
      while (end < value.length) {
        const char = value[end];
        if ((delimiter && char === delimiter) || (!delimited && /[\n\r<>"']/.test(char)) || (!delimited && char === ')' && depth === 0) || (!delimited && char === ']')) break;
        if (char === '(') depth++;
        if (char === ')') depth--;
        if (!delimited && /\s/.test(char)) {
          const prefix = value.slice(start, end);
          const hasLaterPathPart = /\/|\.[a-zA-Z0-9_-]{1,15}(?=:\d+|\s|$|[),;!?])/.test(value.slice(end + 1, end + 100));
          if (/\/$/.test(prefix) || /(?:\.[a-zA-Z0-9_-]{1,15}|:\d+(?::\d+)?)$/.test(prefix) || !hasLaterPathPart) break;
        }
        end++;
      }
      let path = value.slice(start, end);
      if (!delimited) path = path.replace(/[.,;!?]+$/, '');
      replacement.append(value.slice(cursor, start));
      const link = document.createElement('a');
      link.href = localFileUrl(path);
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = path;
      replacement.append(link);
      cursor = start + path.length;
    }
    if (cursor) {
      replacement.append(value.slice(cursor));
      node.parentNode?.replaceChild(replacement, node);
    }
  }
  return template.innerHTML;
}

// Heading ids come from the text, deduplicated per document, so the file
// page's table of contents and the hover anchors agree.
export function headingId(text: string, seen: Map<string, number>): string {
  let id = text.trim().toLowerCase().replace(/[^a-z0-9À-ɏͰ-﷏]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
  const n = seen.get(id) ?? 0; seen.set(id, n + 1);
  if (n) id += '-' + n;
  return id;
}

// GitHub's alert labels: > [!NOTE] and friends open a coloured callout.
const ALERTS: Record<string, string> = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning', CAUTION: 'Caution' };
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])(?:\s+(.*)|\s*)$/;

export function renderMarkdown(src: string, baseUrl = '', inner = false): string {
  let lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  const seenIds = new Map<string, number>();
  // Footnote definitions ([^id]: text) leave the flow and list at the end.
  const notes = new Map<string, string>();
  if (!inner) {
    let inFence = false;
    lines = lines.filter(l => {
      if (/^ {0,3}(`{3,}|~{3,})/.test(l)) inFence = !inFence;
      const m = !inFence && l.match(/^\[\^([^\]\s]+)\]:\s*(.*)$/);
      if (m) { notes.set(m[1], m[2]); return false; }
      return true;
    });
  }
  // Front matter: a --- block at the top renders as a key and value list.
  let i = 0;
  if (!inner && lines[0] === '---') {
    const end = lines.slice(1, 60).findIndex(l => l === '---');
    if (end >= 0) {
      const rows = lines.slice(1, end + 1).map(l => l.match(/^([\w.-]+)\s*:\s*(.*)$/)).filter(Boolean) as RegExpMatchArray[];
      if (rows.length) out.push(`<dl class="fe-md-fm">${rows.map(m => `<dt>${esc(m[1])}</dt><dd>${mdInline(m[2], baseUrl)}</dd>`).join('')}</dl>`);
      i = end + 2;
    }
  }
  // Two trailing spaces or a backslash end a line with a hard break.
  const flush = () => {
    if (!para.length) return;
    const text = para.map((l, k) => k < para.length - 1 && /( {2,}|\\)$/.test(l) ? l.replace(/( {2,}|\\)$/, '') + '\uE002' : l.trim()).join(' ');
    out.push(`<p>${mdInline(text, baseUrl).replace(/\uE002 ?/g, '<br>')}</p>`);
    para = [];
  };
  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^( {0,3})(`{3,}|~{3,})([^\r\n]*)$/);
    if (fence) {
      flush();
      const buf: string[] = []; i++;
      const marker = fence[2][0], width = fence[2].length, indent = fence[1].length;
      const close = new RegExp(`^ {0,3}${marker === '`' ? '`' : '~'}{${width},}\\s*$`);
      while (i < lines.length && !close.test(lines[i])) {
        buf.push(lines[i++].replace(new RegExp(`^ {0,${indent}}`), ''));
      }
      if (i < lines.length) i++;
      const code = buf.join('\n');
      const language = fence[3].trim().split(/\s+/)[0] || '';
      if (language.toLowerCase() === 'mermaid') {
        out.push(`<div class="fe-md-mermaid"><pre class="fe-md-mermaid-source" hidden>${esc(code)}</pre><div class="fe-md-mermaid-view">Rendering diagram…</div></div>`);
      } else {
        out.push(`<div class="fe-md-code"><div class="fe-md-code-bar"><span class="fe-md-lang">${esc(language || 'text')}</span><button type="button" class="fe-md-copy" title="Copy this block" aria-label="Copy this block">${UI_ICON.copy}</button></div><pre class="fe-md-pre">${highlightCode(code, language || 'md')}</pre></div>`);
      }
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush();
      const n = h[1].length;
      const id = headingId(h[2].replace(/[*_`]/g, ''), seenIds);
      out.push(`<h${n} id="${esc(id)}">${mdInline(h[2], baseUrl)}<a class="fe-md-anchor" href="#${esc(id)}" title="Link to this heading"></a></h${n}>`);
      i++; continue;
    }

    // Raw HTML block: consume until the next blank line, keep a safe subset
    if (/^\s*<[a-zA-Z!/]/.test(line)) {
      flush();
      const buf: string[] = [];
      while (i < lines.length && !/^\s*$/.test(lines[i])) buf.push(lines[i++]);
      out.push(`<div class="fe-md-html">${sanitizeHtml(buf.join('\n'), baseUrl)}</div>`);
      continue;
    }

    if (para.length === 0 && /^\s*(?:\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      flush(); out.push('<hr>'); i++; continue;
    }

    if (/^\s*>/.test(line)) {
      flush();
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      const alert = buf[0]?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i);
      if (alert) {
        const kind = alert[1].toUpperCase();
        out.push(`<div class="fe-md-alert fe-md-alert-${kind.toLowerCase()}"><p class="fe-md-alert-title">${ALERTS[kind]}</p>${renderMarkdown(buf.slice(1).join('\n'), baseUrl, true)}</div>`);
      } else out.push(`<blockquote>${renderMarkdown(buf.join('\n'), baseUrl)}</blockquote>`);
      continue;
    }

    // Lists nest by indentation. An item owns every following line indented
    // past its marker, plus unindented lines that continue its paragraph; its
    // body renders as markdown, so nested lists, code and quotes work inside.
    const li = line.match(LIST_ITEM);
    if (li && (li[3] !== undefined || para.length === 0)) {
      flush();
      const baseIndent = li[1].length;
      const ordered = /\d/.test(li[2]);
      const items: string[] = [];
      let loose = false;
      while (i < lines.length) {
        const m = lines[i].match(LIST_ITEM);
        if (!m || m[1].length !== baseIndent || /\d/.test(m[2]) !== ordered) break;
        const contentIndent = m[1].length + m[2].length + 1;
        const body: string[] = [m[3] ?? ''];
        i++;
        while (i < lines.length) {
          const l = lines[i];
          if (/^\s*$/.test(l)) {
            const next = lines.slice(i + 1).find(x => !/^\s*$/.test(x));
            if (next !== undefined && next.match(/^\s*/)![0].length >= contentIndent) { body.push(''); i++; loose = true; continue; }
            break;
          }
          const ind = l.match(/^\s*/)![0].length;
          if (ind >= contentIndent || (ind > baseIndent && LIST_ITEM.test(l))) { body.push(l.slice(Math.min(ind, contentIndent))); i++; continue; }
          // A lazy continuation: plain text right after the item's own text.
          if (!LIST_ITEM.test(l) && body[body.length - 1] !== '' && !/^\s*(#|>|```|~~~|\|)/.test(l)) { body.push(l.trim()); i++; continue; }
          break;
        }
        const task = body[0].match(/^\[( |x|X)\]\s+(.*)$/);
        if (task) body[0] = task[2];
        let html = renderMarkdown(body.join('\n'), baseUrl, true);
        const tight = html.match(/^<p>([\s\S]*?)<\/p>(\n?[\s\S]*)$/);
        if (tight && !loose) html = tight[1] + tight[2];
        items.push(task
          ? `<li class="fe-task"><input type="checkbox" disabled${task[1] === ' ' ? '' : ' checked'}> ${html}</li>`
          : `<li>${html}</li>`);
        // One blank line between siblings keeps the list going.
        if (i < lines.length && /^\s*$/.test(lines[i]) && lines[i + 1]?.match(LIST_ITEM)?.[1].length === baseIndent) { i++; loose = true; }
      }
      const start = ordered ? parseInt(li[2], 10) : 1;
      out.push(ordered ? `<ol${start !== 1 ? ` start="${start}"` : ''}>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*\s*$/.test(lines[i + 1])) {
      flush();
      const cells = (l: string) => {
        const parts: string[] = [];
        let cell = '';
        let codeTicks = 0;
        for (let p = 0; p < l.length; p++) {
          if (l[p] === '\\' && l[p + 1] === '|') { cell += '|'; p++; continue; }
          if (l[p] === '`') {
            let end = p;
            while (l[end] === '`') end++;
            const ticks = end - p;
            if (!codeTicks) codeTicks = ticks;
            else if (codeTicks === ticks) codeTicks = 0;
            cell += l.slice(p, end);
            p = end - 1;
            continue;
          }
          if (l[p] === '|' && !codeTicks) { parts.push(cell); cell = ''; continue; }
          cell += l[p];
        }
        parts.push(cell);
        if (/^\s*\|/.test(l)) parts.shift();
        if (/\|\s*$/.test(l) && !/\\\|\s*$/.test(l)) parts.pop();
        return parts.map(c => mdInline(c.trim(), baseUrl));
      };
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) rows.push(cells(lines[i++]));
      out.push(`<div class="fe-md-tablewrap"><table class="fe-md-table fe-rz"><thead><tr>${
        head.map(c => `<th>${c}${COL_HANDLE}</th>`).join('')
      }</tr></thead><tbody>${
        rows.map(r => `<tr>${Array.from({ length: head.length }, (_, n) => `<td>${r[n] ?? ''}</td>`).join('')}</tr>`).join('')
      }</tbody></table></div>`);
      continue;
    }

    if (/^\s*$/.test(line)) { flush(); i++; continue; }
    para.push(line.replace(/^\s+/, '')); i++;
  }
  flush();
  if (inner) return out.join('\n');
  let html = out.join('\n');
  if (notes.size) {
    const order: string[] = [];
    html = html.replace(/\[\^([^\]\s]+)\]/g, (m, id: string) => {
      if (!notes.has(id)) return m;
      if (!order.includes(id)) order.push(id);
      const n = order.indexOf(id) + 1;
      return `<sup class="fe-md-fnref"><a href="#fn-${esc(id)}" id="fnref-${esc(id)}">${n}</a></sup>`;
    });
    const listed = [...order, ...[...notes.keys()].filter(k => !order.includes(k))];
    html += `<section class="fe-md-footnotes"><ol>${listed.map(id =>
      `<li id="fn-${esc(id)}">${mdInline(notes.get(id)!, baseUrl)} <a href="#fnref-${esc(id)}" class="fe-md-fnback" title="Back to the text">↩</a></li>`).join('')}</ol></section>`;
  }
  return linkLocalPaths(`<div class="fe-md">${html}</div>`);
}

// ── JSON / JSONL ────────────────────────────────────────────────────

function jsonLeaf(v: unknown): string {
  if (v === null) return `<span class="tok-lit">null</span>`;
  switch (typeof v) {
    case 'string': {
      const s = v.length > 500 ? v.slice(0, 500) + '…' : v;
      return `<span class="tok-str">"${esc(s)}"</span>`;
    }
    case 'number':  return `<span class="tok-num">${v}</span>`;
    case 'boolean': return `<span class="tok-lit">${v}</span>`;
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
    return `<details class="fe-jt"${open}><summary>${CHEVRON_DOWN}${keyHtml}<span class="fe-jt-badge">${badge}</span></summary><div class="fe-jt-kids">${
      entries.map(([k, x]) => jsonNode(k, x, depth + 1, budget)).join('')
    }</div></details>`;
  }
  return `<div class="fe-jt-row">${keyHtml}${jsonLeaf(v)}</div>`;
}

export function renderJsonTree(text: string): string {
  let v: unknown;
  try { v = JSON.parse(text); }
  catch (err) {
    // Comments and trailing commas (tsconfig, VS Code settings) still read as JSON text.
    return `<div class="fe-ql-note">Not strict JSON, shown as text: ${esc((err as Error).message)}</div>${renderCode(text, 'jsonc')}`;
  }
  return `<div class="fe-jt-root">${jsonNode(null, v, 0, { n: RENDER_CAPS.treeNodes })}</div>`;
}

/** One collapsible row per JSONL line; malformed lines render raw with a badge. */
export function renderJsonl(text: string): string {
  // Each record keeps its line number in the file, blank lines included,
  // so "line 6" here is line 6 in an editor.
  const lines = text.split('\n').map((l, i) => ({ l, n: i + 1 })).filter(x => x.l.trim() !== '');
  let truncNote = '';
  let shown = lines;
  if (lines.length > RENDER_CAPS.jsonlLines) {
    shown = lines.slice(0, RENDER_CAPS.jsonlLines);
    truncNote = `<div class="fe-ql-note">Showing first ${RENDER_CAPS.jsonlLines.toLocaleString()} of ${lines.length.toLocaleString()} lines.</div>`;
  }
  const body = shown.map(({ l: line, n }) => {
    try {
      const v = JSON.parse(line);
      const compact = JSON.stringify(v);
      const preview = compact.length > 140 ? compact.slice(0, 140) + '…' : compact;
      return `<details class="fe-jl-line"><summary>${CHEVRON_DOWN}<span class="fe-jl-n">${n}</span><span class="fe-jl-prev">${esc(preview)}</span></summary><div class="fe-jt-kids">${jsonNode(null, v, 1, { n: 2000 })}</div></details>`;
    } catch {
      return `<div class="fe-jl-line bad"><span class="fe-jl-n">${n}</span><span class="fe-jl-err">not JSON</span><span class="fe-jl-prev">${esc(line.slice(0, 200))}</span></div>`;
    }
  }).join('');
  return `${truncNote}<div class="fe-jl-root">${body}</div>`;
}
