// The sidebar: the Saved list (star or + adds, tags group, drag reorders,
// a filter box), the Notes list from the Settings folder, and the bookmark
// gestures shared by sidebar rows, crumbs and the crumb dropdown.
import type { App } from './app';
import type { NotesError } from './notes';
import { el, els } from './el';
import { esc, copyToClipboard, midHtml, fileHref, whenText } from './utils';
import { PI, DISCLOSE } from './icons';
import { UI_ICON } from './control-icons';
import { getSaved, saveSaved, getTags, saveTags, saveSettings, getFoldedGroups, saveFoldedGroups, homeDir, textPref, setPref, flagPref, keptNotesList, keepNotesList } from './storage';
import { samePlace, upsertPlace, removePlace, renamePlace, movePlace, setTags, parseTags, cycleTagColor } from './places';
import { renderSavedList } from './render';
import { notes, noteTitle, slugForTitle, retitle, nameIsId, sharedOrder, filterNotes, colorName, readProps, applyChange, changedKeys, frontmatterDrift, arrangeWrites, setPos, setPinned, type NoteMeta, type TrashedNote } from './notes';
import { openPropsMenu } from './note-meta-ui';
import { openNote, discardEditor, editingRel, saveEditor, type NoteActions } from './preview';
import { isViewPath } from './find';
import { fetchFileText } from './file-fetch';
import { parseListing } from './parse';
import { foldTo } from './motion';
import { addPaletteSource } from './commands';
import { dismissOutside, openLayer, raise, rovingFocus, type Layer } from './layer';
import { emptyHtml, CLEAR } from './empty-state';
import { errorText } from './errors';

