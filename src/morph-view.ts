// Updating a rendered page as its source is typed. Blocks whose source did not
// change stay in the page, so a diagram or picture keeps its height and its drawing,
// and the reader's place holds. Markdown arrives wrapped in one .fe-md, so the blocks
// compared are the ones inside it.
const blocksOf = (root: Element | DocumentFragment): Element | DocumentFragment => {
  let at = root;
  while (at.children.length === 1 && at.children[0].matches('.fe-md')) at = at.children[0];
  return at;
};

// A block's line numbers change whenever a line is added above it, which is not a change to the block.
const sourceKey = (block: Element): string => block.outerHTML.replace(/^(<[^>]*?) data-sl="[^"]*"/, '$1');

/** A function that puts new rendered HTML into the element, replacing only the blocks that changed. */
export function morphInto(view: HTMLElement): (html: string) => void {
  const sourceOf = new WeakMap<Element, string>();
  return html => {
    const next = document.createElement('template');
    next.innerHTML = html;
    const fresh = [...blocksOf(next.content).children];
    if (!view.children.length) {
      const keys = fresh.map(sourceKey);
      view.innerHTML = html;
      [...blocksOf(view).children].forEach((c, i) => sourceOf.set(c, keys[i] ?? ''));
      return;
    }
    const into = blocksOf(view);
    const olds = [...into.children];
    const keys = fresh.map(sourceKey);
    let a = 0;
    while (a < olds.length && a < fresh.length && sourceOf.get(olds[a]) === keys[a]) a++;
    let oe = olds.length, fe = fresh.length;
    while (oe > a && fe > a && sourceOf.get(olds[oe - 1]) === keys[fe - 1]) { oe--; fe--; }
    // A kept block takes its new line numbers, which comments read to place themselves.
    const renumber = (kept: Element, from: Element) => { const sl = from.getAttribute('data-sl'); if (sl !== null) kept.setAttribute('data-sl', sl); };
    for (let i = 0; i < a; i++) renumber(olds[i], fresh[i]);
    for (let i = 0; i < olds.length - oe; i++) renumber(olds[oe + i], fresh[fe + i]);
    const after = olds[oe] ?? null;
    for (let i = a; i < oe; i++) olds[i].remove();
    for (let i = a; i < fe; i++) {
      sourceOf.set(fresh[i], keys[i]);
      into.insertBefore(fresh[i], after);
    }
  };
}
