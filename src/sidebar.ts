// The sidebar: the Saved list (star or + adds, tags group, drag reorders,
// a filter box), the Notes list from the Settings folder, and the bookmark
// gestures shared by sidebar rows, crumbs and the crumb dropdown.
import type { App } from './app';
import type { NotesError } from './notes';
import { el, els } from './el';
import { esc, copyToClipboard, midHtml, fileHref } from './utils';
import { kvGet, kvSet, onKvChange } from './kv';
import { PI, DISCLOSE } from './icons';
import { UI_ICON } from './control-icons';
import { getSaved, saveSaved, getTags, saveTags, saveSettings, getFoldedGroups, saveFoldedGroups, homeDir } from './storage';
import { samePlace, upsertPlace, removePlace, renamePlace, movePlace, setTags, parseTags, cycleTagColor } from './places';
import { renderSavedList } from './render';
import { notes, noteTitle, slugForTitle, retitle, nameIsId, sharedOrder, filterNotes, colorName, readProps, applyChange, changedKeys, frontmatterDrift, type NoteMeta } from './notes';
import { openPropsMenu } from './note-meta-ui';
import { openNote, discardEditor, editingRel, saveEditor, type NoteActions } from './preview';
import { isViewPath } from './find';
import { fetchFileText } from './file-fetch';
import { parseListing } from './parse';
import { foldTo } from './motion';
import { addPaletteSource } from './commands';
import { openLayer, raise, rovingFocus, type Layer } from './layer';
import { emptyHtml, CLEAR } from './empty-state';

