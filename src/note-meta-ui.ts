// The note properties UI both the editor and the sidebar use: colour dots, the chip row
// above the editor, and the small menu that sets colour, pin and tags.
import { NOTE_COLORS, nextRing, reminderState, type NoteColor, type NoteProps, type PropChange } from './notes';
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

const pad = (n: number) => String(n).padStart(2, '0');
/** An ISO time as the value a datetime-local box wants, in the person's own clock. */
const localValue = (iso: string): string => { const d = new Date(iso); return isFinite(+d) ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` : ''; };
/** A time as a short phrase: "Nov 2, 9:00 AM". */
export const whenShort = (iso: string): string => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const plain = (u: string): string => u.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** The words on a reminder chip: when it rings, that it was missed, or that another device rings it. */
export function reminderLabel(p: NoteProps, now = Date.now()): string {
  const st = reminderState(p, now);
  if (st === 'none') return 'Remind';
  return `${st === 'missed' ? 'Missed ' : ''}${whenShort(p.remindAt!)}${p.remindRepeat ? ` · ${p.remindRepeat}` : ''}${p.remindOn === 'phone' ? ' · on phone' : ''}`;
}

/// The reminder box: when, how often, which device rings it, and whether it keeps ringing. Clear removes it; Dismiss
/// clears a one-off and moves a repeating one to its next time.
export function openReminderMenu(anchor: HTMLElement, props: NoteProps, apply: ApplyChange): void {
  closePropsMenu();
  const menu = document.createElement('div');
  menu.className = 'fe-pmenu fe-rem';
  const st = reminderState(props);
  const seed = props.remindAt ? localValue(props.remindAt) : localValue(new Date(Date.now() + 3600_000).toISOString());
  menu.innerHTML = `
    <form class="fe-rem-form">
      <label class="fe-pm-lbl" for="fe-rem-at">Remind me${st === 'missed' ? ' (missed)' : ''}</label>
      <input id="fe-rem-at" class="tb" data-size="sm" type="datetime-local" value="${seed}" required>
      <label class="fe-pm-lbl" for="fe-rem-repeat">Repeats</label>
      <select id="fe-rem-repeat" class="tb" data-size="sm">${[['', 'Does not repeat'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([v, t]) => `<option value="${v}"${(props.remindRepeat ?? '') === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <label class="fe-pm-lbl" for="fe-rem-on">Rings on</label>
      <select id="fe-rem-on" class="tb" data-size="sm"><option value="mac"${props.remindOn !== 'phone' ? ' selected' : ''}>This Mac</option><option value="phone"${props.remindOn === 'phone' ? ' selected' : ''}>The phone</option></select>
      <label class="fe-rem-keep"><input id="fe-rem-persist" type="checkbox"${props.remindPersist ? ' checked' : ''}><span>Keep ringing until dismissed</span></label>
      <label class="fe-rem-keep"><input id="fe-rem-expire" type="checkbox"><span>Also expire the note then</span></label>
      <div class="fe-rem-acts">
        <button class="btn" data-size="sm" data-variant="primary" type="submit">${UI_ICON.clock}<span>${props.remindAt ? 'Update' : 'Set reminder'}</span></button>
        ${props.remindAt ? `<button class="btn" data-size="sm" type="button" data-rem="dismiss" title="${props.remindRepeat ? 'Move to the next time' : 'Done: clear it'}">Dismiss</button><button class="btn" data-size="sm" data-tone="danger" type="button" data-rem="clear">Clear</button>` : ''}
      </div>
    </form>`;
  const done = async (c: PropChange) => { await apply(c); closePropsMenu(); };
  menu.addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rem]');
    if (!b) return;
    e.preventDefault();
    if (b.dataset.rem === 'clear') void done({ remind: null });
    else if (props.remindAt && props.remindRepeat) void done({ remind: { at: nextRing(props.remindAt, props.remindRepeat), repeat: props.remindRepeat, on: props.remindOn, persist: props.remindPersist } });
    else void done({ remind: null });
  });
  menu.addEventListener('submit', e => {
    e.preventDefault();
    const at = new Date((menu.querySelector('#fe-rem-at') as HTMLInputElement).value);
    if (!isFinite(+at)) return;
    const repeat = (menu.querySelector('#fe-rem-repeat') as HTMLSelectElement).value as 'daily' | 'weekly' | 'monthly' | '';
    const iso = at.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const alsoExpire = (menu.querySelector('#fe-rem-expire') as HTMLInputElement).checked;
    void done({ remind: { at: iso, ...(repeat ? { repeat } : {}), on: (menu.querySelector('#fe-rem-on') as HTMLSelectElement).value as 'mac' | 'phone', persist: (menu.querySelector('#fe-rem-persist') as HTMLInputElement).checked }, ...(alsoExpire ? { expires: iso } : {}) });
  });
  openMenu = openLayer(menu, { kind: 'popover', anchor, role: 'dialog', group: 'menu', focus: menu.querySelector<HTMLElement>('#fe-rem-at')! });
}

