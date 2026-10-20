// The explorer's tooltip: a styled label that appears shortly after the pointer
// rests on anything with a title, in place of Chrome's slow native one. The
// title stays in the markup; it is lifted off only while the tooltip shows, so
// the native tooltip does not appear on top of it.

const DELAY = 350;

export function initTooltips(root: HTMLElement): void {
  const tip = document.createElement('div');
  tip.id = 'fe-hint';
  tip.setAttribute('role', 'tooltip');
  root.appendChild(tip);
  let target: HTMLElement | null = null;
  let lifted = '';
  let timer = 0;

  function hide(): void {
    clearTimeout(timer);
    tip.classList.remove('on');
    if (target && lifted && !target.hasAttribute('title')) target.setAttribute('title', lifted);
    target = null; lifted = '';
  }
  function place(): void {
    if (!target) return;
    const r = target.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    let top = r.bottom + 6;
    if (top + t.height > innerHeight - 4) top = r.top - t.height - 6;   // no room below: above
    const left = Math.min(Math.max(4, r.left + r.width / 2 - t.width / 2), innerWidth - t.width - 4);
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  root.addEventListener('pointerover', e => {
    const el = (e.target as Element).closest<HTMLElement>('[title]');
    if (!el || el === target || !root.contains(el)) return;
    hide();
    const text = el.getAttribute('title')?.trim();
    if (!text) return;
    target = el; lifted = text;
    el.removeAttribute('title');
    timer = window.setTimeout(() => {
      if (target !== el) return;
      tip.textContent = text;
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
