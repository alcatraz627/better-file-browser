// The note properties UI both the editor and the sidebar use: colour dots, the chip row
// above the editor, and the small menu that sets colour, pin and tags.
import { NOTE_COLORS, type NoteColor, type NoteProps, type PropChange } from './notes';
import { UI_ICON, dotIcon } from './control-icons';
import { esc, midHtml } from './utils';
import { openLayer, type Layer } from './layer';

export const colorDot = (c: NoteColor | null): string => dotIcon(c ? `var(--nc-${c})` : null);

/// Applies a change and answers with the properties as written, or void when the change failed.
export type ApplyChange = (c: PropChange) => Promise<NoteProps | void> | NoteProps | void;

let openMenu: Layer | null = null;
export function closePropsMenu(): void { openMenu?.close('api'); openMenu = null; }

/// The properties menu: pin, the eight colours, and tags, anchored under `anchor`.
export function openPropsMenu(anchor: HTMLElement, props: NoteProps, apply: ApplyChange): void {
  closePropsMenu();
  const menu = document.createElement('div');
  menu.className = 'fe-pmenu';
  let cur = props;

  const render = () => {
    menu.innerHTML = `
      <button data-size="sm" class="btn fe-pm-pin${cur.pinned ? ' active' : ''}" data-pm="pin" role="menuitem">${UI_ICON.pin}<span>${cur.pinned ? 'unpin' : 'pin to top'}</span></button>
      <div class="fe-pm-lbl">Colour</div>
      <div class="fe-pm-colors">
        <button data-size="sm" class="btn${cur.color === null ? ' active' : ''}" data-pm="color" data-color="" role="menuitem">${colorDot(null)}<span>none</span></button>
        ${NOTE_COLORS.map(c => `<button data-size="sm" class="btn${cur.color === c ? ' active' : ''}" data-pm="color" data-color="${c}" role="menuitem">${colorDot(c)}<span>${c}</span></button>`).join('')}
      </div>
      <div class="fe-pm-lbl">tags</div>
      <div class="fe-pm-tags">
        ${cur.tags.map(t => `<span class="chip">${UI_ICON.tag}<span>${esc(t)}</span><button class="btn" data-icon data-size="xs" data-tone="danger" data-pm="untag" data-tag="${esc(t)}" title="Remove tag ${esc(t)}" aria-label="Remove tag ${esc(t)}">${UI_ICON.close}</button></span>`).join('')}
      </div>
      <form class="fe-pm-add"><input class="tb" data-size="sm" type="text" placeholder="new tag" autocomplete="off" spellcheck="false" maxlength="32"><button class="btn" data-size="sm" type="submit">${UI_ICON.add}<span>add</span></button></form>`;
  };
  const run = async (c: PropChange) => {
    const r = await apply(c);
    if (r) cur = r;
    render();
    openMenu?.place();
    menu.querySelector<HTMLInputElement>('.fe-pm-add input')?.focus();
  };
  menu.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pm]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const k = b.dataset.pm;
    if (k === 'pin') void run({ pinned: !cur.pinned });
    else if (k === 'color') void run({ color: (b.dataset.color || null) as NoteColor | null });
    else if (k === 'untag') void run({ tags: cur.tags.filter(t => t !== b.dataset.tag) });
  });
  menu.addEventListener('submit', e => {
    e.preventDefault();
    const inp = menu.querySelector<HTMLInputElement>('.fe-pm-add input')!;
    // A comma ends a tag, as it does in the Saved list: "work, planning" is two tags. Spaces
    // stay inside a tag, which the file format allows.
    const typed = [...new Set(inp.value.split(',').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean))];
    const fresh = typed.filter(t => !cur.tags.includes(t));
    // the same limits the Pi and the phone keep: a "pin" tag would turn the note into a pin and
    // hide it from every Notes list, and the phone refuses more than 12 tags of 32 characters
    const why = typed.some(t => t.toLowerCase() === 'pin') ? '"pin" is kept for pins; pin the note instead'
      : typed.some(t => t.length > 32) ? 'A tag is at most 32 characters'
      : cur.tags.length + fresh.length > 12 ? 'A note keeps at most 12 tags' : '';
    inp.setCustomValidity(why);
    if (why) { inp.reportValidity(); return; }
    if (fresh.length) void run({ tags: [...cur.tags, ...fresh] });
    else inp.value = '';
  });
  render();
  openMenu = openLayer(menu, { kind: 'popover', anchor, role: 'menu', group: 'menu', focus: menu.querySelector<HTMLElement>('.fe-pm-add input')! });
}

