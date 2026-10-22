import { describe, it, expect } from 'vitest';
import { docRows, browsedPath, type DocRow } from '../src/docs-lens';

const row = (name: string, extra: Partial<DocRow> = {}): DocRow => ({ doc: '/w/' + name, name, open: 1, done: 0, ...extra });
const rows = [row('b.md'), row('a.md', { mentions: ['user'] }), row('c.md', { due: ['2026-11-03'] }), row('d.md', { open: 0, done: 2 }), row('gone.md', { exists: false })];

describe('docRows', () => {
  it('lists documents on disk, open ones first, then by name', () => {
    expect(docRows(rows).map(r => r.name)).toEqual(['a.md', 'b.md', 'c.md', 'd.md']);
  });
  it('filters by a tag on any of the document threads', () => {
    const tagged = [row('t.md', { tags: ['schedule', 'risk'] }), row('u.md', { tags: ['risk'] }), row('v.md')];
    expect(docRows(tagged, { q: '', me: false, due: false, tag: 'schedule' }).map(r => r.name)).toEqual(['t.md']);
    expect(docRows(tagged, { q: '', me: false, due: false, tag: 'risk' }).map(r => r.name)).toEqual(['t.md', 'u.md']);
    expect(docRows(tagged, { q: '', me: false, due: false, tag: '' }).length).toBe(3);
  });
  it('filters by name or folder, by a mention of you, and by a due date', () => {
    expect(docRows(rows, { q: 'C.', me: false, due: false }).map(r => r.name)).toEqual(['c.md']);
    expect(docRows(rows, { q: '/w/', me: true, due: false }).map(r => r.name)).toEqual(['a.md']);
    expect(docRows(rows, { q: '', me: false, due: true }).map(r => r.name)).toEqual(['c.md']);
  });
});

describe('browsedPath', () => {
  it('turns the resolved /private form back into the path a person browses', () => {
    expect(browsedPath('/private/var/folders/x/plan.md')).toBe('/var/folders/x/plan.md');
    expect(browsedPath('/private/tmp/a.md')).toBe('/tmp/a.md');
    expect(browsedPath('/private/varnish/a.md')).toBe('/private/varnish/a.md');
    expect(browsedPath('/Users/a/plan.md')).toBe('/Users/a/plan.md');
  });
});
