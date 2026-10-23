// Runs at document_start — prevents the white flash before the explorer or
// the file page paints. Folder listings end with /; file pages are matched by
// extension (keep this list in step with src/file-page.ts filePageExt).
(function () {
  const p = window.location.pathname;
  const fileExt = /\.(md|mdx|txt|log|json|jsonl|ndjson|tsv|csv|sh|bash|zsh|fish|js|mjs|cjs|ts|tsx|jsx|py|rb|go|rs|java|kt|swift|c|cpp|h|cs|php|css|scss|less|html|htm|xml|svg|vue|svelte|yaml|yml|toml|ini|conf|env|sql|rst|lock|gitignore|diff|patch|jsonc|graphql|gql|proto)$/i;
  if (!p.endsWith('/') && !fileExt.test(p) && !/(?:Dockerfile|Containerfile|Makefile)$/i.test(p.split('/').pop() || '')) return;
  // An HTML file the explorer will take over gets a no-scripts policy before
  // Chrome parses it, so the file's own scripts never run. The list is a copy
  // of the Settings choice (src/storage.ts syncHtmlGuard). A policy only
  // counts inside a <head>, so one is added; the parser adds its own later,
  // which is harmless because the explorer replaces the page.
  const htmlExt = (p.match(/\.(html?)$/i) || [])[1];
  let takeover = '';
  try { takeover = localStorage.getItem('bfbHtmlTakeover') || ''; } catch (e) { /* storage blocked */ }
  if (htmlExt && takeover.split(' ').includes(htmlExt.toLowerCase())) {
    const head = document.head || document.documentElement.appendChild(document.createElement('head'));
    const csp = document.createElement('meta');
    csp.httpEquiv = 'Content-Security-Policy';
    csp.content = "script-src 'none'";
    head.prepend(csp);
  }
  // The cover is the colour the last page was drawn in (src/storage.ts
  // PAGE_BG_KEY), so a light theme never flashes dark between pages.
  // Kept per theme with the theme choice; a page that follows the system, or
  // a first page with nothing kept, goes by the system's appearance now.
  let mode = '', kept = '';
  try { mode = localStorage.getItem('bfbPageBg-mode') || ''; } catch (e) { /* storage blocked */ }
  const theme = mode === 'light' || mode === 'dark' ? mode : (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  try { kept = localStorage.getItem('bfbPageBg-' + theme) || ''; } catch (e) { /* storage blocked */ }
  const bg = /^(rgba?\([\d.,\s]+\)|#[0-9a-f]{3,8})$/i.test(kept) ? kept : theme === 'light' ? 'rgb(238, 243, 245)' : 'rgb(15, 19, 22)';
  // The shell's cards as the last page drew them, so the one frame Chrome
  // paints between two pages shows the app's outline rather than a blank.
  const colour = /^(rgba?\([\d.,\s]+\)|#[0-9a-f]{3,8})$/i;
  let cards = '';
  try {
    const shapes = JSON.parse(localStorage.getItem('bfbPageBg-shapes-' + theme) || '[]');
    cards = (Array.isArray(shapes) ? shapes : []).filter(c => c && colour.test(c.c) && ['x', 'y', 'r', 'b'].every(k => Number.isFinite(c[k])))
      .map(c => `linear-gradient(${c.c},${c.c}) ${c.x}px ${c.y}px / calc(100vw - ${c.x + c.r}px) calc(100vh - ${c.y + c.b}px) no-repeat,`).join('');
  } catch (e) { /* nothing kept: plain cover */ }
  const s = document.createElement('style');
  s.id = 'bfb-preload';
  s.textContent = `
    html { background: ${cards} ${bg} !important; }
    body { opacity: 0 !important; }
  `;
  document.documentElement.appendChild(s);
  // Chrome never finishes listing a folder it may not read, so the explorer
  // never starts and the cover would stay up for good. After a wait, show
  // Chrome's page with a note; the explorer replaces both if it starts later.
  if (!p.endsWith('/')) return;
  setTimeout(function () {
    if (document.readyState !== 'loading' || document.getElementById('fe')) return;
    s.remove();
    const note = document.createElement('div');
    note.id = 'bfb-slow-note';
    note.style.cssText = 'margin:16px 0;padding:10px 14px;border-radius:8px;background:#fff4e5;color:#5c3b00;font:14px -apple-system,system-ui,sans-serif';
    note.textContent = 'This folder is still listing. If nothing appears, macOS may not allow reading it: check the folder’s permissions in Finder (Get Info).';
    (document.body || document.documentElement).prepend(note);
  }, 3000);
})();
