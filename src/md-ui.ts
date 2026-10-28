// Behaviour inside rendered markdown, wherever it appears (file page, panel,
// help): the copy button on a code block, and an image that opens natively.
import { copyWithCheck } from './copy-done';
import { linkGccRefs } from './gcc-refs';
import type { Toast } from './toast';
import { fileExists, fetchFileText } from './file-fetch';
import { esc } from './utils';
import { go } from './nav';
import { decorateFileView } from './docviews';
import { mountDiagram } from './diagram-lab';
import { openDiagram } from './docview-media';

export function initMarkdownUi(toast: Toast): void {
  const mounted = new WeakSet<HTMLElement>();
  // Each diagram gets the viewer once; the viewer follows theme changes itself.
  const renderDiagrams = () => {
    document.querySelectorAll<HTMLElement>('.fe-md-mermaid').forEach(block => {
      if (mounted.has(block)) return;
      mounted.add(block);
      const view = block.querySelector<HTMLElement>('.fe-md-mermaid-view');
      if (!view) return;
      const src = block.querySelector('.fe-md-mermaid-source')?.textContent || '';
      // The words "Rendering diagram" show only if drawing takes long enough to notice.
      const slow = setTimeout(() => {
        const stage = view.querySelector('.dl-stage');
        if (stage && !view.dataset.ready && !stage.querySelector('.dl-msg')) stage.insertAdjacentHTML('beforeend', '<div class="dl-msg">Rendering diagram…</div>');
      }, 200);
      const name = decodeURIComponent(location.pathname.split('/').pop() || 'diagram').replace(/\.[^.]+$/, '');
      void mountDiagram(view, {
        src, name, compact: true,
        // On a markdown file's own page the large view reads the doc around the diagram too.
        expand: o => {
          if (!block.closest('#fe-page') || !/\.(md|markdown|mdx)$/i.test(location.pathname)) { openDiagram(o); return; }
          void fetchFileText(location.href).then(md => openDiagram({ ...o, md, file: location.href }), () => openDiagram(o));
        },
        onReady: () => clearTimeout(slow),
        onError: () => { clearTimeout(slow); showSource(block, true); },
      });
    });
  };
  const fe = document.getElementById('fe');
  if (fe) {
    // A file page whose doc has a view (a directions doc) is decorated once rendered, and again after a reload from disk.
    const directionsHere = () => {
      const md = document.querySelector<HTMLElement>('#fe-page .fe-md');
      if (md && !md.dataset.docview) decorateFileView(md, decodeURIComponent(location.pathname), m => toast(m));
    };
    directionsHere();
    new MutationObserver(() => { renderDiagrams(); linkFrontMatterPaths(); linkGccRefs(); directionsHere(); }).observe(fe, {
      childList: true, subtree: true,
    });
    renderDiagrams();
    linkFrontMatterPaths();
    linkGccRefs();
  }
  document.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const copy = t.closest<HTMLElement>('.fe-md-copy');
    if (copy) {
      e.preventDefault();
      const pre = copy.closest('.fe-md-code')?.querySelector('pre');
      void copyWithCheck(copy, pre?.textContent || '').then(ok => { if (!ok) toast('Copy failed'); });
      return;
    }
    const img = t.closest<HTMLImageElement>('.fe-md img');
    if (img && !img.closest('a, [data-docview]')) { e.preventDefault(); go(img.src, 'chrome-tab'); }
  });
}

/// Show the source under a diagram that could not be drawn.
function showSource(block: HTMLElement, on: boolean): void {
  block.querySelector<HTMLElement>('.fe-md-mermaid-source')?.toggleAttribute('hidden', !on);
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
