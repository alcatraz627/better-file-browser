// Stations and lines change rarely, so a month-old area is still good.
const TRANSIT_CACHE = 'bfb-transit-v1';
const TRANSIT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const transitUrl = key => `https://bfb-transit.invalid/${encodeURIComponent(key)}`;

async function transitCacheGet(key) {
  const cache = await caches.open(TRANSIT_CACHE);
  const hit = await cache.match(transitUrl(key));
  if (!hit) return null;
  if (Date.now() - Number(hit.headers.get('x-saved-at')) > TRANSIT_MAX_AGE_MS) {
    await cache.delete(transitUrl(key));
    return null;
  }
  return hit.text();
}

async function transitCachePut(key, text) {
  const cache = await caches.open(TRANSIT_CACHE);
  await cache.put(transitUrl(key), new Response(text, { headers: { 'x-saved-at': String(Date.now()) } }));
}

// Reads file:// content on behalf of content scripts. Page-context XHR to
// file:// is blocked by CORS in modern Chrome (file pages have an opaque
// origin); the extension service worker can still fetch file URLs as long as
// "Allow access to file URLs" is enabled.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === 'bfb-fetch') {
    fetch(msg.url)
      .then(r => r.text())
      .then(text => sendResponse({ ok: true, text }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true; // keep the message channel open for the async response
  }
  // An image's bytes for the preview's copy button: a page canvas cannot read a
  // file:// image back, so the worker fetches it and answers base64 plus its type.
  if (msg.type === 'bfb-fetch-image') {
    fetch(msg.url)
      .then(async r => {
        const buf = await r.arrayBuffer();
        if (buf.byteLength > 40 * 1024 * 1024) throw new Error('image exceeds 40 MB');
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        sendResponse({ ok: true, base64: btoa(bin), type: r.headers.get('content-type') || '' });
      })
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  // The app icon picked in Settings also becomes the toolbar button's icon.
  if (msg.type === 'bfb-app-icon') {
    setActionIcon(msg.id).then(() => sendResponse({ ok: true }), err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  // Interface size is Chrome's own zoom for the tab, so every popup the page
  // places by screen coordinates still lands under its anchor.
  if (msg.type === 'bfb-zoom') {
    const tabId = _sender.tab?.id;
    if (tabId == null) { sendResponse({ ok: false }); return; }
    chrome.tabs.getZoom(tabId).then(cur => {
      if (Math.abs(cur - msg.factor) < 0.001) return;
      return chrome.tabs.setZoom(tabId, msg.factor);
    }).then(() => sendResponse({ ok: true }), err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  // Rail data for the metro overlay, kept so an area is only slow the first time.
  if (msg.type === 'bfb-transit-get') {
    transitCacheGet(msg.key).then(text => sendResponse({ text }), () => sendResponse({ text: null }));
    return true;
  }
  if (msg.type === 'bfb-transit-put') {
    transitCachePut(msg.key, msg.text).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }
  // One-shot native call (terminal button): content scripts cannot use
  // connectNative, so the round-trip happens here.
  if (msg.type === 'bfb-native-oneshot') {
    try {
      const native = chrome.runtime.connectNative(msg.host);
      let settled = false;
      native.onMessage.addListener(r => {
        if (!settled) { settled = true; sendResponse({ ok: true, response: r }); }
        native.disconnect();
      });
      native.onDisconnect.addListener(() => {
        if (!settled) { settled = true; sendResponse({ ok: false, error: chrome.runtime.lastError?.message || 'disconnected' }); }
      });
      native.postMessage(msg.payload);
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  }
});

// Long-lived LLM port proxy: content script <-> here <-> native host.
// The native port closing (host exit or host-not-found) surfaces to the
// client as a {t:"native-gone"} frame so it can tell the difference between
// "stream ended" and "never started".
const searchQueue = [];
let searchReads = 0;
function runSearchReads() {
  while (searchReads < 4 && searchQueue.length) {
    const job = searchQueue.shift();
    if (job.state.closed) continue;
    const reply = message => { if (!job.state.closed) try { job.port.postMessage(message); } catch { /* tab closed */ } };
    searchReads++;
    job.state.active.add(job.controller);
    fetch(job.url, { signal: job.controller.signal }).then(async response => {
      if (response.status >= 400) throw new Error(`HTTP ${response.status}`);
      if (job.url.endsWith('/')) {
        const listing = await response.text();
        if (listing.length > 5 * 1024 * 1024) throw new Error('folder listing exceeds 5 MB');
        return listing;
      }
      const limit = 2 * 1024 * 1024;
      const reader = response.body?.getReader();
      if (!reader) {
        const text = await response.text();
        if (text.length > limit) throw new Error('file exceeds 2 MB');
        return text;
      }
      const parts = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel(); throw new Error('file exceeds 2 MB'); }
        parts.push(value);
      }
      const bytes = new Uint8Array(size);
      let at = 0;
      for (const part of parts) { bytes.set(part, at); at += part.byteLength; }
      return new TextDecoder().decode(bytes);
    }).then(text => {
      reply({ id: job.id, ok: true, text });
    }).catch(error => {
      reply({ id: job.id, ok: false, error: String(error) });
    }).finally(() => {
      job.state.active.delete(job.controller);
      searchReads--;
      runSearchReads();
    });
  }
}
chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'bfb-search-fetch') {
    const state = { closed: false, active: new Set() };
    port.onMessage.addListener(msg => {
      if (state.closed || msg?.type !== 'read' || typeof msg.url !== 'string' || !msg.url.startsWith('file://')) return;
      searchQueue.push({ port, state, id: msg.id, url: msg.url, controller: new AbortController() });
      runSearchReads();
    });
    port.onDisconnect.addListener(() => {
      state.closed = true;
      for (const controller of state.active) controller.abort();
      for (let i = searchQueue.length - 1; i >= 0; i--) if (searchQueue[i].state === state) searchQueue.splice(i, 1);
    });
    return;
  }
  if (port.name !== 'bfb-llm') return;
  let native = null;
  port.onMessage.addListener(msg => {
    if (msg?.op === 'query' && msg.job?.id) { startAskJob(port, msg); return; }
    if (msg?.op === 'attach') { attachAskJob(port, msg.id); return; }
    if (msg?.op === 'cancel') { cancelAskJob(msg.id); return; }
    if (msg?.op === 'running') { try { port.postMessage({ t: 'running', jobs: [...askJobs.values()].map(j => ({ id: j.id, job: j.job, text: j.text, steps: j.steps })) }); } catch { /* client gone */ } return; }
    if (msg?.op === 'orphans') { void takeAskOrphans().then(list => { try { port.postMessage({ t: 'orphans', list }); } catch { /* client gone */ } }); return; }
    if (!native) {
      try {
        native = chrome.runtime.connectNative('com.better_file_browser.llm');
      } catch (e) {
        try { port.postMessage({ t: 'native-gone', message: String(e) }); } catch { /* client gone */ }
        return;
      }
      native.onMessage.addListener(m => {
        try { port.postMessage(m); } catch { native.disconnect(); }
      });
      native.onDisconnect.addListener(() => {
        const err = chrome.runtime.lastError?.message || '';
        try { port.postMessage({ t: 'native-gone', message: err }); } catch { /* client gone */ }
      });
    }
    native.postMessage(msg);
  });
  port.onDisconnect.addListener(() => {
    try { native?.disconnect(); } catch { /* already closed */ }
    // An answer this page was watching keeps going; only its viewer left.
    for (const j of askJobs.values()) j.clients.delete(port);
  });
});

