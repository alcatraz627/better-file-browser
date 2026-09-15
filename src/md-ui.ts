// Behaviour inside rendered markdown, wherever it appears (file page, panel,
// help): the copy button on a code block, and an image that opens natively.
import { copyToClipboard } from './utils';
import type { Toast } from './toast';

export function initMarkdownUi(toast: Toast): void {
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
