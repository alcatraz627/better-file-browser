// Find in file: a search field in the file bar that marks every match in the
// rendered page, counts them, and steps through them with Enter and
// Shift+Enter. The marks are redrawn whenever the page re-renders.

const MAX_HITS = 2000;

export interface FindInPage { refresh(): void; clear(): void; focus(): void }

// Never searched: code, the line-number gutters, and anything not drawn.
const SKIP = 'script,style,svg,textarea,.fe-code-gut,.fe-jl-n,.fe-fe-ln,[hidden]';
// A match may run across inline formatting and syntax colours, but not from
// one of these into the next.
const BLOCK = 'p,li,dt,dd,h1,h2,h3,h4,h5,h6,td,th,tr,pre,blockquote,div,section,article,summary,figcaption';

export function attachFind(page: HTMLElement, input: HTMLInputElement, count: HTMLElement, prev: HTMLElement, next: HTMLElement): FindInPage {
  let hits: HTMLElement[][] = [];   // one hit can span several marks
  let cur = -1;

  const unmark = () => {
    for (const m of page.querySelectorAll('mark.fe-ff-hit')) m.replaceWith(document.createTextNode(m.textContent || ''));
    page.normalize();
    hits = []; cur = -1;
  };

  // A capped view (first N rows or characters) only holds part of the file.
  const partial = () => !!page.querySelector('.fe-ql-note');
  const show = () => {
    const q = input.value;
    // The count keeps a fixed width so the box never resizes as it changes; a
    // capped view says so on hover rather than in a longer label.
    const part = !!q && partial();
    count.textContent = !q ? '' : hits.length ? `${cur + 1} of ${hits.length}${hits.length >= MAX_HITS ? '+' : ''}` : 'No match';
    count.title = part ? 'Searched only the part of the file shown here' : '';
    count.classList.toggle('part', part);
    count.classList.toggle('none', !!q && !hits.length);
    prev.toggleAttribute('disabled', hits.length < 2);
    next.toggleAttribute('disabled', hits.length < 2);
    hits.forEach((h, i) => h.forEach(m => m.classList.toggle('on', i === cur)));
  };

  const go = (i: number) => {
    if (!hits.length) return;
    cur = (i + hits.length) % hits.length;
    show();
    hits[cur][0].scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  // Case-insensitive plain-text match over the text a reader sees. The text
  // nodes are joined into one string, with a line break wherever the block
  // changes, so "bo" in bold followed by "ld" still matches "bold".
  const mark = () => {
    unmark();
    const q = input.value.toLowerCase();
    if (!q) { show(); return; }
    const drawn = new Map<Element, boolean>();
    const isDrawn = (el: Element) => {
      let v = drawn.get(el);
      if (v === undefined) { v = el.getClientRects().length > 0; drawn.set(el, v); }
      return v;
    };
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, {
      acceptNode: n => {
        const p = n.parentElement;
        return !p || p.closest(SKIP) || !isDrawn(p) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes: Text[] = [], starts: number[] = [];
    let joined = '', lastBlock: Element | null = null;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const block = node.parentElement!.closest(BLOCK);
      if (nodes.length && block !== lastBlock) joined += '\n';
      lastBlock = block;
      nodes.push(node); starts.push(joined.length);
      joined += node.data;
    }
    const lower = joined.toLowerCase();
    // Each match becomes pieces, one per text node it touches.
    const pieces: { node: number; s: number; e: number; hit: number }[] = [];
    let n = 0, found = 0;
    for (let at = lower.indexOf(q); at !== -1 && found < MAX_HITS; at = lower.indexOf(q, at + q.length), found++) {
      const end = at + q.length;
      while (starts[n] + nodes[n].data.length <= at) n++;
      for (let k = n; k < nodes.length && starts[k] < end; k++) {
        const s = Math.max(at, starts[k]) - starts[k], e = Math.min(end, starts[k] + nodes[k].data.length) - starts[k];
        if (e > s) pieces.push({ node: k, s, e, hit: found });
      }
    }
    hits = Array.from({ length: found }, () => []);
    // Wrap from the last piece back, so earlier offsets in a node stay valid.
    for (let i = pieces.length - 1; i >= 0; i--) {
      const { node, s, e, hit } = pieces[i];
      const t = nodes[node];
      t.splitText(e);
      const mid = t.splitText(s);
      const m = document.createElement('mark');
      m.className = 'fe-ff-hit';
      mid.replaceWith(m); m.append(mid);
      hits[hit].unshift(m);
    }
    // Start at the first match below the top of what is on screen.
    const top = page.getBoundingClientRect().top;
    const first = hits.findIndex(h => h[0].getBoundingClientRect().top >= top);
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
