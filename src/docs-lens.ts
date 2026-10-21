// The Comments lens: every markdown document that has comments, from the
// bfb-docs index (written by the page and by the CLI alike), with how many
// threads are open, the nearest due date and whether one waits on you. A
// click opens the document with its comments showing.
import { notes } from './notes';
import { esc, fileHref } from './utils';
import { icoFile } from './icons';
import { UI_ICON } from './control-icons';

export interface DocRow { doc: string; name: string; open: number; done: number; due?: string[]; mentions?: string[]; exists?: boolean; updated?: string }

/** The rows the lens shows: documents still on disk, open ones first, then by name. */
export function docRows(rows: DocRow[]): DocRow[] {
  return rows.filter(r => r.exists !== false && r.open + r.done > 0)
    .sort((a, b) => (b.open > 0 ? 1 : 0) - (a.open > 0 ? 1 : 0) || a.name.localeCompare(b.name));
}

export function initDocsLens(box: HTMLElement, home: string): void {
  let loaded = false;
  const short = (p: string) => (home && p.startsWith(home + '/') ? '~' + p.slice(home.length) : p).replace(/\/[^/]+$/, '') || '/';
  const due = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const paint = (rows: DocRow[]) => {
    const list = docRows(rows);
    if (!list.length) {
      box.innerHTML = `<div class="fe-cm-empty"><span class="fe-cm-empty-ico">${UI_ICON.comment}</span><p>No comments yet</p><p class="fe-cm-hint">Documents you or an agent<br>comment on show up here</p></div>`;
      return;
    }
    box.innerHTML = list.map(r => {
      const mine = (r.mentions ?? []).some(m => m === 'user' || m === 'owner');
      return `<button type="button" class="fe-doc-row" data-doc="${esc(r.doc)}" title="${esc(r.doc)}">
        <span class="fe-row-ico">${icoFile(r.name.split('.').pop()!.toLowerCase())}</span>
        <span class="fe-doc-tx"><span class="fe-doc-name">${esc(r.name)}</span><span class="fe-doc-dir">${esc(short(r.doc))}</span></span>
        ${mine ? `<span class="fe-doc-me" title="Mentions you">${UI_ICON.at}</span>` : ''}
        ${r.due?.length ? `<span class="fe-doc-due" title="Due ${esc(r.due[0])}">${esc(due(r.due[0]))}</span>` : ''}
        <span class="fe-doc-n${r.open ? '' : ' done'}" title="${r.open} open, ${r.done} done">${r.open || UI_ICON.check}</span>
      </button>`;
    }).join('');
  };
  const load = () => notes.docsIndex().then(paint).catch(err => {
    box.innerHTML = `<div class="fe-cm-empty"><p>Comments could not be listed</p><p class="fe-cm-hint">${esc((err as Error).message)}</p></div>`;
  });
  // Rows are buttons, not links: the page's link handlers rebuild a file
  // link from its path and would encode the #comments into the file name.
  box.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('.fe-doc-row');
    if (b) location.href = fileHref(b.dataset.doc!) + '#comments';
  });
  document.addEventListener('bfb-lens', e => {
    if ((e as CustomEvent).detail !== 'comments') return;
    if (!loaded) box.innerHTML = '<div class="fe-cm-empty"><p>Loading…</p></div>';
    loaded = true;
    void load();
  });
}
