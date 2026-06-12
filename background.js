// Reads file:// content on behalf of content scripts. Page-context XHR to
// file:// is blocked by CORS in modern Chrome (file pages have an opaque
// origin); the extension service worker can still fetch file URLs as long as
// "Allow access to file URLs" is enabled.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'bfb-fetch') return;
  fetch(msg.url)
    .then(r => r.text())
    .then(text => sendResponse({ ok: true, text }))
    .catch(err => sendResponse({ ok: false, error: String(err) }));
  return true; // keep the message channel open for the async response
});
