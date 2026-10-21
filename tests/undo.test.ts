// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { attachBuffer, diffText, applyPatch } from '../src/editor';

describe('diffText and applyPatch', () => {
  const cases: [string, string][] = [
    ['', 'abc'], ['abc', ''], ['abc', 'abc'], ['hello world', 'hello brave world'],
    ['aaaa', 'aa'], ['aa', 'aaaa'], ['line1\nline2\n', 'line0\nline1\nline2\n'], ['x😀y', 'x😀😀y'],
  ];
  it.each(cases)('turns %j into %j', (a, b) => {
    expect(applyPatch(a, diffText(a, b))).toBe(b);
  });
  it('keeps only the changed span', () => {
    expect(diffText('a'.repeat(1000) + 'X' + 'b'.repeat(1000), 'a'.repeat(1000) + 'YZ' + 'b'.repeat(1000))).toEqual({ at: 1000, len: 1, ins: 'YZ' });
  });
});

describe('attachBuffer', () => {
  const setup = (text: string) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    return { ta, buf: attachBuffer(ta, `t:${Math.random()}`) };
  };
  const type = (ta: HTMLTextAreaElement, buf: ReturnType<typeof attachBuffer>, v: string) => { ta.value = v; buf.snap(); };

  it('undoes and redoes through several steps', () => {
    const { ta, buf } = setup('one');
    type(ta, buf, 'one two');
    type(ta, buf, 'one two three');
    type(ta, buf, 'zero one two three');
    expect(buf.undo()).toBe(true); expect(ta.value).toBe('one two three');
    expect(buf.undo()).toBe(true); expect(ta.value).toBe('one two');
    expect(buf.undo()).toBe(true); expect(ta.value).toBe('one');
    expect(buf.undo()).toBe(false); expect(ta.value).toBe('one');
    expect(buf.redo()).toBe(true); expect(ta.value).toBe('one two');
    expect(buf.redo()).toBe(true); expect(ta.value).toBe('one two three');
    expect(buf.redo()).toBe(true); expect(ta.value).toBe('zero one two three');
    expect(buf.redo()).toBe(false);
  });

  it('an edit after undo drops the redo steps', () => {
    const { ta, buf } = setup('a');
    type(ta, buf, 'ab');
    buf.undo();
    type(ta, buf, 'ac');
    expect(buf.redo()).toBe(false);
    buf.undo(); expect(ta.value).toBe('a');
  });

  it('an unsnapped change is kept as a step before undoing it', () => {
    const { ta, buf } = setup('base');
    ta.value = 'base plus';
    buf.undo(); expect(ta.value).toBe('base');
    buf.redo(); expect(ta.value).toBe('base plus');
  });

  it('a large text keeps many steps without holding copies of it', () => {
    const big = 'const value = compute(1, "row");\n'.repeat(300_000);   // about 10 MB
    const { ta, buf } = setup(big);
    for (let i = 0; i < 50; i++) type(ta, buf, ta.value.slice(0, 5000) + 'x' + ta.value.slice(5000));
    expect(buf.depth()).toBe(51);
    for (let i = 0; i < 50; i++) buf.undo();
    expect(ta.value).toBe(big);
  });
});
