import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/renderers';

const lines = (html: string) => [...html.matchAll(/<([a-z0-9]+)[^>]* data-sl="(\d+)-(\d+)"/g)].map(m => `${m[1]}:${m[2]}-${m[3]}`);

describe('source lines on rendered blocks', () => {
  it('marks each top-level block with the lines it came from', () => {
    const src = '# Title\n\nFirst para\nstill first.\n\n- one\n- two\n\n```js\nx\n```\n\n> quote\n\n---\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nlast';
    expect(lines(renderMarkdown(src))).toEqual(['h1:1-1', 'p:3-4', 'ul:6-7', 'div:9-11', 'blockquote:13-13', 'hr:15-15', 'div:17-19', 'p:21-21']);
  });
  it('a block right after a paragraph does not re-mark the paragraph', () => {
    const html = renderMarkdown('para line\n# Heading');
    expect(lines(html)).toEqual(['p:1-1', 'h1:2-2']);
    expect(html.match(/data-sl/g)!.length).toBe(2);
  });
  it('counts lines in the file, footnote definitions included', () => {
    const html = renderMarkdown('Text[^1].\n\n[^1]: the note\n\nAfter.');
    expect(lines(html)).toEqual(['p:1-1', 'p:5-5']);
  });
  it('front matter shifts the numbering correctly', () => {
    expect(lines(renderMarkdown('---\ntitle: x\n---\n# H\n\nbody'))).toEqual(['h1:4-4', 'p:6-6']);
  });
  it('nested blocks are not marked', () => {
    const html = renderMarkdown('- item\n  - nested\n\n> a\n> > b');
    expect(lines(html)).toEqual(['ul:1-2', 'blockquote:4-5']);
  });
});
