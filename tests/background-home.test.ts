import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// The toolbar button opens Home at the home folder bfb learned, or the top of
// the disk before it has learned one.
const clickWith = async (stored: Record<string, unknown>) => {
  let onClick: () => void = () => {};
  const opened: string[] = [];
  const chrome = {
    runtime: { onMessage: { addListener: () => {} }, onConnect: { addListener: () => {} } },
    action: { onClicked: { addListener: (fn: () => void) => { onClick = fn; } }, setIcon: () => Promise.resolve() },
    storage: { local: { get: async (k: string) => (k in stored ? { [k]: stored[k] } : {}) } },
    tabs: { create: async ({ url }: { url: string }) => { opened.push(url); } },
  };
  runInNewContext(readFileSync('background.js', 'utf8'), { chrome, fetch, AbortController, TextDecoder, Uint8Array });
  onClick();
  await new Promise(r => setTimeout(r, 10));
  return opened;
};

describe('toolbar button', () => {
  it('opens Home in a new tab at the known home folder', async () => {
    expect(await clickWith({ 'bfb-home-v1': '/Users/sam' })).toEqual(['file:///Users/sam/#home']);
  });
  it('opens the top of the disk before a home folder is known, and ignores an odd value', async () => {
    expect(await clickWith({})).toEqual(['file:///']);
    expect(await clickWith({ 'bfb-home-v1': '/etc' })).toEqual(['file:///']);
  });
});
