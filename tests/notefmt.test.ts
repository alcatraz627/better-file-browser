// Holds src/notefmt.ts and the readers in src/notes.ts to the notes spec's own fixture files.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveTitle, parseNote, renderNote, settle, autoSettles, sortNotes, validPos, validId, saveKey, normaliseUrl, type Keep } from '../src/notefmt';
import { noteTitle, readProps, splitNote, settleClash } from '../src/notes';
import { folderHash } from './notes-spec-hash';

const DIR = join(__dirname, 'fixtures/notes-spec');
const SPEC_DIR = '/Users/alcatraz627/Code/mnt-sync/specs/notes/fixtures';
const read = (p: string) => readFileSync(join(DIR, p), 'utf8');
const json = (p: string) => JSON.parse(read(p));
const NOT_CASES = new Set(['order', 'pos', 'ids', 'savekey']);
const cases = readdirSync(DIR).filter(f => f.endsWith('.json') && !NOT_CASES.has(f.slice(0, -5))).map(f => f.slice(0, -5));

describe('vendored fixtures', () => {
  it('match the recorded hash', () => {
    expect(folderHash(DIR)).toBe(readFileSync(join(__dirname, 'fixtures/notes-spec.sha256'), 'utf8').trim());
  });
  it.skipIf(!existsSync(SPEC_DIR))('match the spec folder when it is on this machine', () => {
    expect(folderHash(DIR)).toBe(folderHash(SPEC_DIR));
  });
});

describe('reading', () => {
  it('has cases', () => expect(cases.length).toBeGreaterThan(40));
  for (const name of cases) {
    it(name, () => expect(parseNote(read(`${name}.md`), name)).toEqual(json(`${name}.json`)));
  }
});

describe('settling', () => {
  const names = readdirSync(join(DIR, 'settle')).filter(f => /^[^.]+\.md$/.test(f)).map(f => f.slice(0, -3));
  for (const name of names) {
    for (const keep of ['first', 'second', 'both'] as Keep[]) {
      it(`${name} ${keep}`, () => expect(settle(read(`settle/${name}.md`), keep)).toBe(read(`settle/${name}.${keep}.md`)));
      it(`${name} ${keep} (the editor's settleClash)`, () => expect(settleClash(read(`settle/${name}.md`), keep)).toBe(read(`settle/${name}.${keep}.md`)));
    }
  }
  for (const row of json('settle/auto.json') as { file: string; path: string; auto: boolean }[]) {
    it(`auto-settles ${row.file} at ${row.path} is ${row.auto}`, () => expect(autoSettles(read(`settle/${row.file}`), row.path)).toBe(row.auto));
  }
});

describe('writing', () => {
  const names = readdirSync(join(DIR, 'render')).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
  for (const name of names) {
    it(name, () => {
      const input = json(`render/${name}.json`), text = read(`render/${name}.md`);
      expect(renderNote(input)).toBe(text);
      const back = parseNote(text, 'x');
      expect(back.body).toBe(input.body ?? '');
      expect(back.tags).toEqual(input.tags ?? []);
      expect(back.extraLines).toEqual(input.extraLines ?? []);
    });
  }
});

describe('order, pos, ids, save keys', () => {
  for (const c of json('order.json') as { name: string; notes: { id: string }[]; expected: string[] }[]) {
    it(`order ${c.name}`, () => expect(sortNotes(c.notes as { id: string }[]).map(n => n.id)).toEqual(c.expected));
  }
  const pos = json('pos.json'), ids = json('ids.json');
  it('pos', () => { for (const s of pos.valid) expect(validPos(s), s).toBe(true); for (const s of pos.invalid) expect(validPos(s), s).toBe(false); });
  it('ids', () => { for (const s of ids.valid) expect(validId(s), s).toBe(true); for (const s of ids.invalid) expect(validId(s), s).toBe(false); });
  for (const c of json('savekey.json') as { url: string; normalised: string; key: string }[]) {
    it(`save key ${JSON.stringify(c.url)}`, async () => {
      expect(normaliseUrl(c.url)).toBe(c.normalised);
      expect(await saveKey(c.url)).toBe(c.key);
    });
  }
});

describe('the app readers follow the same rules', () => {
  for (const name of cases) {
    const p = json(`${name}.json`);
    it(`title and header of ${name}`, () => {
      const text = read(`${name}.md`);
      // An empty `title:` stays empty in the parse; the list shows the note's first line instead (display only).
      expect(noteTitle(`${name}.md`, text)).toBe(p.title || (p.conflicted ? name : deriveTitle(p.body, name)));
      const props = readProps(`${name}.md`, text);
      expect(props.pinned).toBe(p.pinned);
      expect(props.tags).toEqual(p.tags);
      expect(props.color).toBe(p.color);
      expect(props.pos ?? null).toBe(p.pos);
    });
  }
  it('a clash file is not parsed for a header', () => {
    const text = read('clash-across-fence.md');
    expect(splitNote(text).head).toBe('');
  });
});
