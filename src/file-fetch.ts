// Read a file:// URL as text. Chrome blocks page-context XHR/fetch between
// file:// URLs (opaque origins), so the primary path relays through the
// background service worker; direct XHR remains as a fallback for browsers
// where it still works or when the worker is unavailable.

function xhrDirect(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload  = () => resolve(xhr.responseText);
    xhr.onerror = () => reject(new Error('XHR error'));
    xhr.send();
  });
}

export function fetchFileText(rawUrl: string): Promise<string> {
  // Listing hrefs can be page-relative; the service worker resolves URLs
  // against the extension origin, so make them absolute here.
  const url = new URL(rawUrl, location.href).href;
  return new Promise((resolve, reject) => {
    let relayed = false;
    try {
      chrome.runtime.sendMessage({ type: 'bfb-fetch', url }, res => {
        if (relayed) return;
        relayed = true;
        if (chrome.runtime.lastError || !res) {
          xhrDirect(url).then(resolve, reject);
        } else if (res.ok) {
          resolve(res.text);
        } else {
          xhrDirect(url).then(resolve, () => reject(new Error(res.error || 'read failed')));
        }
      });
    } catch {
      xhrDirect(url).then(resolve, reject);
    }
  });
}
