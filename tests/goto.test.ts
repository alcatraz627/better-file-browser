import { describe, it, expect, vi } from 'vitest';

const read = vi.hoisted(() => ({ fn: (url: string): Promise<string> => Promise.reject(new Error(url)) }));
vi.mock('../src/file-fetch', () => ({ fetchFileText: (url: string) => read.fn(url) }));

import { pathToHref, resolvePath, readable } from '../src/goto';

describe('pathToHref', () => {
  it.each([
    ['/Users/a/Code', 'file:///Users/a/Code'],
    ['  "/Users/a/My Notes/"  ', 'file:///Users/a/My%20Notes/'],
    ['~/Code', 'file:///Users/a/Code'],
    ['file:///Users/a/x.md', 'file:///Users/a/x.md'],
    ['/Users/a//Code///x/', 'file:///Users/a/Code/x/'],
  ])('%j goes to %s', (input, want) => expect(pathToHref(input, '/Users/a')).toBe(want));
  it('refuses a relative path or ~ with no known home', () => {
    expect(pathToHref('Code/x', '/Users/a')).toBeNull();
    expect(pathToHref('~/x', '')).toBeNull();
  });
});

describe('resolvePath', () => {
  const listing = '<script>addRow("lib","lib",1,0,"","");addRow("a.server.ts","a.server.ts",0,10,"","");</script>';
  it('names a folder with a trailing slash and a file without', async () => {
    read.fn = () => Promise.resolve(listing);
    expect(await resolvePath('/x/lib')).toBe('/x/lib/');
    expect(await resolvePath('/x/a.server.ts')).toBe('/x/a.server.ts');
  });
  it('says nothing is there only after reading the folder', async () => {
    read.fn = () => Promise.resolve(listing);
    expect(await resolvePath('/x/missing.ts')).toBeNull();
  });
  it('keeps the path as typed when the folder cannot be read', async () => {
    read.fn = () => Promise.reject(new Error('no reply from the extension worker'));
    expect(await resolvePath('/x/a.server.ts')).toBe('/x/a.server.ts');
  });
});

describe('readable', () => {
  it('refuses a folder the browser cannot list and passes a file without reading it', async () => {
    read.fn = () => Promise.reject(new Error('denied'));
    expect(await readable('/var/root/')).toBe(false);
    expect(await readable('/var/root/x.md')).toBe(true);
    read.fn = () => Promise.resolve('');
    expect(await readable('/tmp/')).toBe(true);
  });
});
