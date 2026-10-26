import { describe, it, expect } from 'vitest';
import { lineDiff } from '../src/line-diff';

const kinds = (a: string, b: string) => lineDiff(a, b).map(r => (r.kind === 'same' ? ' ' : r.kind === 'gone' ? '-' : '+') + r.text).join('|');

describe('lineDiff', () => {
  it('marks identical texts as all shared', () => expect(kinds('a\nb', 'a\nb')).toBe(' a| b'));
  it('marks a line only in the edited copy as new', () => expect(kinds('a\nb', 'a\nx\nb')).toBe(' a|+x| b'));
  it('marks a line only on disk as gone', () => expect(kinds('a\nx\nb', 'a\nb')).toBe(' a|-x| b'));
  it('shows a changed line as gone then new', () => expect(kinds('a\nold\nb', 'a\nnew\nb')).toBe(' a|-old|+new| b'));
});
