import { describe, it, expect } from 'vitest';
import { moveLines, duplicateLines, indentLines, continueList, wrapSelection, tableSnippet } from '../src/editor';

const T = 'one\ntwo\nthree';
const at = (s: number, e = s) => ({ start: s, end: e });

describe('moveLines', () => {
  it('moves the caret line down and up, carrying the caret', () => {
    const down = moveLines(T, at(1), 1);
    expect(down.text).toBe('two\none\nthree');
    expect(down.start).toBe(5);
    const up = moveLines(down.text, at(down.start), -1);
    expect(up.text).toBe(T);
    expect(up.start).toBe(1);
  });
  it('moves a multi-line selection as a block and stops at the edges', () => {
    const sel = at(0, 6);   // "one\ntwo"
    const r = moveLines(T, sel, 1);
    expect(r.text).toBe('three\none\ntwo');
    expect(moveLines(T, at(0), -1).text).toBe(T);
    expect(moveLines(T, at(10), 1).text).toBe(T);
  });
});

describe('duplicateLines', () => {
  it('duplicates the caret line below and keeps the caret on the copy', () => {
    const r = duplicateLines(T, at(5));
    expect(r.text).toBe('one\ntwo\ntwo\nthree');
    expect(r.start).toBe(9);
  });
});

describe('indentLines', () => {
  it('indents and outdents every touched line', () => {
    const r = indentLines(T, at(0, 6), false);
    expect(r.text).toBe('  one\n  two\nthree');
    expect(r.start).toBe(2);
    const back = indentLines(r.text, { start: r.start, end: r.end }, true);
    expect(back.text).toBe(T);
  });
});

describe('continueList', () => {
  it('continues bullets, numbers and checkboxes, and ends an empty item', () => {
    expect(continueList('- a', at(3))!.text).toBe('- a\n- ');
    expect(continueList('1. a', at(4))!.text).toBe('1. a\n2. ');
    expect(continueList('- [x] done', at(10))!.text).toBe('- [x] done\n- [ ] ');
    expect(continueList('- a\n- ', at(6))!.text).toBe('- a\n');
    expect(continueList('plain', at(5))).toBeNull();
  });
});

describe('wrapSelection and tableSnippet', () => {
  it('wraps a selection and keeps it selected', () => {
    const r = wrapSelection('say hi', at(4, 6), '**');
    expect(r.text).toBe('say **hi**');
    expect([r.start, r.end]).toEqual([6, 8]);
  });
  it('builds a table skeleton', () => {
    expect(tableSnippet(2, 1)).toBe('| Column 1 | Column 2 |\n| --- | --- |\n|   |   |\n');
  });
});
