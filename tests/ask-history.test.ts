import { describe, it, expect, beforeEach, vi } from 'vitest';

async function fresh() {
  vi.resetModules();
  const kv = await import('../src/kv');
  await kv.loadKv();
  return import('../src/ask-history');
}
const turn = (q: string, at: number, a = 'answer') => ({ q, a, model: 'small', ms: 10, at });

describe('ask history', () => {
  beforeEach(() => localStorage.clear());

  it('keeps chats per subject, newest first, titled by their first question', async () => {
    const h = await fresh();
    h.addTurn('/a.md', 'c1', turn('What is this?', 1));
    h.addTurn('/a.md', 'c2', turn('Summarize', 2));
    h.addTurn('/a.md', 'c1', turn('And then?', 3));
    h.addTurn('/b.md', 'c3', turn('Other file', 4));
    const chats = h.chatsFor('/a.md');
    expect(chats.map(c => c.id)).toEqual(['c1', 'c2']);
    expect(chats[0].title).toBe('What is this?');
    expect(chats[0].turns.map(t => t.q)).toEqual(['What is this?', 'And then?']);
    expect(h.chatsFor('/b.md')).toHaveLength(1);
  });

  it('a folder lists its own chats and those up to four levels down', async () => {
    const h = await fresh();
    h.addTurn('/p/', 'self', turn('The folder', 1));
    h.addTurn('/p/a.md', 'file', turn('A file', 2));
    h.addTurn('/p/x/y/z/w.md', 'four', turn('Four down', 3));
    h.addTurn('/p/x/y/z/q/deep.md', 'five', turn('Five down', 4));
    h.addTurn('/pq/b.md', 'beside', turn('A sibling with a shared prefix', 5));
    h.addTurn('/other.md', 'out', turn('Elsewhere', 6));
    expect(h.chatsUnder('/p/').map(c => c.chat.id)).toEqual(['four', 'file', 'self']);
    expect(h.chatsUnder('/p').map(c => c.chat.id)).toEqual(['four', 'file', 'self']);
    expect(h.chatsUnder('/p/', 1).map(c => c.chat.id)).toEqual(['file', 'self']);
  });

  it('deletes a chat, and forgets a subject with none left', async () => {
    const h = await fresh();
    h.addTurn('/a.md', 'c1', turn('One', 1));
    h.deleteChat('/a.md', 'c1');
    expect(h.chatsFor('/a.md')).toEqual([]);
  });

  it('caps chats per subject at twenty, dropping the oldest', async () => {
    const h = await fresh();
    for (let i = 0; i < 25; i++) h.addTurn('/a.md', 'c' + i, turn('Q' + i, i));
    const ids = h.chatsFor('/a.md').map(c => c.id);
    expect(ids).toHaveLength(20);
    expect(ids).not.toContain('c0');
    expect(ids[0]).toBe('c24');
  });

  it('the line under an answer names model, tokens and time, and leaves out what is unknown', async () => {
    const h = await fresh();
    expect(h.turnMeta({ q: 'q', a: 'a', model: 'small', ms: 4200, at: 1, tokensIn: 1204, tokensOut: 388 })).toBe('small · in 1,204 · out 388 · 4.2s');
    expect(h.turnMeta({ q: 'q', a: 'a', model: 'gemini-3.8-flash', ms: 900, at: 1 }, true)).toBe('gemini-3.8-flash · 0.9s · shortened to fit');
    expect(h.turnMeta({ q: 'q', a: 'a', model: 'small', ms: 0, at: 1, stopped: true })).toBe('small · stopped');
    expect(h.turnMeta({ q: 'q', a: 'a', model: 'stopped', ms: 0, at: 1 })).toBe('Stopped');
  });

  it('a follow-up carries the last turns and stays under the limit', async () => {
    const h = await fresh();
    expect(h.withHistory([], 'Q')).toBe('Q');
    const turns = [turn('first', 1, 'one'), turn('second', 2, 'two')];
    const p = h.withHistory(turns, 'third');
    expect(p).toContain('Q: first\nA: one');
    expect(p.endsWith('Now: third')).toBe(true);
    const long = [turn('old', 1, 'x'.repeat(5000)), turn('recent', 2, 'short')];
    const q = h.withHistory(long, 'next', 4000);
    expect(q).toContain('Q: recent');
    expect(q).not.toContain('Q: old');
  });
});
