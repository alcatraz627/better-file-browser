import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { summarizeRepo, sortRepos, openPages, type RepoSummary } from '../src/home-model';
import type { DpRow } from '../src/dp-lens';

const doc = (name: string, mtime = 1) => ({ path: `/r/${name}`, repo: name.replace('.md', ''), mtime, text: readFileSync(join(__dirname, 'fixtures/directions', name), 'utf8') });

describe('Home', () => {
  it('counts what waits on the owner and what is ready the way the doc head does', () => {
    const s = summarizeRepo(doc('standard.md'), new Date('2026-10-27T12:00:00'));
    expect([s.onYou, s.ready, s.staleDays]).toEqual([3, 3, 7]);
    const b = summarizeRepo(doc('buckets.md'));
    expect(b.onYou).toBe(1);
  });
  it('lists repos with asks on the owner first, most asks first, then newest', () => {
    const r = (repo: string, onYou: number, mtime: number): RepoSummary => ({ path: repo, repo, mtime, onYou, ready: 0, staleDays: null });
    expect(sortRepos([r('quiet-new', 0, 9), r('one', 1, 1), r('quiet-old', 0, 2), r('two', 2, 0)]).map(x => x.repo))
      .toEqual(['two', 'one', 'quiet-new', 'quiet-old']);
  });
  it('keeps open decision pages, waiting first, and leaves archived ones out', () => {
    const p = (slug: string, state: DpRow['state'], mtime: number): DpRow => ({ slug, path: '/' + slug, state, mtime });
    const rows = [p('done', 'answered', 9), p('stale', 'never', 8), p('wait', 'waiting', 1), p('handled', 'cleared', 7), p('mine', 'waiting', 2)];
    expect(openPages(rows, new Set(['mine'])).map(r => r.slug)).toEqual(['wait', 'stale']);
  });
});
