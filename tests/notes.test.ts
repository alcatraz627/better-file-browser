import { describe, it, expect } from 'vitest';
import { slugForTitle, noteTitle, stampUpdated, setTitle, settleClash, clashSides } from '../src/notes';

describe('clash', () => {
  const clash = 'top\n<<<<<<< HEAD\nmac line\n=======\npi line\n>>>>>>> pi/main\nmiddle\n<<<<<<< phone\nA\n=======\nB\n>>>>>>> csync-pi\nend';
  it('settles to the first side, the second, or both, keeping the rest', () => {
    expect(settleClash(clash, 'first')).toBe('top\nmac line\nmiddle\nA\nend');
    expect(settleClash(clash, 'second')).toBe('top\npi line\nmiddle\nB\nend');
    expect(settleClash(clash, 'both')).toBe('top\nmac line\npi line\nmiddle\nA\nB\nend');
    expect(settleClash('a\n<<<<<<< x\nb\n=======\nc', 'first')).toBe('a\nb\nc');
  });
  it('names the sides', () => {
    expect(clashSides(clash)).toEqual(["this Mac's", "the Pi's"]);
    expect(clashSides('<<<<<<< phone\nA\n=======\nB\n>>>>>>> csync-pi')).toEqual(["the phone's", "the Pi's"]);
    expect(clashSides('no clash here')).toBeNull();
  });
});

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
  it('noteTitle reads back what setTitle writes, and single-quoted YAML titles', () => {
    const t = 'a "b" c \\ d';
    expect(noteTitle('x.md', setTitle('---\ntitle: x\n---\nbody', t)!)).toBe(t);
    expect(noteTitle('x.md', "---\ntitle: 'C:\\Users\\me'\n---\n")).toBe('C:\\Users\\me');
    expect(noteTitle('x.md', "---\ntitle: 'it''s'\n---\n")).toBe("it's");
    expect(noteTitle('x.md', '---\ntitle: "   padded   "\n---\n')).toBe('padded');
  });
  it('stampUpdated refreshes updated, adds it when missing, and leaves notes without front matter alone', () => {
    const later = new Date('2026-09-16T00:00:00.000Z');
    expect(stampUpdated('---\ntitle: x\nupdated: 2026-09-15T10:00:00.000Z\n---\nbody', later)).toContain('updated: 2026-09-16T00:00:00.000Z');
    expect(stampUpdated('---\ntitle: y\n---\nbody', later)).toBe('---\ntitle: y\nupdated: 2026-09-16T00:00:00.000Z\n---\nbody');
    expect(stampUpdated('# plain\n', later)).toBe('# plain\n');
  });
});
