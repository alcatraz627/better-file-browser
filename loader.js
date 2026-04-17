// Runs at document_start — prevents the white flash of Chrome's default listing.
// Directory listing URLs always end with /, so we can detect them before DOM exists.
(function () {
  if (!window.location.pathname.endsWith('/')) return;
  const s = document.createElement('style');
  s.id = 'bfb-preload';
  s.textContent = `
    html { background: #0d1117 !important; }
    body { opacity: 0 !important; transition: opacity 0.15s ease; }
  `;
  document.documentElement.appendChild(s);
})();