/// The chip row above the editor text: title, pin, colour and tags. Returns a redraw.
export function mountMetaBar(host: HTMLElement, o: {
  props: () => NoteProps;
  /** True while the note has no title of its own yet (a new, empty note). */
  untitled: () => boolean;
  setTitle: (v: string) => void;
  apply: ApplyChange;
}): () => void {
  const draw = () => {
    const p = o.props();
    const none = o.untitled();
    host.innerHTML = `
      <button id="fe-meta-title" class="fe-chip-title${none ? ' untitled' : ''}" data-title="${esc(none ? '' : p.title)}" title="Rename this note" aria-label="${none ? 'Name this note' : `Note title: ${esc(p.title)}. Click to rename.`}">${none ? 'Untitled, click to name it' : midHtml(p.title)}${UI_ICON.rename}</button>
      <button data-size="sm" class="btn fe-chip-btn${p.pinned ? ' active' : ''}" data-m="pin" title="${p.pinned ? 'Unpin this note' : 'Pin this note to the top of the list'}">${UI_ICON.pin}<span>${p.pinned ? 'Pinned' : 'Pin'}</span></button>
      <button data-size="sm" class="btn fe-chip-btn${p.color ? ' active' : ''}" data-m="color" title="Set this note's colour">${colorDot(p.color)}<span>${p.color ? p.color[0].toUpperCase() + p.color.slice(1) : 'Colour'}</span></button>
      ${p.tags.map(t => `<span class="chip">${UI_ICON.tag}<span>${esc(t)}</span><button class="btn" data-icon data-size="xs" data-tone="danger" data-m="untag" data-tag="${esc(t)}" title="Remove tag ${esc(t)}" aria-label="Remove tag ${esc(t)}">${UI_ICON.close}</button></span>`).join('')}
      <button class="btn fe-chip-btn" data-size="sm" data-m="tag" title="Add a tag">${UI_ICON.add}<span>Tag</span></button>`;
    // The title shows on one line, middle-truncated; a click opens a box holding the whole title.
    const btn = host.querySelector<HTMLButtonElement>('#fe-meta-title');
    btn?.addEventListener('click', () => {
      const box = document.createElement('textarea');
      box.id = 'fe-meta-title-edit';
      box.className = 'tb fe-chip-title';
      box.value = none ? '' : p.title; box.placeholder = 'Name this note'; box.rows = 1; box.maxLength = 200; box.spellcheck = true;
      box.setAttribute('aria-label', 'Note title');
      // The box opens at the chip's height so the row does not jump, and grows only for a long title.
      const h0 = btn.offsetHeight;
      btn.replaceWith(box);
      const fit = () => { box.style.height = 'auto'; box.style.height = Math.max(h0, box.scrollHeight + 2) + 'px'; };
      fit(); box.focus(); box.select();
      let done = false;
      const finish = (save: boolean) => {
        if (done) return; done = true;
        const v = box.value.replace(/\s*\n\s*/g, ' ').trim();
        if (save && v && (none || v !== p.title)) o.setTitle(v); else draw();
      };
      box.addEventListener('input', fit);
      box.addEventListener('blur', () => finish(true));
      box.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      });
    });
  };
  host.addEventListener('click', async e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-m]');
    if (!b) return;
    const p = o.props();
    if (b.dataset.m === 'pin') { await o.apply({ pinned: !p.pinned }); draw(); }
    else if (b.dataset.m === 'untag') { await o.apply({ tags: p.tags.filter(t => t !== b.dataset.tag) }); draw(); }
    else {
      openPropsMenu(b, p, async c => { const r = await o.apply(c); draw(); return r; });
    }
  });
  draw();
  return draw;
}
