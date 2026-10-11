// The sidebar: the Saved list (star or + adds, tags group, drag reorders,
// a filter box), the Notes list from the Settings folder, and the bookmark
// gestures shared by sidebar rows, crumbs and the crumb dropdown.
import type { App } from './app';
import type { NotesError } from './notes';
import { el, els } from './el';
import { esc, copyToClipboard, midHtml } from './utils';
import { PI } from './icons';
import { UI_ICON } from './control-icons';
import { getSaved, saveSaved, getTags, saveTags, saveSettings } from './storage';
import { upsertPlace, removePlace, renamePlace, movePlace, setTags, parseTags, cycleTagColor } from './places';
import { renderSavedList } from './render';
import { notes, noteTitle, slugForTitle, setTitle, pinnedFirst, filterNotes, colorName, readProps, applyChange, changedKeys, frontmatterDrift, type NoteMeta } from './notes';
import { colorDot, openPropsMenu } from './note-meta-ui';
import { openNote, discardEditor, editingRel, saveEditor, type NoteActions } from './preview';
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
  function inlineEdit(target: HTMLElement, onSave: (val: string) => void, onCancel?: () => void): void {
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
      if (save && val !== orig) onSave(val); else onCancel?.();
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
  const ntFilter = el<HTMLInputElement>('fe-nt-filter');
  let allNotes: NoteMeta[] = [];
  function renderNotes(root: string): void {
    const shown = filterNotes(allNotes, ntFilter.value);
    ntHint.textContent = ntFilter.value.trim()
      ? `${shown.length} of ${allNotes.length} notes in ${root}`
      : `${allNotes.length} note${allNotes.length !== 1 ? 's' : ''} in ${root}`;
    ntList.innerHTML = shown.length
      ? shown.map(n => `
          <div class="fe-bm-item fe-nt-item${n.pinned ? ' pinned' : ''}" data-rel="${esc(n.rel)}">
            <a href="file://${esc(root + '/' + n.rel)}" class="fe-si-link" title="${esc(n.rel)}">
              ${PI.docs ?? PI.folder}${noteRowText(n)}
            </a>
            <span class="fe-nt-acts">
              <button class="fe-nt-props" data-rel="${esc(n.rel)}" title="Colour, pin and tags" aria-label="Colour, pin and tags for ${esc(n.title || noteTitle(n.rel))}">${UI_ICON.palette}</button>
              <button class="fe-nt-tab" data-rel="${esc(n.rel)}" title="Open in a page tab" aria-label="Open ${esc(n.title || noteTitle(n.rel))} in a page tab">${UI_ICON.tab}</button>
              <button class="fe-rm-btn" data-rel="${esc(n.rel)}" title="Move to .trash">✕</button>
            </span>
          </div>`).join('')
      : allNotes.length
        ? `<div class="fe-hint">No note matches "${esc(ntFilter.value.trim())}".</div>`
        : `<div class="fe-hint">No notes yet.<br>Press n or + to write one.</div>`;
    attachNoteEvents(root);
  }
  ntFilter.addEventListener('input', () => { const root = notesRoot(); if (root) renderNotes(root); });
  ntFilter.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); ntFilter.value = ''; ntFilter.dispatchEvent(new Event('input')); ntFilter.blur(); }
  });
  function refreshNotes(): void {
    const root = notesRoot();
    ntFilter.style.display = root ? '' : 'none';
    if (!root) {
      ntHint.textContent = '';
      el<HTMLAnchorElement>('fe-notes-root').removeAttribute('href');
      ntList.innerHTML = `<div class="fe-hint">Choose a folder to store your notes.<br><button id="fe-nt-pick" class="fe-hint-action fe-icon-act" title="Pick the notes folder in the system chooser">${UI_ICON.folderOpen}<span>Choose folder</span></button><br><button id="fe-nt-setup" class="fe-hint-action" title="Type the notes folder in Settings">Type it in Settings</button></div>`;
      el('fe-nt-pick').addEventListener('click', () => app.pickNotesFolder());
      el('fe-nt-setup').addEventListener('click', () => {
        app.openSettings('notes');
        el<HTMLInputElement>('fe-st-notes-root').focus();
      });
      return;
    }
    el<HTMLAnchorElement>('fe-notes-root').href = 'file://' + root + '/';
    notes.list(root).then(unsorted => {
      allNotes = pinnedFirst(unsorted);
      renderNotes(root);
    }).catch((err: NotesError) => {
      ntHint.textContent = err.message;
      ntList.innerHTML = `<div class="fe-hint">${esc(err.code === 'unavailable' ? 'Notes host not installed. Run native/install.sh.' : err.message)}</div>`;
    });
  }
  app.refreshNotes = refreshNotes;
  // Colour dot and pin first, then the title with tags beneath.
  function noteRowText(n: NoteMeta): string {
    const tags = (n.tags ?? []).length ? `<span class="fe-nt-tags">${n.tags!.map(t => `<span>${UI_ICON.tag}${esc(t)}</span>`).join('')}</span>` : '';
    const flags = (colorName(n.color) || n.pinned)
      ? `<span class="fe-nt-flags">${colorName(n.color) ? colorDot(colorName(n.color)) : ''}${n.pinned ? `<span class="fe-nt-pin" title="Pinned">${UI_ICON.pin}</span>` : ''}</span>` : '';
    return `${flags}<span class="fe-nt-main"><span class="fe-sl fe-nt-label" title="${esc(noteName(n))}&#10;Double-click to rename (F2)">${midHtml(noteName(n))}</span>${tags}</span>`;
  }
  const noteName = (n: NoteMeta) => n.title || noteTitle(n.rel);
  const notePath = (root: string, rel: string) => root.replace(/\/$/, '') + '/' + rel;
  // The editor's arrows walk the list as the sidebar shows it, filter included.
  function stepNote(root: string, rel: string, dir: 1 | -1): void {
    const shown = filterNotes(allNotes, ntFilter.value);
    const pool = shown.some(n => n.rel === rel) ? shown : allNotes;
    const at = pool.findIndex(n => n.rel === rel);
    const next = at < 0 ? undefined : pool[at + dir];
    if (!next) { toast(dir > 0 ? 'That is the last note' : 'That is the first note'); return; }
    openNoteRel(root, next.rel);
  }
  // Rename keeps the file for a shared-store note (the title is a property) and renames the file otherwise.
  function renameNote(root: string, rel: string, reopen: boolean): void {
    const row = els<HTMLElement>('.fe-nt-item', ntList).find(i => i.dataset.rel === rel);
    const label = row?.querySelector<HTMLElement>('.fe-nt-label');
    if (!label) { toast('That note is not in the list. Clear the filter first.'); return; }
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
    row!.scrollIntoView({ block: 'nearest' });
    const meta = allNotes.find(n => n.rel === rel);
    label.textContent = meta ? noteName(meta) : noteTitle(rel);   // the box holds the whole title, every line of it
    inlineEdit(label, val => {
      notes.read(root, rel).then(async doc => {
        const titled = setTitle(doc.text, val);
        let now = rel;
        if (titled !== null) await notes.write(root, rel, titled, doc.mtime);
        else { now = rel.replace(/[^/]+$/, slugForTitle(val)); await notes.rename(root, rel, now); }
        refreshNotes();
        if (reopen) openNoteRel(root, now);
      }).catch((err: NotesError) => toast(err.message));
    }, () => renderNotes(root));
  }
  function deleteNote(root: string, rel: string): void {
    if (editingRel() === rel) discardEditor();
    notes.delete(root, rel).then(() => { refreshNotes(); toast('Moved to .trash'); })
      .catch((err: NotesError) => toast(err.message));
  }
  function openNoteRel(root: string, rel: string): void {
    const actions: NoteActions = {
      step: (r, dir) => stepNote(root, r, dir),
      rename: r => { void saveEditor().then(() => renameNote(root, r, true)); },
      del: r => deleteNote(root, r),
    };
    notes.read(root, rel).then(doc => openNote(root, doc, refreshNotes, actions))
      .catch((err: NotesError) => toast(err.message));
  }
  function openProps(root: string, rel: string, anchor: HTMLElement): void {
    notes.read(root, rel).then(doc => openPropsMenu(anchor, readProps(rel, doc.text), async c => {
      const cur = await notes.read(root, rel);
      const next = applyChange(cur.text, c);
      if (frontmatterDrift(cur.text, next, changedKeys(c)).length) { toast('Not saved: that would change other properties'); return; }
      try { await notes.write(root, rel, next, cur.mtime); } catch (err) { toast((err as NotesError).message); return; }
      refreshNotes();
      return readProps(rel, next);
    })).catch((err: NotesError) => toast(err.message));
  }

  // Right-click menu on a note row; the same actions the keys and the hover buttons carry.
  const ntMenu = document.createElement('div');
  ntMenu.id = 'fe-nt-ctx';
  ntMenu.className = 'fe-ctx';
  ntMenu.style.display = 'none';
  (document.getElementById('fe') ?? document.body).appendChild(ntMenu);
  const closeNtMenu = () => { ntMenu.style.display = 'none'; };
  function openNtMenu(root: string, item: HTMLElement, x: number, y: number): void {
    const rel = item.dataset.rel!;
    ntMenu.innerHTML = [
      `<div class="fe-ctx-item" data-act="open">${UI_ICON.files}<span>Open</span><span class="fe-ctx-key">Enter</span></div>`,
      `<div class="fe-ctx-item" data-act="tab">${UI_ICON.tab}<span>Open in a page tab</span></div>`,
      `<div class="fe-ctx-item" data-act="rename">${UI_ICON.rename}<span>Rename</span><span class="fe-ctx-key">F2</span></div>`,
      `<div class="fe-ctx-item" data-act="props">${UI_ICON.palette}<span>Colour, pin and tags</span></div>`,
      `<div class="fe-ctx-sep"></div>`,
      `<div class="fe-ctx-item" data-act="cp-path">${UI_ICON.copy}<span>Copy path</span></div>`,
      `<div class="fe-ctx-item" data-act="cp-title">${UI_ICON.copy}<span>Copy title</span></div>`,
      `<div class="fe-ctx-sep"></div>`,
      `<div class="fe-ctx-item" data-act="delete">${UI_ICON.trash}<span>Move to .trash</span><span class="fe-ctx-key">Delete</span></div>`,
    ].join('');
    ntMenu.dataset.rel = rel;
    ntMenu.dataset.root = root;
    ntMenu.style.display = 'block';
    ntMenu.style.left = Math.min(x, window.innerWidth - ntMenu.offsetWidth - 8) + 'px';
    ntMenu.style.top = Math.min(y, window.innerHeight - ntMenu.offsetHeight - 8) + 'px';
  }
  ntMenu.addEventListener('click', e => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.fe-ctx-item');
    if (!item) return;
    const { rel, root } = ntMenu.dataset as { rel: string; root: string };
    closeNtMenu();
    const row = els<HTMLElement>('.fe-nt-item', ntList).find(i => i.dataset.rel === rel);
    const meta = allNotes.find(n => n.rel === rel);
    switch (item.dataset.act) {
      case 'open': openNoteRel(root, rel); break;
      case 'tab': app.strip.go(notePath(root, rel)); break;
      case 'rename': renameNote(root, rel, false); break;
      case 'props': if (row) openProps(root, rel, row.querySelector<HTMLElement>('.fe-nt-props')!); break;
      case 'cp-path': void copyToClipboard(notePath(root, rel)).then(ok => toast(ok ? 'Copied path' : 'Copy failed')); break;
      case 'cp-title': void copyToClipboard(meta ? noteName(meta) : noteTitle(rel)).then(ok => toast(ok ? 'Copied title' : 'Copy failed')); break;
      case 'delete': deleteNote(root, rel); break;
    }
  });
  document.addEventListener('click', e => { if (ntMenu.style.display !== 'none' && !ntMenu.contains(e.target as Node)) closeNtMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ntMenu.style.display !== 'none') closeNtMenu(); });

  // Keys on a focused note row: arrows move between rows, F2 renames, Delete trashes.
  ntList.addEventListener('keydown', e => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.fe-nt-item');
    if (!item || (e.target as HTMLElement).isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
    const root = notesRoot();
    const rel = item.dataset.rel!;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const rows = els<HTMLElement>('.fe-nt-item', ntList);
      const to = rows[rows.indexOf(item) + (e.key === 'ArrowDown' ? 1 : -1)];
      if (to) { e.preventDefault(); to.querySelector<HTMLElement>('.fe-si-link')!.focus(); }
    } else if (e.key === 'F2') {
      e.preventDefault(); renameNote(root, rel, false);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const rows = els<HTMLElement>('.fe-nt-item', ntList);
      const keep = rows[rows.indexOf(item) + 1] ?? rows[rows.indexOf(item) - 1];
      deleteNote(root, rel);
      if (keep) { const keepRel = keep.dataset.rel; setTimeout(() => els<HTMLElement>('.fe-nt-item', ntList).find(i => i.dataset.rel === keepRel)?.querySelector<HTMLElement>('.fe-si-link')?.focus(), 400); }
    }
  });
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
      item.addEventListener('contextmenu', e => {
        e.preventDefault();
        openNtMenu(root, item, e.clientX, e.clientY);
      });
      item.querySelector<HTMLElement>('.fe-nt-label')!.addEventListener('dblclick', e => {
        e.preventDefault(); e.stopPropagation();
        renameNote(root, rel, false);
      });
      item.querySelector('.fe-rm-btn')!.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        deleteNote(root, rel);
      });
      item.querySelector<HTMLElement>('.fe-nt-props')!.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        openProps(root, rel, e.currentTarget as HTMLElement);
      });
      item.querySelector('.fe-nt-tab')!.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        app.strip.go(notePath(root, rel));
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
  app.pickNotesFolder = () => {
    notes.pick(notesRoot() || undefined).then(root => {
      if (!root) return;   // cancelled
      settings.notesRoot = root; saveSettings(settings);
      const field = document.getElementById('fe-st-notes-root') as HTMLInputElement | null;
      if (field) field.value = root;
      refreshNotes();
    }).catch((err: NotesError) => toast(err.code === 'unavailable' ? 'Notes host not installed. Run native/install.sh.' : err.message));
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
