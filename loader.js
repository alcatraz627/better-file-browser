// Runs at document_start — prevents the white flash before the explorer or
// the file page paints. Folder listings end with /; file pages are matched by
// extension (keep this list in step with src/file-page.ts filePageExt).
(function () {
  const p = window.location.pathname;
  const fileExt = /\.(md|mdx|txt|log|json|jsonl|ndjson|tsv|csv|sh|bash|zsh|fish|js|mjs|cjs|ts|tsx|jsx|py|rb|go|rs|java|kt|swift|c|cpp|h|cs|php|css|scss|less|html|htm|xml|svg|vue|svelte|yaml|yml|toml|ini|conf|env|sql|rst|lock|gitignore|diff|patch|jsonc|graphql|gql|proto)$/i;
  if (!p.endsWith('/') && !fileExt.test(p) && !/(?:Dockerfile|Containerfile|Makefile)$/i.test(p.split('/').pop() || '')) return;
  const s = document.createElement('style');
  s.id = 'bfb-preload';
  s.textContent = `
    html { background: #0d1117 !important; }
    body { opacity: 0 !important; transition: opacity 0.15s ease; }
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
