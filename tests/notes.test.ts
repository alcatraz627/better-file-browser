import { describe, it, expect } from 'vitest';
import { slugForTitle, noteTitle, stampUpdated, setTitle } from '../src/notes';

const T = new Date('2026-09-15T10:00:00.000Z');

describe('slugForTitle', () => {
  it('slugs a heading into a file name', () => {
    expect(slugForTitle('# Weekly Plan: Q3!')).toBe('weekly-plan-q3.md');
    expect(slugForTitle('   ')).toBe('untitled.md');
  });
});

describe('noteTitle', () => {
  it('prefers front matter, then the first heading, then the file name', () => {
    expect(noteTitle('a.md', '---\ntitle: "From FM"\n---\n# Heading\n')).toBe('From FM');
    expect(noteTitle('a.md', 'intro\n# Heading\n')).toBe('Heading');
    expect(noteTitle('untitled-123.md', 'Weekly plan\n\nDetails')).toBe('Weekly plan');
    expect(noteTitle('sub/weekly-plan_v2.md')).toBe('weekly plan v2');
  });
});

describe('front matter', () => {
  it('setTitle replaces or adds the title, keeps the other fields, and refuses a note without front matter', () => {
    const sb = '---\ntitle: "v6 sor"\ncreated: 2026-09-29T14:24:11Z\ncolor: purple\npinned: true\n---\nbody $1 $&\n';
    expect(setTitle(sb, 'New: "name" $1')).toBe('---\ntitle: "New: \\"name\\" $1"\ncreated: 2026-09-29T14:24:11Z\ncolor: purple\npinned: true\n---\nbody $1 $&\n');
    expect(setTitle('---\ncreated: x\n---\nb', 'T')).toBe('---\ntitle: "T"\ncreated: x\n---\nb');
    expect(setTitle('# plain\n', 'T')).toBeNull();
  });
  it('stampUpdated refreshes updated, adds it when missing, and leaves notes without front matter alone', () => {
    const later = new Date('2026-09-16T00:00:00.000Z');
    expect(stampUpdated('---\ntitle: x\nupdated: 2026-09-15T10:00:00.000Z\n---\nbody', later)).toContain('updated: 2026-09-16T00:00:00.000Z');
    expect(stampUpdated('---\ntitle: y\n---\nbody', later)).toBe('---\ntitle: y\nupdated: 2026-09-16T00:00:00.000Z\n---\nbody');
    expect(stampUpdated('# plain\n', later)).toBe('# plain\n');
  });
});
