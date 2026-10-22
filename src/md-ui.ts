// Behaviour inside rendered markdown, wherever it appears (file page, panel,
// help): the copy button on a code block, and an image that opens natively.
import { copyToClipboard } from './utils';
import { UI_ICON } from './control-icons';
import type { Toast } from './toast';
import { fileExists } from './file-fetch';
import { esc } from './utils';

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
    new MutationObserver(() => { renderDiagrams(); linkFrontMatterPaths(); }).observe(fe, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme'],
    });
    renderDiagrams();
    linkFrontMatterPaths();
  }
  document.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const copy = t.closest<HTMLElement>('.fe-md-copy');
    if (copy) {
      e.preventDefault();
      const pre = copy.closest('.fe-md-code')?.querySelector('pre');
      copyToClipboard(pre?.textContent || '').then(ok => {
        if (!ok) { toast('Copy failed'); return; }
        // A green check stands in for the icon for 3s; a second copy restarts it.
        clearTimeout(Number(copy.dataset.timer));
        copy.dataset.done = '';
        copy.innerHTML = UI_ICON.check;
        copy.dataset.timer = String(window.setTimeout(() => { delete copy.dataset.done; copy.innerHTML = UI_ICON.copy; }, 3000));
      });
      return;
    }
    const img = t.closest<HTMLImageElement>('.fe-md img');
    if (img && !img.closest('a')) { e.preventDefault(); window.open(img.src, '_blank'); }
  });
}

/// Front matter values that name a file become links when the file is there.
/// A relative path is tried from the document's folder, then from each folder
/// above it, so `features/x.md` in a file under ~/.claude/features finds
/// ~/.claude/features/x.md. A path found nowhere stays plain text.
const looked = new WeakSet<HTMLElement>();
function linkFrontMatterPaths(): void {
  document.querySelectorAll<HTMLElement>('.fe-md-fm .fe-fm-path').forEach(span => {
    if (looked.has(span) || span.tagName === 'A') return;
    looked.add(span);
    const base = span.closest<HTMLElement>('.fe-md-fm')?.dataset.fmBase || location.href;
    const rel = span.dataset.fmPath || '';
    void findPath(rel, base).then(url => {
      if (!url || !span.isConnected) return;
      const a = document.createElement('a');
      a.className = 'fe-fm-path';
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.title = decodeURIComponent(new URL(url).pathname);
      a.innerHTML = esc(rel);
      span.replaceWith(a);
    });
  });
}

async function findPath(rel: string, base: string): Promise<string | null> {
  let dir: URL;
  try { dir = new URL('.', new URL(base, location.href)); } catch { return null; }
  const home = /^\/(Users|home)\/[^/]+\//.exec(dir.pathname)?.[0];
  const tries: string[] = [];
  if (rel.startsWith('/')) tries.push('file://' + rel);
  else if (rel.startsWith('~/')) { if (home) tries.push('file://' + home + rel.slice(2)); }
  else for (let d = dir, k = 0; k < 8; k++) {
    tries.push(new URL(rel, d).href);
    const up = new URL('..', d);
    if (up.href === d.href) break;
    d = up;
  }
  for (const url of tries) {
    if (await fileExists(url)) return url;
  }
  return null;
}
