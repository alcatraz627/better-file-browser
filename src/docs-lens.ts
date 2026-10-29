// The Comments lens: every markdown document that has comments, from the
// bfb-docs index (written by the page and by the CLI alike), with how many
// threads are open, the nearest due date and whether one waits on you. A
// filter narrows by name or folder, and two chips keep only what mentions
// you or has a due date. This folder, on by default, keeps the documents in
// the folder being browsed, up to four levels down. A click opens the
// document with its comments showing.
import { notes } from './notes';
import { esc, midHtml } from './utils';
import { icoFile } from './icons';
import { UI_ICON } from './control-icons';
import { addPaletteSource } from './commands';
import { emptyHtml, CLEAR } from './empty-state';
import { errorText } from './errors';
import { isWithin } from './places';

export interface DocRow { doc: string; name: string; open: number; done: number; due?: string[]; mentions?: string[]; tags?: string[]; exists?: boolean; updated?: string }
export interface DocFilter { q: string; me: boolean; due: boolean; tag?: string; here?: boolean; folder?: string }

// The index stores resolved paths, and macOS resolves /var, /tmp and /etc to
// /private/…; a person browses the short form, so the lens uses it too, or a
// document opened from here becomes a second tab beside the one already open.
export const browsedPath = (p: string) => p.replace(/^\/private\/(var|tmp|etc)(?=\/|$)/, '/$1');

export const forMe = (r: DocRow) => (r.mentions ?? []).some(m => m === 'user' || m === 'owner');

/** The rows the lens shows: documents still on disk that match the filter, open ones first, then by name. */
export function docRows(rows: DocRow[], f: DocFilter = { q: '', me: false, due: false }): DocRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter(r => r.exists !== false && r.open + r.done > 0)
    .filter(r => (!q || r.doc.toLowerCase().includes(q)) && (!f.me || forMe(r)) && (!f.due || !!r.due?.length) && (!f.tag || (r.tags ?? []).includes(f.tag))
      && (!f.here || !f.folder || isWithin(r.doc, f.folder)))
    .sort((a, b) => (b.open > 0 ? 1 : 0) - (a.open > 0 ? 1 : 0) || a.name.localeCompare(b.name));
}