/// The expiry box: pick a time (or a preset), or remove it. A passed expiry only moves the note under Expired;
/// the note is never deleted.
export function openExpiryMenu(anchor: HTMLElement, props: NoteProps, apply: ApplyChange): void {
  closePropsMenu();
  const menu = document.createElement('div');
  menu.className = 'fe-pmenu fe-rem fe-exp';
  const seed = props.expires ? localValue(props.expires) : localValue(new Date(Date.now() + 7 * 86400_000).toISOString());
  const presets: [string, number][] = [['Tomorrow', 1], ['In a week', 7], ['In a month', 30]];
  menu.innerHTML = `
    <form class="fe-rem-form">
      <label class="fe-pm-lbl" for="fe-exp-at">Expire this note at</label>
      <div class="fe-exp-presets">${presets.map(([t, d]) => `<button class="btn" data-size="sm" type="button" data-exp-days="${d}">${t}</button>`).join('')}</div>
      <input id="fe-exp-at" class="tb" data-size="sm" type="datetime-local" value="${seed}" required>
      <div class="fe-rem-acts">
        <button class="btn" data-size="sm" data-variant="primary" type="submit">${UI_ICON.clock}<span>${props.expires ? 'Update' : 'Set expiry'}</span></button>
        ${props.expires ? `<button class="btn" data-size="sm" data-tone="danger" type="button" data-exp="clear">No expiry</button>` : ''}
      </div>
    </form>`;
  const done = async (c: PropChange) => { await apply(c); closePropsMenu(); };
  menu.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const preset = t.closest<HTMLElement>('[data-exp-days]');
    if (preset) {
      e.preventDefault();
      const d = new Date(Date.now() + Number(preset.dataset.expDays) * 86400_000);
      (menu.querySelector('#fe-exp-at') as HTMLInputElement).value = localValue(d.toISOString());
      return;
    }
    if (t.closest('[data-exp="clear"]')) { e.preventDefault(); void done({ expires: null }); }
  });
  menu.addEventListener('submit', e => {
    e.preventDefault();
    const at = new Date((menu.querySelector('#fe-exp-at') as HTMLInputElement).value);
    if (!isFinite(+at)) return;
    void done({ expires: at.toISOString().replace(/\.\d{3}Z$/, 'Z') });
  });
  openMenu = openLayer(menu, { kind: 'popover', anchor, role: 'dialog', group: 'menu', focus: menu.querySelector<HTMLElement>('#fe-exp-at')! });
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
      <button class="btn fe-chip-btn" data-size="sm" data-m="tag" title="Add a tag">${UI_ICON.add}<span>Tag</span></button>
      <button class="btn fe-chip-btn fe-chip-rem${p.remindAt ? ' active' : ''}${reminderState(p) === 'missed' ? ' missed' : ''}" data-size="sm" data-m="remind" title="${p.remindAt ? 'Change or clear this reminder' : 'Set a reminder'}">${UI_ICON.clock}<span>${esc(reminderLabel(p))}</span></button>
      ${p.agent ? `<span class="chip fe-chip-agent" title="Last edited by an agent">${UI_ICON.ai}<span>${esc(p.agent)}</span></span>` : ''}
      <button class="btn fe-chip-btn fe-chip-exp${p.expires ? ' active' : ''}${p.expires && Date.parse(p.expires) <= Date.now() ? ' expired' : ''}" data-size="sm" data-m="expires" title="${p.expires ? 'After this time the note is listed under Expired. It is never deleted. Click to change.' : 'Set a time after which the note is listed under Expired'}">${UI_ICON.clock}<span>${p.expires ? `${Date.parse(p.expires) <= Date.now() ? 'Expired' : 'Expires'} ${esc(whenShort(p.expires))}` : 'Expiry'}</span></button>
      ${p.expires ? `<button class="btn" data-icon data-size="xs" data-tone="danger" data-m="expires-clear" title="Remove the expiry" aria-label="Remove the expiry">${UI_ICON.close}</button>` : ''}
      ${p.url ? `<span class="chip fe-chip-url" title="${esc(p.url)}">${UI_ICON.link}<span class="fe-chip-url-t">${esc(plain(p.url))}</span><button class="btn" data-icon data-size="xs" data-m="url-open" title="Open ${esc(p.url)}" aria-label="Open the link">${UI_ICON.tab}</button><button class="btn" data-icon data-size="xs" data-m="url-copy" title="Copy the link" aria-label="Copy the link">${UI_ICON.copy ?? UI_ICON.link}</button></span>` : ''}`;
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
    else if (b.dataset.m === 'remind') openReminderMenu(b, p, async c => { const r = await o.apply(c); draw(); return r; });
    else if (b.dataset.m === 'expires') openExpiryMenu(b, p, async c => { const r = await o.apply(c); draw(); return r; });
    else if (b.dataset.m === 'expires-clear') { await o.apply({ expires: null }); draw(); }
    else if (b.dataset.m === 'url-open') window.open(p.url!, '_blank', 'noopener');
    else if (b.dataset.m === 'url-copy') { void navigator.clipboard?.writeText(p.url!).catch(() => undefined); b.title = 'Copied'; }
    else if (b.dataset.m === 'untag') { await o.apply({ tags: p.tags.filter(t => t !== b.dataset.tag) }); draw(); }
    else {
      openPropsMenu(b, p, async c => { const r = await o.apply(c); draw(); return r; });
    }
  });
  draw();
  return draw;
}
