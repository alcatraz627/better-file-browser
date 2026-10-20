// Find in file: a search field in the file bar that marks every match in the
// rendered page, counts them, and steps through them with Enter and
// Shift+Enter. The marks are redrawn whenever the page re-renders.

const MAX_HITS = 2000;

export interface FindInPage { refresh(): void; clear(): void; focus(): void }

export function attachFind(page: HTMLElement, input: HTMLInputElement, count: HTMLElement, prev: HTMLElement, next: HTMLElement): FindInPage {
  let hits: HTMLElement[] = [];
  let cur = -1;

  const unmark = () => {
    for (const m of page.querySelectorAll('mark.fe-ff-hit')) m.replaceWith(document.createTextNode(m.textContent || ''));
    page.normalize();
    hits = []; cur = -1;
  };

  const show = () => {
    const q = input.value;
    count.textContent = !q ? '' : hits.length ? `${cur + 1} of ${hits.length}${hits.length >= MAX_HITS ? '+' : ''}` : 'No match';
    count.classList.toggle('none', !!q && !hits.length);
    prev.toggleAttribute('disabled', hits.length < 2);
    next.toggleAttribute('disabled', hits.length < 2);
    hits.forEach((h, i) => h.classList.toggle('on', i === cur));
  };

  const go = (i: number) => {
    if (!hits.length) return;
    cur = (i + hits.length) % hits.length;
    show();
    hits[cur].scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  // Case-insensitive plain-text match over the page's visible text nodes.
  const mark = () => {
    unmark();
    const q = input.value.toLowerCase();
    if (!q) { show(); return; }
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement?.closest('script,style,svg,textarea') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      if (hits.length >= MAX_HITS) break;
      const text = node.data;
      const lower = text.toLowerCase();
      let at = lower.indexOf(q);
      if (at === -1) continue;
      const frag = document.createDocumentFragment();
      let from = 0;
      while (at !== -1 && hits.length < MAX_HITS) {
        frag.append(text.slice(from, at));
        const m = document.createElement('mark');
        m.className = 'fe-ff-hit';
        m.textContent = text.slice(at, at + q.length);
        frag.append(m); hits.push(m);
        from = at + q.length;
        at = lower.indexOf(q, from);
      }
      frag.append(text.slice(from));
      node.replaceWith(frag);
    }
    // Start at the first match below the top of what is on screen.
    const top = page.getBoundingClientRect().top;
    const first = hits.findIndex(h => h.getBoundingClientRect().top >= top);
    go(first === -1 ? 0 : first);
    if (!hits.length) show();
  };

  input.addEventListener('input', mark);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); go(cur + (e.shiftKey ? -1 : 1)); }
    else if (e.key === 'Escape') { e.preventDefault(); input.value = ''; mark(); input.blur(); }
    e.stopPropagation();   // page keys must not fire while typing
  });
  prev.addEventListener('click', () => go(cur - 1));
  next.addEventListener('click', () => go(cur + 1));

  return {
    refresh: () => { if (input.value) mark(); },
    clear: () => { input.value = ''; unmark(); show(); },
    focus: () => { input.focus(); input.select(); },
  };
}
