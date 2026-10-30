import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderMarkdown } from '../src/renderers';
import { readDirections } from '../src/directions-model';
import { nextHead, nextHeadHtml, staleHtml } from '../src/directions-head';

const model = (name: string) => {
  const root = document.createElement('div');
  root.innerHTML = renderMarkdown(readFileSync(join(__dirname, 'fixtures/directions', name), 'utf8'));
  return readDirections(root);
};

describe('what to do next', () => {
  it('puts the Waiting-on-you asks first, then other rows that need the owner', () => {
    const h = nextHead(model('standard.md'), new Date('2026-10-21T12:00:00'));
    expect(h.you.map(r => r.id)).toEqual(['W1', 'W2', 'A1']);
  });
  it('orders ready rows now before next, keeping doc order within', () => {
    const h = nextHead(model('standard.md'), new Date('2026-10-21T12:00:00'));
    expect(h.ready.map(r => r.id)).toEqual(['S2', 'A3', 'S3']);
  });
  it('calls a doc stale only after three days', () => {
    const m = model('standard.md');
    expect(nextHead(m, new Date('2026-10-22T12:00:00')).staleDays).toBeNull();
    expect(nextHead(m, new Date('2026-10-27T12:00:00')).staleDays).toBe(7);
  });
  it('builds On you from red rows when the doc has no Waiting section', () => {
    const h = nextHead(model('buckets.md'));
    expect(h.you.map(r => r.id || r.text)).toEqual(['H1']);
    expect(h.staleDays).toBeNull();
  });
  it('shows what is needed and what happens on silence, and says so when nothing waits', () => {
    const m = model('standard.md');
    const html = nextHeadHtml(m, nextHead(m, new Date('2026-10-27T12:00:00')));
    expect(html).toContain('A yes on model B, or another model');
    expect(html).toContain('If you say nothing: I order model B on Friday');
    // Staleness reads in the state bar, beside the chips, rather than in the head.
    expect(html).not.toContain('days ago');
    expect(staleHtml(nextHead(m, new Date('2026-10-27T12:00:00')))).toContain('updated 7 days ago');
    const empty = nextHeadHtml(m, { you: [], ready: [], staleDays: null, waiting: 0 });
    expect(empty).toContain('Nothing waits on you.');
  });
});
