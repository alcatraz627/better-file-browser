// One address for a note or a save, opened on whichever device you are holding.
// A `file://` link points at this Mac's disk, so a phone cannot follow it; the phone
// server shows the same path over HTTP on the tailnet. These pure functions turn one
// into the other, and phone.ts wires them to clicks and to the Copy link actions.

/** The Mac path inside a `file://` link, or null when it is not one. */
export function filePathOf(href: string): string | null {
  const m = /^file:\/\/(\/[^?#]*)(.*)$/i.exec(href.trim());
  if (!m) return null;
  try { return decodeURI(m[1]) + m[2]; } catch { return m[1] + m[2]; }
}

/** A Mac path as a `file://` address. */
export function fileHrefOf(path: string): string {
  const at = path.indexOf('#');
  const base = at < 0 ? path : path.slice(0, at);
  return 'file://' + encodeURI(base).replace(/\?/g, '%3F').replace(/#/g, '%23') + (at < 0 ? '' : path.slice(at));
}

/** The Mac path a phone-server address stands for, or null when the address is on another host. */
export function pathOnPhoneBase(href: string, phoneBase: string): string | null {
  if (!phoneBase || !href.startsWith(phoneBase.replace(/\/$/, '') + '/')) return null;
  try { return decodeURI(href.slice(phoneBase.replace(/\/$/, '').length)); } catch { return null; }
}

export interface Route { to: string | null; say?: string }

/**
 * Where a followed link should really go on this device.
 * - On the phone, a `file://` link opens the same path through the phone server (this origin).
 * - On the Mac, an address on the phone server opens the file locally.
 * Anything else is left alone (`to` null).
 */
export function routeLink(href: string, ctx: { onPhone: boolean; origin: string; phoneBase: string }): Route {
  if (ctx.onPhone) {
    const p = filePathOf(href);
    if (p === null) return { to: null };
    const at = p.indexOf('#');
    return { to: ctx.origin + (at < 0 ? p : p.slice(0, at)).split('/').map(encodeURIComponent).join('/') + (at < 0 ? '' : p.slice(at)) };
  }
  const p = pathOnPhoneBase(href, ctx.phoneBase);
  return p === null ? { to: null } : { to: fileHrefOf(p) };
}

/** The text Copy link puts on the clipboard, and what to tell the person about where it opens. */
export function copyTarget(path: string, ctx: { onPhone: boolean; phoneLink: string }): { text: string; say: string } {
  if (ctx.phoneLink) return { text: ctx.phoneLink, say: ctx.onPhone ? 'Link copied' : 'Link copied. It opens on this Mac and on your phone.' };
  // A path here names a file, so a `#` belongs to its name, unlike the `#` of a followed link.
  return { text: 'file://' + encodeURI(path).replace(/[?#]/g, encodeURIComponent), say: 'Link copied. Phone access is off, so it opens only on this Mac. Turn it on in Settings, Data.' };
}
