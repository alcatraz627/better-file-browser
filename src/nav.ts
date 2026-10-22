// Every way the page leaves for another place: open a folder or file here,
// open one in a new Chrome tab, reload, or note where the reader is in the
// address without reloading. One module owns the address so a file that
// needs a viewer (a download-only type) always gets one.
import { pageHref } from './utils';

/** Where a link opens: in this tab, or in a new Chrome tab. */
export type How = 'here' | 'chrome-tab';

/**
 * Open a folder or file. `hash` is added after the address; `exact` keeps the
 * address as given, for a folder URL that must not be read as a file name.
 */
export function go(href: string, how: How = 'here', o: { hash?: string; exact?: boolean } = {}): void {
  if (how === 'chrome-tab') { window.open(href, '_blank'); return; }
  location.href = (o.exact ? href : pageHref(href)) + (o.hash ?? '');
}

/** Load this page again, for a change only a fresh page can show. */
export function reload(): void {
  location.reload();
}

/** Put a heading's id in the address so the link can be shared, without moving. */
export function markPlace(hash: string): void {
  history.replaceState(null, '', hash);
}
