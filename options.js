// Chrome's "Options" item for bfb. Settings lives in bfb's own pages, so this
// tab is sent to Home with Settings open on Web pages.
chrome.runtime.sendMessage({ type: 'bfb-open-settings', tab: 'web', inTab: true }).catch(() => {
  document.body.textContent = 'Settings could not open. Open a folder in bfb and press , (comma).';
});
