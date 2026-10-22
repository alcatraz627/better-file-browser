// How big a floating panel opens: md (its own size), lg (85% of the window,
// never smaller than md) or xl (the window less a margin). One button in the panel's title bar
// steps through the three; each panel remembers its own choice
// (docs/system/panel.md).
import { getPanelSize, savePanelSize } from './storage';
import { UI_ICON } from './control-icons';

export type PanelSize = 'md' | 'lg' | 'xl';
const ORDER: PanelSize[] = ['md', 'lg', 'xl'];
const NAME: Record<PanelSize, string> = { md: 'medium', lg: 'large', xl: 'extra large' };

/** The size this panel was last left at. */
export function panelSize(key: string): PanelSize {
  const v = getPanelSize(key);
  return (ORDER as string[]).includes(v) ? v as PanelSize : 'md';
}

/** The size button's markup, for a panel's title bar. */
export const SIZE_BTN = (id: string) => `<button id="${id}" class="btn" data-icon title="Size">${UI_ICON.size}</button>`;

/// Wire a size button to the panel it sizes: the panel carries `data-size`,
/// the button names the current size and the next one. `onChange` runs after
/// each step, for panels that also hold a size of their own.
export function wireSize(btn: HTMLElement, panel: HTMLElement, key: string, onChange?: (s: PanelSize) => void): { set(s: PanelSize): void } {
  const set = (s: PanelSize) => {
    if (s === 'md') delete panel.dataset.size; else panel.dataset.size = s;
    const next = ORDER[(ORDER.indexOf(s) + 1) % ORDER.length];
    btn.title = `Size: ${NAME[s]} · click for ${NAME[next]}`;
    btn.setAttribute('aria-label', btn.title);
    btn.classList.toggle('on', s !== 'md');
    savePanelSize(key, s);
  };
  set(panelSize(key));
  btn.addEventListener('click', () => {
    const s = ORDER[(ORDER.indexOf(panelSize(key)) + 1) % ORDER.length];
    set(s);
    onChange?.(s);
  });
  return { set };
}
