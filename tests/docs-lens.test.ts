import { describe, it, expect } from 'vitest';
import { docRows, type DocRow } from '../src/docs-lens';

const row = (name: string, extra: Partial<DocRow> = {}): DocRow => ({ doc: '/w/' + name, name, open: 1, done: 0, ...extra });
const rows = [row('b.md'), row('a.md', { mentions: ['user'] }), row('c.md', { due: ['2026-11-03'] }), row('d.md', { open: 0, done: 2 }), row('gone.md', { exists: false })];

describe('docRows', () => {
  it('lists documents on disk, open ones first, then by name', () => {
    expect(docRows(rows).map(r => r.name)).toEqual(['a.md', 'b.md', 'c.md', 'd.md']);
  });
  it('filters by name or folder, by a mention of you, and by a due date', () => {
    expect(docRows(rows, { q: 'C.', me: false, due: false }).map(r => r.name)).toEqual(['c.md']);
    expect(docRows(rows, { q: '/w/', me: true, due: false }).map(r => r.name)).toEqual(['a.md']);
    expect(docRows(rows, { q: '', me: false, due: true }).map(r => r.name)).toEqual(['c.md']);
  });
});
