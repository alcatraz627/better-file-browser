import { describe, it, expect, beforeEach } from 'vitest';
import { quoteMarkdown, quoteTargets, sendQuote, takeQuote, splitThinking, closeOpenFence, QUOTE_MAX } from '../src/ask-quote';
import type { AskChat } from '../src/ask-history';

const chat = (id: string, title = id): AskChat => ({ id, at: 1, title, turns: [] });

describe('ask quote', () => {
  beforeEach(() => localStorage.clear());

  it('quotes every line and names the source', () => {
    expect(quoteMarkdown('one\n\ntwo', 'readme.md')).toBe('> From readme.md:\n>\n> one\n>\n> two\n\n');
  });

  it('shortens a long quote and says so', () => {
    const q = quoteMarkdown('x'.repeat(QUOTE_MAX + 50), 'a.md');
    expect(q.startsWith('> From a.md (shortened):')).toBe(true);
    expect(q.length).toBeLessThan(QUOTE_MAX + 40);
  });

  it('lists this chat, then open tabs, then recent chats, each subject once', () => {
    const store: Record<string, AskChat[]> = { '/p/a.md': [chat('a1', 'About a')], '/p/b.md': [chat('b1')] };
    const t = quoteTargets({ subject: '/p/x.md', chatId: 'x1', title: 'Here' },
      ['/p/x.md', '/p/a.md', '/p/none.md'],
      [{ subject: '/p/a.md', chat: chat('a1') }, { subject: '/p/b.md', chat: chat('b1') }],
      s => store[s] ?? []);
    expect(t.map(x => [x.subject, x.label])).toEqual([
      ['/p/x.md', 'This chat'], ['/p/a.md', 'a.md · open tab'], ['/p/b.md', 'b.md'],
    ]);
  });

  it('hands a quote to its page once, and drops a stale one', () => {
    sendQuote({ subject: '/p/a.md', chatId: 'a1', text: '> hi', at: 1000 });
    expect(takeQuote('/p/b.md', 1000)).toBeNull();
    expect(takeQuote('/p/a.md', 2000)?.text).toBe('> hi');
    expect(takeQuote('/p/a.md', 2000)).toBeNull();
    sendQuote({ subject: '/p/a.md', chatId: 'a1', text: 'old', at: 0 });
    expect(takeQuote('/p/a.md', 10 * 60_000)).toBeNull();
  });

  it('closes a code fence that is still open', () => {
    expect(closeOpenFence('Look:\n```js\nconst a')).toBe('Look:\n```js\nconst a\n```');
    expect(closeOpenFence('```\nx\n```\ndone')).toBe('```\nx\n```\ndone');
    expect(closeOpenFence('plain')).toBe('plain');
  });

  it('splits thinking from the answer, open while it streams', () => {
    expect(splitThinking('<think>\nhmm\n</think>\n\nYes.')).toEqual({ thinking: 'hmm', answer: 'Yes.', open: false });
    expect(splitThinking('<think>still going')).toEqual({ thinking: 'still going', answer: '', open: true });
    expect(splitThinking('No tags <think>x</think>')).toEqual({ thinking: '', answer: 'No tags <think>x</think>', open: false });
  });
});
