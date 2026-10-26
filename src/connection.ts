// Tells the person, quietly and at once, when this page has lost its
// extension: after the extension is reloaded or updated, the page that was
// open keeps its look but nothing behind it works, and without this it only
// says so when an action fails.
import { reload } from './nav';

const CHECK_MS = 2000;

/// Whether the extension this page was started by is still there. Chrome clears
/// the runtime id of a content script whose extension went away.
export function extensionAlive(): boolean {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

/// Watch the connection; the first time it is gone, a banner under the toolbar offers a refresh.
export function watchConnection(): void {
  const fe = document.getElementById('fe');
  if (!fe) return;
  let timer = 0;
  const check = () => {
    if (extensionAlive()) return;
    clearInterval(timer);
    document.removeEventListener('visibilitychange', check);
    window.removeEventListener('focus', check);
    showBanner(fe);
  };
  timer = window.setInterval(check, CHECK_MS);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
}

function showBanner(fe: HTMLElement): void {
  if (document.getElementById('fe-conn')) return;
  const bar = document.createElement('div');
  bar.id = 'fe-conn';
  bar.className = 'notice';
  bar.dataset.tone = 'warn';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `<span>The extension was reloaded, so this page can no longer open files or ask the model. Refresh to carry on.</span><button type="button" class="btn" data-size="sm" data-variant="outline" id="fe-conn-reload">Refresh page</button>`;
  bar.querySelector('#fe-conn-reload')!.addEventListener('click', () => reload());
  const body = document.getElementById('fe-body');
  fe.insertBefore(bar, body);
}
