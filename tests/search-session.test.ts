import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { SearchFileReader } from '../src/search-session';

describe('search cancellation across tabs', () => {
  it('rejects every pending read and disconnects the tab port when a query ends', async () => {
    const messages: unknown[] = [];
    const disconnect = vi.fn();
    const port = {
      postMessage: (msg: unknown) => messages.push(msg),
      disconnect,
      onMessage: { addListener: vi.fn() },
      onDisconnect: { addListener: vi.fn() },
    };
    (globalThis as any).chrome = { runtime: { connect: () => port } };
    const reader = new SearchFileReader();
    const pending = [reader.read('file:///a.txt'), reader.read('file:///b.txt')];
    expect(messages).toHaveLength(2);
    reader.close();
    await expect(Promise.allSettled(pending)).resolves.toEqual([
      expect.objectContaining({ status: 'rejected' }),
      expect.objectContaining({ status: 'rejected' }),
    ]);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('caps reads across ports and frees slots when one tab closes', async () => {
    let onConnect: (port: any) => void = () => {};
    const started: Array<{ url: string; signal: AbortSignal; resolve: (value: unknown) => void }> = [];
    const fakeFetch = (url: string, opts: { signal: AbortSignal }) => new Promise((resolve, reject) => {
      started.push({ url, signal: opts.signal, resolve });
      opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
    const chrome = {
      runtime: {
        onMessage: { addListener: () => {} },
        onConnect: { addListener: (fn: (port: any) => void) => { onConnect = fn; } },
      },
    };
    runInNewContext(readFileSync('background.js', 'utf8'), {
      chrome, fetch: fakeFetch, AbortController, TextDecoder, Uint8Array,
    });
    const makePort = () => {
      let onMessage: (msg: unknown) => void = () => {};
      let onDisconnect = () => {};
      const replies: unknown[] = [];
      const port = {
        name: 'bfb-search-fetch',
        onMessage: { addListener: (fn: typeof onMessage) => { onMessage = fn; } },
        onDisconnect: { addListener: (fn: typeof onDisconnect) => { onDisconnect = fn; } },
        postMessage: (msg: unknown) => replies.push(msg),
        read: (id: number) => onMessage({ type: 'read', id, url: `file:///r/${id}.txt` }),
        close: () => onDisconnect(),
        replies,
      };
      onConnect(port);
      return port;
    };
    const a = makePort(), b = makePort();
    for (let id = 1; id <= 6; id++) a.read(id);
    b.read(7); b.read(8);
    expect(started).toHaveLength(4);
    a.close();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(started.slice(0, 4).every(job => job.signal.aborted)).toBe(true);
    expect(started.map(job => job.url)).toEqual([
      'file:///r/1.txt', 'file:///r/2.txt', 'file:///r/3.txt', 'file:///r/4.txt',
      'file:///r/7.txt', 'file:///r/8.txt',
    ]);
    expect(a.replies).toHaveLength(0);
    for (const job of started.slice(4)) job.resolve({ status: 0, body: null, text: async () => 'ok' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(b.replies).toEqual([{ id: 7, ok: true, text: 'ok' }, { id: 8, ok: true, text: 'ok' }]);
  });
});
