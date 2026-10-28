import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { summarizeRepo, sortRepos, openPages, homeStats, lastSevenDays, splitByAge, type RepoSummary } from '../src/home-model';
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
  it('counts what the owner acts on, with seven days of questions and places', () => {
    const now = new Date('2026-10-27T15:00:00').getTime();
    const day = 86400_000;
    const chats = [
      { chat: { turns: [{ at: now - day }, { at: now - 10 * day }] } },
      { chat: { turns: [{ at: now - 2 * day }, { at: now - 3600_000 }] } },
    ];
    const recents = [{ ts: now - 3600_000 }, { ts: now - 7200_000 }, { ts: now - 2 * day }];
    const saved = [{ tags: ['work', 'code'] }, { tags: ['work'] }];
    const notes = [{ mtime: (now - day) / 1000 }, { mtime: now - 20 * day }];
    const s = homeStats({ waiting: 3, asks: 4, askRepos: 2, chats, recents, saved, notes }, now);
    expect(s.map(x => [x.id, x.value, x.sub, x.hot ?? false])).toEqual([
      ['waiting', '3', 'pages to answer', true],
      ['asks', '4', 'in 2 repos', true],
      ['asked', '3', 'this week', false],
      ['opened', '2', 'today', false],
      ['saved', '2', '2 tags', false],
      ['notes', '2', '1 changed this week', false],
    ]);
    expect(s.find(x => x.id === 'asked')?.series).toEqual([0, 0, 0, 0, 1, 1, 1]);
    expect(s.find(x => x.id === 'opened')?.series).toEqual([0, 0, 0, 0, 1, 0, 2]);
  });
  it('says so plainly when nothing waits and nothing is kept', () => {
    const s = homeStats({ waiting: 0, asks: 0, askRepos: 0, chats: [], recents: [], saved: [], notes: [] });
    expect(s.map(x => [x.id, x.sub, x.hot ?? false])).toEqual([
      ['waiting', 'nothing to answer', false], ['asks', 'no repo needs you', false], ['asked', 'this week', false],
      ['opened', 'today', false], ['saved', 'no tags yet', false], ['notes', '0 changed this week', false],
    ]);
  });
  it('splits times into the last seven local days, today last', () => {
    const now = new Date('2026-10-27T15:00:00').getTime();
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    expect(lastSevenDays([now, d.getTime(), d.getTime() - 1, d.getTime() - 6 * 86400_000, d.getTime() - 7 * 86400_000], now)).toEqual([1, 0, 0, 0, 0, 1, 2]);
  });
  it('lists waiting pages from the last two weeks and only counts older ones', () => {
    const now = Date.UTC(2026, 9, 28);
    const at = (days: number) => ({ mtime: now / 1000 - days * 86400 });
    const { recent, older } = splitByAge([at(1), at(13.9), at(14.1), at(40)], 14, now);
    expect([recent.length, older.length]).toEqual([2, 2]);
  });
  it('keeps open decision pages, waiting first, and leaves archived ones out', () => {
    const p = (slug: string, state: DpRow['state'], mtime: number): DpRow => ({ slug, path: '/' + slug, state, mtime });
    const rows = [p('done', 'answered', 9), p('stale', 'never', 8), p('wait', 'waiting', 1), p('handled', 'cleared', 7), p('mine', 'waiting', 2)];
    expect(openPages(rows, new Set(['mine'])).map(r => r.slug)).toEqual(['wait', 'stale']);
  });
});
