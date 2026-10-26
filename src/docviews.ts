// The doc views bfb ships, and the two places they are shown: a folder view
// in place of a folder's listing, and a file view over a rendered markdown
// file. A new kind of doc registers here.
import type { App } from './app';
import { registerDocView, docViewsFor, markDocView } from './docview';
import { textPref } from './storage';
import { UI_ICON } from './control-icons';
import { errorText } from './errors';
import { decisionPageView } from './dp-page';
import { directionsView } from './directions';

registerDocView(decisionPageView);
registerDocView(directionsView);

/**
 * Show this folder through the first folder view that takes it. Until the
 * views have looked, the listing stays out of sight, so a view never flashes
 * the file list first; a folder no view takes gets its listing back at once.
 * A Files button in the view and a button at the end of the listing's
 * toolbar switch between the two, remembered for this tab.
 */
export async function mountFolderView(app: App): Promise<string | null> {
  const fe = app.fe;
  const box = document.getElementById('fe-dp');
  if (app.fileMode || !box) return null;
  const views = docViewsFor('folder', app.rawPath, app.entryNames);
  if (!views.length) return null;
  fe.classList.add('fe-dp-pending');
  const base = 'file://' + app.rawPath.split('/').map(encodeURIComponent).join('/');
  let shown: string | null = null;
  for (const v of views) {
    // A view that breaks says so, rather than passing for a plain folder; the listing comes back either way.
    try { if (await v.mount({ root: box, base, path: app.rawPath, toast: (m: string) => app.toast(m), app })) { shown = v.id; break; } }
    catch (err) { box.innerHTML = ''; app.toast(`This folder's page could not be drawn. ${errorText(err)}`); }
  }
  fe.classList.remove('fe-dp-pending');
  if (!shown) return null;
  markDocView(box, shown);

  const filesPref = textPref('bfb-dp-files:' + app.rawPath, '', 'tab');
  const back = document.createElement('button');
  back.type = 'button'; back.id = 'fe-dp-back'; back.className = 'btn';
  Object.assign(back.dataset, { variant: 'outline', size: 'sm', tone: 'accent' });
  back.title = 'Show this folder as its page';
  back.innerHTML = UI_ICON.opinion + (shown === 'decision-page' ? 'Decision page' : 'Page');
  document.getElementById('fe-toolbar')?.append(back);
  const show = (page: boolean) => {
    fe.classList.toggle('fe-dp-page', page);
    box.hidden = !page;
    back.hidden = page;
    filesPref.set(page ? '' : '1');
  };
  box.querySelector('[data-docview-files]')?.addEventListener('click', () => show(false));
  back.addEventListener('click', () => show(true));
  show(filesPref.get() !== '1');
  return shown;
}

/** Decorate a rendered markdown file with the file views that take its path. Safe to call again. */
export function decorateFileView(root: HTMLElement, path: string, toast: (m: string) => void): void {
  const base = 'file://' + path.replace(/[^/]*$/, '').split('/').map(encodeURIComponent).join('/');
  // A view that fails leaves the doc as plain markdown.
  for (const v of docViewsFor('file', path)) Promise.resolve().then(() => v.mount({ root, base, path, toast })).catch(() => {});
}
