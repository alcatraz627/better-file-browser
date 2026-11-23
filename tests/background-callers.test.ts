// The worker reads files and reaches the Mac's helpers for bfb's own pages
// only. A bfb script also runs on every website, so the worker checks who asks.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

type Reply = { ok: boolean; error?: string; text?: string };
const EXT = 'chrome-extension://abc/';

function load() {
  let onMessage: (msg: unknown, sender: { url?: string }, reply: (r: Reply) => void) => unknown = () => {};
  let onConnect: (port: unknown) => void = () => {};
  const fetched: string[] = [], natives: string[] = [];
  const chrome = {
    runtime: {
      getURL: (p: string) => EXT + p,
      onMessage: { addListener: (fn: typeof onMessage) => { onMessage = fn; } },
      onConnect: { addListener: (fn: typeof onConnect) => { onConnect = fn; } },
      connectNative: (host: string) => {
        natives.push(host);
        return { onMessage: { addListener: (fn: (r: unknown) => void) => setTimeout(() => fn({ t: 'ok' }), 0) }, onDisconnect: { addListener: () => {} }, postMessage: () => {}, disconnect: () => {} };
      },
    },
    action: { onClicked: { addListener: () => {} }, setIcon: () => Promise.resolve() },
    storage: { local: { get: async () => ({}) } },
    tabs: { onCreated: { addListener: () => {} } },
  };
  const fetch = async (url: string) => { fetched.push(url); return { text: async () => 'file text' }; };
  runInNewContext(readFileSync('background.js', 'utf8'), { chrome, fetch, AbortController, TextDecoder, Uint8Array, setTimeout });
  const ask = (msg: unknown, url: string) => new Promise<Reply>(resolve => { onMessage(msg, { url }, resolve); });
  const connect = (name: string, url: string) => {
    let closed = false, listening = false;
    onConnect({ name, sender: { url }, disconnect: () => { closed = true; }, onMessage: { addListener: () => { listening = true; } }, onDisconnect: { addListener: () => {} }, postMessage: () => {} });
    return { closed, listening };
  };
  return { ask, connect, fetched, natives };
}

describe('who may ask the worker for files and helpers', () => {
  const FILE = 'file:///Users/sam/notes.md', SITE = 'https://example.com/article';

  it('reads a file for a file:// page and for the extension\'s own pages', async () => {
    const w = load();
    expect(await w.ask({ type: 'bfb-fetch', url: FILE }, 'file:///Users/sam/')).toEqual({ ok: true, text: 'file text' });
    expect((await w.ask({ type: 'bfb-fetch', url: FILE }, EXT + 'design.html')).ok).toBe(true);
    expect(w.fetched).toEqual([FILE, FILE]);
  });
  it('does not read a file for a script on a website', async () => {
    const w = load();
    expect((await w.ask({ type: 'bfb-fetch', url: FILE }, SITE)).ok).toBe(false);
    expect((await w.ask({ type: 'bfb-fetch-image', url: FILE }, SITE)).ok).toBe(false);
    expect(w.fetched).toEqual([]);
  });
  it('reaches a helper only for bfb\'s own pages, and only the helpers bfb installs', async () => {
    const w = load();
    expect((await w.ask({ type: 'bfb-native-oneshot', host: 'com.better_file_browser.notes', payload: {} }, SITE)).ok).toBe(false);
    expect((await w.ask({ type: 'bfb-native-oneshot', host: 'com.other.app', payload: {} }, FILE)).ok).toBe(false);
    expect(w.natives).toEqual([]);
    expect((await w.ask({ type: 'bfb-native-oneshot', host: 'com.better_file_browser.notes', payload: {} }, FILE)).ok).toBe(true);
    expect(w.natives).toEqual(['com.better_file_browser.notes']);
  });
  it('closes the search and model ports for a website, and keeps them for a file:// page', () => {
    const w = load();
    for (const name of ['bfb-search-fetch', 'bfb-llm']) {
      expect(w.connect(name, SITE)).toEqual({ closed: true, listening: false });
      expect(w.connect(name, FILE)).toEqual({ closed: false, listening: true });
    }
  });
});
