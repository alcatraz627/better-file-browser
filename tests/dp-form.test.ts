import { describe, it, expect } from 'vitest';
import { draftedState, restoreState, flagOf, progress, stateKey } from '../src/dp-form';
import { parseDpConfig, originChips } from '../src/dp-page';
import type { DpConfig } from '../src/dp-page';

const cfg: DpConfig = {
  title: 'T', storageKey: 'k',
  decisions: [
    { id: 'D1', question: 'q1', options: [{ code: 'a', label: 'A' }, { code: 'b', label: 'B', rec: true }] },
    { id: 'D2', question: 'q2', note: 'why?', none: true, options: [{ code: 'a', label: 'A', rec: true }] },
  ],
  sections: [{ id: 's1', title: 'S', note: 'seed' }],
};

describe('decision page answers', () => {
  it('drafts the recommended pick, agreement and seeded notes', () => {
    expect(draftedState(cfg)).toEqual({ picks: { D1: 'b', D2: 'a' }, agree: { s1: true }, notes: { D2: 'why?', s1: 'seed' }, endNotes: '' });
  });
  it('a changed pick or agree is changed; an edited note is noted; a seeded note left alone is neither', () => {
    const s = draftedState(cfg);
    expect(flagOf(cfg, s, 'D2')).toBeNull();
    s.picks.D1 = 'a'; s.agree.s1 = false; s.notes.D2 = 'my own reason';
    expect(flagOf(cfg, s, 'D1')).toBe('changed');
    expect(flagOf(cfg, s, 's1')).toBe('changed');
    expect(flagOf(cfg, s, 'D2')).toBe('noted');
    expect(progress(cfg, s)).toEqual({ items: 3, flagged: 3, asDrafted: false });
  });
  it('end notes alone mean the page is not as drafted', () => {
    const s = draftedState(cfg); s.endNotes = 'hi';
    expect(progress(cfg, s)).toEqual({ items: 3, flagged: 0, asDrafted: false });
    expect(progress(cfg, draftedState(cfg)).asDrafted).toBe(true);
  });
  it('restores saved answers the config still has, including None of these, and drops the rest', () => {
    const s = restoreState(cfg, { picks: { D1: 'a', D2: 'z', Gone: 'x' }, agree: { s1: false }, notes: { D1: 'n', Gone: 'x' }, endNotes: 'e' });
    expect(s.picks).toEqual({ D1: 'a', D2: 'z' });
    expect(s.agree).toEqual({ s1: false });
    expect(s.notes).toEqual({ D1: 'n', D2: 'why?', s1: 'seed' });
    expect(s.endNotes).toBe('e');
    expect(restoreState(cfg, { picks: { D1: 'q' } }).picks.D1).toBe('b');
  });
  it('keeps answers by storage key, else by title', () => {
    expect(stateKey(cfg)).toBe('bfb-dp-answers:k');
    expect(stateKey({ title: 'Only title' })).toBe('bfb-dp-answers:Only title');
  });
  it('knows a decision page config from any other config.json', () => {
    expect(parseDpConfig('{"sections":[]}')).not.toBeNull();
    expect(parseDpConfig('{"name":"x"}')).toBeNull();
    expect(parseDpConfig('not json')).toBeNull();
    expect(originChips({ topic: 't', created: '2026' }).map(c => c.label)).toEqual(['Topic', 'Asked']);
  });
});
