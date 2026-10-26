// Long prose in a doc view shows its first few lines with a More button, so
// a page of many items reads as a list of items rather than a wall of text.
// The button appears only when the text is really cut off, and is checked
// again whenever the text's width changes.

/** Prose shown to `lines` lines until More is pressed. */
export const clampHtml = (inner: string, lines = 3): string =>
  `<div class="fe-dv-clamp" style="--lines:${lines}"><div class="fe-dv-clamp-in">${inner}</div><button type="button" class="btn fe-dv-more" data-variant="ghost" data-size="sm" aria-expanded="false" hidden>More</button></div>`;

/** Show each clamp's More button when its text is cut off, and let it open and close the text. */
export function wireClamps(root: HTMLElement): void {
  const check = (c: HTMLElement) => {
    if (c.classList.contains('open')) return;
    const inner = c.querySelector<HTMLElement>('.fe-dv-clamp-in')!;
    if (!inner.clientHeight) return;
    c.querySelector<HTMLElement>('.fe-dv-more')!.hidden = inner.scrollHeight <= inner.clientHeight + 1;
  };
  const ro = new ResizeObserver(entries => entries.forEach(e => check((e.target as HTMLElement).parentElement!)));
  root.querySelectorAll<HTMLElement>('.fe-dv-clamp-in').forEach(i => ro.observe(i));
  root.addEventListener('click', e => {
    const more = (e.target as HTMLElement).closest<HTMLElement>('.fe-dv-more');
    if (!more) return;
    e.stopPropagation();
    const c = more.closest<HTMLElement>('.fe-dv-clamp')!;
    const open = c.classList.toggle('open');
    more.textContent = open ? 'Less' : 'More';
    more.setAttribute('aria-expanded', String(open));
  });
}
