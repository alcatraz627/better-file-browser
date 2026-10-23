// Coming back to a page (Back, a tab, a link) puts it where it was scrolled.
// The page is often still growing when it opens (rows drawn in windows, a
// diagram, an image), so a scroll set too early is cut short; this keeps
// setting it as the content grows, until it lands or the person scrolls.
// Nothing is saved in the meantime, so a cut-short position never replaces
// the remembered one.

/** Restore `top` on `scroller`, then call `save` with each scroll the person makes.
 *  Returns where the page counts as scrolled to now: the restored spot while it is still being held. */
export function holdScroll(scroller: HTMLElement, top: number, save: (top: number) => void): () => number {
  let holding = top > 0;
  const stop = () => { holding = false; grow.disconnect(); };
  const apply = () => { if (!holding) return; scroller.scrollTop = top; if (Math.abs(scroller.scrollTop - top) < 2) stop(); };
  const grow = new ResizeObserver(apply);
  if (holding) {
    for (const c of scroller.children) grow.observe(c);
    apply();
    for (const ev of ['wheel', 'pointerdown', 'keydown', 'touchstart']) scroller.addEventListener(ev, stop, { once: true, passive: true });
    setTimeout(stop, 3000);
  }
  scroller.addEventListener('scroll', () => { if (!holding) save(scroller.scrollTop); }, { passive: true });
  return () => holding ? top : scroller.scrollTop;
}
