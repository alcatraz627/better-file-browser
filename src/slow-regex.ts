/**
 * Says whether a typed pattern has one of the shapes that can hang the page.
 *
 * A pattern like `^(a+)+$` can take minutes on a thirty letter name, and
 * nothing can stop it once it runs. Two shapes are caught: a repeat inside a
 * repeated group, and a repeated group whose choices start alike or can be empty.
 */
type Group = { rep: boolean; firsts: string[]; atStart: boolean; overlap: boolean };

const seen = new Map<string, boolean>();

export function slowRegex(pattern: string): boolean {
  let known = seen.get(pattern);
  if (known === undefined) {
    known = scan(pattern);
    if (seen.size > 500) seen.clear();
    seen.set(pattern, known);
  }
  return known;
}

export const SLOW_REGEX_WHY = 'This pattern can freeze the page: a repeat inside a repeat';

function scan(p: string): boolean {
  const stack: Group[] = [{ rep: false, firsts: [], atStart: true, overlap: false }];
  // The group that just closed, while the next character can still repeat it.
  let closed: Group | null = null;
  const top = () => stack[stack.length - 1];
  const atom = (token: string) => {
    const g = top();
    if (g.atStart) { if (g.firsts.includes(token)) g.overlap = true; g.firsts.push(token); g.atStart = false; }
    closed = null;
  };
  let i = 0;
  while (i < p.length) {
    const c = p[i];
    if (c === '\\') { atom(p.slice(i, i + 2)); i += 2; continue; }
    if (c === '[') {
      let j = i + 1;
      while (j < p.length && p[j] !== ']') j += p[j] === '\\' ? 2 : 1;
      atom(p.slice(i, j + 1)); i = j + 1; continue;
    }
    if (c === '(') {
      atom('(' + i);
      stack.push({ rep: false, firsts: [], atStart: true, overlap: false });
      i++;
      const lead = /^\?(?::|=|!|<=|<!|<[^>]*>)/.exec(p.slice(i));
      if (lead) i += lead[0].length;
      continue;
    }
    if (c === ')') {
      if (stack.length > 1) {
        const g = stack.pop()!;
        if (g.atStart && g.firsts.length) g.overlap = true;
        if (g.rep) top().rep = true;
        closed = g;
      }
      i++; continue;
    }
    if (c === '|') { const g = top(); if (g.atStart) g.overlap = true; g.atStart = true; closed = null; i++; continue; }
    if (c === '^' || c === '$') { i++; continue; }
    const counted = c === '{' ? /^\{(\d+)(,(\d*))?\}/.exec(p.slice(i)) : null;
    if (c === '*' || c === '+' || counted) {
      const repeats = !counted || (counted[2] ? counted[3] === '' || Number(counted[3]) > 1 : Number(counted[1]) > 1);
      const g: Group | null = closed;
      if (repeats && g && (g.rep || g.overlap)) return true;
      if (repeats) top().rep = true;
      i += counted ? counted[0].length : 1;
      if (p[i] === '?') i++;
      closed = null; continue;
    }
    if (c === '?') { closed = null; i++; continue; }
    atom(c); i++;
  }
  return false;
}
