import { describe, it, expect } from 'vitest';
import { filePathOf, fileHrefOf, routeLink, copyTarget, pathOnPhoneBase } from '../src/address';

const phone = { onPhone: true, origin: 'http://100.64.0.9:8446', phoneBase: '' };
const mac = { onPhone: false, origin: 'file://', phoneBase: 'http://100.64.0.9:8446/' };

describe('one address', () => {
  it('reads and writes file addresses', () => {
    expect(filePathOf('file:///Users/example/My%20Docs/a.md')).toBe('/Users/example/My Docs/a.md');
    expect(filePathOf('https://example.com/')).toBeNull();
    expect(fileHrefOf('/Users/example/My Docs/a.md')).toBe('file:///Users/example/My%20Docs/a.md');
  });
  it('on the phone a file link opens through the phone server', () => {
    expect(routeLink('file:///Users/example/My%20Docs/a.md', phone).to).toBe('http://100.64.0.9:8446/Users/example/My%20Docs/a.md');
    expect(routeLink('https://example.com/x', phone).to).toBeNull();
  });
  it('on the Mac a phone-server link opens the file locally', () => {
    expect(routeLink('http://100.64.0.9:8446/Users/example/My%20Docs/a.md', mac).to).toBe('file:///Users/example/My%20Docs/a.md');
    expect(routeLink('http://other.test/Users/example/a.md', mac).to).toBeNull();
    expect(pathOnPhoneBase('http://100.64.0.9:8446/a%20b', 'http://100.64.0.9:8446')).toBe('/a b');
  });
  it('a view keeps its # part both ways', () => {
    expect(routeLink('file:///Users/example/Work/#find=draft', phone).to).toBe('http://100.64.0.9:8446/Users/example/Work/#find=draft');
  });
  it('Copy link says where the link opens', () => {
    expect(copyTarget('/Users/example/a.md', { onPhone: false, phoneLink: 'http://100.64.0.9:8446/Users/example/a.md' }).say).toMatch(/opens on this Mac and on your phone/);
    const off = copyTarget('/Users/example/a b.md', { onPhone: false, phoneLink: '' });
    expect(off.text).toBe('file:///Users/example/a%20b.md');
    expect(off.say).toMatch(/Phone access is off, so it opens only on this Mac/);
  });
  it('Copy link keeps a # or ? in a file name as part of the name', () => {
    const u = new URL(copyTarget('/Users/example/report#1?.md', { onPhone: false, phoneLink: '' }).text);
    expect(decodeURIComponent(u.pathname)).toBe('/Users/example/report#1?.md');
    expect(u.hash).toBe('');
    expect(u.search).toBe('');
  });
});