export function initDocsLens(box: HTMLElement, home: string, folder: string, go: (path: string, hash: string) => void): void {
  let loaded = false, all: DocRow[] = [];
  const f: DocFilter = { q: '', me: false, due: false, tag: '', here: true, folder };
  box.innerHTML = `<div class="fe-docs-top" hidden>
      <input id="fe-docs-q" class="tb" data-size="lg" data-lead="search" type="text" placeholder="Filter" spellcheck="false" autocomplete="off" title="Matches the document's name and folder. Esc clears.">
      <div class="fe-lens-tags"><button type="button" class="chip fe-lens-tag" aria-pressed="false" data-f="here" title="Only documents in this folder, up to four levels down">This folder</button><button type="button" class="chip fe-lens-tag" aria-pressed="false" data-f="me" title="Only documents with a comment that mentions you">For me</button><button type="button" class="chip fe-lens-tag" aria-pressed="false" data-f="due" title="Only documents with a due date">Due</button><span class="fe-docs-tags"></span></div>
    </div><div class="fe-docs-rows"></div>`;
  const top = box.querySelector<HTMLElement>('.fe-docs-top')!, rowsBox = box.querySelector<HTMLElement>('.fe-docs-rows')!;
  const input = box.querySelector<HTMLInputElement>('#fe-docs-q')!;
  const short = (p: string) => (home && p.startsWith(home + '/') ? '~' + p.slice(home.length) : p).replace(/\/[^/]+$/, '') || '/';
  const due = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const paint = () => {
    const usable = docRows(all);
    top.hidden = !usable.length;
    for (const c of top.querySelectorAll<HTMLElement>('[data-f]')) { const on = !!f[c.dataset.f as 'me' | 'due' | 'here']; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); }
    // Tags in use across the listed documents, most used first; a chip filters to that tag.
    const counts = new Map<string, number>();
    for (const r of usable) for (const g of r.tags ?? []) counts.set(g, (counts.get(g) ?? 0) + 1);
    const tags = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([g]) => g);
    if (f.tag && !tags.includes(f.tag)) tags.push(f.tag);
    const tagBox = top.querySelector<HTMLElement>('.fe-docs-tags')!;
    const tagHtml = tags.map(g => `<button type="button" class="chip fe-lens-tag${f.tag === g ? ' on' : ''}" aria-pressed="${f.tag === g}" data-tag="${esc(g)}" title="Only documents with a thread tagged #${esc(g)}">#${esc(g)}</button>`).join('');
    if (tagBox.innerHTML !== tagHtml) tagBox.innerHTML = tagHtml;   // a chip under the pointer stays the same node
    const list = docRows(all, f);
    if (!usable.length) {
      rowsBox.innerHTML = emptyHtml('empty', 'No comments yet', { icon: UI_ICON.comment, hintHtml: 'Documents you or an agent<br>comment on show up here' });
      return;
    }
    if (!list.length) {
      // Only the folder scope hides everything: offer the rest in one click.
      const onlyHere = f.here && docRows(all, { ...f, here: false }).length > 0;
      rowsBox.innerHTML = onlyHere
        ? emptyHtml('filtered', 'No comments in this folder', { actions: [{ a: 'all', label: 'Show all', title: 'List commented documents from every folder' }] })
        : emptyHtml('filtered', 'No document matches', { actions: [CLEAR] });
      return;
    }
    rowsBox.innerHTML = list.map(r => `<button type="button" class="row fe-doc-row" data-doc="${esc(r.doc)}" title="${esc(r.doc)}">
        <span class="fe-row-ico">${icoFile(r.name.split('.').pop()!.toLowerCase())}</span>
        <span class="fe-doc-tx"><span class="fe-doc-name">${midHtml(r.name)}</span><span class="fe-doc-dir">${esc(short(r.doc))}</span></span>
        ${forMe(r) ? `<span class="fe-doc-me" title="Mentions you">${UI_ICON.at}</span>` : ''}
        ${r.due?.length ? `<span class="fe-doc-due" title="Due ${esc(r.due[0])}">${esc(due(r.due[0]))}</span>` : ''}
        <span class="badge fe-doc-n" data-tone="${r.open ? 'solid' : 'quiet'}" title="${r.open} open, ${r.done} done">${r.open || UI_ICON.check}</span>
      </button>`).join('');
  };
  const load = () => notes.docsIndex().then(rows => { all = rows.map(r => ({ ...r, doc: browsedPath(r.doc) })); paint(); }).catch(err => {
    top.hidden = true;
    rowsBox.innerHTML = emptyHtml('failed', 'Comments could not be listed', { hint: errorText(err), actions: [{ a: 'retry', label: 'Try again', title: 'List the commented documents again' }] });
  });
  input.addEventListener('input', () => { f.q = input.value; paint(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; f.q = ''; paint(); }
    e.stopPropagation();   // page keys must not fire while typing
  });
  top.addEventListener('click', e => {
    const tg = (e.target as Element).closest<HTMLElement>('[data-tag]');
    if (tg) { f.tag = f.tag === tg.dataset.tag ? '' : tg.dataset.tag!; paint(); return; }
    const c = (e.target as Element).closest<HTMLElement>('[data-f]');
    if (!c) return;
    const k = c.dataset.f as 'me' | 'due' | 'here';
    f[k] = !f[k];
    paint();
  });
  // Rows are buttons, not links: the page's link handlers rebuild a file
  // link from its path and would encode the #comments into the file name.
  rowsBox.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('.fe-doc-row');
    if (b) { go(b.dataset.doc!, '#comments'); return; }
    const a = (e.target as Element).closest<HTMLElement>('.empty [data-a]')?.dataset.a;
    if (a === 'clear') { input.value = ''; f.q = ''; f.tag = ''; f.me = f.due = f.here = false; paint(); input.focus(); }
    else if (a === 'all') { f.here = false; paint(); }
    else if (a === 'retry') { rowsBox.innerHTML = emptyHtml('loading', 'Loading…'); void load(); }
  });
  // Every commented document is in the palette's Comments tab; the list loads
  // on first use, so the palette fills that tab when it arrives.
  addPaletteSource(() => (loaded ? Promise.resolve(all) : (loaded = true, load().then(() => all))).then(rows => docRows(rows).map(r => ({
    title: r.name, sub: `${short(r.doc)} · ${r.open ? `${r.open} open` : 'all done'}`, group: 'Comments', tab: 'comments' as const,
    icon: icoFile(r.name.split('.').pop()!.toLowerCase()), run: () => go(r.doc, '#comments'),
  }))));
  document.addEventListener('bfb-lens', e => {
    if ((e as CustomEvent).detail !== 'comments') return;
    if (!loaded) rowsBox.innerHTML = emptyHtml('loading', 'Loading…');
    loaded = true;
    void load();
  });
}
