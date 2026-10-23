// Where a document is kept, managed from the document itself: its file name,
// whether it is in Saved and under what name, and, for a file in the Notes
// folder, its pin and its note title. One card behind the file bar's Keep
// button holds all of it, in reading and in editing alike. The rename here is
// also what the listing and the preview use, so a renamed file's Saved entry
// and tab follow it wherever the rename started.
import { notes, NotesError, readProps, retitle, applyChange } from './notes';
import { getSaved, saveSaved, getSettings } from './storage';
import { retargetPlace, upsertPlace, removePlace, samePlace, renamePlace } from './places';
import { openLayer, type Layer } from './layer';
import { switchHtml, checkHtml } from './controls';
import { PI } from './icons';
import { esc, fileHref } from './utils';
import { errorText } from './errors';
import { go } from './nav';
import type { App } from './app';

/** What is wrong with a new file name, or null when it can be used. */
export function nameProblem(name: string): string | null {
  if (!name) return 'Type a name.';
  if (name.includes('/')) return 'A name cannot hold a slash.';
  if (name === '.' || name === '..') return 'Pick another name.';
  if (name.includes('\0')) return 'Pick another name.';
  return null;
}

const baseOf = (p: string) => p.slice(p.lastIndexOf('/') + 1);
const dirOf = (p: string) => p.slice(0, p.lastIndexOf('/')) || '/';

/**
 * Rename a file on disk and bring along everything that points at it: its
 * Saved entry, its tab, and its comments (the host moves those). Answers the
 * new path, or null after telling the person why it did not happen.
 */
export async function renameOnDisk(app: Pick<App, 'toast' | 'refreshSaved' | 'refreshNotes' | 'strip'>, path: string, name: string): Promise<string | null> {
  name = name.trim();
  if (name === baseOf(path)) return null;
  const problem = nameProblem(name);
  if (problem) { app.toast(problem); return null; }
  const to = dirOf(path).replace(/\/$/, '') + '/' + name;
  try {
    await notes.rename(dirOf(path), baseOf(path), name);
  } catch (err) {
    app.toast((err as NotesError).code === 'notes_exists' ? `${name} is already there. Pick another name.` : errorText(err, 'Renaming the file'));
    return null;
  }
  const list = getSaved();
  if (list.some(p => samePlace(p.path, path))) { saveSaved(retargetPlace(list, path, to)); app.refreshSaved(); }
  app.strip?.retarget(path, to);
  app.refreshNotes();
  app.toast(`Renamed to ${name}`);
  return to;
}

/** The notes folder and this file's place in it, when the file is a note. */
function noteOf(path: string): { root: string; rel: string } | null {
  const root = (getSettings().notesRoot || '').replace(/\/$/, '');
  return root && path.startsWith(root + '/') && /\.md$/i.test(path) ? { root, rel: path.slice(root.length + 1) } : null;
}

/// The file bar's Keep button.
export const KEEP_BTN = `<button id="fe-fp-keep" class="btn" title="Name, Saved and Notes for this file">${PI.bm}<span>Keep</span></button>`;

