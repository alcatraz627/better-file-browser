import { describe, it, expect } from 'vitest';
import { mergeMarks, markRows } from '../src/site-marks-store';

const m = (id: string, updated = 1, note = '') => ({ id, updated, note });
const ids = (list: { id: string }[]) => list.map(x => x.id);

describe('two tabs on one page keep each other\'s marks', () => {
  it('keeps a mark the other tab added while this tab adds its own', () => {
    // Both tabs loaded [m1]. The other saved [m1, m2]; this tab now holds [m1, m3].
    const out = mergeMarks([m('m1'), m('m2')], [m('m1'), m('m3')], new Set(['m1']), new Set());
    expect(ids(out)).toEqual(['m1', 'm3', 'm2']);
  });
  it('drops a mark the other tab deleted', () => {
    const out = mergeMarks([m('m1')], [m('m1'), m('m2')], new Set(['m1', 'm2']), new Set());
    expect(ids(out)).toEqual(['m1']);
  });
  it('does not bring back a mark this tab deleted', () => {
    const out = mergeMarks([m('m1'), m('m2')], [m('m1')], new Set(['m1', 'm2']), new Set(['m2']));
    expect(ids(out)).toEqual(['m1']);
  });
  it('takes the later edit of a mark both tabs hold, on this tab\'s own object', () => {
    const mine = m('m1', 5, 'old');
    const out = mergeMarks([m('m1', 9, 'new')], [mine], new Set(['m1']), new Set());
    expect(out[0]).toBe(mine);
    expect(out[0].note).toBe('new');
    expect(mergeMarks([m('m1', 2, 'older')], [m('m1', 5, 'mine')], new Set(['m1']), new Set())[0].note).toBe('mine');
  });
  it('leaves out rows that are not marks', () => {
    expect(ids(markRows([null, 5, { id: 1 }, { id: 'a' }, { id: 'ok', updated: 3 }]))).toEqual(['ok']);
    expect(markRows('nope')).toEqual([]);
  });
});
