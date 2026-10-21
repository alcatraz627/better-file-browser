// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../src/renderers';
import { visibleMap, visibleOf, sourceSpan, widen, rangeFor, carrier } from '../src/comment-anchor';
import { completions, commentHtml, agentBrief } from '../src/comments-ui';
import type { DocThread } from '../src/notes';

/** Render `src` as the file page does and select the `nth` occurrence of `words` on it. */
function pick(src: string, words: string, nth = 0) {
  const page = document.createElement('div');
  page.innerHTML = `<div class="fe-md">${renderMarkdown(src)}</div>`;
  document.body.replaceChildren(page);
  const nodes: Text[] = [];
  const w = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) nodes.push(w.currentNode as Text);
  const all = nodes.map(n => n.data).join('');
  let at = -1;
  for (let i = 0; i <= nth; i++) at = all.indexOf(words, at + 1);
  if (at === -1) throw new Error(`"${words}" is not on the page`);
  const place = (k: number): [Text, number] => {
    for (const n of nodes) { if (k <= n.data.length) return [n, k]; k -= n.data.length; }
    return [nodes[nodes.length - 1], nodes[nodes.length - 1].data.length];
  };
  const r = document.createRange();
  r.setStart(...place(at));
  r.setEnd(...place(at + words.length));
  return { page, range: r };
}
const quote = (src: string, words: string, nth = 0) => {
  const { page, range } = pick(src, words, nth);
  const s = sourceSpan(page, src, range);
  return s && { q: src.slice(s.start, s.end), block: s.block, start: s.start };
};

describe('visibleMap', () => {
  it('keeps each visible character pointing at its source character', () => {
    const src = '## Risks of **bold** and [a link](x.md)';
    const m = visibleMap(src);
    expect(m.s).toBe('Risks of bold and a link');
    for (let i = 0; i < m.s.length; i++) if (m.s[i] !== ' ') expect(src[m.o[i]]).toBe(m.s[i]);
  });
  it('reads the same as visibleOf', () => {
    for (const s of ['- [x] done', '> *q* here', 'a `b` c\nd', 'x | y | z']) expect(visibleMap(s).s).toBe(visibleOf(s));
  });
});

describe('sourceSpan', () => {
  const doc = '# Release review\n\nWe agreed to ship on **Friday** after the [smoke run](notes.txt), unless red.\n\nThe lens rail landed.\n';
  it('plain words map to their source', () => expect(quote(doc, 'lens rail')).toEqual({ q: 'lens rail', block: false, start: doc.indexOf('lens rail') }));
  it('a selection across bold and a link carries the markup it covers', () =>
    expect(quote(doc, 'ship on Friday after the smoke run')?.q).toBe('ship on **Friday** after the [smoke run](notes.txt)'));
  it('selecting the bold word alone takes its markers', () => expect(quote(doc, 'Friday')?.q).toBe('**Friday**'));
  it('ending half way into bold closes it', () => expect(quote(doc, 'on Friday')?.q).toBe('on **Friday**'));
  it('starting inside a link takes the whole link', () => expect(quote(doc, 'run, unless')?.q).toBe('[smoke run](notes.txt), unless'));
  it('a heading maps without its hashes', () => expect(quote(doc, 'Release')?.q).toBe('Release'));
  it('a repeated phrase picks the occurrence that was selected', () => {
    const src = 'go now\n\nand then go now again\n';
    expect(quote(src, 'go now', 1)?.start).toBe(src.lastIndexOf('go now'));
    expect(quote(src, 'go now', 0)?.start).toBe(0);
  });
  it('a selection across two paragraphs spans both in the source', () => {
    const src = 'First part here.\n\nSecond part here.\n';
    const { page, range: a } = pick(src, 'part here.');
    const ps = page.querySelectorAll('p');
    const r = document.createRange();
    r.setStart(a.startContainer, a.startOffset);
    r.setEnd(ps[1].firstChild!, 'Second'.length);
    const s = sourceSpan(page, src, r)!;
    expect(src.slice(s.start, s.end)).toBe('part here.\n\nSecond');
  });
  it('a selection starting between blocks, as a drag from the margin does, still maps', () => {
    const src = 'First para.\n\nSecond para here.\n';
    const { page } = pick(src, 'Second');
    const md = page.querySelector('.fe-md')!;
    const gap = [...md.childNodes].find(n => n.nodeType === 3 && n.nextSibling === page.querySelectorAll('p')[1]) as Text | undefined;
    const r = document.createRange();
    if (gap) r.setStart(gap, gap.data.length); else r.setStartBefore(page.querySelectorAll('p')[1]);
    r.setEnd(page.querySelectorAll('p')[1].firstChild!, 'Second para'.length);
    const s = sourceSpan(page, src, r)!;
    expect(s && src.slice(s.start, s.end)).toBe('Second para');
  });
  it('a list item maps without its marker', () => expect(quote('- one item\n- two item\n', 'two')?.q).toBe('two'));
  it('front matter cannot be commented', () => {
    const src = '---\ntitle: Plan\n---\n# H\n\nbody\n';
    const { page } = pick(src, 'body');
    const fm = page.querySelector('.fe-md-fm')!;
    expect(fm).not.toBeNull();
    const r = document.createRange(); r.selectNodeContents(fm);
    expect(sourceSpan(page, src, r)).toBeNull();
  });
  it('an empty selection carries nothing', () => {
    const { page, range } = pick(doc, 'lens');
    range.collapse(true);
    expect(sourceSpan(page, doc, range)).toBeNull();
  });
  it('words the source does not have fall back to the whole block', () => {
    const src = '```js\nconst a = 1;\n```\n';
    const { page, range } = pick(src, 'const a');
    const s = sourceSpan(page, src, range)!;
    expect(s).not.toBeNull();
    expect(src.slice(s.start, s.end)).toContain('const a');
  });
  it('the span found reads back as the same words on the page', () => {
    const { page, range } = pick(doc, 'ship on Friday after');
    const s = sourceSpan(page, doc, range)!;
    const line = doc.slice(0, s.start).split('\n').length;
    expect(rangeFor(page, line, line, visibleOf(doc.slice(s.start, s.end)))?.toString()).toBe('ship on Friday after');
  });
});