/** Wire the Keep button on a file page: the card it opens, and what each field writes. */
export function mountKeep(app: App): void {
  const btn = document.getElementById('fe-fp-keep');
  if (!btn) return;
  const path = app.rawPath;
  let layer: Layer | null = null;
  const paintBtn = () => btn.classList.toggle('on', getSaved().some(p => samePlace(p.path, path)));
  paintBtn();

  const open = async () => {
    const note = noteOf(path);
    const doc = note ? await notes.read(note.root, note.rel).catch(() => null) : null;
    let props = note && doc ? readProps(note.rel, doc.text) : null;
    const saved = () => getSaved().find(p => samePlace(p.path, path)) ?? null;
    const s = saved();
    const box = document.createElement('form');
    box.id = 'fe-keep';
    // One title for both while they agree, or while only one of them exists.
    const linked = !s || !props || s.label === props.title;
    box.innerHTML = `
      <label class="fe-keep-f"><span class="fe-keep-l">File name</span>
        <span class="fe-keep-row"><input class="tb" data-k="name" value="${esc(baseOf(path))}" spellcheck="false" autocomplete="off" aria-label="File name"><button type="submit" class="btn" data-variant="outline" data-k="go" title="Rename the file on disk (Enter)">Rename</button></span></label>
      <div class="fe-keep-sec">
        <div class="fe-keep-h">${switchHtml({ id: 'fe-keep-saved', title: 'Keep this file in Saved', label: 'In Saved', checked: !!s, small: true })}<span>Saved</span></div>
        <label class="fe-keep-f"><span class="fe-keep-l">Name in Saved</span>
          <input class="tb" data-k="label" value="${esc(s?.label ?? props?.title ?? baseOf(path))}" spellcheck="false" autocomplete="off" aria-label="Name in Saved"${s ? '' : ' disabled'}></label>
      </div>
      <div class="fe-keep-sec">
        ${props ? `<div class="fe-keep-h">${switchHtml({ id: 'fe-keep-pinned', title: 'Pin this note to the top of Notes', label: 'Pinned in Notes', checked: props.pinned, small: true })}<span>Pinned in Notes</span></div>
        <label class="fe-keep-f"><span class="fe-keep-l">Note title</span>
          <input class="tb" data-k="title" value="${esc(props.title)}" spellcheck="false" autocomplete="off" aria-label="Note title"></label>
        ${checkHtml('fe-keep-link', 'Same title in Saved and Notes', 'Changing one title changes the other', linked)}`
        : `<p class="fe-keep-note">${note ? 'This note could not be read.' : 'Not in your Notes folder, so it has no note title or pin.'}</p>`}
      </div>
      <p class="fe-keep-msg" aria-live="polite"></p>`;
    const field = (k: string) => box.querySelector<HTMLInputElement>(`[data-k="${k}"]`);
    const say = (t: string) => { box.querySelector<HTMLElement>('.fe-keep-msg')!.textContent = t; };
    const isLinked = () => !!box.querySelector<HTMLInputElement>('#fe-keep-link')?.checked;
    // A change made while unsaved edits wait would be lost or fight them.
    const busyEditing = () => !!app.filePage?.unsaved();

    const writeNote = async (change: (text: string) => string) => {
      if (!note) return false;
      try {
        const now = await notes.read(note.root, note.rel);
        const text = change(now.text);
        if (text === now.text) return true;
        await notes.write(note.root, note.rel, text, now.mtime);
        props = readProps(note.rel, text);
        if (!app.filePage?.editing()) app.filePage?.setText(text);
        app.refreshNotes();
        return true;
      } catch (err) { say(errorText(err, 'Saving the note')); return false; }
    };
    const setLabel = (label: string) => {
      const cur = saved();
      if (cur && label && cur.label !== label) { saveSaved(renamePlace(getSaved(), cur.path, label)); app.refreshSaved(); }
    };
    const setTitle = async (title: string) => {
      if (!title || !props || title === props.title) return;
      if (await writeNote(t => retitle(t, title) ?? `# ${title}\n\n${t}`)) say('Note title saved');
    };

    box.addEventListener('change', async e => {
      const t = e.target as HTMLElement;
      const k = t.dataset?.k ?? t.id?.replace('fe-keep-', '');
      if (k === 'saved') {
        const on = (e.target as HTMLInputElement).checked;
        const label = field('label')!.value.trim() || baseOf(path);
        saveSaved(on ? upsertPlace(getSaved(), { path, label }) : removePlace(getSaved(), path));
        field('label')!.disabled = !on;
        app.refreshSaved(); paintBtn();
        say(on ? 'Saved' : 'Removed from Saved');
      } else if (k === 'pinned') {
        const on = (e.target as HTMLInputElement).checked;
        if (await writeNote(t => applyChange(t, { pinned: on }))) say(on ? 'Pinned in Notes' : 'Unpinned');
      } else if (k === 'label') {
        const v = field('label')!.value.trim();
        setLabel(v);
        if (isLinked() && field('title')) { field('title')!.value = v; await setTitle(v); }
        say('Name in Saved changed');
      } else if (k === 'title') {
        const v = field('title')!.value.trim();
        await setTitle(v);
        if (isLinked() && field('label')) { field('label')!.value = v; setLabel(v); }
      }
    });
    // While linked, the other box shows what is being typed.
    box.addEventListener('input', e => {
      const k = (e.target as HTMLElement).dataset?.k;
      if (!isLinked() || (k !== 'label' && k !== 'title')) return;
      const other = field(k === 'label' ? 'title' : 'label');
      if (other && !other.disabled) other.value = (e.target as HTMLInputElement).value;
    });
    // Enter in a box applies it; in the file name box it renames.
    box.addEventListener('submit', async e => {
      e.preventDefault();
      const active = document.activeElement as HTMLInputElement | null;
      const k = active?.dataset.k === 'go' ? 'name' : active?.dataset.k;
      if (k !== 'name') { active?.blur(); return; }
      if (busyEditing()) { say('Save your edits first, then rename.'); return; }
      const to = await renameOnDisk(app, path, field('name')!.value);
      if (to) { layer?.close('pick'); go(fileHref(to)); }
    });

    layer = openLayer(box, { kind: 'popover', anchor: btn, align: 'end', offset: 8, role: 'dialog', label: 'Keep this file', focus: field('name')!,
      onClose: () => { layer = null; btn.classList.remove('open'); paintBtn(); } });
    if (!layer.open) { layer = null; return; }
    btn.classList.add('open');
    const name = field('name')!;
    // The name is selected up to its extension, as Finder does.
    const dot = name.value.lastIndexOf('.');
    name.setSelectionRange(0, dot > 0 ? dot : name.value.length);
  };
  btn.addEventListener('click', () => { if (layer) layer.close('api'); else void open(); });
}

/** Ask for a new name in a small box beside `anchor`, then rename. Used by the listing and the preview. */
export function askRename(app: App, anchor: HTMLElement, path: string, done: (to: string) => void): void {
  const box = document.createElement('form');
  box.id = 'fe-keep';
  box.className = 'fe-rename';
  box.innerHTML = `<label class="fe-keep-f"><span class="fe-keep-l">Rename</span>
    <input class="tb" value="${esc(baseOf(path))}" spellcheck="false" autocomplete="off" aria-label="New name"></label>`;
  const input = box.querySelector('input')!;
  const layer = openLayer(box, { kind: 'popover', anchor, align: 'start', offset: 4, role: 'dialog', label: 'Rename', focus: input });
  if (!layer.open) return;
  const dot = input.value.lastIndexOf('.');
  input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
  box.addEventListener('submit', async e => {
    e.preventDefault();
    const to = await renameOnDisk(app, path, input.value);
    layer.close('pick');
    if (to) done(to);
  });
}
