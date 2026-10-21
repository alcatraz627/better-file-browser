// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { windowedText, lineStart, countLines } from '../src/text-window';

const mk = (n: number) => Array.from({ length: n }, (_, i) => `line ${i}`).join('\n');
const setup = (text: string, size = 100) => {
  const ta = document.createElement('textarea');
  document.body.append(ta);
  return { ta, tw: windowedText(ta, text, size) };
};

describe('lineStart and countLines', () => {
  it('finds line starts', () => {
    expect(lineStart('a\nbb\nccc', 0)).toBe(0);
    expect(lineStart('a\nbb\nccc', 2)).toBe(5);
    expect(lineStart('a\nbb\nccc', 9)).toBe(8);
    expect(countLines('a\nbb\nccc')).toBe(3);
    expect(countLines('')).toBe(1);
  });
});

describe('windowedText', () => {
  it('holds only a window but gives back the whole text', () => {
    const text = mk(1000);
    const { ta, tw } = setup(text);
    expect(countLines(ta.value)).toBe(100);
    expect(tw.text()).toBe(text);
    expect(tw.first()).toBe(0);
  });

  it('a short text fits whole', () => {
    const { ta, tw } = setup('one\ntwo', 100);
    expect(ta.value).toBe('one\ntwo');
    expect(tw.text()).toBe('one\ntwo');
  });

  it('moves to a line and keeps the whole text intact', () => {
    const text = mk(1000);
    const { ta, tw } = setup(text);
    tw.center(500);
    expect(tw.first()).toBe(450);
    expect(ta.value.split('\n')[0]).toBe('line 450');
    expect(tw.text()).toBe(text);
    tw.center(999);
    expect(tw.first()).toBe(900);
    expect(ta.value.split('\n').pop()).toBe('line 999');
    expect(tw.text()).toBe(text);
  });

  it('typing inside the window edits the whole text in place', () => {
    const text = mk(1000);
    const { ta, tw } = setup(text);
    tw.center(500);
    const at = lineStart(text, 500) + 4;
    tw.select(at, at);
    ta.setRangeText('X', ta.selectionStart, ta.selectionEnd, 'end');
    ta.dispatchEvent(new Event('input'));
    expect(tw.text()).toBe(text.slice(0, at) + 'X' + text.slice(at));
    expect(tw.selection()).toEqual({ start: at + 1, end: at + 1 });
  });

  it('selecting outside the window moves the window there', () => {
    const text = mk(1000);
    const { ta, tw } = setup(text);
    const at = lineStart(text, 800);
    tw.select(at, at + 4);
    expect(tw.first()).toBeLessThanOrEqual(800);
    expect(tw.first() + tw.size()).toBeGreaterThan(800);
    expect(ta.value.slice(ta.selectionStart, ta.selectionEnd)).toBe('line');
    expect(tw.selection()).toEqual({ start: at, end: at + 4 });
  });

  it('set replaces the whole text', () => {
    const { tw } = setup(mk(1000));
    tw.center(600);
    tw.set(mk(300));
    expect(tw.text()).toBe(mk(300));
  });

  it('select-all copies the whole text, and typing over it replaces everything', () => {
    const text = mk(1000);
    const { ta, tw } = setup(text);
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true }));
    ta.select();
    expect(tw.selection()).toEqual({ start: 0, end: text.length });
    let copied = '';
    const ev = new Event('copy', { cancelable: true }) as ClipboardEvent;
    Object.defineProperty(ev, 'clipboardData', { value: { setData: (_: string, v: string) => { copied = v; } } });
    ta.dispatchEvent(ev);
    expect(copied).toBe(text);
    ta.dispatchEvent(new Event('beforeinput'));
    ta.setRangeText('new', 0, ta.value.length, 'end');
    ta.dispatchEvent(new Event('input'));
    expect(tw.text()).toBe('new');
  });

  it('an arrow key after select-all drops back to a window selection', () => {
    const { ta, tw } = setup(mk(1000));
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true }));
    ta.select();
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(tw.selection().end).toBeLessThan(tw.text().length);
  });
});
