import { describe, it, expect } from 'vitest';
import { placeUrl, urlPlace, assignPositions, placeText, textPlace, placesFromFiles, planSaved, placeKey } from '../src/saved-files';
import { parseNote, validPos } from '../src/notefmt';
import type { Place } from '../src/types';

describe('saved addresses', () => {
  const paths = ['/Users/example/Work/', '/Users/example/My Docs/plan v2.md', '/Users/example/café/日本.md', '/a/b#c.md', '/a/what?.md', '/a/100%/', '/Users/example/Work/#find=draft%20plan'];
  it('round-trips every kind of saved path', () => {
    for (const p of paths) expect(urlPlace(placeUrl(p)), p).toBe(p);
  });
  it('writes a file:// address, a folder keeps its slash and a view its # part', () => {
    expect(placeUrl('/Users/example/Work/')).toBe('file:///Users/example/Work/');
    expect(placeUrl('/Users/example/My Docs/a.md')).toBe('file:///Users/example/My%20Docs/a.md');
    expect(placeUrl('/Users/example/Work/#find=x')).toBe('file:///Users/example/Work/#find=x');
  });
  it('reads file:// and web addresses, nothing else', () => {
    expect(urlPlace('https://example.com/')).toBe('https://example.com/');
    expect(urlPlace('mailto:a@b.test')).toBeNull();
    expect(urlPlace('file://host/share')).toBeNull();
  });
  it('names a save by the first 12 hex of the sha-1 of its url', async () => {
    expect(await placeKey('/Users/alcatraz627/Code/')).toBe('62e5caffb1fb');   // the spec's savekey fixture
    expect(await placeKey('/Users/alcatraz627/Notes/feedback.md')).toBe('68dd0ed13906');
  });
});

describe('positions', () => {
  it('gives every row a valid pos that sorts in list order', () => {
    const out = assignPositions([{}, {}, {}, {}, {}]);
    expect(out.every(validPos)).toBe(true);
    expect([...out].sort()).toEqual(out);
    expect(new Set(out).size).toBe(5);
  });
  it('keeps rows already in order and rewrites only the moved one', () => {
    expect(assignPositions([{ pos: 'a' }, { pos: 'c' }, { pos: 'e' }])).toEqual(['a', 'c', 'e']);
    const out = assignPositions([{ pos: 'a' }, { pos: 'z' }, { pos: 'c' }, { pos: 'e' }]);   // the second row was dragged to the front... of c, e
    expect(out[0]).toBe('a'); expect(out[2]).toBe('c'); expect(out[3]).toBe('e');
    expect(out[1] > 'a' && out[1] < 'c').toBe(true);
  });
  it('fills a run of new rows between two kept ones', () => {
    const out = assignPositions([{ pos: 'b' }, {}, {}, {}, { pos: 'd' }]);
    expect([...out].sort()).toEqual(out);
    expect(out[0]).toBe('b'); expect(out[4]).toBe('d');
  });
});

describe('a save as a file', () => {
  const place: Place = { path: '/Users/example/Work/', label: 'Work', tags: ['work', 'code'] };
  it('writes the spec header and reads back the same row', () => {
    const text = placeText(place, 'm', null, '2026-11-01T10:00:00Z');
    expect(text).toBe('---\ntitle: "Work"\ncreated: 2026-11-01T10:00:00Z\ntags: "work, code"\nurl: "file:///Users/example/Work/"\ndevice: "mac"\npos: m\n---\n');
    expect(textPlace(text, 'k')).toEqual({ ...place, key: 'k', pos: 'm', created: '2026-11-01T10:00:00Z' });
  });
  it('keeps what another app put in the file: body, unknown lines, agent and the first created', () => {
    const existing = '---\ntitle: "Old"\ncreated: 2026-10-01T00:00:00Z\nagent: "claude"\nmood: calm\nurl: "file:///Users/example/Work/"\ndevice: "mac"\npos: c\n---\nwhy I saved this\n';
    const out = parseNote(placeText({ ...place, label: 'Renamed' }, 'c', existing, '2026-11-01T10:00:00Z'), 'k');
    expect(out.title).toBe('Renamed'); expect(out.created).toBe('2026-10-01T00:00:00Z');
    expect(out.agent).toBe('claude'); expect(out.extraLines).toEqual(['mood: calm']); expect(out.body).toBe('why I saved this\n');
  });
  it('does not take a save with no url, or a file save made for the phone, as a row', () => {
    expect(textPlace('---\ntitle: "No url"\n---\n', 'k')).toBeNull();
    expect(textPlace('---\ntitle: "P"\nurl: "file:///x/"\ndevice: "phone"\n---\n', 'k')).toBeNull();
  });
  it('reads the folder in the shared order', () => {
    const f = (key: string, pos: string | null, created: string) => ({ key, text: `---\ntitle: "${key}"\ncreated: ${created}\nurl: "file:///x/${key}/"\n${pos ? `pos: ${pos}\n` : ''}---\n` });
    const rows = placesFromFiles([f('b', 'b', '2026-01-01T00:00:00Z'), f('new1', null, '2026-02-01T00:00:00Z'), f('a', 'a', '2026-01-02T00:00:00Z'), f('new2', null, '2026-03-01T00:00:00Z')]);
    expect(rows.map(r => r.label)).toEqual(['new2', 'new1', 'a', 'b']);
  });
});

