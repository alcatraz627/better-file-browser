// A yes or no question in the app's own style, for the few actions that need one.
// Esc, a click away and the Cancel button all answer no.
import { esc } from './utils';
import { openLayer } from './layer';

export function askYesNo(message: string, yes: string, no = 'Cancel'): Promise<boolean> {
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'fe-dlg fe-yesno';
    root.innerHTML = `<div class="fe-dlg-bg scrim"></div>
      <div class="panel fe-yesno-box" role="alertdialog" aria-label="${esc(message)}" tabindex="-1">
        <p>${esc(message)}</p>
        <div class="fe-yesno-acts">
          <button type="button" class="btn" data-a="no">${esc(no)}</button>
          <button type="button" class="btn" data-variant="solid" data-tone="danger" data-a="yes">${esc(yes)}</button>
        </div>
      </div>`;
    (document.getElementById('fe') ?? document.body).append(root);
    let answer = false;
    const layer = openLayer(root, {
      kind: 'dialog', place: 'none', backdrop: root.querySelector<HTMLElement>('.fe-dlg-bg'),
      focus: root.querySelector<HTMLElement>('[data-a="no"]')!,
      onClose: () => { root.remove(); resolve(answer); },
    });
    root.addEventListener('click', e => {
      const a = (e.target as Element).closest<HTMLElement>('[data-a]')?.dataset.a;
      if (!a) return;
      answer = a === 'yes';
      layer.close('pick');
    });
  });
}
