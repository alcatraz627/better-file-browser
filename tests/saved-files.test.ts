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
  it('reads only file:// addresses', () => {
    expect(urlPlace('https://example.com/')).toBeNull();
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
    expect(textPlace(text, 'k')).toEqual({ ...place, pos: 'm', created: '2026-11-01T10:00:00Z' });
  });
  it('keeps what another app put in the file: body, unknown lines, agent and the first created', () => {
    const existing = '---\ntitle: "Old"\ncreated: 2026-10-01T00:00:00Z\nagent: "claude"\nmood: calm\nurl: "file:///Users/example/Work/"\ndevice: "mac"\npos: c\n---\nwhy I saved this\n';
    const out = parseNote(placeText({ ...place, label: 'Renamed' }, 'c', existing, '2026-11-01T10:00:00Z'), 'k');
    expect(out.title).toBe('Renamed'); expect(out.created).toBe('2026-10-01T00:00:00Z');
    expect(out.agent).toBe('claude'); expect(out.extraLines).toEqual(['mood: calm']); expect(out.body).toBe('why I saved this\n');
  });
  it('does not take web saves, the phone\'s file saves or clash files as Mac rows', () => {
    expect(textPlace('---\ntitle: "Web"\nurl: "https://example.com/"\n---\n', 'k')).toBeNull();
    expect(textPlace('---\ntitle: "P"\nurl: "file:///x/"\ndevice: "phone"\n---\n', 'k')).toBeNull();
    expect(textPlace('---\ntitle: "C"\n<<<<<<< HEAD\nurl: "file:///x/"\n=======\n>>>>>>> o\n---\n', 'k')).toBeNull();
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
    const plan = await planSaved(list, [], '2026-11-01T10:00:00Z');
    expect(plan.writes).toHaveLength(2); expect(plan.removes).toEqual([]);
    expect(plan.placed.map(p => p.pos).every(Boolean)).toBe(true);
  });
  it('a second plan over the files it wrote changes nothing', async () => {
    const first = await planSaved(list, [], '2026-11-01T10:00:00Z');
    const again = await planSaved(first.placed, first.writes, '2026-11-02T10:00:00Z');
    expect(again.writes).toEqual([]); expect(again.removes).toEqual([]);
  });
  it('removes only Mac saves that left the list, never other devices\' or web saves', async () => {
    const first = await planSaved(list, [], '2026-11-01T10:00:00Z');
    const web = { key: 'webwebweb', text: '---\ntitle: "W"\nurl: "https://example.com/"\n---\n' };
    const phone = { key: 'phonefile', text: '---\ntitle: "P"\nurl: "file:///p/"\ndevice: "phone"\n---\n' };
    const plan = await planSaved([list[0]], [...first.writes, web, phone], '2026-11-01T10:00:00Z');
    expect(plan.removes).toEqual([first.writes[1].key]);
  });
});
