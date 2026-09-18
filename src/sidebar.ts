// The sidebar: the Saved list (star or + adds, tags group, drag reorders,
// a filter box), the Notes list from the Settings folder, and the bookmark
// gestures shared by sidebar rows, crumbs and the crumb dropdown.
import type { App } from './app';
import type { NotesError } from './notes';
import { el, els } from './el';
import { esc } from './utils';
import { PI } from './icons';
import { getSaved, saveSaved, getTags, saveTags } from './storage';
import { upsertPlace, removePlace, renamePlace, movePlace, setTags, parseTags, cycleTagColor } from './places';
import { renderSavedList } from './render';
import { notes, noteTitle, newNoteText, slugForTitle } from './notes';
import { openNote } from './preview';
import { isViewPath } from './find';

export function initSidebar(app: App): void {
  const { rawPath, settings, toast } = app;
  const svList = el('fe-sv-list');
  const svFilter = el<HTMLInputElement>('fe-sv-filter');
  let dragSrc: HTMLElement | null = null;

  function syncStar(): void {
    const on = getSaved().some(p => p.path === rawPath);
    const btn = el('fe-bm-btn');
    btn.classList.toggle('on', on);
    btn.title = on ? 'Remove this folder from Saved' : 'Save this folder (sidebar)';
    el('fe-bm-path').setAttribute('fill', on ? 'currentColor' : 'none');
  }
  function refreshSaved(): void {
    svList.innerHTML = renderSavedList(getSaved(), getTags(), rawPath, svFilter.value);
    attachSavedEvents();
    syncStar();
  }
  app.refreshSaved = refreshSaved;
  svFilter.addEventListener('input', refreshSaved);
  svFilter.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); svFilter.value = ''; refreshSaved(); svFilter.blur(); }
  });

  // Inline edit of a label or a tag list: contentEditable on the span,
  // Enter saves, Esc restores, blur saves.
  function inlineEdit(target: HTMLElement, onSave: (val: string) => void): void {
    const orig = target.textContent || '';
    target.contentEditable = 'true';
    target.classList.add('editing');
    target.focus();
    const range = document.createRange(); range.selectNodeContents(target);
    const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range);
    let done = false;
    const finish = (save: boolean) => {
      if (done) return; done = true;
      const val = (target.textContent || '').trim();
      target.contentEditable = 'false'; target.classList.remove('editing');
      if (save && val !== orig) onSave(val);
      refreshSaved();
    };
    target.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); target.textContent = orig; finish(false); }
      e.stopPropagation();
    });
    target.addEventListener('blur', () => finish(true), { once: true });
  }
  function attachSavedEvents(): void {
    els('.fe-rm-btn', svList).forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        saveSaved(removePlace(getSaved(), btn.dataset.path!));
        refreshSaved(); toast('Removed from Saved');
      });
    });
    els('.fe-pl-label', svList).forEach(lbl => {
      lbl.addEventListener('dblclick', e => {
        e.preventDefault(); e.stopPropagation();
        const path = lbl.closest<HTMLElement>('.fe-pl-item')!.dataset.path!;
        inlineEdit(lbl, val => { if (val) saveSaved(renamePlace(getSaved(), path, val)); });
      });
    });
    els('.fe-tag-btn', svList).forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        const item = btn.closest<HTMLElement>('.fe-pl-item')!;
        const path = item.dataset.path!;
        const tagsEl = item.querySelector<HTMLElement>('.fe-pl-tags')!;
        tagsEl.textContent = (getSaved().find(p => p.path === path)?.tags ?? []).join(', ');
        tagsEl.classList.add('show');
        inlineEdit(tagsEl, val => saveSaved(setTags(getSaved(), path, parseTags(val))));
      });
    });
    els('.fe-sv-dot', svList).forEach(dot => {
      dot.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        saveTags(cycleTagColor(getTags(), dot.dataset.tag!));
        refreshSaved();
      });
    });
    els('.fe-pl-item', svList).forEach(item => {
      item.addEventListener('dragstart', e => {
        dragSrc = item; (e as DragEvent).dataTransfer!.effectAllowed = 'move';
        setTimeout(() => item.classList.add('dragging'), 0);
      });
      item.addEventListener('dragend',  () => item.classList.remove('dragging'));
      item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('drag-over'); });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
      item.addEventListener('drop', e => {
        e.stopPropagation(); e.preventDefault();
        item.classList.remove('drag-over');
        if (!dragSrc || dragSrc === item) return;
        saveSaved(movePlace(getSaved(), dragSrc.dataset.path!, item.dataset.path!));
        refreshSaved();
      });
    });
  }
  function addCurrentFolder(rename: boolean): void {
    const label = rawPath.split('/').filter(Boolean).pop() || '/';
    saveSaved(upsertPlace(getSaved(), { path: rawPath, label }));
    refreshSaved();
    toast('Saved');
    if (!rename) return;
    const fresh = els('.fe-pl-item', svList).find(i => i.dataset.path === rawPath);
    const lbl = fresh?.querySelector<HTMLElement>('.fe-pl-label');
    if (lbl) lbl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  }
  el('fe-sv-add').addEventListener('click', () => addCurrentFolder(true));
  el('fe-bm-btn').addEventListener('click', () => {
    if (getSaved().some(p => p.path === rawPath)) {
      saveSaved(removePlace(getSaved(), rawPath));
      refreshSaved(); toast('Removed from Saved');
    } else addCurrentFolder(false);
  });
  attachSavedEvents();
  syncStar();

  // Notes: the folder from Settings, listed newest first, edited in the
  // preview panel. Hidden until a folder is set.
  const ntSec  = el('fe-notes-sec');
  const ntList = el('fe-nt-list');
  const ntHint = el('fe-st-notes-hint');
  function notesRoot(): string { return (settings.notesRoot || '').replace(/\/$/, ''); }
  function refreshNotes(): void {
    const root = notesRoot();
    ntSec.style.display = root ? '' : 'none';
    if (!root) { ntHint.textContent = ''; return; }
    el<HTMLAnchorElement>('fe-notes-root').href = 'file://' + root + '/';
    notes.list(root).then(list => {
      ntHint.textContent = `${list.length} note${list.length !== 1 ? 's' : ''} in ${root}`;
      ntList.innerHTML = list.length
        ? list.map(n => `
          <div class="fe-bm-item fe-nt-item" data-rel="${esc(n.rel)}">
            <a href="file://${esc(root + '/' + n.rel)}" class="fe-si-link" title="${esc(n.rel)}">
              ${PI.docs ?? PI.folder}<span class="fe-sl fe-nt-label" title="Double-click to rename">${esc(noteTitle(n.rel))}</span>
            </a>
            <button class="fe-rm-btn" data-rel="${esc(n.rel)}" title="Move to .trash">✕</button>
          </div>`).join('')
        : `<div class="fe-hint">No notes yet.<br>Press n or + to write one.</div>`;
      attachNoteEvents(root);
    }).catch((err: NotesError) => {
      ntHint.textContent = err.message;
      ntList.innerHTML = `<div class="fe-hint">${esc(err.code === 'unavailable' ? 'Notes host not installed. Run native/install.sh.' : err.message)}</div>`;
    });
  }
  app.refreshNotes = refreshNotes;
  function openNoteRel(root: string, rel: string): void {
    notes.read(root, rel).then(doc => openNote(root, doc, refreshNotes))
      .catch((err: NotesError) => toast(err.message));
  }
  function attachNoteEvents(root: string): void {
    els('.fe-nt-item', ntList).forEach(item => {
      const rel = item.dataset.rel!;
      item.querySelector<HTMLElement>('.fe-si-link')!.addEventListener('click', e => {
        if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;   // the shell's gestures take those
        e.preventDefault(); openNoteRel(root, rel);
      });
      item.querySelector<HTMLElement>('.fe-nt-label')!.addEventListener('dblclick', e => {
        e.preventDefault(); e.stopPropagation();
        inlineEdit(e.currentTarget as HTMLElement, val => {
          const to = rel.replace(/[^/]+$/, slugForTitle(val));
          notes.rename(root, rel, to).then(refreshNotes).catch((err: NotesError) => toast(err.message));
        });
      });
      item.querySelector('.fe-rm-btn')!.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        notes.delete(root, rel).then(() => { refreshNotes(); toast('Moved to .trash'); })
          .catch((err: NotesError) => toast(err.message));
      });
    });
  }
  app.newNote = () => {
    const root = notesRoot();
    if (!root) { toast('Set a Notes folder in Settings first'); return; }
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const rel = `untitled-${stamp}.md`;
    notes.create(root, rel, newNoteText('Untitled'))
      .then(() => openNoteRel(root, rel))
      .catch((err: NotesError) => toast(err.message));
  };
  el('fe-nt-add').addEventListener('click', () => app.newNote());
  refreshNotes();

  // Sidebar rows are bookmarks: a plain click switches to the strip tab that
  // already holds the place, or keeps a new one, and goes there. Crumbs and
  // dropdown items just go. Alt keeps a background tab everywhere; Chrome's
  // own modifier and middle clicks pass through. Notes rows keep the editor.
  const anchorPath = (a: HTMLAnchorElement) => decodeURIComponent((a.getAttribute('href') || '').slice(7));
  for (const host of [el('fe-side'), el('fe-bc'), el('fe-crumb-menu')]) {
    host.addEventListener('click', e => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="file://"]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || e.detail > 1) return;
      const path = anchorPath(a);
      if (e.altKey) { e.preventDefault(); app.strip.open(isViewPath(path) ? path.split('#')[0] : path, true); return; }
      if (host.id !== 'fe-side' || a.closest('#fe-nt-list') || isViewPath(path)) return;
      e.preventDefault();
      app.strip.go(path);
    });
  }
}