// The rail of lenses: one panel at a time, the choice remembered across tabs.
const LENS_KEY = 'bfb-lens-v1';
function initLenses(app: App): void {
  const rail = el('fe-rail');
  const btns = els<HTMLButtonElement>('#fe-rail .fe-rail-btn');
  const lenses = els<HTMLElement>('#fe-lenses .fe-lens');
  // The lens itself switches at once; the bar's look (which button is wide and
  // lit) goes through `paint`, so a switch can hand it to a view transition.
  const show = (lens: string, paint: (f: () => void) => void = f => f()) => {
    const usable = btns.filter(b => !b.hidden).map(b => b.dataset.lens!);
    const pick = usable.includes(lens) ? lens : 'notes';
    for (const b of btns) { const on = b.dataset.lens === pick; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; }
    for (const l of lenses) l.hidden = l.dataset.lens !== pick;
    // The open lens shows its name already; its tooltip would only sit over
    // the lens's first row while the pointer rests where it clicked.
    paint(() => { for (const b of btns) { const on = b.dataset.lens === pick; b.classList.toggle('on', on); b.title = on ? '' : b.dataset.hint ?? ''; b.setAttribute('aria-label', b.dataset.hint ?? ''); } fitBar(); });
    document.dispatchEvent(new CustomEvent('bfb-lens', { detail: pick }));
  };
  // A narrow sidebar first squeezes the closed icons so the open lens keeps
  // its name; only when even that does not fit does the name go.
  function fitBar(): void {
    rail.classList.remove('tight', 'tighter');
    const over = () => rail.scrollWidth > rail.clientWidth + 1;
    if (!over()) return;
    rail.classList.add('tight');
    if (over()) rail.classList.add('tighter');
  }
  new ResizeObserver(fitBar).observe(rail);
  // Each button holds its own highlight and only the open one shows it, so at
  // rest it always fits its button. A switch plays one slide from where the
  // old highlight was; nothing is measured or kept between switches.
  for (const b of btns) b.prepend(Object.assign(document.createElement('span'), { className: 'fe-rail-hl' }));
  const hlRect = () => rail.querySelector('.fe-rail-btn.on .fe-rail-hl')?.getBoundingClientRect();
  const switchTo = (lens: string) => show(lens, f => {
    const from = hlRect();
    f();
    const to = hlRect(), hl = rail.querySelector<HTMLElement>('.fe-rail-btn.on .fe-rail-hl');
    if (!from || !to || !hl || !to.width || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    hl.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})` }, { transform: 'none' }],
      { duration: 180, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  });
  app.showLens = (lens, hideHistory) => {
    if (hideHistory !== undefined) el('fe-rail-history').hidden = hideHistory;
    show(lens ?? kvGet(LENS_KEY) ?? 'notes');
  };
  // In a narrow window the sidebar is only its rail; picking a lens opens it
  // over the page, and picking it again, Esc or a click outside closes it.
  const side = el('fe-side');
  const narrow = () => matchMedia('(max-width: 520px)').matches;
  const closeOverlay = () => side.classList.remove('open');
  // Open a lens from its bar button and remember it.
  const pick = (b: HTMLElement) => { kvSet(LENS_KEY, b.dataset.lens!); switchTo(b.dataset.lens!); };
  rail.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('.fe-rail-btn');
    if (!b) return;
    if (narrow()) side.classList.toggle('open', !(b.classList.contains('on') && side.classList.contains('open')));
    pick(b);
  });
  document.addEventListener('pointerdown', e => { if (side.classList.contains('open') && !side.contains(e.target as Node)) closeOverlay(); });
  // Esc (area-leave) closes it too.
  app.closeSideOverlay = () => { const was = side.classList.contains('open'); closeOverlay(); return was; };
  const step = (dir: 1 | -1) => {
    const usable = btns.filter(b => !b.hidden);
    const i = usable.findIndex(b => b.classList.contains('on'));
    pick(usable[(i + dir + usable.length) % usable.length]);
  };
  // The arrow keys move between lenses, and so does the wheel over the bar:
  // one step per mouse notch, and one per trackpad swipe, which arrives as a
  // stream of small deltas and counts as one gesture until it pauses.
  rovingFocus(rail, '.fe-rail-btn', { axis: 'both', onMove: pick });
  let wheelAt = 0, steppedAt = 0;
  rail.addEventListener('wheel', e => {
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (!d) return;
    e.preventDefault();
    const notch = e.deltaMode !== 0 || Math.abs(d) >= 40;
    const quiet = e.timeStamp - wheelAt;
    wheelAt = e.timeStamp;
    if (notch ? e.timeStamp - steppedAt < 120 : quiet < 220) return;
    steppedAt = e.timeStamp;
    step(d > 0 ? 1 : -1);
  }, { passive: false });
  // Saved and Notes use one search box and one tag row, moved to whichever of
  // the two is open: the box sits right of that lens's buttons, the tags below.
  // initSidebar empties the box on the move so a query never follows you across.
  const box = document.querySelector<HTMLElement>('.fe-lens-box');
  const tagRow = document.getElementById('fe-lens-tags');
  document.addEventListener('bfb-lens', e => {
    const lens = (e as CustomEvent).detail;
    const tools = document.querySelector(`#fe-lens-${lens} .fe-lens-tools`);
    if (!box || !tagRow || !tools || (lens !== 'saved' && lens !== 'notes')) return;
    tools.append(box);
    tools.after(tagRow);
  });
  onKvChange(key => { if (key === LENS_KEY) show(kvGet(LENS_KEY) ?? 'notes'); });
  show(kvGet(LENS_KEY) ?? 'notes');
}