describe('widen', () => {
  it('leaves snake_case alone', () => {
    const t = 'use snake_case_name here';
    const a = t.indexOf('case');
    expect(t.slice(...widen(t, a, a + 4))).toBe('case');
  });
  it('wraps a fully covered emphasis', () => {
    const t = 'a *word* b';
    expect(t.slice(...widen(t, 3, 7))).toBe('*word*');
  });
});

describe('carrier', () => {
  const before = 'aaa\nbbb target ccc\n';
  it('text typed above shifts an offset by its length', () => {
    const at = carrier(before, 'new line\n' + before);
    expect(at(before.indexOf('target'))).toBe(('new line\n' + before).indexOf('target'));
  });
  it('text typed below leaves it', () => expect(carrier(before, before + 'more\n')(before.indexOf('target'))).toBe(before.indexOf('target')));
  it('an offset inside the edit goes to the edit start', () => {
    const after = before.replace('bbb target', 'bbb TARGET');
    expect(carrier(before, after)(before.indexOf('target') + 2)).toBe(before.indexOf('target'));
  });
});

describe('completions', () => {
  const people = ['user', 'bfb', 'reviewer-2'];
  it('offers people and date words after @', () => expect(completions('hi @b', 5, people, [])?.items).toEqual(['bfb']));
  it('offers due words', () => expect(completions('@to', 3, people, [])?.items).toEqual(['today', 'tomorrow']));
  it('offers known tags after #', () => expect(completions('see #sch', 8, people, ['schedule', 'risk'])).toEqual({ from: 4, sigil: '#', items: ['schedule'] }));
  it('nothing inside a word or an email', () => {
    expect(completions('me@b', 4, people, [])).toBeNull();
    expect(completions('a#s', 3, people, ['schedule'])).toBeNull();
  });
  it('nothing once the word is complete', () => expect(completions('@bfb', 4, people, [])).toBeNull());
});

describe('claude mentions', () => {
  it('offers the generic agent and each live one', () =>
    expect(completions('ask @cl', 7, ['user', 'claude', 'claude:bfb', 'claude:enh-scrape'], [])?.items).toEqual(['claude', 'claude:bfb', 'claude:enh-scrape']));
  it('narrows after the colon', () => expect(completions('@claude:b', 9, ['claude', 'claude:bfb', 'claude:x'], [])?.items).toEqual(['claude:bfb']));
});

describe('commentHtml', () => {
  it('keeps line breaks and draws dash lines as a list', () => {
    expect(commentHtml('- one\n- two\nOh also\nthis')).toBe('<ul><li>one</li><li>two</li></ul><p>Oh also<br>this</p>');
  });
  it('a blank line starts a new paragraph', () => expect(commentHtml('a\n\nb')).toBe('<p>a</p><p>b</p>'));
});

describe('agentBrief', () => {
  const t: DocThread = {
    id: 't-abc', status: 'open', tags: ['schedule'], due: '2026-11-03', created: '',
    anchor: { exact: 'ship on **Friday**', line: 5, offset: 40 }, place: { state: 'anchored', offset: 40, length: 18, line: 5 },
    comments: [{ id: 'c-1', author: { kind: 'human', name: 'Aakarsh' }, created: '2026-10-21T11:18:00Z', text: '@claude is this firm?\nsecond line' }],
  };
  const b = agentBrief('/x/plan.md', 'file:///x/plan.md#c=old', [t]);
  it('names the file, the commands and the thread', () => {
    expect(b).toContain('bfb-docs comments reply /x/plan.md <thread>');
    expect(b).toContain('## Thread t-abc (open, line 5, #schedule, due 2026-11-03)');
    expect(b).toContain('> ship on **Friday**');
    expect(b).toContain('- Aakarsh, 2026-10-21 11:18:\n    @claude is this firm?\n    second line');
    expect(b).toContain('Link: file:///x/plan.md#c=t-abc');
  });
});
