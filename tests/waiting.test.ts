import { describe, it, expect } from 'vitest';
import { buildWaiting, isUnclaimedCapture, FADE_DAYS } from '../src/waiting';
import type { NoteMeta } from '../src/notes';
import type { DocRow } from '../src/docs-lens';
import type { DpRow } from '../src/dp-lens';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const DAY = 86400_000;
const note = (rel: string, over: Partial<NoteMeta> = {}): NoteMeta => ({ rel, size: 1, mtime: 1, title: rel.replace('.md', ''), ...over });
const doc = (name: string, over: Partial<DocRow> = {}): DocRow => ({ doc: `/x/${name}`, name, open: 1, done: 0, mentions: ['user'], exists: true, ...over });
const page = (slug: string, state: DpRow['state'] = 'waiting'): DpRow => ({ slug, path: `/reg/${slug}`, mtime: 1, state, title: slug });
const none = { root: '/n', notes: [], docs: [], pages: [] };

describe('the waiting list', () => {
  it('covers agent notes, missed reminders, captures, comments for you and decision pages', () => {
    const { items } = buildWaiting({
      root: '/n',
      notes: [note('a.md', { agent: 'claude-1' }), note('r.md', { remindAt: '2026-11-09T09:00:00Z' }), note('c.md', { source: 'Pocket' }), note('plain.md')],
      docs: [doc('plan.md'), doc('quiet.md', { mentions: [] }), doc('done.md', { open: 0 })],
      pages: [page('ask-1'), page('old', 'answered')],
    }, {}, NOW);
    expect(items.map(i => `${i.kind}:${i.title}`)).toEqual(['reminder:r', 'comment:plan.md', 'decision:ask-1', 'capture:c', 'agent:a']);
  });
  it('a future reminder, a pinned or tagged capture and an agent note the owner pinned are not waiting', () => {
    const { items } = buildWaiting({ ...none, notes: [note('f.md', { remindAt: '2026-12-01T09:00:00Z' }), note('t.md', { source: 'x', tags: ['work'] }), note('p.md', { source: 'x', pinned: true }), note('ap.md', { agent: 'c', pinned: true })] }, {}, NOW);
    expect(items).toEqual([]);
  });
  it('an item fades a week after it first showed up, and a missed reminder never fades', () => {
    const seen = { 'agent:a.md': NOW - FADE_DAYS * DAY, 'reminder:r.md': NOW - 30 * DAY, 'agent:b.md': NOW - (FADE_DAYS * DAY - 1000) };
    const { items } = buildWaiting({ ...none, notes: [note('a.md', { agent: 'x' }), note('b.md', { agent: 'x' }), note('r.md', { remindAt: '2026-10-01T09:00:00Z' })] }, seen, NOW);
    const by = Object.fromEntries(items.map(i => [i.key, i.faded]));
    expect(by).toEqual({ 'agent:a.md': true, 'agent:b.md': false, 'reminder:r.md': false });
    expect(items[items.length - 1].key).toBe('agent:a.md');   // faded items go last
  });
  it('keeps first-seen times for what still waits, starts new ones now, and forgets what left', () => {
    const r1 = buildWaiting({ ...none, notes: [note('a.md', { agent: 'x' })] }, { 'agent:gone.md': 5, 'agent:a.md': 99 }, NOW);
    expect(r1.seen).toEqual({ 'agent:a.md': 99 });
    expect(buildWaiting({ ...none, notes: [note('n.md', { agent: 'x' })] }, {}, NOW).seen).toEqual({ 'agent:n.md': NOW });
  });
  it('a capture needs a source, no tags, no pin and no agent', () => {
    expect(isUnclaimedCapture({ source: 'Pocket' })).toBe(true);
    expect(isUnclaimedCapture({})).toBe(false);
    expect(isUnclaimedCapture({ source: 'x', agent: 'c' })).toBe(false);
  });
});
