// A doc view turns a known kind of document into a page made for its job,
// instead of a plain listing or plain markdown: a decision page is answered,
// a directions doc is read as a plan. Each kind registers here and draws
// with the shared kit (docview-media, -status, -clamp, -outline), so a new
// kind reuses the same pictures, meters, folding prose and item rail.
//
// A folder view replaces a folder's listing (it may decline after reading
// the folder); a file view decorates a rendered markdown file in place.

export interface DocViewCtx {
  /** The element the view draws into or decorates. */
  root: HTMLElement;
  /** The folder's file:// URL, ending in '/', for resolving relative pictures. */
  base: string;
  /** The decoded path of the folder or file. */
  path: string;
  toast: (message: string) => void;
}

export interface DocView<C extends DocViewCtx = DocViewCtx> {
  id: string;
  on: 'folder' | 'file';
  /** Whether the view wants this path: a file view sees the file path, a folder view the folder path and its entry names. */
  claims: (path: string, names: string[]) => boolean;
  /** Draw the view; false when, having looked, it is not one after all. */
  mount: (ctx: C) => boolean | Promise<boolean>;
}

const views: DocView<any>[] = [];

export function registerDocView<C extends DocViewCtx>(v: DocView<C>): void {
  if (!views.some(x => x.id === v.id)) views.push(v);
}

/** The registered views of one kind that want this path, in registration order. */
export function docViewsFor(on: DocView['on'], path: string, names: string[] = []): DocView<any>[] {
  return views.filter(v => v.on === on && v.claims(path, names));
}

/** Mark an element as drawn by a doc view, so page-wide handlers (a markdown picture opening in a tab) leave it to the view. */
export function markDocView(root: HTMLElement, id: string): void {
  root.dataset.docview = id;
}
