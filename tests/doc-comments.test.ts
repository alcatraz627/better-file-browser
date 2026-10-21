import { describe, it, expect } from 'vitest';
import { commentedDocs, openThreads } from '../src/doc-comments';
import type { Entry } from '../src/types';

const file = (name: string): Entry => ({ name, href: 'file:///d/' + encodeURIComponent(name), isDir: false, isParent: false, isHidden: false, rawBytes: 1, dateMs: NaN, dateStr: '' });

describe('openThreads', () => {
  it('counts threads that are neither done nor deleted', () => {
    const text = JSON.stringify({ comments: { threads: [{ status: 'open' }, { status: 'done' }, { status: 'open', deleted: true }, {}] } });
    expect(openThreads(text)).toBe(2);
  });
  it('reads a broken or empty companion as no comments', () => {
    expect(openThreads('{oops')).toBe(0);
    expect(openThreads('')).toBe(0);
    expect(openThreads('{}')).toBe(0);
  });
});

describe('commentedDocs', () => {
  it('pairs a companion with the document beside it, and skips a stranded one', () => {
    const got = commentedDocs([file('plan.md'), file('plan.md.bfb.json'), file('gone.md.bfb.json'), file('data.json')]);
    expect(got.map(d => d.doc)).toEqual(['plan.md']);
  });
});
