// Runs at document_start — prevents the white flash before the explorer or
// the file page paints. Folder listings end with /; file pages are matched by
// extension (keep this list in step with src/file-page.ts filePageExt).
(function () {
  const p = window.location.pathname;
  const fileExt = /\.(md|mdx|txt|log|json|jsonl|ndjson|tsv|csv|sh|bash|zsh|fish|js|mjs|cjs|ts|tsx|jsx|py|rb|go|rs|java|kt|swift|c|cpp|h|cs|php|css|scss|less|html|htm|xml|svg|vue|svelte|yaml|yml|toml|ini|conf|env|sql|rst|lock|gitignore)$/i;
  if (!p.endsWith('/') && !fileExt.test(p)) return;
  const s = document.createElement('style');
  s.id = 'bfb-preload';
  s.textContent = `
    html { background: #0d1117 !important; }
    body { opacity: 0 !important; transition: opacity 0.15s ease; }
  `;
  document.documentElement.appendChild(s);
})();