export function initSidebar(app: App): void {
  const { rawPath, settings, toast } = app;
  initLenses(app);
  const collapseKey = 'bfb-sidebar-collapsed-v1';
  const sections = els<HTMLElement>('#fe-side .fe-sec[data-collapse]');
  const collapsed = (): Set<string> => {
    try {
      const value = JSON.parse(kvGet(collapseKey) || '[]');
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
    toggle.innerHTML = DISCLOSE;
    toggle.append(labelNode);
    toggle.addEventListener('click', () => {
      const keys = collapsed();
      if (section.classList.contains('fe-collapsed')) keys.delete(key); else keys.add(key);
      // The choice is saved at once; only the look waits for the fold to finish.
      kvSet(collapseKey, JSON.stringify([...keys]));
      toggle.setAttribute('aria-expanded', String(!keys.has(key)));   // the chevron turns as the fold starts
      foldTo(section, () => { section.classList.toggle('fe-collapsed'); }, () => applyCollapsed(keys));
    });
    header.prepend(toggle);
  }
  applyCollapsed(collapsed());
  onKvChange(key => { if (key === collapseKey) applyCollapsed(collapsed()); });
  const svList = el('fe-sv-list');
  const svFilter = el<HTMLInputElement>('fe-sv-filter');
  // Saved places found by looking inside them, with the name that matched.
  let svHits = new Map<string, string>();
  // Resting on a saved row shows a card with its path and tags. It sits over
  // the listing, so it takes no clicks: the pointer passes through it to the
  // row underneath, and it goes away once the pointer leaves the list.
  const card = document.createElement('div');
  card.id = 'fe-sv-card';
  card.hidden = true;
  el('fe').append(card);
  let cardTimer: ReturnType<typeof setTimeout> | null = null, cardFor: HTMLElement | null = null;
  function hideCard(): void {
    if (cardTimer) { clearTimeout(cardTimer); cardTimer = null; }
    card.hidden = true; cardFor = null;
  }
  function showCard(item: HTMLElement): void {
    const p = getSaved().find(x => x.path === item.dataset.path);
    if (!p) return;
    const colour = new Map(getTags().map(t => [t.name, t.color]));
    const home = homeDir(rawPath);
    const where = isViewPath(p.path) ? 'Saved view in ' + p.path.split('#')[0] : p.path;
    card.innerHTML = `<b>${esc(p.label || where)}</b><span class="fe-svc-path">${esc(home && where.startsWith(home) ? '~' + where.slice(home.length) : where)}</span>`
      + ((p.tags ?? []).length ? `<span class="fe-svc-tags">${p.tags!.map(t => `<span class="chip fe-lens-tag"><i style="background:${esc(colour.get(t) ?? '#8b949e')}"></i>${esc(t)}</span>`).join('')}</span>` : '')
      + `<span class="fe-svc-hint">Double-click to rename · drag to reorder</span>`;
    const r = item.getBoundingClientRect();
    card.hidden = false;
    raise(card);
    const h = card.offsetHeight, w = card.offsetWidth;
    // Beside the sidebar, level with the row, so it never covers the rows a
    // person moves on to; below the row only when the window is too narrow.
    const sideRight = el('fe-side').getBoundingClientRect().right;
    if (sideRight + 8 + w <= innerWidth - 8) {
      card.style.left = `${Math.round(sideRight + 8)}px`;
      card.style.top = `${Math.round(Math.max(8, Math.min(r.top - 4, innerHeight - h - 8)))}px`;
    } else {
      card.style.left = `${Math.round(r.left + 24)}px`;
      card.style.top = `${Math.round(r.bottom + h + 8 > innerHeight ? r.top - h - 4 : r.bottom + 4)}px`;
    }
    cardFor = item;
  }
  svList.addEventListener('pointerover', e => {
    const item = (e.target as Element).closest<HTMLElement>('.fe-pl-item');
    if (item === cardFor) { if (cardTimer) { clearTimeout(cardTimer); cardTimer = null; } return; }
    if (cardTimer) clearTimeout(cardTimer);
    if (!item || item.classList.contains('dragging') || item.querySelector('.editing')) { cardTimer = setTimeout(hideCard, 150); return; }
    cardTimer = setTimeout(() => { cardTimer = null; hideCard(); showCard(item); }, card.hidden ? 450 : 120);
  });
  svList.addEventListener('pointerleave', () => { if (cardTimer) clearTimeout(cardTimer); cardTimer = setTimeout(hideCard, 200); });
  svList.addEventListener('scroll', hideCard, true);
  svList.addEventListener('pointerdown', hideCard);
  svList.addEventListener('dragstart', hideCard);

  let dragSrc: HTMLElement | null = null;
  // What the lens filter and tag row need from the notes list, filled when
  // notes load; declared here because the saved list renders first.
  const lensNotes = { count: 0, tags: [] as string[] };

  function syncStar(): void {
    const on = getSaved().some(p => samePlace(p.path, rawPath));
    const btn = el('fe-bm-btn');
    btn.classList.toggle('on', on);
    const what = app.fileMode ? 'file' : 'folder';
    btn.title = on ? `Remove this ${what} from Saved` : `Save this ${what} (sidebar)`;
    el('fe-bm-path').setAttribute('fill', on ? 'currentColor' : 'none');
  }
  function refreshSaved(): void {
    hideCard();
    svList.innerHTML = renderSavedList(getSaved(), getTags(), rawPath, svFilter.value, foldedGroups(), svHits);
    attachSavedEvents();
    syncStar();
    syncLens();
  }

  // One filter and one tag row, in whichever of Saved and Notes is open. The
  // box writes into each list's own filter, so Saved keeps its label, path and
  // tag match and Notes keeps its tag and full-text search. It shows only once
  // the open lens holds more than eight rows, or while it has text, and the
  // tag row offers only that lens's tags.
  const openLens = () => document.querySelector<HTMLElement>('#fe-rail .fe-rail-btn.on')?.dataset.lens;
  function syncLens(): void {
    const box = document.getElementById('fe-lens-filter') as HTMLInputElement | null;
    const row = document.getElementById('fe-lens-tags');
    if (!box || !row) return;
    const inNotes = openLens() === 'notes';
    const colour = new Map(getTags().map(t => [t.name, t.color]));
    const names = [...new Set(inNotes ? lensNotes.tags : getSaved().flatMap(p => p.tags ?? []))].sort();
    const on = box.value.trim().toLowerCase();
    row.hidden = !names.length;
    row.innerHTML = names.map(n => `<button type="button" class="chip fe-lens-tag${on === '#' + n.toLowerCase() ? ' on' : ''}" aria-pressed="${on === '#' + n.toLowerCase()}" data-tag="${esc(n)}" style="--chip:${esc(colour.get(n) ?? '#8b949e')}" title="Show only items tagged ${esc(n)}"><i style="background:${esc(colour.get(n) ?? '#8b949e')}"></i>${esc(n)}</button>`).join('');
  }
  const foldedGroups = getFoldedGroups;
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
    // A folded tag group stays folded across pages.
    // A filter opens every group on its own; those opens are not the person's.
    els<HTMLDetailsElement>('details.fe-grp', svList).forEach(d => d.querySelector('summary')!.addEventListener('click', e => {
      if ((e.target as Element).closest('.fe-sv-dot')) return;
      e.preventDefault();
      if (!svFilter.value.trim()) {
        const folded = foldedGroups();
        if (d.open) folded.add(d.dataset.tag!); else folded.delete(d.dataset.tag!);
        saveFoldedGroups(folded);
      }
      foldTo(d, () => { d.open = !d.open; });
    }));
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
    const fresh = els('.fe-pl-item', svList).find(i => samePlace(i.dataset.path!, rawPath));
    const lbl = fresh?.querySelector<HTMLElement>('.fe-pl-label');
    if (lbl) lbl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  }
  el('fe-sv-add').addEventListener('click', () => addCurrentFolder(true));
  el('fe-bm-btn').addEventListener('click', () => {
    if (getSaved().some(p => samePlace(p.path, rawPath))) {
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
  const NOTE_FOLDS_KEY = 'bfb-notes-folded-v1';
  const noteFolds = (): Set<string> => { try { return new Set(JSON.parse(kvGet(NOTE_FOLDS_KEY) || '[]')); } catch { return new Set(); } };
  ntList.addEventListener('click', e => {
    const g = (e.target as Element).closest<HTMLElement>('.fe-nt-grp');
    if (!g) return;
    const body = g.nextElementSibling as HTMLElement;
    const folds = noteFolds(), key = g.dataset.grp!;
    if (folds.has(key)) folds.delete(key); else folds.add(key);
    const open = !folds.has(key);
    g.setAttribute('aria-expanded', String(open));
    g.title = `${open ? 'Fold' : 'Show'} ${g.dataset.label}`;
    kvSet(NOTE_FOLDS_KEY, JSON.stringify([...folds]));
    foldTo(body, () => { body.hidden = !body.hidden; });
  });
  // Notes whose text (not just title or tags) holds every word typed, with the
  // first matching line; filled a moment after typing stops.
  let bodyHits = new Map<string, string>();
  const shownNotes = () => {
    const byMeta = filterNotes(allNotes, ntFilter.value);
    return [...byMeta, ...allNotes.filter(n => bodyHits.has(n.rel) && !byMeta.includes(n))];
  };
  function renderNotes(root: string): void {
    // A refresh landing while a title is being renamed would replace the box
    // under the cursor; the rename re-renders the list itself when it ends.
    if (ntList.querySelector('.fe-nt-label.editing')) return;
    lensNotes.count = allNotes.length;
    lensNotes.tags = [...new Set(allNotes.flatMap(n => n.tags ?? []))];
    syncLens();
    const shown = shownNotes();
    ntHint.textContent = ntFilter.value.trim()
      ? `${shown.length} of ${allNotes.length} notes in ${root}`
      : `${allNotes.length} note${allNotes.length !== 1 ? 's' : ''} in ${root}`;
    const row = (n: NoteMeta) => {
      const c = colorName(n.color);
      return `
          <div class="row fe-bm-item fe-nt-item${n.pinned ? ' pinned' : ''}${c ? ' coloured' : ''}${(n.tags ?? []).length ? ' two' : ''}" data-rel="${esc(n.rel)}"${c ? ` style="--c:var(--nc-${c})"` : ''}>
            <a href="${esc(fileHref(root + '/' + n.rel))}" class="fe-si-link" title="${esc(n.rel)}">
              ${PI.docs ?? PI.folder}${noteRowText(n)}${bodyHits.has(n.rel) ? `<span class="fe-nt-hit" title="${esc(bodyHits.get(n.rel)!)}">${esc(bodyHits.get(n.rel)!)}</span>` : ''}
            </a>
            <span class="fe-nt-acts">
              <button class="btn fe-nt-props" data-icon data-size="sm" data-rel="${esc(n.rel)}" title="Colour, pin and tags" aria-label="Colour, pin and tags for ${esc(n.title || noteTitle(n.rel))}">${UI_ICON.palette}</button>
              <button class="btn fe-nt-tab" data-icon data-size="sm" data-rel="${esc(n.rel)}" title="Open in a page tab" aria-label="Open ${esc(n.title || noteTitle(n.rel))} in a page tab">${UI_ICON.tab}</button>
              <button class="btn fe-rm-btn" data-icon data-size="sm" data-tone="danger" data-rel="${esc(n.rel)}" title="Move to .trash" aria-label="Move ${esc(n.title || noteTitle(n.rel))} to .trash">${UI_ICON.trash}</button>
            </span>
          </div>`;
    };
    // With any pinned note in view the list splits into Pinned and All notes,
    // each folding on its header; with none it is one plain list.
    const pinned = shown.filter(n => n.pinned), rest = shown.filter(n => !n.pinned);
    const folded = noteFolds();
    const group = (key: string, label: string, list: NoteMeta[]) => {
      const open = !folded.has(key) || !!ntFilter.value.trim();
      return `<button type="button" class="sect fe-nt-grp" data-level="group" data-grp="${key}" data-label="${esc(label.toLowerCase())}" aria-expanded="${open}" title="${open ? 'Fold' : 'Show'} ${esc(label.toLowerCase())}">`
        + `${DISCLOSE}${key === 'pinned' ? `<span class="fe-nt-grp-pin">${UI_ICON.pin}</span>` : ''}${label}<span class="fe-grp-n">${list.length}</span></button>`
        + `<div class="fe-nt-gbody"${open ? '' : ' hidden'}>${list.map(row).join('')}</div>`;
    };
    ntList.innerHTML = shown.length
      ? (pinned.length ? group('pinned', 'Pinned', pinned) + group('all', 'All notes', rest) : shown.map(row).join(''))
      : allNotes.length
        ? emptyHtml('filtered', `No note matches "${ntFilter.value.trim()}"`, { inline: true, actions: [CLEAR] })
        : emptyHtml('empty', 'No notes yet', { inline: true, hintHtml: 'Press <kbd>n</kbd> or + to write one' });
    attachNoteEvents(root);
  }
  addPaletteSource(() => {
    const root = notesRoot();
    return root ? allNotes.map(n => ({ title: n.title || noteTitle(n.rel), sub: (n.tags ?? []).map(t => '#' + t).join(' ') || 'note', group: 'Notes', icon: PI.docs,
      run: () => app.strip.go(root + '/' + n.rel), runAlt: () => app.strip.open(root + '/' + n.rel, true) })) : [];
  });
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  ntFilter.addEventListener('input', () => {
    const root = notesRoot();
    if (!root) return;
    const q = ntFilter.value.trim();
    bodyHits = new Map();
    renderNotes(root);
    if (searchTimer) clearTimeout(searchTimer);
    if (!q || q.startsWith('#') || !deep()) return;
    searchTimer = setTimeout(() => {
      notes.search(root, q).then(hits => {
        if (ntFilter.value.trim() !== q) return;
        bodyHits = new Map(hits.map(h => [h.rel, h.line]));
        renderNotes(root);
      }).catch(() => { /* host without search: titles and tags still filter */ });
    }, 250);
  });
  ntFilter.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); ntFilter.value = ''; ntFilter.dispatchEvent(new Event('input')); ntFilter.blur(); }
  });

  const lensFilter = el<HTMLInputElement>('fe-lens-filter');
  function toggleTagFilter(tag: string): void {
    const q = '#' + tag;
    lensFilter.value = lensFilter.value.trim().toLowerCase() === q.toLowerCase() ? '' : q;
    applyLensFilter();
  }
  // Names matches names and tags; Deep also looks inside: the text of each
  // note, and the names in each saved folder. The choice is kept.
  const DEEP_KEY = 'bfb-lens-deep-v1';
  const depthBtn = el<HTMLButtonElement>('fe-lens-depth');
  const deep = () => kvGet(DEEP_KEY) === '1';
  function syncDepth(): void {
    const on = deep(), inNotes = openLens() === 'notes';
    depthBtn.textContent = on ? 'Deep' : 'Names';
    depthBtn.classList.toggle('on', on);
    depthBtn.setAttribute('aria-pressed', String(on));
    depthBtn.title = on ? `Deep: also matches ${inNotes ? 'the text inside notes' : 'the names inside saved folders'}. Click for names only` : 'Names only. Click to search inside too';
    lensFilter.placeholder = on ? (inNotes ? 'Search inside notes' : 'Search inside folders') : 'Filter';
  }
  depthBtn.addEventListener('click', e => {
    e.preventDefault();
    kvSet(DEEP_KEY, deep() ? '0' : '1');
    syncDepth();
    applyLensFilter();
    lensFilter.focus();
  });
  const applyLensFilter = () => {
    svFilter.value = ntFilter.value = lensFilter.value;
    svHits = new Map();
    refreshSaved();
    searchInsideSaved();
    ntFilter.dispatchEvent(new Event('input'));
  };
  // Deep search in Saved reads each saved folder's listing (one level, kept for
  // a minute) and shows the folders holding a name with every typed word.
  const listings = new Map<string, { at: number; names: Promise<string[]> }>();
  const namesIn = (path: string): Promise<string[]> => {
    const hit = listings.get(path);
    if (hit && Date.now() - hit.at < 60_000) return hit.names;
    const href = fileHref(path);
    const names = fetchFileText(href).then(t => parseListing(t, href).map(e => e.name)).catch(() => [] as string[]);
    listings.set(path, { at: Date.now(), names });
    return names;
  };
  let insideTimer: ReturnType<typeof setTimeout> | null = null;
  function searchInsideSaved(): void {
    if (insideTimer) clearTimeout(insideTimer);
    const q = svFilter.value.trim().toLowerCase();
    if (!q || q.startsWith('#') || !deep()) return;
    const words = q.split(/\s+/);
    insideTimer = setTimeout(async () => {
      const found = new Map<string, string>();
      await Promise.all(getSaved().filter(p => p.path.endsWith('/') && !isViewPath(p.path)).map(async p => {
        const name = (await namesIn(p.path)).find(n => words.every(w => n.toLowerCase().includes(w)));
        if (name) found.set(p.path, name);
      }));
      if (svFilter.value.trim().toLowerCase() !== q || !deep()) return;
      svHits = found;
      refreshSaved();
    }, 250);
  }
  lensFilter.addEventListener('input', applyLensFilter);
  for (const list of [svList, ntList]) list.addEventListener('click', e => {
    const a = (e.target as Element).closest<HTMLElement>('.empty [data-a]')?.dataset.a;
    if (a === 'clear') { lensFilter.value = ''; applyLensFilter(); lensFilter.focus(); }
    else if (a === 'retry') refreshNotes();
  });
  lensFilter.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); lensFilter.value = ''; applyLensFilter(); lensFilter.blur(); }
    e.stopPropagation();   // page keys must not fire while typing
  });
  document.addEventListener('bfb-lens', e => {
    const lens = (e as CustomEvent).detail;
    if (lens !== 'saved' && lens !== 'notes') return;
    syncDepth();
    if (lensFilter.value) { lensFilter.value = ''; applyLensFilter(); } else syncLens();
  });
  syncDepth();
  el('fe-lens-tags').addEventListener('click', e => {
    const chip = (e.target as Element).closest<HTMLElement>('.fe-lens-tag');
    if (!chip) return;
    const tag = chip.dataset.tag!, hadFocus = document.activeElement === chip;
    toggleTagFilter(tag);
    // The row is redrawn; a chip picked by keyboard keeps the focus.
    if (hadFocus) [...el('fe-lens-tags').querySelectorAll<HTMLElement>('.fe-lens-tag')].find(c => c.dataset.tag === tag)?.focus();
  });
  function refreshNotes(): void {
    const root = notesRoot();
    if (!root) {
      lensNotes.count = 0; lensNotes.tags = []; syncLens();
      ntHint.textContent = '';
      el<HTMLAnchorElement>('fe-notes-root').removeAttribute('href');
      ntList.innerHTML = emptyHtml('empty', 'Choose a folder to store your notes', { inline: true, actions: [
        { id: 'fe-nt-pick', label: 'Choose folder', title: 'Pick the notes folder in the system chooser', icon: UI_ICON.folderOpen },
        { id: 'fe-nt-setup', label: 'Type it in Settings', title: 'Type the notes folder in Settings' }] });
      el('fe-nt-pick').addEventListener('click', () => app.pickNotesFolder());
      el('fe-nt-setup').addEventListener('click', () => {
        app.openSettings('notes');
        el<HTMLInputElement>('fe-st-notes-root').focus();
      });
      return;
    }
    el<HTMLAnchorElement>('fe-notes-root').href = fileHref(root + '/');
    notes.list(root).then(unsorted => {
      allNotes = sharedOrder(unsorted);
      renderNotes(root);
    }).catch((err: NotesError) => {
      ntHint.textContent = err.message;
      ntList.innerHTML = err.code === 'unavailable'
        ? emptyHtml('failed', 'Notes host not installed', { inline: true, hint: 'Run native/install.sh, then reload' })
        : emptyHtml('failed', 'Notes could not be listed', { inline: true, hint: err.message, actions: [{ a: 'retry', label: 'Try again', title: 'List the notes again' }] });
    });
  }
  app.refreshNotes = refreshNotes;
  // Colour dot and pin first, then the title with tags beneath.
  function noteRowText(n: NoteMeta): string {
    const colour = new Map(getTags().map(t => [t.name, t.color]));
    const tags = (n.tags ?? []).length ? `<span class="fe-nt-tags">${n.tags!.map(t => `<span class="fe-nt-tag"><i style="background:${esc(colour.get(t) ?? 'var(--dm)')}"></i>${esc(t)}</span>`).join('')}</span>` : '';
    const pin = n.pinned ? `<span class="fe-nt-pin" title="Pinned">${UI_ICON.pin}</span>` : '';
    return `<span class="fe-nt-main"><span class="fe-sl fe-nt-label" title="${esc(noteName(n))}&#10;Double-click to rename (F2)">${midHtml(noteName(n))}</span>${tags}</span>${pin}`;
  }
  const noteName = (n: NoteMeta) => n.title || noteTitle(n.rel);
  const notePath = (root: string, rel: string) => root.replace(/\/$/, '') + '/' + rel;
  // The editor's arrows walk the list as the sidebar shows it, filter included.
  function stepNote(root: string, rel: string, dir: 1 | -1): void {
    const shown = shownNotes();
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
    const back = () => { renderNotes(root); if (reopen) openNoteRel(root, rel); };
    inlineEdit(label, val => {
      // An emptied box means "never mind", not "call it untitled".
      if (!val.trim()) { back(); return; }
      notes.read(root, rel).then(async doc => {
        // Rename puts the title where this note keeps it (its properties
        // block, or else its first line). A note named after its title also
        // takes the new title's file name, moved first so a name already
        // taken changes nothing; a note whose name is its id keeps it.
        const to = nameIsId(rel) ? rel : rel.replace(/[^/]+$/, slugForTitle(val));
        if (to.toLowerCase() !== rel.toLowerCase() && allNotes.some(n => n.rel.toLowerCase() === to.toLowerCase())) {
          toast(`A note named ${to.split('/').pop()} already exists. Pick another title.`);
          back();
          return;
        }
        let now = rel;
        if (to !== rel) { await notes.rename(root, rel, to); now = to; }
        const titled = retitle(doc.text, val);
        if (titled !== null) await notes.write(root, now, titled, doc.mtime);
        refreshNotes();
        if (reopen) openNoteRel(root, now);
      }).catch((err: NotesError) => toast(err.message));
    }, back);
  }
  function deleteNote(root: string, rel: string): void {
    if (editingRel() === rel) discardEditor();
    notes.delete(root, rel).then(() => { refreshNotes(); toast('Moved to .trash'); })
      .catch((err: NotesError) => toast(err.message));
  }
  function openNoteRel(root: string, rel: string): void {
    const actions: NoteActions = {
      step: (r, dir) => stepNote(root, r, dir),
      // The editor's scrim covers the sidebar, so close the editor, rename in
      // the list, then reopen the note. The bar acts on mousedown; wait for the
      // rest of that click, which would otherwise land on the page under the
      // closed editor and shut the rename box straight away.
      rename: (r, now) => {
        let started = false;
        const start = () => { if (started) return; started = true; void saveEditor().then(() => { discardEditor(); renameNote(root, r, true); }); };
        if (now) { start(); return; }
        document.addEventListener('pointerup', () => setTimeout(start, 0), { once: true, capture: true });
        setTimeout(start, 800);
      },
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
  let ntLayer: Layer | null = null;
  const closeNtMenu = () => ntLayer?.close('pick');
  function openNtMenu(root: string, item: HTMLElement, x: number, y: number): void {
    const rel = item.dataset.rel!;
    ntMenu.innerHTML = [
      `<div class="row fe-ctx-item" data-act="open">${UI_ICON.files}<span>Open</span><span class="fe-ctx-key">Enter</span></div>`,
      `<div class="row fe-ctx-item" data-act="tab">${UI_ICON.tab}<span>Open in a page tab</span></div>`,
      `<div class="row fe-ctx-item" data-act="rename">${UI_ICON.rename}<span>Rename</span><span class="fe-ctx-key">F2</span></div>`,
      `<div class="row fe-ctx-item" data-act="props">${UI_ICON.palette}<span>Colour, pin and tags</span></div>`,
      `<div class="fe-ctx-sep"></div>`,
      `<div class="row fe-ctx-item" data-act="cp-path">${UI_ICON.copy}<span>Copy path</span></div>`,
      `<div class="row fe-ctx-item" data-act="cp-title">${UI_ICON.copy}<span>Copy title</span></div>`,
      `<div class="fe-ctx-sep"></div>`,
      `<div class="row fe-ctx-item" data-act="delete">${UI_ICON.trash}<span>Move to .trash</span><span class="fe-ctx-key">Delete</span></div>`,
    ].join('');
    ntMenu.dataset.rel = rel;
    ntMenu.dataset.root = root;
    ntLayer = openLayer(ntMenu, { kind: 'popover', place: 'point', point: { x, y }, origin: item, role: 'menu', group: 'menu' });
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
    const d = new Date(), two = (n: number) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
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
