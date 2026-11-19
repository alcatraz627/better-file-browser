// Settings, Browse, Folders with their own view: every folder that keeps its own
// view, with that view as a dropdown that can be changed here. The list can be
// plain or grouped by view, and the tree switch indents a folder kept inside
// another kept folder. Each row can open its folder or let it follow the
// default again.

import { el } from './el';
import { esc, fileHref } from './utils';
import { UI_ICON, VIEW_ICONS } from './control-icons';
import { ddHtml, upgradeControls, type ValuedEl } from './controls';
import { emptyHtml } from './empty-state';
import { homeDir, textPref } from './storage';
import { allFolderViews, dropFolderView, folderTree, keepFolderView, folderKey } from './folder-views';
import type { App } from './app';

type Toast = (msg: string, ms?: number, action?: { label: string; run: () => void }) => void;

const VIEW_OPTS = VIEW_ICONS.map(v => ({ value: v.id, label: v.label, icon: v.ico }));
const VIEW_NAME = Object.fromEntries(VIEW_ICONS.map(v => [v.id, v.label])) as Record<string, string>;
const shapePref = textPref('bfb-fv-shape', 'list');
const treePref = textPref('bfb-fv-tree', 'on');

export function initFolderViewSettings(app: App, toast: Toast): () => void {
  const list = el('fe-st-fv-list');
  const shape = el<ValuedEl>('fe-st-fv-shape');
  const tree = el<HTMLInputElement>('fe-st-fv-tree');
  const home = homeDir(decodeURIComponent(location.pathname));
  const short = (p: string) => (home && (p === home || p.startsWith(home + '/')) ? '~' + p.slice(home.length) : p);

  function rowHtml(path: string, view: string, depth: number, tail: string, inTree: boolean): string {
    const here = !app.fileMode && folderKey(app.folderPath) === path;
    const label = inTree && depth ? tail : short(path);
    return `<div class="fe-fv-row${here ? ' here' : ''}" data-path="${esc(path)}" style="--depth:${inTree ? depth : 0}">
      <a class="fe-fv-path" href="${esc(fileHref(path === '/' ? '/' : path + '/'))}" title="${esc(short(path))}">${UI_ICON.folderOpen}<span>${esc(label)}</span>${here ? '<em>this folder</em>' : ''}</a>
      ${ddHtml('', VIEW_OPTS, `View for ${short(path)}`, 'lg').replace(' id=""', '').replace('class="fe-dd', 'class="fe-fv-view fe-dd')}
      <button type="button" class="btn fe-ibtn fe-fv-drop" data-icon data-size="sm" title="Follow the default view" aria-label="Follow the default view for ${esc(short(path))}">${UI_ICON.close}</button>
    </div>`;
  }

  function render(): void {
    const all = allFolderViews();
    const paths = Object.keys(all);
    shape.value = shapePref.get();
    tree.checked = treePref.get() === 'on';
    if (!paths.length) {
      list.innerHTML = emptyHtml('empty', 'No folder keeps its own view', { inline: true, hint: 'Every folder opens with the defaults above' });
      return;
    }
    const inTree = tree.checked;
    const laid = inTree ? folderTree(paths) : [...paths].sort((a, b) => a.localeCompare(b)).map(p => ({ path: p, depth: 0, tail: p }));
    const viewOf = (p: string) => all[p].view ?? 'details';
    if (shape.value === 'view') {
      // Grouped by view: one heading per view in the order the toolbar shows them.
      list.innerHTML = VIEW_ICONS.map(v => {
        const rows = laid.filter(r => viewOf(r.path) === v.id);
        return rows.length ? `<div class="fe-fv-group"><h4>${v.ico}${esc(v.label)}<span>${rows.length}</span></h4>${rows.map(r => rowHtml(r.path, v.id, r.depth, r.tail, inTree)).join('')}</div>` : '';
      }).join('');
    } else {
      list.innerHTML = laid.map(r => rowHtml(r.path, viewOf(r.path), r.depth, r.tail, inTree)).join('');
    }
    upgradeControls(list);
    list.querySelectorAll<HTMLElement>('.fe-fv-row').forEach(row => {
      (row.querySelector('.fe-fv-view') as ValuedEl).value = viewOf(row.dataset.path!);
    });
  }

  list.addEventListener('change', e => {
    const dd = (e.target as HTMLElement).closest<HTMLElement>('.fe-fv-view');
    const row = dd?.closest<HTMLElement>('.fe-fv-row');
    if (!dd || !row) return;
    const v = (dd as ValuedEl).value;
    keepFolderView(row.dataset.path!, { view: v });
    // The folder on screen follows at once.
    if (row.classList.contains('here')) app.setView(v);
    toast(`${short(row.dataset.path!)} opens in ${VIEW_NAME[v] ?? v}`);
    if (shape.value === 'view') render();
  });
  list.addEventListener('click', e => {
    const drop = (e.target as HTMLElement).closest('.fe-fv-drop');
    const row = drop?.closest<HTMLElement>('.fe-fv-row');
    if (!row) return;
    const path = row.dataset.path!;
    const kept = allFolderViews()[path];
    dropFolderView(path);
    render();
    toast(`${short(path)} follows the default view`, 8000, { label: 'Undo', run: () => { keepFolderView(path, kept); render(); } });
  });
  shape.addEventListener('change', () => { shapePref.set(shape.value); render(); });
  tree.addEventListener('change', () => { treePref.set(tree.checked ? 'on' : 'off'); render(); });

  return render;
}
