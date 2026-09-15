// Read a file:// URL as text. Chrome blocks page-context XHR/fetch between
// file:// URLs (opaque origins), so the primary path relays through the
// background service worker; direct XHR remains as a fallback for browsers
// where it still works or when the worker is unavailable.

// `context-invalidated`: the extension was reloaded under this page, so
// chrome.runtime is dead until the page refreshes. `read-failed`: the worker
// and the XHR fallback both failed to read the file.
export class FileFetchError extends Error {
  constructor(public code: 'context-invalidated' | 'read-failed', message: string) {
    super(message);
    this.name = 'FileFetchError';
  }
}

function xhrDirect(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload  = () => resolve(xhr.responseText);
    xhr.onerror = () => reject(new Error('XHR error'));
    xhr.send();
  });
}

type RelayReply = { ok: true; text: string } | { ok: false; error?: string };

// One round trip to the worker. Resolves null when the worker never answered,
// which is what an idle-terminated MV3 worker does on the first message after
// it wakes; the caller retries those.
function relayOnce(url: string): Promise<RelayReply | null> {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'bfb-fetch', url }, (res?: RelayReply) => {
      if (chrome.runtime.lastError || !res) resolve(null);
      else resolve(res);
    });
  });
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function fetchFileText(rawUrl: string, attempts = 3, delayMs = 150): Promise<string> {
  // Listing hrefs can be page-relative; the service worker resolves URLs
  // against the extension origin, so make them absolute here.
  const url = new URL(rawUrl, location.href).href;

  for (let i = 0; i < attempts; i++) {
    if (!chrome.runtime?.id) throw new FileFetchError('context-invalidated', 'extension reloaded under this page');
    let res: RelayReply | null;
    try { res = await relayOnce(url); }
    catch (e) { throw new FileFetchError('context-invalidated', String(e)); }
    if (res === null) { await sleep(delayMs * (i + 1)); continue; }
    if (res.ok) return res.text;
    return xhrDirect(url).catch(() => { throw new FileFetchError('read-failed', res.error || 'read failed'); });
  }
  return xhrDirect(url).catch(() => { throw new FileFetchError('read-failed', 'no reply from the extension worker'); });
}
