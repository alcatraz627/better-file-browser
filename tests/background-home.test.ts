import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Loads background.js against a stand-in chrome, holding `stored` in storage.
const load = (stored: Record<string, unknown>) => {
  let onClick: () => void = () => {};
  let onCreated: (tab: { id: number; pendingUrl?: string; url?: string }) => void = () => {};
  const opened: string[] = [];
  const updated: [number, string][] = [];
  const pick = (k: string | string[]) => Object.fromEntries([k].flat().filter(x => x in stored).map(x => [x, stored[x]]));
  const chrome = {
    runtime: { onMessage: { addListener: () => {} }, onConnect: { addListener: () => {} } },
    action: { onClicked: { addListener: (fn: () => void) => { onClick = fn; } }, setIcon: () => Promise.resolve() },
    storage: { local: { get: async (k: string | string[]) => pick(k) } },
    tabs: {
      create: async ({ url }: { url: string }) => { opened.push(url); },
      update: async (id: number, { url }: { url: string }) => { updated.push([id, url]); },
      onCreated: { addListener: (fn: typeof onCreated) => { onCreated = fn; } },
    },
  };
  runInNewContext(readFileSync('background.js', 'utf8'), { chrome, fetch, AbortController, TextDecoder, Uint8Array });
  const settle = () => new Promise(r => setTimeout(r, 10));
  return {
    click: async () => { onClick(); await settle(); return opened; },
    newTab: async (tab: { id: number; pendingUrl?: string; url?: string }) => { onCreated(tab); await settle(); return updated; },
  };
};

// The toolbar button opens Home at the home folder bfb learned, or the top of
// the disk before it has learned one.
describe('toolbar button', () => {
  it('opens Home in a new tab at the known home folder', async () => {
    expect(await load({ 'bfb-home-v1': '/Users/sam' }).click()).toEqual(['file:///Users/sam/#home']);
  });
  it('opens the top of the disk before a home folder is known, and ignores an odd value', async () => {
    expect(await load({}).click()).toEqual(['file:///']);
    expect(await load({ 'bfb-home-v1': '/etc' }).click()).toEqual(['file:///']);
  });
});

describe('new tab', () => {
  const on = JSON.stringify({ newTabHome: true });
  it('opens Home when the setting is on', async () => {
    expect(await load({ 'bfb-settings-v1': on, 'bfb-home-v1': '/Users/sam' }).newTab({ id: 7, pendingUrl: 'chrome://newtab/' }))
      .toEqual([[7, 'file:///Users/sam/#home']]);
  });
  it('leaves Chrome’s page alone when the setting is off or unset', async () => {
    expect(await load({ 'bfb-settings-v1': JSON.stringify({ newTabHome: false }), 'bfb-home-v1': '/Users/sam' }).newTab({ id: 7, pendingUrl: 'chrome://newtab/' })).toEqual([]);
    expect(await load({ 'bfb-home-v1': '/Users/sam' }).newTab({ id: 7, pendingUrl: 'chrome://newtab/' })).toEqual([]);
  });
  it('leaves a tab opened at any other address, and waits for a known home folder', async () => {
    expect(await load({ 'bfb-settings-v1': on, 'bfb-home-v1': '/Users/sam' }).newTab({ id: 7, pendingUrl: 'https://example.com/' })).toEqual([]);
    expect(await load({ 'bfb-settings-v1': on }).newTab({ id: 7, pendingUrl: 'chrome://newtab/' })).toEqual([]);
  });
});
