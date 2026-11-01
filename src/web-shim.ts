// bfb as a web page, for a phone on the tailnet. The phone server
// (native/web_server.py) serves each file and folder at its own path, so the
// app reads its address the way it reads a file:// one. This module stands in
// for the extension's Chrome APIs before the app starts: storage lives in this
// browser's localStorage, file reads are plain requests to the server, and the
// native hosts are reached through the server's /_bfb/native route.
import { setFileBase } from './utils';
import { mergeAskHistory } from './ask-merge';

const ASK_HISTORY = 'bfb-ask-history-v1';

type Cb = (r?: unknown) => void;
type Changes = Record<string, { oldValue?: unknown; newValue?: unknown }>;
type Listener = (changes: Changes, area: string) => void;

setFileBase(location.origin);
document.documentElement.classList.add('bfb-web');

const listeners = new Set<Listener>();
const PREFIX = 'bfbweb:';
const keyOf = (area: string, k: string) => `${PREFIX}${area}:${k}`;
const read = (area: string, k: string): unknown => {
  try { const v = localStorage.getItem(keyOf(area, k)); return v == null ? undefined : JSON.parse(v); } catch { return undefined; }
};
const allKeys = (area: string) => {
  const p = `${PREFIX}${area}:`, out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(p)) out.push(k.slice(p.length)); }
  return out;
};
const fire = (changes: Changes, area: string) => { if (Object.keys(changes).length) for (const l of listeners) { try { l(changes, area); } catch { /* one listener's fault */ } } };

// One storage area, answering both the callback and the promise forms Chrome offers.
function area(name: string) {
  const done = <T>(v: T, cb?: Cb) => { cb?.(v); return Promise.resolve(v); };
  return {
    get(keys?: string | string[] | Record<string, unknown> | null, cb?: Cb) {
      const out: Record<string, unknown> = {};
      if (keys == null) for (const k of allKeys(name)) out[k] = read(name, k);
      else if (typeof keys === 'string') { const v = read(name, keys); if (v !== undefined) out[keys] = v; }
      else if (Array.isArray(keys)) for (const k of keys) { const v = read(name, k); if (v !== undefined) out[k] = v; }
      else for (const [k, d] of Object.entries(keys)) { const v = read(name, k); out[k] = v === undefined ? d : v; }
      return done(out, cb);
    },
    set(items: Record<string, unknown>, cb?: Cb) {
      const changes: Changes = {};
      for (const [k, v] of Object.entries(items)) {
        const old = read(name, k);
        try { localStorage.setItem(keyOf(name, k), JSON.stringify(v)); } catch { /* storage full: this visit keeps it in memory only */ }
        changes[k] = { oldValue: old, newValue: v };
      }
      fire(changes, name);
      return done(undefined, cb);
    },
    remove(keys: string | string[], cb?: Cb) {
      const changes: Changes = {};
      for (const k of Array.isArray(keys) ? keys : [keys]) { changes[k] = { oldValue: read(name, k) }; localStorage.removeItem(keyOf(name, k)); }
      fire(changes, name);
      return done(undefined, cb);
    },
    clear(cb?: Cb) { return this.remove(allKeys(name), cb); },
  };
}
// Another tab of the same phone browser changed something: tell this one too.
addEventListener('storage', e => {
  const m = e.key && /^bfbweb:([a-z]+):(.*)$/.exec(e.key);
  if (!m) return;
  const parse = (s: string | null) => { try { return s == null ? undefined : JSON.parse(s); } catch { return undefined; } };
  fire({ [m[2]]: { oldValue: parse(e.oldValue), newValue: parse(e.newValue) } }, m[1]);
});

// A file's text or bytes: the server answers a request with the file itself.
const raw = (url: string) => fetch(url, { headers: { 'X-Bfb-Raw': '1' }, credentials: 'same-origin' }).then(r => {
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r;
});
async function native(host: string, payload: unknown) {
  const r = await fetch('/_bfb/native', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Bfb-Web': '1' }, body: JSON.stringify({ host, payload }) });
  const j = await r.json().catch(() => ({ ok: false, error: `the phone server answered ${r.status}` }));
  return j as { ok: boolean; response?: unknown; error?: string };
}
const b64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
async function answer(msg: { type?: string; url?: string; host?: string; payload?: unknown }): Promise<unknown> {
  switch (msg?.type) {
    case 'bfb-fetch': return raw(msg.url!).then(r => r.text()).then(text => ({ ok: true, text }), e => ({ ok: false, error: String(e) }));
    case 'bfb-fetch-image': return raw(msg.url!).then(async r => ({ ok: true, base64: b64(await r.arrayBuffer()), type: r.headers.get('content-type') || '' }), e => ({ ok: false, error: String(e) }));
    case 'bfb-native-oneshot': return native(msg.host!, msg.payload).catch(e => ({ ok: false, error: String(e) }));
    case 'bfb-app-icon': return { ok: true };
    default: return { ok: false, error: 'not available on the phone' };
  }
}

type Frame = { t?: string; message?: string };
type AskMsg = { op?: string; id?: string; job?: { id?: string } };
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const whenVisible = () => document.visibilityState === 'visible' ? Promise.resolve() : new Promise<void>(res => {
  const f = () => { if (document.visibilityState === 'visible') { removeEventListener('visibilitychange', f); res(); } };
  addEventListener('visibilitychange', f);
});
const ASK_HEADERS = { 'content-type': 'application/json', 'X-Bfb-Web': '1' };

/**
 * One Ask request through the Mac, which runs the same AI host the extension uses and
 * streams its frames back as JSON lines. An answer started with a job keeps running on
 * the Mac when this page is suspended or closed, so a broken stream is picked up again
 * (the text so far arrives as a replay) instead of ending the chat.
 */
function askStream(m: AskMsg, emit: (f: Frame) => void, isClosed: () => boolean, setCtl: (c: AbortController) => void) {
  const jobId = m.job?.id ?? (m.op === 'attach' ? m.id : undefined);
  const startedAsQuery = m.op === 'query' && !!m.job?.id;
  let ended = false;
  const once = async (msg: AskMsg): Promise<string | null> => {
    const ctl = new AbortController();
    setCtl(ctl);
    try {
      const r = await fetch('/_bfb/llm', { method: 'POST', headers: ASK_HEADERS, body: JSON.stringify(msg), signal: ctl.signal });
      if (!r.ok || !r.body) return `the phone server answered ${r.status}`;
      const reader = r.body.getReader(), dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
          const line = buf.slice(0, i); buf = buf.slice(i + 1);
          if (!line) continue;
          let f: Frame;
          try { f = JSON.parse(line); } catch { continue; }
          if (f.t === 'ping') continue;
          if (f.t === 'done' || f.t === 'error' || f.t === 'gone' || f.t === 'native-gone') ended = true;
          // An answer that ended while the phone was away says so, rather than leaving the chat waiting.
          if (f.t === 'gone' && startedAsQuery) emit({ t: 'native-gone', message: 'The answer ended while this phone was away.' });
          else emit(f);
        }
      }
      return null;
    } catch (e) { return String(e); }
  };
  void (async () => {
    let tries = 0;
    let err = await once(m);
    // A broken stream is not the end of an answer the Mac is still writing.
    while (!ended && !isClosed() && jobId && tries < 8) {
      tries++;
      await whenVisible();
      await sleep(Math.min(400 * 2 ** tries, 5000));
      if (isClosed()) return;
      err = await once({ op: 'attach', id: jobId });
    }
    if (!ended && !isClosed() && (err || jobId)) emit({ t: 'native-gone', message: err ?? '' });
  })();
}

