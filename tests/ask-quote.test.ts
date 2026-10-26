import { describe, it, expect, beforeEach } from 'vitest';
import { quoteMarkdown, quoteTargets, sendQuote, takeQuote, splitThinking, closeOpenFence, resolveMention, isImageName, bareLabel, QUOTE_MAX } from '../src/ask-quote';
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

  it('sends a question starting with @name to that model', () => {
    const opts = [{ value: '', label: 'gemma4' }, { value: 'code', label: 'code' },
      { value: 'gemini:gemini-3.8-flash', label: 'gemini-3.8-flash (default)' }, { value: 'gemini:gemini-4-argon', label: 'gemini-4-argon' }];
    expect(resolveMention('@code why does this loop?', opts)).toEqual({ model: 'code', label: 'code', question: 'why does this loop?' });
    expect(resolveMention('@gemini summarize', opts)?.model).toBe('gemini:gemini-3.8-flash');
    expect(resolveMention('@gemini-4-argon go', opts)?.model).toBe('gemini:gemini-4-argon');
    expect(resolveMention('@nobody hi', opts)).toBeNull();
    expect(resolveMention('mail me @code later', opts)).toBeNull();
    expect(resolveMention('@code', opts)).toBeNull();
  });

  it('finds the Gemini default by its own tag and names models without it', () => {
    const opts = [{ value: '', label: 'gemma4 (default)' }, { value: 'gemini:a', label: 'a' }, { value: 'gemini:b', label: 'b (Gemini default)' }];
    expect(resolveMention('@gemini hi', opts)).toEqual({ model: 'gemini:b', label: 'b', question: 'hi' });
    expect([bareLabel('x (default)'), bareLabel('y (Gemini default)'), bareLabel('z')]).toEqual(['x', 'y', 'z']);
  });

  it('knows an image by its name', () => {
    expect([isImageName('shot.PNG'), isImageName('a.jpeg'), isImageName('notes.txt')]).toEqual([true, true, false]);
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
