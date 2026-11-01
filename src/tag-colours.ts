// The tag colours page in Settings: every tag on a note or a save, with its colour and its name.
// Renaming a tag renames it on every note and save that carries it, and the colour goes along.
import { notes, NotesError, applyChange, readProps, frontmatterDrift, changedKeys, type NoteMeta } from './notes';
import { getSaved, saveSaved, getTags, setTagColour, renameTagColour } from './storage';
import { TAG_COLORS } from './places';
import type { Place, Tag } from './types';
import { esc } from './utils';
import { errorText } from './errors';

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

/** The colour a swatch click moves to: the next in the palette, and after the last, none. */
export function nextColour(current: string | null): string | null {
  if (!current) return TAG_COLORS[0];
  const i = TAG_COLORS.indexOf(current);
  return i < 0 || i === TAG_COLORS.length - 1 ? null : TAG_COLORS[i + 1];
}

/** Rename a tag on every note and save. Resolves to how many files and saves changed. */
export async function renameTag(root: string, old: string, rawNew: string): Promise<number> {
  const next = rawNew.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
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
    saveSaved(saved.map(p => (p.tags?.includes(old) ? { ...p, tags: swapTag(p.tags, old, next.toLowerCase()) } : p)));
    changed += saved.filter(p => p.tags?.includes(old)).length;
  }
  renameTagColour(old, next);
  if (root) await notes.savedSync(root, { tags: { [old]: null } }).catch(() => undefined);
  return changed;
}

/** Draws the page into `host` and answers with a redraw. */
export function mountTagColours(host: HTMLElement, o: { root: () => string; toast: (m: string) => void; refresh: () => void }): () => void {
  const draw = async () => {
    const root = o.root();
    let list: NoteMeta[] = [];
    if (root) { try { list = await notes.list(root); } catch { /* the notes host is missing: saves still show */ } }
    const rows = tagRows(list.map(n => n.tags ?? []), getSaved(), getTags());
    host.innerHTML = rows.length ? rows.map(r => `
      <div class="fe-tc-row" data-tag="${esc(r.tag)}">
        <button class="fe-tc-sw" data-tc="colour" title="Click to change this tag's colour" aria-label="Colour of ${esc(r.tag)}"><i style="--dot:${esc(r.color ?? 'var(--dm)')}"></i></button>
        <input class="tb" data-size="sm" data-tc="name" value="${esc(r.tag)}" maxlength="32" spellcheck="false" aria-label="Name of ${esc(r.tag)}">
        <span class="fe-tc-n">${r.count} ${r.count === 1 ? 'item' : 'items'}</span>
      </div>`).join('') : '<p class="fe-set-note">No tags yet. Tag a note or a save and it shows up here.</p>';
  };
  host.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tc="colour"]');
    if (!b) return;
    const tag = b.closest<HTMLElement>('.fe-tc-row')!.dataset.tag!;
    const cur = getTags().find(t => t.name === tag)?.color ?? null;
    setTagColour(tag, nextColour(cur));
    o.refresh();
    void draw();
  });
  host.addEventListener('change', e => {
    const inp = (e.target as HTMLElement).closest<HTMLInputElement>('[data-tc="name"]');
    if (!inp) return;
    const tag = inp.closest<HTMLElement>('.fe-tc-row')!.dataset.tag!;
    renameTag(o.root(), tag, inp.value).then(n => { if (n) o.toast(`Renamed on ${n} ${n === 1 ? 'item' : 'items'}`); o.refresh(); return draw(); })
      .catch(err => { o.toast(errorText(err as NotesError, 'Renaming the tag')); void draw(); });
  });
  return () => { void draw(); };
}
