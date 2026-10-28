// bfb as a web page, for a phone on the tailnet. The phone server
// (native/web_server.py) serves each file and folder at its own path, so the
// app reads its address the way it reads a file:// one. This module stands in
// for the extension's Chrome APIs before the app starts: storage lives in this
// browser's localStorage, file reads are plain requests to the server, and the
// native hosts are reached through the server's /_bfb/native route.
import { setFileBase } from './utils';

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

// A long-lived connection. Search reads files through it; Ask is not on the phone yet.
function port(name: string) {
  const msgL = new Set<(m: unknown) => void>(), discL = new Set<() => void>();
  const emit = (m: unknown) => setTimeout(() => msgL.forEach(f => f(m)));
  const p = {
    name,
    onMessage: { addListener: (f: (m: unknown) => void) => msgL.add(f), removeListener: (f: (m: unknown) => void) => msgL.delete(f) },
    onDisconnect: { addListener: (f: () => void) => discL.add(f), removeListener: (f: () => void) => discL.delete(f) },
    disconnect() { discL.clear(); msgL.clear(); },
    postMessage(m: { type?: string; id?: unknown; url?: string; op?: string }) {
      if (name === 'bfb-search-fetch' && m?.type === 'read' && m.url) {
        raw(m.url).then(r => r.text()).then(text => emit({ id: m.id, ok: true, text }), e => emit({ id: m.id, ok: false, error: String(e) }));
      } else if (name === 'bfb-llm') {
        if (m?.op === 'running') emit({ t: 'running', jobs: [] });
        else if (m?.op === 'orphans') emit({ t: 'orphans', list: [] });
        else emit({ t: 'native-gone', message: 'Ask is not available on the phone yet' });
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
    const { kv } = await r.json() as { kv?: Record<string, string> };
    for (const [k, v] of Object.entries(kv ?? {})) if (k.startsWith('bfb-') && typeof v === 'string') localStorage.setItem(keyOf('local', k), JSON.stringify(v));
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
