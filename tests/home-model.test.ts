import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { summarizeRepo, sortRepos, openPages, usageStats, type RepoSummary } from '../src/home-model';
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
  it('counts usage facts from chats, places and answered pages', () => {
    const now = new Date('2026-10-27T15:00:00').getTime();
    const day = 86400_000;
    const chats = [
      { subject: '/a/plan.md', chat: { at: now, turns: [{ at: now - day }, { at: now - 10 * day }] } },
      { subject: '/a/plan.md', chat: { at: now, turns: [{ at: now - 2 * day }] } },
      { subject: '/b/', chat: { at: now, turns: [{ at: now - 30 * day }] } },
    ];
    const recents = [{ path: '/x/', ts: now - 3600_000 }, { path: '/y/', ts: now - 2 * day }];
    const saved = [{ path: '/s/', tags: ['work', 'code'] }, { path: '/t/', tags: ['work'] }];
    const pages = [{ answered: (now - day) / 1000 }, { answered: (now - 20 * day) / 1000 }, { answered: null }];
    expect(usageStats(chats, recents, saved, pages, now).map(s => [s.label, s.value, s.sub])).toEqual([
      ['questions asked', '4', '2 this week'],
      ['chats', '3', 'about 2 things'],
      ['decisions answered', '2', '1 this week'],
      ['places opened lately', '2', '1 today'],
      ['places saved', '2', '2 tags'],
      ['asked about most', 'plan.md', '3 questions'],
    ]);
  });
  it('says so plainly when nothing has been used yet', () => {
    const s = usageStats([], [], [], []);
    expect(s.find(x => x.label === 'asked about most')).toEqual({ label: 'asked about most', value: 'nothing yet', sub: 'ask about any file' });
    expect(s.find(x => x.label === 'places saved')?.sub).toBe('no tags yet');
  });
  it('keeps open decision pages, waiting first, and leaves archived ones out', () => {
    const p = (slug: string, state: DpRow['state'], mtime: number): DpRow => ({ slug, path: '/' + slug, state, mtime });
    const rows = [p('done', 'answered', 9), p('stale', 'never', 8), p('wait', 'waiting', 1), p('handled', 'cleared', 7), p('mine', 'waiting', 2)];
    expect(openPages(rows, new Set(['mine'])).map(r => r.slug)).toEqual(['wait', 'stale']);
  });
});
