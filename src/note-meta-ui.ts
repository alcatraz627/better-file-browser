// The note properties UI both the editor and the sidebar use: colour dots, the chip row
// above the editor, and the small menu that sets colour, pin and tags.
import { NOTE_COLORS, type NoteColor, type NoteProps, type PropChange } from './notes';
import { UI_ICON } from './control-icons';
import { esc, midHtml } from './utils';

export const colorDot = (c: NoteColor | null): string =>
  `<svg class="fe-cdot" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">`
  + (c ? `<circle cx="6" cy="6" r="4.5" fill="var(--nc-${c})"/>` : `<circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.2"/>`)
  + `</svg>`;

/// Applies a change and answers with the properties as written, or void when the change failed.
export type ApplyChange = (c: PropChange) => Promise<NoteProps | void> | NoteProps | void;

let openMenu: { el: HTMLElement; off: () => void } | null = null;
export function closePropsMenu(): void { openMenu?.off(); openMenu = null; }

/// The properties menu: pin, the eight colours, and tags, anchored under `anchor`.
export function openPropsMenu(anchor: HTMLElement, props: NoteProps, apply: ApplyChange): void {
  closePropsMenu();
  const menu = document.createElement('div');
  menu.className = 'fe-pmenu';
  menu.setAttribute('role', 'menu');
  const host = document.getElementById('fe') ?? document.body;
  host.appendChild(menu);
  let cur = props;

  const render = () => {
    menu.innerHTML = `
      <button class="fe-pbn fe-pm-pin${cur.pinned ? ' active' : ''}" data-pm="pin" role="menuitem">${UI_ICON.pin}<span>${cur.pinned ? 'unpin' : 'pin to top'}</span></button>
      <div class="fe-pm-lbl">Colour</div>
      <div class="fe-pm-colors">
        <button class="fe-pbn${cur.color === null ? ' active' : ''}" data-pm="color" data-color="" role="menuitem">${colorDot(null)}<span>none</span></button>
        ${NOTE_COLORS.map(c => `<button class="fe-pbn${cur.color === c ? ' active' : ''}" data-pm="color" data-color="${c}" role="menuitem">${colorDot(c)}<span>${c}</span></button>`).join('')}
      </div>
      <div class="fe-pm-lbl">tags</div>
      <div class="fe-pm-tags">
        ${cur.tags.map(t => `<span class="fe-chip">${UI_ICON.tag}<span>${esc(t)}</span><button class="fe-chip-x" data-pm="untag" data-tag="${esc(t)}" title="Remove tag ${esc(t)}" aria-label="Remove tag ${esc(t)}">${UI_ICON.close}</button></span>`).join('')}
      </div>
      <form class="fe-pm-add"><input type="text" placeholder="new tag" autocomplete="off" spellcheck="false" maxlength="32"><button class="fe-pbn" type="submit">${UI_ICON.add}<span>add</span></button></form>`;
  };
  const run = async (c: PropChange) => {
    const r = await apply(c);
    if (r) cur = r;
    render();
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
    // a comma would split the tag in the file, so it cannot be part of one
    const t = inp.value.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    // the same limits the Pi and the phone keep: a "pin" tag would turn the note into a pin and
    // hide it from every Notes list, and the phone refuses more than 12 tags of 32 characters
    const why = t.toLowerCase() === 'pin' ? '"pin" is kept for pins; pin the note instead'
      : t.length > 32 ? 'A tag is at most 32 characters'
      : cur.tags.length >= 12 && !cur.tags.includes(t) ? 'A note keeps at most 12 tags' : '';
    inp.setCustomValidity(why);
    if (why) { inp.reportValidity(); return; }
    if (t && !cur.tags.includes(t)) void run({ tags: [...cur.tags, t] });
    else inp.value = '';
  });
  render();

  const r = anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8))}px`;
  menu.style.top = `${Math.min(r.bottom + 4, window.innerHeight - menu.offsetHeight - 8)}px`;
  const onDown = (e: MouseEvent) => { if (!menu.contains(e.target as Node) && !anchor.contains(e.target as Node)) closePropsMenu(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closePropsMenu(); } };
  document.addEventListener('mousedown', onDown, true);
  document.addEventListener('keydown', onKey, true);
  openMenu = { el: menu, off: () => {
    document.removeEventListener('mousedown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    menu.remove();
  } };
  menu.querySelector<HTMLInputElement>('.fe-pm-add input')!.focus();
}

/// The chip row above the editor text: title, pin, colour and tags. Returns a redraw.
export function mountMetaBar(host: HTMLElement, o: {
  props: () => NoteProps;
  titleEditable: () => boolean;
  setTitle: (v: string) => void;
  apply: ApplyChange;
}): () => void {
  const draw = () => {
    const p = o.props();
    host.innerHTML = `
      ${o.titleEditable()
        ? `<button id="fe-meta-title" class="fe-chip-title" data-title="${esc(p.title)}" title="${esc(p.title)}&#10;Click to edit the whole title" aria-label="Note title: ${esc(p.title)}. Click to edit.">${UI_ICON.rename}${midHtml(p.title)}</button>`
        : `<span class="fe-chip fe-chip-static" title="This note has no properties block yet; its title is its first line">${UI_ICON.notes}<span>${esc(p.title)}</span></span>`}
      <button class="fe-pbn fe-chip-btn${p.pinned ? ' active' : ''}" data-m="pin" title="${p.pinned ? 'Unpin this note' : 'Pin this note to the top of the list'}">${UI_ICON.pin}<span>${p.pinned ? 'Pinned' : 'Pin'}</span></button>
      <button class="fe-pbn fe-chip-btn${p.color ? ' active' : ''}" data-m="color" title="Set this note's colour">${colorDot(p.color)}<span>${p.color ? p.color[0].toUpperCase() + p.color.slice(1) : 'Colour'}</span></button>
      ${p.tags.map(t => `<span class="fe-chip">${UI_ICON.tag}<span>${esc(t)}</span><button class="fe-chip-x" data-m="untag" data-tag="${esc(t)}" title="Remove tag ${esc(t)}" aria-label="Remove tag ${esc(t)}">${UI_ICON.close}</button></span>`).join('')}
      <button class="fe-pbn fe-chip-btn" data-m="tag" title="Add a tag">${UI_ICON.add}<span>Tag</span></button>`;
    // The title shows on one line, middle-truncated; a click opens a box holding the whole title.
    const btn = host.querySelector<HTMLButtonElement>('#fe-meta-title');
    btn?.addEventListener('click', () => {
      const box = document.createElement('textarea');
      box.id = 'fe-meta-title-edit';
      box.className = 'fe-chip-title';
      box.value = p.title; box.rows = 1; box.maxLength = 200; box.spellcheck = true;
      box.setAttribute('aria-label', 'Note title');
      btn.replaceWith(box);
      const fit = () => { box.style.height = 'auto'; box.style.height = box.scrollHeight + 2 + 'px'; };
      fit(); box.focus(); box.select();
      let done = false;
      const finish = (save: boolean) => {
        if (done) return; done = true;
        const v = box.value.replace(/\s*\n\s*/g, ' ').trim();
        if (save && v && v !== p.title) o.setTitle(v); else draw();
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