// Ask answers outlive the page that asked. The worker holds each answer's
// native stream and the text so far, so moving to another page does not stop
// it. A page that comes back to the same chat attaches and sees it continue.
// An answer that finishes with no page watching is parked under
// ORPHANS_KEY, and the next bfb page files it into the chat history.
// An open native port keeps the worker alive, so a running answer is not lost.
const askJobs = new Map();
const ORPHANS_KEY = 'ask-orphans-v1';   // outside the bfb- prefix, so it stays out of settings exports
function sendTo(port, frame) {
  if (!port) return false;
  try { port.postMessage(frame); return true; } catch { return false; }
}
function startAskJob(port, msg) {
  const { job, ...query } = msg;
  let native;
  try { native = chrome.runtime.connectNative('com.better_file_browser.llm'); }
  catch (e) { sendTo(port, { t: 'native-gone', message: String(e) }); return; }
  const j = { id: job.id, job, native, clients: new Set([port]), text: '', steps: [], gotFrame: false, over: false };
  askJobs.set(j.id, j);
  const finish = frame => {
    if (j.over) return;
    j.over = true;
    askJobs.delete(j.id);
    try { native.disconnect(); } catch { /* closed */ }
    let told = false;
    for (const c of j.clients) if (sendTo(c, frame)) told = true;
    if (told) return;
    void parkAskOrphan({ job: j.job, text: j.text, steps: j.steps, frame });
  };
  native.onMessage.addListener(m => {
    if (j.over || !m) return;
    if (m.t === 'chunk') { j.gotFrame = true; j.text += m.text ?? ''; }
    else if (m.t === 'step') { j.gotFrame = true; j.steps.push(m.text ?? ''); }
    if (m.t === 'done' || m.t === 'error') { finish(m); return; }
    for (const c of j.clients) sendTo(c, m);
  });
  native.onDisconnect.addListener(() => {
    finish({ t: 'error', code: j.gotFrame ? 'disconnected' : 'unavailable', message: chrome.runtime.lastError?.message || '' });
  });
  native.postMessage(query);
}
function attachAskJob(port, id) {
  const j = askJobs.get(id);
  if (!j) { sendTo(port, { t: 'gone' }); return; }
  j.clients.add(port);
  sendTo(port, { t: 'replay', text: j.text, steps: j.steps });
}
function cancelAskJob(id) {
  const j = askJobs.get(id);
  if (!j) return;
  j.over = true;
  askJobs.delete(id);
  try { j.native.disconnect(); } catch { /* closed */ }
}
// Parking and taking run one at a time, so two pages never file the same answer.
let orphanChain = Promise.resolve();
function parkAskOrphan(o) {
  orphanChain = orphanChain.then(async () => {
    const list = (await chrome.storage.local.get(ORPHANS_KEY))[ORPHANS_KEY] ?? [];
    list.push(o);
    await chrome.storage.local.set({ [ORPHANS_KEY]: list.slice(-50) });
  }).catch(() => {});
  return orphanChain;
}
function takeAskOrphans() {
  const taken = orphanChain.then(async () => {
    const list = (await chrome.storage.local.get(ORPHANS_KEY))[ORPHANS_KEY] ?? [];
    if (list.length) await chrome.storage.local.remove(ORPHANS_KEY);
    return list;
  });
  orphanChain = taken.then(() => {}, () => {});
  return taken.catch(() => []);
}

