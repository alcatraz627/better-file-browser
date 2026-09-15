import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchFileText, FileFetchError } from '../src/file-fetch';

type Reply = { ok: boolean; text?: string; error?: string } | undefined;

// A fake chrome.runtime whose sendMessage answers from a scripted queue.
// `undefined` in the queue means "no reply" (what an idle-killed worker does).
function fakeRuntime(replies: Reply[], id: string | null = 'ext') {
  const sendMessage = vi.fn((_msg: unknown, cb: (r?: Reply) => void) => {
    const r = replies.shift();
    (globalThis as any).chrome.runtime.lastError = r === undefined ? { message: 'port closed' } : undefined;
    cb(r);
  });
  (globalThis as any).chrome = { runtime: { id, sendMessage, lastError: undefined } };
  return sendMessage;
}

// XHR fallback that always fails, so a test passes only via the relay.
function failingXhr() {
  (globalThis as any).XMLHttpRequest = class {
    onerror: (() => void) | null = null;
    open() {}
    send() { queueMicrotask(() => this.onerror?.()); }
  };
}

describe('fetchFileText relay', () => {
  beforeEach(failingXhr);

  it('returns the worker text on a clean reply', async () => {
    fakeRuntime([{ ok: true, text: 'hello' }]);
    await expect(fetchFileText('file:///a.txt')).resolves.toBe('hello');
  });

  it('retries when the worker gives no reply, then succeeds', async () => {
    const send = fakeRuntime([undefined, { ok: true, text: 'second' }]);
    await expect(fetchFileText('file:///a.txt', 3, 1)).resolves.toBe('second');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('fails with read-failed after every attempt goes unanswered', async () => {
    const send = fakeRuntime([undefined, undefined, undefined]);
    const err = await fetchFileText('file:///a.txt', 3, 1).catch(e => e);
    expect(err).toBeInstanceOf(FileFetchError);
    expect(err.code).toBe('read-failed');
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('fails with read-failed when the worker reports an error', async () => {
    fakeRuntime([{ ok: false, error: 'ENOENT' }]);
    const err = await fetchFileText('file:///a.txt', 3, 1).catch(e => e);
    expect(err.code).toBe('read-failed');
    expect(err.message).toBe('ENOENT');
  });

  it('reports context-invalidated when chrome.runtime.id is gone', async () => {
    const send = fakeRuntime([{ ok: true, text: 'never' }], null);
    const err = await fetchFileText('file:///a.txt').catch(e => e);
    expect(err.code).toBe('context-invalidated');
    expect(send).not.toHaveBeenCalled();
  });
});