// A long-lived connection. Search reads files through it; Ask goes through the Mac.
function port(name: string) {
  const msgL = new Set<(m: unknown) => void>(), discL = new Set<() => void>();
  const emit = (m: unknown) => setTimeout(() => msgL.forEach(f => f(m)));
  let closed = false, ctl: AbortController | null = null;
  const p = {
    name,
    onMessage: { addListener: (f: (m: unknown) => void) => msgL.add(f), removeListener: (f: (m: unknown) => void) => msgL.delete(f) },
    onDisconnect: { addListener: (f: () => void) => discL.add(f), removeListener: (f: () => void) => discL.delete(f) },
    disconnect() { closed = true; ctl?.abort(); discL.clear(); msgL.clear(); },
    postMessage(m: { type?: string; id?: unknown; url?: string } & AskMsg) {
      if (name === 'bfb-search-fetch' && m?.type === 'read' && m.url) {
        raw(m.url).then(r => r.text()).then(text => emit({ id: m.id, ok: true, text }), e => emit({ id: m.id, ok: false, error: String(e) }));
      } else if (name === 'bfb-llm') {
        // Stopping an answer is its own request: the page disconnects right after, which only ends the stream.
        if (m?.op === 'cancel') void fetch('/_bfb/llm', { method: 'POST', headers: ASK_HEADERS, body: JSON.stringify(m), keepalive: true }).catch(() => undefined);
        else askStream(m, emit, () => closed, c => { ctl = c; });
      }
    },
  };
  return p;
}

/**
 * Copy the Mac's settings into this browser before the app reads them. The
 * desktop pushes them to the server while phone access is on; the Mac is the
 * source, so its values replace the phone's on every load.
 */
export async function seedFromMac(): Promise<void> {
  try {
    const r = await fetch('/_bfb/seed.json', { cache: 'no-store' });
    if (!r.ok) return;
    const { kv } = await r.json() as { kv?: Record<string, unknown> };
    // Saved and its tag colours live in the notes folder, which the phone reads and writes through the Mac;
    // the seed is only their first copy, and never replaces a change the phone has not sent yet.
    const unsent = read('local', 'bfb-saved-dirty-v1') === '1';
    const MAC_ONLY = (k: string) => k === 'bfb-saved-dirty-v1' || k === 'bfb-saved-folder-off-v1' || k.endsWith('-premigration-v1') || (unsent && (k === 'bfb-saved-v1' || k === 'bfb-tags-v1'));
    for (const [k, v] of Object.entries(kv ?? {})) {
      if (MAC_ONLY(k)) continue;
      // Chats asked on the phone are not in the Mac's copy: join the two rather than replace.
      const value = k === ASK_HISTORY ? mergeAskHistory(v, read('local', k)) : v;
      try { localStorage.setItem(keyOf('local', k), JSON.stringify(value)); } catch { /* this browser's storage is full: skip the rest of the big ones */ }
    }
  } catch { /* no seed yet: the phone starts with defaults */ }
}

const g = globalThis as unknown as { chrome?: Record<string, unknown> };
g.chrome = {
  ...(g.chrome ?? {}),
  runtime: {
    id: 'bfb-web',
    lastError: undefined,
    getURL: (p: string) => `/_bfb/${p.replace(/^\//, '')}`,
    sendMessage(msg: Parameters<typeof answer>[0], cb?: Cb) {
      const p = answer(msg);
      if (cb) void p.then(cb);
      return p;
    },
    connect: (o?: { name?: string }) => port(o?.name ?? ''),
    onMessage: { addListener() { /* nothing sends to the page */ } },
  },
  storage: {
    local: area('local'), sync: area('sync'), session: area('session'),
    onChanged: { addListener: (f: Listener) => listeners.add(f), removeListener: (f: Listener) => listeners.delete(f) },
  },
};
