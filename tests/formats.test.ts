import { describe, it, expect } from 'vitest';
import { diagnose, formatFor, FORMATS } from '../src/formats';

describe('formatFor', () => {
  it('maps each extension to its format and leaves code alone', () => {
    expect(formatFor('MD')?.id).toBe('markdown');
    expect(formatFor('yml')?.id).toBe('yaml');
    expect(formatFor('ndjson')?.id).toBe('jsonl');
    expect(formatFor('htm')?.id).toBe('html');
    expect(formatFor('ts')).toBeNull();
  });
});

describe('JSON', () => {
  it('passes valid JSON', () => expect(diagnose('json', '{"a": [1, 2]}')).toEqual([]));
  it('places a syntax error on its line', () => {
    const d = diagnose('json', '{\n  "a": 1,\n  "b": }\n');
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ line: 3, severity: 'error' });
  });
  it('treats comments and trailing commas as a warning, not an error', () => {
    const d = diagnose('json', '{\n  // compiler\n  "strict": true,\n}\n');
    expect(d).toHaveLength(1);
    expect(d[0].severity).toBe('warn');
  });
  it('flags each bad JSON Lines record on its own line', () => {
    const d = diagnose('jsonl', '{"a":1}\n\nnope\n{"b":2}\n');
    expect(d.map(x => x.line)).toEqual([3]);
  });
});

describe('YAML', () => {
  it('passes valid YAML, several documents included', () => expect(diagnose('yaml', 'a: 1\nb:\n  - x\n---\nc: 2\n')).toEqual([]));
  it('reports a duplicate key on its line', () => {
    const d = diagnose('yaml', 'name: a\nage: 3\nname: b\n');
    expect(d.some(x => x.line === 3 && x.severity === 'error')).toBe(true);
  });
  it('reports a tab indent', () => {
    const d = diagnose('yaml', 'a:\n\tb: 1\n');
    expect(d.some(x => x.line === 2 && x.severity === 'error')).toBe(true);
  });
  it('still draws a tree for a file with a mistake', () => {
    const html = formatFor('yaml')!.rich('a: 1\nb: [1, 2\nc: 3\n', '');
    expect(html).toContain('fe-jt');
  });
});

describe('Markdown', () => {
  it('passes a tidy note', () => expect(diagnose('md', '---\ntitle: x\n---\n# A\n\n## B\n\n```js\nx\n```\n')).toEqual([]));
  it('reports unclosed front matter, a bad front matter key and an open code block', () => {
    expect(diagnose('md', '---\ntitle: x\n# A\n')[0]).toMatchObject({ line: 1, severity: 'error' });
    // A front matter problem is a warning: the box still shows what parsed.
    expect(diagnose('md', '---\na: 1\na: 2\n---\nbody\n')[0]).toMatchObject({ line: 3, severity: 'warn' });
    expect(diagnose('md', '# A\n\n```\ncode\n')[0]).toMatchObject({ line: 3, severity: 'warn' });
  });
  it('warns when a heading skips a level, but not inside code', () => {
    expect(diagnose('md', '# A\n### C\n')[0]).toMatchObject({ line: 2, severity: 'warn' });
    expect(diagnose('md', '# A\n```\n### not a heading\n```\n')).toEqual([]);
  });
});

describe('HTML', () => {
  it('passes a page with void and optional-close tags', () => {
    expect(diagnose('html', '<html><body><p>one<p>two<br><img src=a.png><ul><li>x</ul></body></html>')).toEqual([]);
  });
  it('reports a stray closing tag and an unclosed div', () => {
    const d = diagnose('html', '<div>\n<span>a</div>\n</em>\n<section>\n');
    expect(d.some(x => x.severity === 'error' && /<\/em>/.test(x.message) && x.line === 3)).toBe(true);
    expect(d.some(x => x.severity === 'warn' && /<span>/.test(x.message))).toBe(true);
    expect(d.some(x => /<section> is never closed/.test(x.message) && x.line === 4)).toBe(true);
  });
  it('ignores tags inside scripts and comments', () => {
    expect(diagnose('html', '<script>if (a < b) { x = "</div>" }</script><!-- <div> -->')).toEqual([]);
  });
  it('renders the page in a frame that runs no scripts', () => {
    const html = formatFor('html')!.rich('<p>hi</p>', 'file:///tmp/a.html');
    expect(html).toContain('sandbox="allow-same-origin"');
    expect(html).not.toContain('allow-scripts');
  });
});

describe('every rich view', () => {
  it('survives garbage without throwing', () => {
    for (const f of FORMATS) expect(() => f.rich('{{{ <<<\n\t: ]]] ```', '')).not.toThrow();
  });
});
