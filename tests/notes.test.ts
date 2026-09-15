import { describe, it, expect } from 'vitest';
import { slugForTitle, noteTitle, newNoteText, stampUpdated } from '../src/notes';

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
    expect(noteTitle('sub/weekly-plan_v2.md')).toBe('weekly plan v2');
  });
});

describe('front matter', () => {
  it('a new note carries title, tags, created and updated', () => {
    const t = newNoteText('Hello', T);
    expect(t.startsWith('---\ntitle: Hello\ntags: []\ncreated: 2026-09-15T10:00:00.000Z\nupdated: 2026-09-15T10:00:00.000Z\n---\n')).toBe(true);
    expect(t).toContain('# Hello');
  });
  it('stampUpdated refreshes updated, adds it when missing, and leaves notes without front matter alone', () => {
    const later = new Date('2026-09-16T00:00:00.000Z');
    expect(stampUpdated(newNoteText('x', T), later)).toContain('updated: 2026-09-16T00:00:00.000Z');
    expect(stampUpdated('---\ntitle: y\n---\nbody', later)).toBe('---\ntitle: y\nupdated: 2026-09-16T00:00:00.000Z\n---\nbody');
    expect(stampUpdated('# plain\n', later)).toBe('# plain\n');
  });
});