describe('planning the folder', () => {
  const list: Place[] = [{ path: '/x/a/', label: 'A' }, { path: '/x/b/', label: 'B', tags: ['t'] }];
  it('writes a file per row on a fresh folder, with ordered positions', async () => {
    const plan = await planSaved(list, [], null, '2026-11-01T10:00:00Z');
    expect(plan.writes).toHaveLength(2); expect(plan.removes).toEqual([]);
    expect(plan.placed.map(p => p.pos).every(Boolean)).toBe(true);
  });
  it('a second plan over the files it wrote changes nothing', async () => {
    const first = await planSaved(list, [], null, '2026-11-01T10:00:00Z');
    const again = await planSaved(first.placed, first.writes, new Set(first.keys), '2026-11-02T10:00:00Z');
    expect(again.writes).toEqual([]); expect(again.removes).toEqual([]);
  });
  it('removes only a file this browser knew and the person took out, never one that arrived since', async () => {
    const first = await planSaved(list, [], null, '2026-11-01T10:00:00Z');
    const arrived = { key: 'newfromother', text: '---\ntitle: "N"\nurl: "file:///n/"\ndevice: "mac"\n---\n' };
    const files = [...first.writes, arrived];
    const plan = await planSaved([list[0]], files, new Set(first.keys), '2026-11-01T10:00:00Z');
    expect(plan.removes).toEqual([first.writes[1].key]);
    expect((await planSaved([list[0]], files, null)).removes).toEqual([]);
  });
  it('a row holding a clash is kept under its file and never rewritten or removed', async () => {
    const row: Place = { path: '/x/c/', label: 'C', clash: 'abc123abc123' };
    const files = [{ key: 'abc123abc123', text: '<<<<<<< HEAD\ntitle: "x"\n=======\n>>>>>>> o\n' }];
    const plan = await planSaved([row], files, new Set(['abc123abc123']));
    expect(plan.writes).toEqual([]); expect(plan.removes).toEqual([]); expect(plan.keys).toEqual(['abc123abc123']);
  });
});

describe('what the folder shows', () => {
  it('shows a web save as a row, and not a save made for the phone', () => {
    expect(textPlace('---\ntitle: "Web"\nurl: "https://example.com/a"\n---\n', 'k')).toMatchObject({ path: 'https://example.com/a', label: 'Web' });
    expect(textPlace('---\ntitle: "P"\nurl: "file:///x/"\ndevice: "phone"\n---\n', 'k')).toBeNull();
  });
  it('keeps a clash save as a marked row, reading the url from whichever side has one', () => {
    const t = '---\ntitle: "T"\n<<<<<<< HEAD\nurl: "file:///Users/example/c.md"\n=======\nurl: "file:///Users/example/c.md"\ntags: "x"\n>>>>>>> origin/main\n---\n';
    expect(textPlace(t, 'k')).toMatchObject({ path: '/Users/example/c.md', clash: 'k' });
    expect(textPlace('<<<<<<< HEAD\ntitle: "T"\n=======\n>>>>>>> o\n', 'k')).toBeNull();
  });
  it('a web row writes no device line', () => {
    expect(placeText({ path: 'https://example.com/a', label: 'W' }, 'm', null, '2026-11-01T10:00:00Z')).not.toMatch(/device:/);
  });
  it('paths with percent signs and hashes come back exactly', () => {
    for (const p of ['/Users/example/100%23done.md', '/Users/example/a#b.md', '/Users/example/what?.md', '/Users/example/50%/', '/Users/example/My Docs/日本.md']) expect(urlPlace(placeUrl(p)), p).toBe(p);
  });
});
