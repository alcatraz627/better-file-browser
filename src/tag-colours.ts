// The tag colours page in Settings: every tag on a note or a save, with its colour and its name.
// Renaming a tag renames it on every note and save that carries it, and the colour goes along.
import { UI_ICON } from './control-icons';
import { notes, NotesError, applyChange, readProps, frontmatterDrift, changedKeys, type NoteMeta } from './notes';
import { getSaved, saveSaved, getTags, setTagColour, renameTagColour } from './storage';
import { askYesNo } from './ask-yes-no';
import type { Toast } from './toast';
import { TAG_COLORS } from './places';
import type { Place, Tag } from './types';
import { esc } from './utils';
import { errorText } from './errors';
import { openLayer } from './layer';

export interface TagRow { tag: string; count: number; color: string | null }

/** Every tag in use on a note or a save plus any that only has a colour, most used first. */
export function tagRows(noteTags: string[][], saved: Place[], colours: Tag[]): TagRow[] {
  const count = new Map<string, number>();
  for (const tags of noteTags) for (const t of new Set(tags)) count.set(t, (count.get(t) ?? 0) + 1);
  for (const p of saved) for (const t of new Set(p.tags ?? [])) count.set(t, (count.get(t) ?? 0) + 1);
  for (const c of colours) if (!count.has(c.name)) count.set(c.name, 0);
  const colour = new Map(colours.map(c => [c.name, c.color]));
  return [...count].map(([tag, n]) => ({ tag, count: n, color: colour.get(tag) ?? null }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** A tag list with `old` replaced by `next`, without repeats. */
export function swapTag(tags: string[], old: string, next: string): string[] {
  const out: string[] = [];
  for (const t of tags.map(x => (x === old ? next : x))) if (!out.includes(t)) out.push(t);
  return out;
}

const cleanTag = (raw: string) => raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

/** Rename a tag on every note and save. Resolves to how many files and saves changed. */
export async function renameTag(root: string, old: string, rawNew: string): Promise<number> {
  const next = cleanTag(rawNew);
  if (!next || next === old) return 0;
  let changed = 0;
  const list: NoteMeta[] = root ? await notes.list(root) : [];
  for (const n of list) {
    if (!(n.tags ?? []).includes(old)) continue;
    const cur = await notes.read(root, n.rel);
    const tags = swapTag(readProps(n.rel, cur.text).tags, old, next);
    const text = applyChange(cur.text, { tags });
    if (frontmatterDrift(cur.text, text, changedKeys({ tags })).length) continue;
    await notes.write(root, n.rel, text, cur.mtime);
    changed++;
  }
  const saved = getSaved();
  if (saved.some(p => p.tags?.includes(old))) {
    saveSaved(saved.map(p => (p.tags?.includes(old) ? { ...p, tags: swapTag(p.tags, old, next) } : p)));
    changed += saved.filter(p => p.tags?.includes(old)).length;
  }
  renameTagColour(old, next);
  if (root) await notes.savedSync(root, { tags: { [old]: null } }).catch(() => undefined);
  return changed;
}

/** Draws the page into `host` and answers with a redraw. */
export function mountTagColours(host: HTMLElement, o: { root: () => string; toast: Toast; refresh: () => void }): () => void {
  const draw = async () => {
    const root = o.root();
    let list: NoteMeta[] = [];
    if (root) { try { list = await notes.list(root); } catch { /* the notes host is missing: saves still show */ } }
    const rows = tagRows(list.map(n => n.tags ?? []), getSaved(), getTags());
    host.innerHTML = rows.length ? rows.map(r => `
      <div class="fe-tc-row" data-tag="${esc(r.tag)}">
        <button class="fe-tc-sw" data-tc="colour" title="Choose this tag's colour" aria-label="Colour of ${esc(r.tag)}"><i style="--dot:${esc(r.color ?? 'var(--dm)')}"></i></button>
        <input class="tb" data-size="sm" data-tc="name" data-own-esc value="${esc(r.tag)}" maxlength="32" spellcheck="false" aria-label="Name of ${esc(r.tag)}">
        <span class="fe-tc-n">${r.count} ${r.count === 1 ? 'item' : 'items'}</span>
      </div>`).join('') : '<p class="fe-set-note">No tags yet. Tag a note or a save and it shows up here.</p>';
  };
  host.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tc="colour"]');
    if (!b) return;
    const tag = b.closest<HTMLElement>('.fe-tc-row')!.dataset.tag!;
    const cur = getTags().find(t => t.name === tag)?.color ?? null;
    const box = document.createElement('div');
    box.className = 'fe-tc-pop';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', `Colour of ${tag}`);
    box.innerHTML = TAG_COLORS.map(c => `<button type="button" class="fe-rp-c${c === cur ? ' on' : ''}" data-c="${c}" style="--c:${c}" title="${c}" aria-label="${c}"></button>`).join('')
      + `<button type="button" class="btn" data-size="sm" data-c=""${cur ? '' : ' aria-pressed="true"'} title="Back to the tag's own colour">${UI_ICON.reset}Default</button>`;
    const pop = openLayer(box, { kind: 'popover', anchor: b, offset: 6, group: 'menu', focus: 'first' });
    box.addEventListener('click', ev => {
      const pick = (ev.target as HTMLElement).closest<HTMLElement>('[data-c]');
      if (!pick) return;
      setTagColour(tag, pick.dataset.c || null);
      pop.close('api');
      o.refresh();
      void draw();
    });
  });
  host.addEventListener('change', e => {
    const inp = (e.target as HTMLElement).closest<HTMLInputElement>('[data-tc="name"]');
    if (!inp) return;
    const tag = inp.closest<HTMLElement>('.fe-tc-row')!.dataset.tag!;
    void rename(tag, inp.value);
  });
  // The name box answers its own keys: Esc puts the name back and stays in Settings, Enter applies it.
  host.addEventListener('keydown', e => {
    const inp = (e.target as HTMLElement).closest<HTMLInputElement>('[data-tc="name"]');
    if (!inp) return;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      inp.value = inp.closest<HTMLElement>('.fe-tc-row')!.dataset.tag!;
      inp.blur();
    } else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); inp.blur(); }
  }, true);
  /** Rename everywhere. Going onto a name already in use merges two tags, which cannot be pulled apart, so it asks; a plain rename can be undone. */
  const rename = async (tag: string, typed: string) => {
    const name = cleanTag(typed);
    if (!name || name === tag) { await draw(); return; }
    const taken = await inUse(name);
    if (taken && !(await askYesNo(`"${name}" is already a tag on ${taken} ${taken === 1 ? 'item' : 'items'}. Merge "${tag}" into it? This cannot be undone.`, 'Merge tags'))) { await draw(); return; }
    try {
      const n = await renameTag(o.root(), tag, name);
      if (n) o.toast(`${taken ? 'Merged' : 'Renamed'} on ${n} ${n === 1 ? 'item' : 'items'}`, 8000, taken ? undefined : { label: 'Undo', run: () => { void rename(name, tag); } });
      o.refresh();
    } catch (err) { o.toast(errorText(err as NotesError, 'Renaming the tag')); }
    await draw();
  };
  const inUse = async (name: string) => {
    let list: NoteMeta[] = [];
    if (o.root()) { try { list = await notes.list(o.root()); } catch { /* the notes host is missing: saves still count */ } }
    return tagRows(list.map(n => n.tags ?? []), getSaved(), []).find(r => r.tag === name)?.count ?? 0;
  };
  return () => { void draw(); };
}
