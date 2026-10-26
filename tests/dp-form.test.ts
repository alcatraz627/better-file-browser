import { describe, it, expect } from 'vitest';
import { draftedState, restoreState, flagOf, progress, stateKey, toGcc, fromGcc, fallbackAnswer, sentSummary } from '../src/dp-form';
import { parseDpConfig, originFacts } from '../src/dp-page';
import type { DpConfig } from '../src/dp-page';
import { isLaidOut } from '../src/dp-cards';
import { mediaOf, marksOf } from '../src/docview-media';

describe('marks on a picture', () => {
  it('keeps boxes that lie inside the picture, with their labels', () => {
    expect(marksOf([{ x: 0.1, y: 0.2, w: 0.3, h: 0.4, label: 'here' }, { x: 0.9, y: 0, w: 0.5, h: 0.1 }, { x: -1, y: 0, w: 0.1, h: 0.1 }, null, 'x']))
      .toEqual([{ x: 0.1, y: 0.2, w: 0.3, h: 0.4, label: 'here' }]);
    expect(marksOf('not a list')).toEqual([]);
  });
  it('reads a path or a path with marks, and never marks a mock page', () => {
    expect(mediaOf('file:///p/', 'a.png')).toEqual({ src: 'file:///p/a.png', name: 'a.png', kind: 'img' });
    expect(mediaOf('file:///p/', { src: 'a.png', marks: [{ x: 0, y: 0, w: 1, h: 1 }] })?.marks).toHaveLength(1);
    expect(mediaOf('file:///p/', { src: 'm.html', marks: [{ x: 0, y: 0, w: 1, h: 1 }] })?.marks).toBeUndefined();
    expect(mediaOf('file:///p/', { src: '../x.png' })).toBeNull();
  });
});

describe('preformatted text on a decision page', () => {
  it('keeps terminal renders and boxed tables verbatim, and renders messages', () => {
    expect(isLaidOut('TASKS  3 goals\n  scope    every goal')).toBe(true);
    expect(isLaidOut('┌ TASKS ─┐\n│ row │')).toBe(true);
    expect(isLaidOut('> Replying to "/claude-bot sync"\n\n**Done.** See [the PR](https://x).')).toBe(false);
    expect(isLaidOut('🦞 Something tripped before I answered. Ask again.')).toBe(false);
  });
});

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
    expect(originFacts({ topic: 't', project: 'p', created: '2026' }).map(c => c.label)).toEqual(['Project', 'Asked']);
    expect(originFacts({ board: 'b', card: 'c1' }).map(c => c.label)).toEqual([]);
    expect(originFacts({ card: 'c1' }).map(c => c.value)).toEqual(['card c1']);
    const now = Date.parse('2026-10-26T12:00:00Z');
    expect(originFacts({ created: '2026-10-23T12:00:00Z' }, now)[0].value).toBe('asked 3 d ago');
    expect(originFacts({ created: 'last week' }, now)[0].value).toBe('asked last week');
  });
});

describe('answers in gcc\'s shape', () => {
  const cfg: DpConfig = {
    decisions: [{ id: 'D1', question: 'Q', options: [{ code: 'a', label: 'Alpha', rec: true }, { code: 'b', label: 'Beta' }] },
      { id: 'D2', question: 'R', none: true, noneLabel: 'Neither', options: [{ code: 'a', label: 'One', rec: true }] }],
    sections: [{ id: 's1', title: 'Layout' }, { id: 's2' }],
  };
  it('maps both ways without losing a pick, an agree or a note', () => {
    const s = { picks: { D1: 'b', D2: 'z' }, agree: { s1: false, s2: true }, notes: { D1: 'why b', s1: 'too dense' }, endNotes: 'thanks' };
    const g = toGcc(cfg, s);
    expect(g).toEqual({ d: { D1: 'b', D2: 'z' }, dnotes: { D1: 'why b', D2: '' }, screens: { s1: { agree: false, note: 'too dense' }, s2: { agree: true, note: '' } }, endnotes: 'thanks' });
    expect(fromGcc(cfg, g)).toEqual({ ...s, notes: { D1: 'why b', D2: '', s1: 'too dense', s2: '' } });
  });
  it('drops a pick the config does not offer when reading gcc back', () => {
    expect(fromGcc(cfg, { d: { D1: 'q' } }).picks.D1).toBe('a');
  });
  it('writes the picks line and an uncomposed notes block when gcc is down', () => {
    const s = { picks: { D1: 'b', D2: 'a' }, agree: { s1: false, s2: true }, notes: { D1: 'why b', s2: 'ok but' }, endNotes: 'end' };
    expect(fallbackAnswer(cfg, s)).toBe('D1b D2a\nnotes (not composed, host down):\nD1: why b\ns1: DISAGREE\ns2: agree (ok but)\nnotes:\nend');
    expect(fallbackAnswer(cfg, draftedState(cfg))).toBe('D1a D2a');
  });
  it('summarises what was sent: labels, moved picks, notes and disagreements', () => {
    const s = { picks: { D1: 'b', D2: 'z' }, agree: { s1: false, s2: true }, notes: { s2: 'nice' }, endNotes: '' };
    expect(sentSummary(cfg, s)).toEqual({
      picks: [{ id: 'D1', code: 'b', label: 'Beta', moved: true }, { id: 'D2', code: 'z', label: 'Neither', moved: true }],
      lines: ['Layout: disagreed', 's2: nice'],
    });
  });
});
