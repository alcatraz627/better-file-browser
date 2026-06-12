import { describe, it, expect } from 'vitest';
import {
  parseDSV, numericCols, sortDSVRows, renderDSVTable,
  highlightCode, renderCode, sniffBinary,
  renderJsonl, renderJsonTree, RENDER_CAPS,
  renderMarkdown, mdInline, sanitizeHtml,
} from '../src/renderers';

describe('parseDSV', () => {
  it('parses simple TSV', () => {
    expect(parseDSV('a\tb\tc\n1\t2\t3\n', '\t')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('handles quoted CSV cells with commas and escaped quotes', () => {
    const rows = parseDSV('name,quote\n"Smith, John","said ""hi"""\n', ',');
    expect(rows).toEqual([['name', 'quote'], ['Smith, John', 'said "hi"']]);
  });

  it('handles embedded newlines inside quoted cells', () => {
    const rows = parseDSV('a,b\n"line1\nline2",x\n', ',');
    expect(rows).toEqual([['a', 'b'], ['line1\nline2', 'x']]);
  });

  it('drops the empty trailing row from a final newline', () => {
    expect(parseDSV('a\tb\n', '\t')).toEqual([['a', 'b']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseDSV('a\tb\r\n1\t2\r\n', '\t')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('numericCols', () => {
  it('detects numeric columns, ignoring the header', () => {
    const rows = [['name', 'count'], ['alpha', '41'], ['beta', '7'], ['gamma', '113']];
    const cols = numericCols(rows);
    expect(cols.has(1)).toBe(true);
    expect(cols.has(0)).toBe(false);
  });

  it('tolerates empty cells and decimals', () => {
    const rows = [['v'], ['1.5'], [''], ['-2'], ['3e10']];
    expect(numericCols(rows).has(0)).toBe(true);
  });
});

describe('sortDSVRows', () => {
  const rows = [['beta', '7'], ['alpha', '41'], ['gamma', '113']];
  it('sorts strings ascending', () => {
    expect(sortDSVRows(rows, 0, 'asc', false).map(r => r[0])).toEqual(['alpha', 'beta', 'gamma']);
  });
  it('sorts numbers numerically, not lexically', () => {
    expect(sortDSVRows(rows, 1, 'asc', true).map(r => r[1])).toEqual(['7', '41', '113']);
  });
  it('descends when asked', () => {
    expect(sortDSVRows(rows, 1, 'desc', true).map(r => r[1])).toEqual(['113', '41', '7']);
  });
});

describe('renderDSVTable', () => {
  it('renders header and escaped cells', () => {
    const html = renderDSVTable(['a<b'], [['<script>']], new Set());
    expect(html).toContain('a&lt;b');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
  it('notes truncation past the row cap', () => {
    const rows = Array.from({ length: RENDER_CAPS.tableRows + 10 }, () => ['x']);
    const html = renderDSVTable(['h'], rows, new Set());
    expect(html).toContain('Showing first');
  });
});

describe('highlightCode', () => {
  it('highlights shell comments, strings, and variables', () => {
    const html = highlightCode('# note\necho "hi" $USER', 'sh');
    expect(html).toContain('<span class="tok-cmt"># note</span>');
    expect(html).toContain('tok-str');
    expect(html).toContain('<span class="tok-var">$USER</span>');
    expect(html).toContain('<span class="tok-kw">echo</span>');
  });

  it('does not treat # inside a shell string as a comment', () => {
    const html = highlightCode('echo "a # b"', 'sh');
    expect(html).not.toContain('tok-cmt');
  });

  it('highlights js keywords and template literals across lines', () => {
    const html = highlightCode('const x = `a\nb`;', 'ts');
    expect(html).toContain('<span class="tok-kw">const</span>');
    expect(html).toContain('tok-str');
  });

  it('escapes HTML in all output paths', () => {
    const html = highlightCode('echo "<b>" # <i>', 'sh');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<i>');
  });

  it('returns escaped plain text for unknown extensions', () => {
    expect(highlightCode('<hello>', 'xyz')).toBe('&lt;hello&gt;');
  });
});

describe('renderCode', () => {
  it('renders a line-number gutter matching the line count', () => {
    const html = renderCode('a\nb\nc', 'txt');
    expect(html).toContain('>1\n2\n3</pre>');
  });
  it('notes truncation past the char cap', () => {
    const html = renderCode('x'.repeat(RENDER_CAPS.codeChars + 1), 'txt');
    expect(html).toContain('Showing first');
  });
});

describe('sniffBinary', () => {
  it('flags NUL bytes', () => {
    expect(sniffBinary('PK\u0000\u0003binarystuff')).toBe(true);
  });
  it('passes normal text including tabs and newlines', () => {
    expect(sniffBinary('hello\tworld\nline two\r\n')).toBe(false);
  });
  it('passes empty input', () => {
    expect(sniffBinary('')).toBe(false);
  });
});

describe('renderJsonl', () => {
  it('renders one collapsible line per JSON record', () => {
    const html = renderJsonl('{"a":1}\n{"b":2}\n');
    expect(html.match(/class="fe-jl-line"/g)?.length).toBe(2);
    expect(html).toContain('fe-jl-prev');
  });
  it('marks malformed lines instead of failing', () => {
    const html = renderJsonl('{"ok":true}\nnot-json-at-all\n');
    expect(html).toContain('not JSON');
    expect(html).toContain('not-json-at-all');
  });
  it('skips blank lines', () => {
    const html = renderJsonl('{"a":1}\n\n\n{"b":2}\n');
    expect(html.match(/class="fe-jl-line"/g)?.length).toBe(2);
  });
  it('notes truncation past the line cap', () => {
    const text = Array.from({ length: RENDER_CAPS.jsonlLines + 5 }, () => '{"x":1}').join('\n');
    expect(renderJsonl(text)).toContain('Showing first');
  });
});

describe('mdInline', () => {
  it('formats bold, italic, code spans, strikethrough', () => {
    const html = mdInline('**b** and *i* and `c` and ~~s~~');
    expect(html).toContain('<strong>b</strong>');
    expect(html).toContain('<em>i</em>');
    expect(html).toContain('<code>c</code>');
    expect(html).toContain('<del>s</del>');
  });
  it('renders links and blocks javascript: URLs', () => {
    const ok = mdInline('[ok](https://x.dev)');
    expect(ok).toContain('<a href="https://x.dev"');
    expect(ok).toContain('target="_blank"');
    expect(mdInline('[rel](./other.md)')).not.toContain('target=');   // relative stays in-tab
    const evil = mdInline('[bad](javascript:alert(1))');
    expect(evil).not.toContain('<a');
    expect(evil).toContain('bad');
  });
  it('escapes HTML before formatting', () => {
    expect(mdInline('<script> **x**')).not.toContain('<script>');
  });
});

describe('renderMarkdown', () => {
  it('renders headings by level', () => {
    const html = renderMarkdown('# One\n\n### Three');
    expect(html).toContain('<h1>One</h1>');
    expect(html).toContain('<h3>Three</h3>');
  });
  it('joins consecutive lines into one paragraph, splits on blanks', () => {
    const html = renderMarkdown('line a\nline b\n\nline c');
    expect(html.match(/<p>/g)?.length).toBe(2);
    expect(html).toContain('<p>line a line b</p>');
  });
  it('highlights fenced code blocks by language', () => {
    const html = renderMarkdown('```sh\necho "hi"\n```');
    expect(html).toContain('fe-md-pre');
    expect(html).toContain('tok-kw');
  });
  it('renders unordered and ordered lists', () => {
    expect(renderMarkdown('- a\n- b')).toContain('<ul><li');
    expect(renderMarkdown('1. a\n2. b')).toContain('<ol><li');
  });
  it('renders GFM tables', () => {
    const html = renderMarkdown('| h1 | h2 |\n|---|---|\n| a | b |');
    expect(html).toContain('<th>h1</th>');
    expect(html).toContain('<td>b</td>');
  });
  it('renders blockquotes and hr', () => {
    expect(renderMarkdown('> quoted')).toContain('<blockquote>');
    expect(renderMarkdown('above\n\n---\n\nbelow')).toContain('<hr>');
  });
  it('renders whitelisted raw HTML blocks instead of escaping them', () => {
    const html = renderMarkdown('<div align="center">\n<img src="logo.svg" width="320">\n<strong>Tagline</strong>\n</div>');
    expect(html).toContain('<div align="center">');
    expect(html).toContain('<img src="logo.svg" width="320">');
    expect(html).toContain('<strong>Tagline</strong>');
  });
  it('strips dangerous HTML even inside raw blocks', () => {
    expect(renderMarkdown('<img src=x onerror=alert(1)>')).not.toContain('onerror');
  });
});

describe('sanitizeHtml', () => {
  it('keeps whitelisted tags and attributes', () => {
    const out = sanitizeHtml('<div align="center"><a href="https://x.dev"><img src="b.svg" alt="b"></a></div>');
    expect(out).toContain('<div align="center">');
    expect(out).toContain('<img src="b.svg" alt="b">');
    expect(out).toContain('target="_blank"');
  });
  it('drops scripts and event handlers, unwraps unknown tags', () => {
    expect(sanitizeHtml('<script>alert(1)</script>')).not.toContain('script');
    expect(sanitizeHtml('<img src="x.png" onerror="alert(1)">')).not.toContain('onerror');
    expect(sanitizeHtml('<marquee>hi</marquee>')).toBe('hi');
  });
  it('blocks javascript: URLs in src and href', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('href');
  });
});

describe('renderJsonTree', () => {
  it('renders object keys and typed leaves', () => {
    const html = renderJsonTree('{"name":"x","n":42,"ok":true,"nil":null}');
    expect(html).toContain('fe-jt-key');
    expect(html).toContain('<span class="tok-num">42</span>');
    expect(html).toContain('<span class="tok-kw">true</span>');
    expect(html).toContain('<span class="tok-kw">null</span>');
  });
  it('reports invalid JSON with a raw fallback', () => {
    const html = renderJsonTree('{nope');
    expect(html).toContain('Invalid JSON');
    expect(html).toContain('{nope');
  });
  it('escapes string values', () => {
    const html = renderJsonTree('{"x":"<script>"}');
    expect(html).not.toContain('<script>');
  });
});
