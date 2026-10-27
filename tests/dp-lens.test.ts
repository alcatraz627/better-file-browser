import { describe, it, expect } from 'vitest';
import { dpBands, ago, type DpRow } from '../src/dp-lens';

const row = (slug: string, state: DpRow['state'], mtime: number, extra: Partial<DpRow> = {}): DpRow => ({ slug, path: '/r/' + slug, state, mtime, title: slug, ...extra });

describe('Decisions lens', () => {
  const rows = [row('old-wait', 'waiting', 10), row('new-wait', 'waiting', 30), row('done', 'answered', 20), row('stale', 'never', 5), row('x', 'broken', 1)];
  it('bands waiting, never, broken, then Archived last, newest first inside a band', () => {
    expect(dpBands(rows).map(b => [b.state, b.rows.map(r => r.slug)])).toEqual([
      ['waiting', ['new-wait', 'old-wait']], ['never', ['stale']], ['broken', ['x']], ['archived', ['done']],
    ]);
  });
  it('files answered, agent-cleared and hand-archived pages under Archived', () => {
    const more = [...rows, row('handled', 'cleared', 25)];
    const b = dpBands(more, '', new Set(['old-wait']));
    expect(b.find(x => x.state === 'archived')?.rows.map(r => r.slug)).toEqual(['handled', 'done', 'old-wait']);
    expect(b.find(x => x.state === 'waiting')?.rows.map(r => r.slug)).toEqual(['new-wait']);
  });
  it('puts a live agent first and a gone one last inside a band, newest first otherwise', () => {
    const w = [row('a', 'waiting', 50, { reach: 'absent' }), row('b', 'waiting', 40), row('c', 'waiting', 10, { reach: 'hot' }), row('d', 'waiting', 30, { reach: 'cold' }), row('e', 'waiting', 20, { reach: 'unknown' })];
    expect(dpBands(w)[0].rows.map(r => r.slug)).toEqual(['c', 'b', 'd', 'e', 'a']);
  });
  it('filters by title, name, project or topic and drops empty bands', () => {
    const tagged = [...rows, row('p', 'answered', 1, { title: 'Other', origin: { project: 'bfb' } })];
    expect(dpBands(tagged, 'BFB').map(b => b.rows.map(r => r.slug))).toEqual([['p']]);
    expect(dpBands(rows, 'nothing')).toEqual([]);
  });
  it('says how long ago in plain words', () => {
    const now = 1_000_000;
    expect(ago(now - 10, now)).toBe('just now');
    expect(ago(now - 300, now)).toBe('5 min');
    expect(ago(now - 3 * 3600, now)).toBe('3 h');
    expect(ago(now - 2 * 86400, now)).toBe('2 d');
    expect(ago(now - 42 * 86400, now)).toBe('6 w');
  });
});