// The rail of lenses: one panel at a time, the choice remembered across tabs.
const lensPref = textPref('bfb-lens-v1', 'notes');
function initLenses(app: App): void {
  const rail = el('fe-rail');
  const btns = els<HTMLButtonElement>('#fe-rail .fe-rail-btn');
  const lenses = els<HTMLElement>('#fe-lenses .fe-lens');
  // The lens itself switches at once; the bar's look (which button is wide and
  // lit) goes through `paint`, so a switch can hand it to a view transition.
  const show = (lens: string, paint: (f: () => void) => void = f => f(), quiet = false) => {
    const usable = btns.filter(b => !b.hidden).map(b => b.dataset.lens!);
    const pick = usable.includes(lens) ? lens : 'notes';
    for (const b of btns) { const on = b.dataset.lens === pick; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; }
    for (const l of lenses) l.hidden = l.dataset.lens !== pick;
    // The open lens shows its name already; its tooltip would only sit over
    // the lens's first row while the pointer rests where it clicked.
    paint(() => { for (const b of btns) { const on = b.dataset.lens === pick; b.classList.toggle('on', on); b.title = on ? '' : b.dataset.hint ?? ''; b.setAttribute('aria-label', b.dataset.hint ?? ''); } fitBar(); });
    document.dispatchEvent(new CustomEvent('bfb-lens', { detail: pick }));
    // A lens that takes focus does so only when someone opened it, never as a page loads.
    if (!quiet) document.dispatchEvent(new CustomEvent('bfb-lens-open', { detail: pick }));
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
    // Only a lens picked by hand slides in; one shown as a page loads is simply there.
    const now = lenses.find(l => !l.hidden);
    if (now) { now.classList.add('entering'); now.addEventListener('animationend', () => now.classList.remove('entering'), { once: true }); }
    const to = hlRect(), hl = rail.querySelector<HTMLElement>('.fe-rail-btn.on .fe-rail-hl');
    if (!from || !to || !hl || !to.width || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    hl.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})` }, { transform: 'none' }],
      { duration: 180, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  });
  app.showLens = (lens, hideHistory) => {
    if (hideHistory !== undefined) el('fe-rail-history').hidden = hideHistory;
    show(lens ?? lensPref.get());
  };
  // In a narrow window the sidebar is only its rail; picking a lens opens it
  // over the page, and picking it again, Esc or a click outside closes it.
  const side = el('fe-side');
  const narrow = () => matchMedia('(max-width: 520px)').matches;
  const closeOverlay = () => side.classList.remove('open');
  // Open a lens from its bar button and remember it.
  const pick = (b: HTMLElement) => { lensPref.set(b.dataset.lens!); switchTo(b.dataset.lens!); };
  rail.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('.fe-rail-btn');
    if (!b) return;
    if (narrow()) side.classList.toggle('open', !(b.classList.contains('on') && side.classList.contains('open')));
    pick(b);
  });
  dismissOutside(side, () => side.classList.contains('open'), closeOverlay);
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
  lensPref.onChange(() => show(lensPref.get(), undefined, true));
  show(lensPref.get(), undefined, true);
}

export function initSidebar(app: App): void {
  const { rawPath, settings, toast } = app;
  initLenses(app);
  const collapsedPref = setPref('bfb-sidebar-collapsed-v1');
  const sections = els<HTMLElement>('#fe-side .fe-sec[data-collapse]');
  const collapsed = (): Set<string> => collapsedPref.get();
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
      collapsedPref.set(keys);
      toggle.setAttribute('aria-expanded', String(!keys.has(key)));   // the chevron turns as the fold starts
      foldTo(section, () => { section.classList.toggle('fe-collapsed'); }, () => applyCollapsed(keys));
    });
    header.prepend(toggle);
  }
  applyCollapsed(collapsed());
  collapsedPref.onChange(() => applyCollapsed(collapsed()));
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
      + ((p.tags ?? []).length ? `<span class="fe-svc-tags">${p.tags!.map(t => `<span class="chip fe-lens-tag"><i style="--dot:${esc(colour.get(t) ?? '#8b949e')}"></i>${esc(t)}</span>`).join('')}</span>` : '')
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
    row.innerHTML = names.map(n => `<button type="button" class="chip fe-lens-tag${on === '#' + n.toLowerCase() ? ' on' : ''}" aria-pressed="${on === '#' + n.toLowerCase()}" data-tag="${esc(n)}" style="--chip:${esc(colour.get(n) ?? '#8b949e')}" title="Show only items tagged ${esc(n)}"><i style="--dot:${esc(colour.get(n) ?? '#8b949e')}"></i>${esc(n)}</button>`).join('');
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
  // The keyboard's answer to dragging a row: one place up or down within its list or group.
  const savedSiblings = (row: HTMLElement) => els<HTMLElement>('.fe-pl-item', row.parentElement!).filter(x => x.parentElement === row.parentElement);
  app.canMoveRow = row => row.classList.contains('fe-pl-item') ? !svFilter.value.trim() : row.classList.contains('fe-nt-item') ? row.draggable : false;
  app.moveRow = (row, dir) => {
    if (row.classList.contains('fe-nt-item')) {
      const root = notesRoot(), rel = row.dataset.rel!, pinned = row.classList.contains('pinned');
      const group = allNotes.filter(n => !!n.pinned === pinned), at = group.findIndex(n => n.rel === rel);
      const next = group[at + dir];
      if (!root || at < 0) return;
      if (!next) { toast(dir > 0 ? 'Already last' : 'Already first'); return; }
      dropNote(root, rel, pinned, next.rel, dir > 0);
      els<HTMLElement>('.fe-nt-item', ntList).find(i => i.dataset.rel === rel)?.querySelector<HTMLElement>('.fe-si-link')?.focus();
      return;
    }
    const sibs = savedSiblings(row), at = sibs.indexOf(row), next = sibs[at + dir];
    if (!next) { toast(dir > 0 ? 'Already last' : 'Already first'); return; }
    const path = row.dataset.path!;
    // A place with several tags shows once per tag group; the redraw replaces
    // every row, so the moved one is found again by which of its copies it was.
    const copy = els<HTMLElement>('.fe-pl-item', svList).filter(i => i.dataset.path === path).indexOf(row);
    saveSaved(movePlace(getSaved(), path, next.dataset.path!));
    refreshSaved();
    els<HTMLElement>('.fe-pl-item', svList).filter(i => i.dataset.path === path)[Math.max(0, copy)]?.querySelector<HTMLElement>('.fe-si-link, .fe-si')?.focus();
  };
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
  // Dragging a note places it in its group, and dropping it in the other group
  // (or on the pin zone that shows while nothing is pinned) pins or unpins it.
  // The list moves at once; the order keys reach the files after.
  let ntDrag: string | null = null;
  const clearDropMarks = () => els('.drop-before, .drop-after, .drop-in', ntList).forEach(x => x.classList.remove('drop-before', 'drop-after', 'drop-in'));
  function dropNote(root: string, rel: string, toPinned: boolean, beforeRel: string | null, after: boolean): void {
    const src = allNotes.find(n => n.rel === rel);
    if (!src) return;
    const group = allNotes.filter(n => !!n.pinned === toPinned && n.rel !== rel);
    const t = beforeRel ? group.findIndex(n => n.rel === beforeRel) : -1;
    const order = [...group];
    order.splice(t < 0 ? 0 : t + (after ? 1 : 0), 0, src);
    const writes = arrangeWrites(order, rel);
    const pinChange = !!src.pinned !== toPinned;
    if (!pinChange && order.every((n, i) => n === allNotes.filter(m => !!m.pinned === toPinned)[i])) return;
    allNotes = sharedOrder(allNotes.map(n => {
      const pos = writes.get(n.rel);
      return pos || (n.rel === rel && pinChange) ? { ...n, ...(pos ? { pos } : {}), ...(n.rel === rel ? { pinned: toPinned } : {}) } : n;
    }));
    renderNotes(root);
    if (pinChange) toast(toPinned ? 'Pinned' : 'Unpinned');
    const rels = [...new Set([...writes.keys(), ...(pinChange ? [rel] : [])])];
    arranging++;
    // Moves write one after another, so a second quick move reads what the first wrote.
    arrangeChain = arrangeChain.then(async () => {
      for (const r of rels) {
        const cur = await notes.read(root, r);
        let next = cur.text;
        if (writes.has(r)) next = setPos(next, writes.get(r)!);
        if (r === rel && pinChange) next = setPinned(next, toPinned);
        if (frontmatterDrift(cur.text, next, ['pos', 'pinned']).length) throw new Error('that would change other properties');
        await notes.write(root, r, next, cur.mtime);
      }
    }).catch(err => { toast(errorText(err, 'Saving the new order')); })
      .finally(() => { if (--arranging === 0) refreshNotes(); });
  }
  let arrangeChain: Promise<void> = Promise.resolve();
  // While a drop's files are being written, a listing would see half the new
  // order and jump a note back; refreshes wait until the last write lands.
  let arranging = 0;
  ntList.addEventListener('dragstart', e => {
    const item = (e.target as Element).closest<HTMLElement>('.fe-nt-item[draggable="true"]');
    if (!item) return;
    ntDrag = item.dataset.rel!;
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', ntDrag);
    setTimeout(() => item.classList.add('dragging'), 0);
    if (!ntList.querySelector('.fe-nt-grp[data-grp="pinned"]')) {
      ntList.insertAdjacentHTML('afterbegin', `<div class="fe-nt-pinzone"><span class="fe-nt-grp-pin">${UI_ICON.pin}</span><span>Drop here to pin</span></div>`);
    }
  });
  ntList.addEventListener('dragend', () => {
    ntDrag = null;
    clearDropMarks();
    els('.dragging', ntList).forEach(x => x.classList.remove('dragging'));
    ntList.querySelector('.fe-nt-pinzone')?.remove();
  });
  // Where a drop would land: the upper half of a row puts the note above it, the
  // lower half below it; a group header or the pin zone puts it at the top.
  const dropAt = (e: DragEvent) => {
    const t = e.target as Element;
    const row = t.closest<HTMLElement>('.fe-nt-item');
    if (row) { const r = row.getBoundingClientRect(); return { el: row, rel: row.dataset.rel!, pinned: row.classList.contains('pinned'), after: e.clientY > r.top + r.height / 2 }; }
    const head = t.closest<HTMLElement>('.fe-nt-grp, .fe-nt-pinzone');
    if (head) return { el: head, rel: null, pinned: head.classList.contains('fe-nt-pinzone') || head.dataset.grp === 'pinned', after: false };
    return null;
  };
  ntList.addEventListener('dragover', e => {
    if (!ntDrag) return;
    const at = dropAt(e);
    clearDropMarks();
    if (!at || at.rel === ntDrag) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    at.el.classList.add(at.rel ? (at.after ? 'drop-after' : 'drop-before') : 'drop-in');
  });
  ntList.addEventListener('drop', e => {
    if (!ntDrag) return;
    e.preventDefault();
    const at = dropAt(e), rel = ntDrag;
    ntDrag = null;
    clearDropMarks();
    ntList.querySelector('.fe-nt-pinzone')?.remove();
    if (at && at.rel !== rel) dropNote(notesRoot(), rel, at.pinned, at.rel, at.after);
  });
  const noteFoldsPref = setPref('bfb-notes-folded-v1');
  const noteFolds = (): Set<string> => noteFoldsPref.get();
  ntList.addEventListener('click', e => {
    const g = (e.target as Element).closest<HTMLElement>('.fe-nt-grp');
    if (!g) return;
    const body = g.nextElementSibling as HTMLElement;
    const folds = noteFolds(), key = g.dataset.grp!;
    if (folds.has(key)) folds.delete(key); else folds.add(key);
    const open = !folds.has(key);
    g.setAttribute('aria-expanded', String(open));
    g.title = `${open ? 'Fold' : 'Show'} ${g.dataset.label}`;
    noteFoldsPref.set(folds);
    foldTo(body, () => { body.hidden = !body.hidden; });
  });
  // Notes whose text (not just title or tags) holds every word typed, with the
  // first matching line; filled a moment after typing stops.
  let bodyHits = new Map<string, string>();
  const shownNotes = () => {
    const byMeta = filterNotes(allNotes, ntFilter.value);
    return [...byMeta, ...allNotes.filter(n => bodyHits.has(n.rel) && !byMeta.includes(n))];
  };
  // The Trash view takes the list's place: what .trash holds, each note with a Restore button.
  let trashOpen = false;
  let trashed: TrashedNote[] = [];
  const trashBtn = el<HTMLButtonElement>('fe-nt-trash');
  function renderTrash(root: string): void {
    ntHint.textContent = `Trash: ${trashed.length} deleted note${trashed.length !== 1 ? 's' : ''} in ${root}/.trash`;
    const head = `<div class="sect fe-nt-trash-head" data-level="group">${UI_ICON.trash}Trash<span class="fe-grp-n">${trashed.length}</span></div>`;
    ntList.innerHTML = head + (trashed.length ? trashed.map(t => `
      <div class="row fe-bm-item fe-nt-trashed" data-trashed="${esc(t.trashed)}">
        <span class="fe-si-link" title="${esc(t.name)}">${PI.docs ?? PI.folder}<span class="fe-nt-main"><span class="fe-nt-label">${midHtml(t.title || noteTitle(t.name))}</span><span class="fe-nt-when">Deleted ${esc(whenText(t.deleted))}</span></span></span>
        <button class="btn fe-nt-restore" data-size="sm" data-trashed="${esc(t.trashed)}" title="Put this note back in the notes folder" aria-label="Restore ${esc(t.title || noteTitle(t.name))}">${UI_ICON.reset}<span>Restore</span></button>
      </div>`).join('')
      : emptyHtml('empty', 'The trash is empty', { inline: true, hint: 'Deleted notes wait here until you restore them' }));
  }
  function showTrash(root: string, on: boolean): void {
    trashOpen = on;
    trashBtn.classList.toggle('on', on);
    el('fe-lens-notes').classList.toggle('trashing', on);
    trashBtn.setAttribute('aria-pressed', String(on));
    trashBtn.title = on ? 'Back to the notes' : 'Trash: notes you deleted';
    if (!on) { refreshNotes(); return; }
    notes.trashList(root).then(list => { trashed = list; if (trashOpen) renderTrash(root); })
      .catch((err: NotesError) => toast(errorText(err, 'Listing the trash')));
  }
  trashBtn.addEventListener('click', () => { const root = notesRoot(); if (root) showTrash(root, !trashOpen); });
  ntList.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('.fe-nt-restore');
    if (!b) return;
    const root = notesRoot(), item = trashed.find(t => t.trashed === b.dataset.trashed);
    if (!root || !item) return;
    notes.restore(root, item.trashed).then(r => {
      trashed = trashed.filter(t => t !== item);
      if (trashOpen) renderTrash(root);
      refreshNotes();
      toast(`Restored ${item.title || noteTitle(r.rel)}`);
    }).catch((err: NotesError) => toast(errorText(err, 'Restoring the note')));
  });
  function renderNotes(root: string): void {
    if (trashOpen) return;   // the list is hidden behind the Trash view; leaving it redraws
    // A refresh landing while a title is being renamed would replace the box
    // under the cursor; the rename re-renders the list itself when it ends.
    if (ntList.querySelector('.fe-nt-label.editing') || ntDrag) return;
    keepNotes(root, allNotes);   // the next page starts from the list as drawn here, drags and pins included
    // A filtered list shows only some of a group, so a drop there has no clear place; drag only unfiltered.
    const filtering = !!ntFilter.value.trim();
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
          <div class="row fe-bm-item fe-nt-item${n.pinned ? ' pinned' : ''}${c ? ' coloured' : ''}${(n.tags ?? []).length ? ' two' : ''}" data-rel="${esc(n.rel)}"${c ? ` style="--c:var(--nc-${c})"` : ''}${filtering ? '' : ' draggable="true"'}>
            ${filtering ? '' : `<span class="fe-drag-h" aria-hidden="true">${PI.drag}</span>`}
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
    // A redraw while the keyboard is on a row must not drop it.
    const heldRel = (document.activeElement as HTMLElement | null)?.matches('.fe-si-link') ? (document.activeElement as HTMLElement).closest<HTMLElement>('.fe-nt-item')?.dataset.rel : undefined;
    ntList.innerHTML = shown.length
      ? (pinned.length ? group('pinned', 'Pinned', pinned) + group('all', 'All notes', rest) : shown.map(row).join(''))
      : allNotes.length
        ? emptyHtml('filtered', `No note matches "${ntFilter.value.trim()}"`, { inline: true, actions: [CLEAR] })
        : emptyHtml('empty', 'No notes yet', { inline: true, hintHtml: 'Press <kbd>n</kbd> or + to write one' });
    attachNoteEvents(root);
    if (heldRel) els<HTMLElement>('.fe-nt-item', ntList).find(i => i.dataset.rel === heldRel)?.querySelector<HTMLElement>('.fe-si-link')?.focus();
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
  const deepPref = flagPref('bfb-lens-deep-v1', false);
  const depthBtn = el<HTMLButtonElement>('fe-lens-depth');
  const deep = () => deepPref.get();
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
    deepPref.set(!deep());
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
  const keptNotes = (root: string) => keptNotesList<NoteMeta>(root);
  const keepNotes = (root: string, list: NoteMeta[]) => keepNotesList(root, list);
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
    // The list as the last page saw it shows at once, so moving between pages
    // never blanks it; the host's answer replaces it only if something changed.
    if (!allNotes.length) {
      const kept = keptNotes(root);
      if (kept) { allNotes = kept; renderNotes(root); }
    }
    notes.list(root).then(unsorted => {
      if (arranging) return;
      const next = sharedOrder(unsorted);
      const same = JSON.stringify(next) === JSON.stringify(allNotes);
      allNotes = next;
      keepNotes(root, next);
      if (!same || !ntList.querySelector('.fe-nt-item, .fe-empty')) renderNotes(root);
    }).catch((err: NotesError) => {
      ntHint.textContent = errorText(err, 'Listing the notes');
      ntList.innerHTML = err.code === 'unavailable'
        ? emptyHtml('failed', 'Notes host not installed', { inline: true, hint: errorText(err) })
        : emptyHtml('failed', 'Notes could not be listed', { inline: true, hint: errorText(err), actions: [{ a: 'retry', label: 'Try again', title: 'List the notes again' }] });
    });
  }
  app.refreshNotes = refreshNotes;
  // Colour dot and pin first, then the title with tags beneath.
  function noteRowText(n: NoteMeta): string {
    const colour = new Map(getTags().map(t => [t.name, t.color]));
    const tags = (n.tags ?? []).length ? `<span class="fe-nt-tags">${n.tags!.map(t => `<span class="fe-nt-tag"><i style="--dot:${esc(colour.get(t) ?? 'var(--dm)')}"></i>${esc(t)}</span>`).join('')}</span>` : '';
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
      }).catch((err: NotesError) => toast(errorText(err, 'Renaming the note')));
    }, back);
  }
  function deleteNote(root: string, rel: string): void {
    if (editingRel() === rel) discardEditor();
    notes.delete(root, rel).then(r => {
      refreshNotes();
      toast('Moved to .trash', 6000, { label: 'Undo', run: () => {
        notes.restore(root, r.trashed, rel).then(() => { refreshNotes(); toast('Put back'); })
          .catch((err: NotesError) => toast(errorText(err, 'Putting the note back')));
      } });
    }).catch((err: NotesError) => toast(errorText(err, 'Moving the note to .trash')));
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
      .catch((err: NotesError) => toast(errorText(err, 'Opening the note')));
  }
  function openProps(root: string, rel: string, anchor: HTMLElement): void {
    notes.read(root, rel).then(doc => openPropsMenu(anchor, readProps(rel, doc.text), async c => {
      const cur = await notes.read(root, rel);
      const next = applyChange(cur.text, c);
      if (frontmatterDrift(cur.text, next, changedKeys(c)).length) { toast('Not saved: that would change other properties'); return; }
      try { await notes.write(root, rel, next, cur.mtime); } catch (err) { toast(errorText(err, 'Saving the change')); return; }
      refreshNotes();
      return readProps(rel, next);
    })).catch((err: NotesError) => toast(errorText(err, 'Reading the note')));
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
      .catch((err: NotesError) => toast(errorText(err, 'Making the note')));
  };
  app.pickNotesFolder = () => {
    notes.pick(notesRoot() || undefined).then(root => {
      if (!root) return;   // cancelled
      settings.notesRoot = root; saveSettings(settings);
      const field = document.getElementById('fe-st-notes-root') as HTMLInputElement | null;
      if (field) field.value = root;
      refreshNotes();
    }).catch((err: NotesError) => toast(errorText(err, 'Picking the folder')));
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
