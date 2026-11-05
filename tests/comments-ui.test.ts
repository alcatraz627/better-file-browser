import { commentHtml } from '../src/comments-ui';
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { forOwner } from '../src/comments-ui';
import { visibleOf } from '../src/comment-anchor';
import type { DocThread } from '../src/notes';

describe('visibleOf', () => {
  it.each([
    ['ship on **Friday** after the [smoke run](notes.txt)', 'ship on Friday after the smoke run'],
    ['## Risks', 'Risks'],
    ['- [x] done item', 'done item'],
    ['> quoted *words* here', 'quoted words here'],
    ['use `npm test` now', 'use npm test now'],
    ['line one\nline two', 'line one line two'],
    ['snake_case_name stays', 'snake_case_name stays'],
    ['a note[^1] here', 'a note here'],
  ])('%j reads as %j', (src, want) => expect(visibleOf(src)).toBe(want));
});

const thread = (authors: ('human' | 'agent')[], texts: string[] = [], status: 'open' | 'done' = 'open'): DocThread => ({
  id: 't', status, created: '', anchor: { exact: 'x', line: 1, offset: 0 }, place: { state: 'anchored', offset: 0, length: 1, line: 1 },
  comments: authors.map((k, i) => ({ id: `c${i}`, author: k === 'human' ? { kind: 'human' } : { kind: 'agent', alias: 'bfb' }, created: '', text: texts[i] ?? '' })),
});

describe('forOwner', () => {
  it('waits on the owner when an agent spoke last', () => expect(forOwner(thread(['human', 'agent']))).toBe(true));
  it('not when the owner spoke last', () => expect(forOwner(thread(['agent', 'human']))).toBe(false));
  it('never for a done thread', () => expect(forOwner(thread(['agent'], [], 'done'))).toBe(false));
});

describe('a comment that holds a tag', () => {
  it('shows the tag as typed and draws nothing', () => {
    const html = commentHtml('look <img src="http://remote.example/x.png"> and <b>this</b>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;img');
  });
  it('holds in a list line too, and keeps Markdown working', () => {
    const html = commentHtml('- <script>x</script> **bold**');
    expect(html).not.toContain('<script');
    expect(html).toContain('<strong>bold</strong>');
  });
});
