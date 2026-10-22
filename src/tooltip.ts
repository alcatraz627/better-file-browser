// The explorer's tooltip: a styled label that appears shortly after the pointer
// rests on anything with a title, in place of Chrome's slow native one. The
// title stays in the markup; it is lifted off only while the tooltip shows, so
// the native tooltip does not appear on top of it.
import { raise } from './layer';
import { esc } from './utils';

const DELAY = 350;

/// How a control's tooltip reads: a title, a lighter line under it, and the
/// keys that do the same thing. A key already written into the text, as in
/// "Settings (press ,)", moves out of the text into the keys row.
export function tipParts(text: string, keys: string[] = []): { title: string; sub: string; keys: string[] } {
  let t = text;
  for (const k of keys) {
    const q = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`\\s*\\((?:press\\s+)?${q}\\)`, 'g'), '');
  }
  const nl = t.indexOf('\n');
  if (nl >= 0) return { title: t.slice(0, nl).trim(), sub: t.slice(nl + 1).trim(), keys };
  const dot = t.indexOf(' · ');
  if (dot >= 0) return { title: t.slice(0, dot).trim(), sub: t.slice(dot + 3).trim(), keys };
  // "Settings, theme, views": a short name, then what it covers.
  const comma = t.indexOf(', ');
  if (comma > 0 && t.slice(0, comma).split(' ').length <= 3) return { title: t.slice(0, comma).trim(), sub: t.slice(comma + 2).trim(), keys };
  return { title: t.trim(), sub: '', keys };
}

// The keys for a control, given by whoever knows the key map.
let keysFor: (el: HTMLElement) => string[] = () => [];
export function setTooltipKeys(fn: (el: HTMLElement) => string[]): void { keysFor = fn; }

export function initTooltips(root: HTMLElement): void {
  const tip = document.createElement('div');
  tip.id = 'fe-hint';
  tip.setAttribute('role', 'tooltip');
  root.appendChild(tip);
  let target: HTMLElement | null = null;
  let lifted = '';
  let labelled = false;   // we gave the target an aria-label while its title is lifted
  let timer = 0;

  function hide(): void {
    clearTimeout(timer);
    tip.classList.remove('on');
    if (target && lifted && !target.hasAttribute('title')) target.setAttribute('title', lifted);
    if (target && labelled) target.removeAttribute('aria-label');
    target = null; lifted = ''; labelled = false;
  }
  function place(): void {
    if (!target) return;
    const r = target.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    let top = r.bottom + 6;
    if (top + t.height > innerHeight - 4) top = r.top - t.height - 6;   // no room below: above
    // A tab's tooltip starts at the tab's left edge so it reads as the tab's;
    // anything else centres under its target.
    const anchor = target.closest('.fe-tab') ? r.left : r.left + r.width / 2 - t.width / 2;
    const left = Math.min(Math.max(4, anchor), innerWidth - t.width - 4);
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  root.addEventListener('pointerover', e => {
    const el = (e.target as Element).closest<HTMLElement>('[title]');
    if (!el || el === target || !root.contains(el)) return;
    hide();
    const text = el.getAttribute('title')?.trim();
    if (!text) return;
    // A label that only repeats text already shown in full adds nothing; it
    // shows only when the text is cut off.
    if (text === el.textContent?.trim() && el.scrollWidth <= el.clientWidth) return;
    target = el; lifted = text;
    el.removeAttribute('title');
    // Keep the control's name while the title is off, so a screen reader (and
    // anything else that reads names) still has it during the hover.
    if (!el.hasAttribute('aria-label')) { el.setAttribute('aria-label', text); labelled = true; }
    timer = window.setTimeout(() => {
      if (target !== el) return;
      // A control (a button or a link that draws an icon, or anything with
      // keys) gets the full pattern; content keeps a plain label.
      const keys = keysFor(el);
      const icon = el.matches('button, a, [role="button"]') ? el.querySelector('svg') : null;
      if (keys.length || icon) {
        const p = tipParts(text, keys);
        tip.className = 'rich';
        tip.innerHTML = `<span class="fe-hint-h">${icon ? icon.outerHTML : ''}<b>${esc(p.title)}</b></span>`
          + (p.sub ? `<span class="fe-hint-s">${esc(p.sub)}</span>` : '')
          + (p.keys.length ? `<span class="fe-hint-k">${p.keys.map(k => k.split(' ').map(x => `<kbd>${esc(x)}</kbd>`).join('')).join('<i>or</i>')}</span>` : '');
      } else {
        tip.className = '';
        tip.textContent = text;
      }
      raise(tip);
      tip.classList.add('on');
      place();
    }, DELAY);
  });
  root.addEventListener('pointerout', e => {
    if (target && !target.contains(e.relatedTarget as Node)) hide();
  });
  // Anything that moves or replaces the target ends the tooltip.
  root.addEventListener('pointerdown', hide, true);
  root.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', hide, true);
}