// Home's address, at the home folder bfb learned from a visit (kept as
// bfb-home-v1); before any visit, the top of the disk.
function homeUrl(home) {
  return typeof home === 'string' && /^\/Users\/[^/]+$/.test(home)
    ? 'file://' + home.split('/').map(encodeURIComponent).join('/') + '/#home'
    : 'file:///';
}

// Tells the local service reaper (svc) which service you are looking at, so one
// you are using stays up and one left in a background tab does not. Only the port
// of a local address leaves the browser, and only while that tab is active, its
// window focused and you are at the machine. The occasional report with no port
// says bfb is running, so svc can trust the silence.
const LOCAL_PORT = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):(\d+)(?:[/?#]|$)/;
const SEEN_ALARM = 'bfb-svc-seen';

async function reportActiveService() {
  let port = null;
  if (await chrome.idle.queryState(300) === 'active') {
    const win = await chrome.windows.getLastFocused({ populate: true });
    const tab = win.focused ? win.tabs?.find(t => t.active) : null;
    port = (tab?.url || '').match(LOCAL_PORT)?.[1] ?? null;
  }
  if (!port && Math.floor(Date.now() / 60000) % 5 !== 0) return;
  const native = chrome.runtime.connectNative('com.better_file_browser.notes');
  native.onMessage.addListener(() => native.disconnect());
  native.onDisconnect.addListener(() => void chrome.runtime.lastError);
  native.postMessage({ op: 'svc_seen', port });
}

// Recreating an alarm restarts its clock, and a worker that wakes often would
// then never see it fire.
chrome.alarms?.get(SEEN_ALARM).then(a => { if (!a) chrome.alarms.create(SEEN_ALARM, { periodInMinutes: 1 }); });
chrome.alarms?.onAlarm.addListener(a => { if (a.name === SEEN_ALARM) reportActiveService().catch(() => {}); });

// The toolbar button opens Home.
chrome.action?.onClicked.addListener(() => {
  chrome.storage.local.get('bfb-home-v1').then(r => chrome.tabs.create({ url: homeUrl(r['bfb-home-v1']) })).catch(() => {});
});

// A new Chrome tab opens Home when Settings says so (newTabHome, off by
// default). Off, Chrome's own new tab page shows as usual: bfb never takes
// the new tab over, it only sends this one tab on. Reading a new tab's
// address needs the tabs permission.
chrome.tabs?.onCreated?.addListener(tab => {
  const at = tab.pendingUrl || tab.url || '';
  if (!/^chrome:\/\/(newtab|new-tab-page)\/?$/.test(at)) return;
  chrome.storage.local.get(['bfb-settings-v1', 'bfb-home-v1']).then(r => {
    let on = false;
    try { on = JSON.parse(r['bfb-settings-v1'] || '{}').newTabHome === true; } catch { /* unreadable settings: leave the tab alone */ }
    if (on && r['bfb-home-v1']) return chrome.tabs.update(tab.id, { url: homeUrl(r['bfb-home-v1']) });
  }).catch(() => {});
});

// The toolbar button wears the app icon chosen in Settings, from PNGs rendered
// beside each SVG (a service worker cannot draw an SVG itself).
function setActionIcon(id) {
  if (!/^[a-z0-9-]{1,40}$/.test(id || '') || id === 'classic') return chrome.action.setIcon({ path: { 16: 'icon16.png', 48: 'icon48.png', 128: 'icon128.png' } });
  const p = size => `assets/app-icons/png/${id}-${size}.png`;
  return chrome.action.setIcon({ path: { 16: p(16), 32: p(32), 48: p(48), 128: p(128) } });
}
chrome.storage?.local?.get('bfb-app-icon').then(r => { if (r['bfb-app-icon']) setActionIcon(r['bfb-app-icon']).catch(() => {}); });
