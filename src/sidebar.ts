// The sidebar: the Saved list (star or + adds, tags group, drag reorders,
// a filter box), the Notes list from the Settings folder, and the bookmark
// gestures shared by sidebar rows, crumbs and the crumb dropdown.
import type { App } from './app';
import type { NotesError } from './notes';
import { el, els } from './el';
import { esc } from './utils';
import { PI } from './icons';
import { UI_ICON } from './control-icons';
import { getSaved, saveSaved, getTags, saveTags } from './storage';
import { upsertPlace, removePlace, renamePlace, movePlace, setTags, parseTags, cycleTagColor } from './places';
import { renderSavedList } from './render';
import { notes, noteTitle, slugForTitle, setTitle, pinnedFirst, colorName, readProps, applyChange, changedKeys, frontmatterDrift, type NoteMeta } from './notes';
import { colorDot, openPropsMenu } from './note-meta-ui';
import { openNote } from './preview';
import { isViewPath } from './find';

export function initSidebar(app: App): void {
  const { rawPath, settings, toast } = app;
  const collapseKey = 'bfb-sidebar-collapsed-v1';
  const sections = els<HTMLElement>('#fe-side .fe-sec[data-collapse]');
  const collapsed = (): Set<string> => {
    try {
      const value = JSON.parse(localStorage.getItem(collapseKey) || '[]');
      return new Set(Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
    } catch { return new Set(); }
  };
  const applyCollapsed = (keys: Set<string>): void => {
    for (const section of sections) {
      const key = section.dataset.collapse!;
      const isCollapsed = keys.has(key);
      section.classList.toggle('fe-collapsed', isCollapsed);
      const toggle = section.querySelector<HTMLButtonElement>('.fe-sh-collapse')!;
      const label = toggle.dataset.label!;
      toggle.setAttribute('aria-expanded', String(!isCollapsed));
      toggle.setAttribute('aria-label', `${isCollapsed ? 'Expand' : 'Collapse'} ${label}`);
      if (settings.tooltips !== false) toggle.title = `${isCollapsed ? 'Expand' : 'Collapse'} ${label}`;
      else toggle.removeAttribute('title');
    }
  };
  for (const section of sections) {
    const header = section.querySelector<HTMLElement>(':scope > .fe-sh')!;
    const labelNode = header.querySelector<HTMLElement>('.fe-sh-label')!;
    const label = labelNode.textContent!.trim();
    const key = section.dataset.collapse!;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'fe-sh-collapse';
    toggle.id = `fe-sec-toggle-${key}`;
    toggle.dataset.label = label;
    toggle.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    toggle.append(labelNode);
    toggle.addEventListener('click', () => {
      const keys = collapsed();
      if (section.classList.contains('fe-collapsed')) keys.delete(key); else keys.add(key);
      localStorage.setItem(collapseKey, JSON.stringify([...keys]));
      applyCollapsed(keys);
    });
    header.prepend(toggle);
  }
  applyCollapsed(collapsed());
  window.addEventListener('storage', e => { if (e.key === collapseKey) applyCollapsed(collapsed()); });
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
  // A Saved-row single click navigates, a double-click renames; defer the
  // navigation so the double-click can cancel it and rename instead.
  let clickTimer: ReturnType<typeof setTimeout> | null = null;
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
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
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
  // preview panel.
  const ntList = el('fe-nt-list');
  const ntHint = el('fe-st-notes-hint');
  function notesRoot(): string { return (settings.notesRoot || '').replace(/\/$/, ''); }
  function refreshNotes(): void {
    const root = notesRoot();
    if (!root) {
      ntHint.textContent = '';
      el<HTMLAnchorElement>('fe-notes-root').removeAttribute('href');
      ntList.innerHTML = '<div class="fe-hint">Choose a folder to store your notes.<br><button id="fe-nt-setup" class="fe-hint-action" title="Choose a Notes folder in Settings">Set notes folder</button></div>';
      el('fe-nt-setup').addEventListener('click', () => {
        app.openSettings('notes');
        el<HTMLInputElement>('fe-st-notes-root').focus();
      });
      return;
    }
    el<HTMLAnchorElement>('fe-notes-root').href = 'file://' + root + '/';
    notes.list(root).then(unsorted => {
      const list = pinnedFirst(unsorted);
      ntHint.textContent = `${list.length} note${list.length !== 1 ? 's' : ''} in ${root}`;
      ntList.innerHTML = list.length
        ? list.map(n => `
          <div class="fe-bm-item fe-nt-item${n.pinned ? ' pinned' : ''}" data-rel="${esc(n.rel)}">
            <a href="file://${esc(root + '/' + n.rel)}" class="fe-si-link" title="${esc(n.rel)}">
              ${PI.docs ?? PI.folder}${noteRowText(n)}
            </a>
            <button class="fe-nt-props" data-rel="${esc(n.rel)}" title="Colour, pin and tags" aria-label="Colour, pin and tags for ${esc(n.title || noteTitle(n.rel))}">${UI_ICON.palette}</button>
            <button class="fe-nt-tab" data-rel="${esc(n.rel)}" title="Open in a page tab" aria-label="Open ${esc(n.title || noteTitle(n.rel))} in a page tab">${UI_ICON.tab}</button>
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
  // Title, then tags beneath; the colour dot and pin sit after the title.
  function noteRowText(n: NoteMeta): string {
    const tags = (n.tags ?? []).length ? `<span class="fe-nt-tags">${n.tags!.map(t => `<span>${UI_ICON.tag}${esc(t)}</span>`).join('')}</span>` : '';
    const flags = (colorName(n.color) || n.pinned)
      ? `<span class="fe-nt-flags">${colorName(n.color) ? colorDot(colorName(n.color)) : ''}${n.pinned ? `<span class="fe-nt-pin" title="Pinned">${UI_ICON.pin}</span>` : ''}</span>` : '';
    return `<span class="fe-nt-main"><span class="fe-sl fe-nt-label" title="Double-click to rename">${esc(n.title || noteTitle(n.rel))}</span>${tags}</span>${flags}`;
  }
  function openNoteRel(root: string, rel: string): void {
    notes.read(root, rel).then(doc => openNote(root, doc, refreshNotes))
      .catch((err: NotesError) => toast(err.message));
  }
  function attachNoteEvents(root: string): void {
    els('.fe-nt-item', ntList).forEach(item => {
      const rel = item.dataset.rel!;
      item.querySelector<HTMLElement>('.fe-si-link')!.addEventListener('click', e => {
        if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;   // the shell's gestures take those
        e.preventDefault();
        if (e.detail > 1) return;   // a double-click renames; ignore the second click
        // Defer the editor open so a double-click can cancel it and rename.
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickTimer = null; openNoteRel(root, rel); }, 250);
      });
      item.querySelector<HTMLElement>('.fe-nt-label')!.addEventListener('dblclick', e => {
        e.preventDefault(); e.stopPropagation();
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
        inlineEdit(e.currentTarget as HTMLElement, val => {
          // A note with front matter belongs to a shared store whose id is its file
          // name (Switchboard, the Pi): renaming it sets the title and keeps the file.
          notes.read(root, rel).then(doc => {
            const titled = setTitle(doc.text, val);
            if (titled !== null) return notes.write(root, rel, titled, doc.mtime).then(refreshNotes);
            const to = rel.replace(/[^/]+$/, slugForTitle(val));
            return notes.rename(root, rel, to).then(refreshNotes);
          }).catch((err: NotesError) => toast(err.message));
        });
      });
      item.querySelector('.fe-rm-btn')!.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        notes.delete(root, rel).then(() => { refreshNotes(); toast('Moved to .trash'); })
          .catch((err: NotesError) => toast(err.message));
      });
      item.querySelector<HTMLElement>('.fe-nt-props')!.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const anchor = e.currentTarget as HTMLElement;
        notes.read(root, rel).then(doc => openPropsMenu(anchor, readProps(rel, doc.text), async c => {
          const cur = await notes.read(root, rel);
          const next = applyChange(cur.text, c);
          if (frontmatterDrift(cur.text, next, changedKeys(c)).length) { toast('Not saved: that would change other properties'); return; }
          try { await notes.write(root, rel, next, cur.mtime); } catch (err) { toast((err as NotesError).message); return; }
          refreshNotes();
          return readProps(rel, next);
        })).catch((err: NotesError) => toast(err.message));
      });
      item.querySelector('.fe-nt-tab')!.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        app.strip.go(root.replace(/\/$/, '') + '/' + rel);
      });
    });
  }
  app.newNote = () => {
    const root = notesRoot();
    if (!root) { app.openSettings('notes'); el<HTMLInputElement>('fe-st-notes-root').focus(); return; }
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const rel = `untitled-${stamp}.md`;
    notes.create(root, rel, '')
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
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const path = anchorPath(a);
      if (e.altKey) { e.preventDefault(); app.strip.open(isViewPath(path) ? path.split('#')[0] : path, true); return; }
      if (host.id !== 'fe-side' || a.closest('#fe-nt-list') || isViewPath(path)) return;
      // Prevent the anchor's own navigation on both clicks, so the second click
      // of a double-click cannot navigate before the rename fires.
      e.preventDefault();
      if (e.detail > 1) return;
      if (a.closest('.fe-pl-item')) {
        // A Saved row renames on double-click; defer the go so a rename cancels it.
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickTimer = null; app.strip.go(path); }, 250);
      } else {
        app.strip.go(path);
      }
    });
  }
}
