import { describe, it, expect } from 'vitest';
import { slugForTitle, noteTitle, stampUpdated, setTitle, settleClash, clashSides, splitNote, readProps, setField, setColor, setPinned, setTags, frontmatterDrift, pinnedFirst } from '../src/notes';

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

describe('properties', () => {
  const sb = '---\ntitle: "v6 sor"\ncreated: 2026-09-29T14:24:11Z\ntags: "ops, later"\npinned: true\ncolor: purple\nsource: "csync"\n---\nbody\n';
  it('splitNote keeps head + body equal to the original and shows clash markers instead of hiding them', () => {
    const s = splitNote(sb);
    expect(s.head + s.body).toBe(sb);
    expect(s.body).toBe('body\n');
    expect(splitNote('# plain\n')).toEqual({ head: '', body: '# plain\n' });
    expect(splitNote('---\n---\nx')).toEqual({ head: '---\n---\n', body: 'x' });
    const clash = '---\ntitle: a\n<<<<<<< HEAD\ncolor: red\n=======\ncolor: blue\n>>>>>>> pi\n---\nb';
    expect(splitNote(clash).head).toBe('');
  });
  it('readProps reads the title, colour, pin and tags', () => {
    expect(readProps('a.md', sb)).toEqual({ title: 'v6 sor', color: 'purple', pinned: true, tags: ['ops', 'later'] });
    expect(readProps('a.md', '---\ncolor: indigo\n---\n').color).toBe('purple');
    expect(readProps('a.md', '---\ncolor: plaid\n---\n').color).toBeNull();
    expect(readProps('a.md', '# x').pinned).toBe(false);
  });
  it('setField changes one line and leaves every other byte alone', () => {
    expect(setColor(sb, 'teal')).toBe(sb.replace('color: purple', 'color: teal'));
    expect(setPinned(sb, false)).toBe(sb.replace('pinned: true\n', ''));
    expect(setTags(sb, ['a', 'b c'])).toBe(sb.replace('"ops, later"', '"a, b c"'));
    expect(setColor(setColor(sb, null), 'purple')).toBe(sb);
  });
  it('setField puts a new line where Switchboard would', () => {
    const t = '---\ntitle: "T"\ncreated: x\nsource: "csync"\n---\nb';
    expect(setTags(t, ['x'])).toBe('---\ntitle: "T"\ncreated: x\ntags: "x"\nsource: "csync"\n---\nb');
    expect(setPinned(setColor(t, 'red'), true)).toBe('---\ntitle: "T"\ncreated: x\npinned: true\ncolor: red\nsource: "csync"\n---\nb');
    expect(setField('---\ncreated: x\n---\nb', 'mood', '"ok"')).toBe('---\ncreated: x\nmood: "ok"\n---\nb');
  });
  it('setField on a note without frontmatter adds a block holding only that field, and removal adds nothing', () => {
    expect(setColor('# plain\n', 'red')).toBe('---\ncolor: red\n---\n# plain\n');
    expect(setColor('# plain\n', null)).toBe('# plain\n');
    expect(setTags('---\ntags: "a"\n---\nb', [])).toBe('---\n---\nb');
  });
  it('tags with quotes and colons survive the round trip', () => {
    expect(readProps('a.md', setTags(sb, ['say "hi"', 'a:b'])).tags).toEqual(['say "hi"', 'a:b']);
  });
  it('frontmatterDrift names a changed line and ignores the keys the person changed and updated', () => {
    expect(frontmatterDrift(sb, setColor(sb, 'red'), ['color'])).toEqual([]);
    expect(frontmatterDrift(sb, setColor(sb, 'red'), [])).toEqual(['- color: purple', '+ color: red']);
    expect(frontmatterDrift(sb, sb.replace('body', '---\nx: 1\n---\nbody'), [])).toEqual([]);
    expect(frontmatterDrift('# plain\n', '---\nx: 1\n---\n# plain\n', [])).toEqual(['+ x: 1']);
    expect(frontmatterDrift(sb, stampUpdated(sb), [])).toEqual([]);
  });
  it('pinnedFirst puts pinned notes first, then newest', () => {
    const l = [{ rel: 'a', pinned: false, mtime: 9 }, { rel: 'b', pinned: true, mtime: 1 }, { rel: 'c', mtime: 5 }, { rel: 'd', pinned: true, mtime: 3 }];
    expect(pinnedFirst(l).map(n => n.rel)).toEqual(['d', 'b', 'a', 'c']);
  });
});
