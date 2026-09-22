// Behaviour inside rendered markdown, wherever it appears (file page, panel,
// help): the copy button on a code block, and an image that opens natively.
import { copyToClipboard } from './utils';
import type { Toast } from './toast';

export function initMarkdownUi(toast: Toast): void {
  const rendered = new WeakMap<HTMLElement, string>();
  const pending = new WeakSet<HTMLElement>();
  let sequence = 0;
  let queue = Promise.resolve();
  const theme = () => document.getElementById('fe')?.dataset.theme === 'light' ? 'light' : 'dark';
  const renderDiagrams = () => {
    document.querySelectorAll<HTMLElement>('.fe-md-mermaid').forEach(block => {
      if (pending.has(block) || rendered.get(block) === theme()) return;
      pending.add(block);
      queue = queue.then(async () => {
        if (!block.isConnected) return;
        const source = block.querySelector('.fe-md-mermaid-source')?.textContent || '';
        const view = block.querySelector<HTMLElement>('.fe-md-mermaid-view');
        if (!view) return;
        const currentTheme = theme();
        try {
          const { default: mermaid } = await import(chrome.runtime.getURL('vendor-mermaid.js')) as typeof import('./mermaid-runtime');
          mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', htmlLabels: false,
            suppressErrorRendering: true, theme: currentTheme === 'light' ? 'default' : 'dark' });
          const { svg } = await mermaid.render(`fe-mermaid-${++sequence}`, source);
          if (block.isConnected) view.innerHTML = svg;
        } catch {
          view.textContent = 'Could not render this Mermaid diagram.';
          block.querySelector<HTMLElement>('.fe-md-mermaid-source')?.removeAttribute('hidden');
        }
        rendered.set(block, currentTheme);
      }).catch(() => {}).finally(() => {
        pending.delete(block);
        if (block.isConnected && rendered.get(block) !== theme()) renderDiagrams();
      });
    });
  };
  const fe = document.getElementById('fe');
  if (fe) {
    new MutationObserver(renderDiagrams).observe(fe, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme'],
    });
    renderDiagrams();
  }
  document.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const copy = t.closest<HTMLElement>('.fe-md-copy');
    if (copy) {
      e.preventDefault();
      const pre = copy.closest('.fe-md-code')?.querySelector('pre');
      copyToClipboard(pre?.textContent || '').then(ok => toast(ok ? 'Copied the block' : 'Copy failed'));
      return;
    }
    const img = t.closest<HTMLImageElement>('.fe-md img');
    if (img && !img.closest('a')) { e.preventDefault(); window.open(img.src, '_blank'); }
  });
}
