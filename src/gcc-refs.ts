// References between the files of ~/.claude (a skill, a rule, a feature, a
// convention, a persona) become links, and hovering one shows a card saying
// what it is, read from that file's own front matter. Only pages under
// ~/.claude look for them, and a name that matches nothing stays plain text.
import { fetchFileText, fileExists } from './file-fetch';
import { parseListing } from './parse';
import { frontMatterRows } from './renderers';
import { hoverCard } from './layer';
import { esc } from './utils';

export type RefKind = 'skill' | 'rule' | 'feature' | 'convention' | 'persona';
export interface GccRef { kind: RefKind; rel: string }
const DIRS: Record<string, RefKind> = { skills: 'skill', rules: 'rule', features: 'feature', conventions: 'convention', personas: 'persona' };

/** What an inline-code token names inside ~/.claude, before the disk is asked.
 *  `rules/shell.md`, `rules/shell` and `~/.claude/rules/shell.md` name a rule;
 *  `skills/probe` names a skill's SKILL.md; `/probe` names a skill only when a
 *  skill by that name exists, so a stray path such as `/tmp` is left alone. */
export function refOf(token: string, skills: Set<string>): GccRef | null {
  const t = token.trim().replace(/^~\/\.claude\//, '');
  const slash = /^\/([a-z][\w-]*)$/.exec(t);
  if (slash) return skills.has(slash[1]) ? { kind: 'skill', rel: `skills/${slash[1]}/SKILL.md` } : null;
  const m = /^(skills|rules|features|conventions|personas)\/([\w.-]+(?:\/[\w.-]+)*)\/?$/.exec(t);
  if (!m) return null;
  if (m[1] === 'skills' && !m[2].endsWith('.md')) return { kind: 'skill', rel: `skills/${m[2].split('/')[0]}/SKILL.md` };
  return { kind: DIRS[m[1]], rel: `${m[1]}/${m[2]}${/\.\w+$/.test(m[2]) ? '' : '.md'}` };
}

/** What a card says about a file, from its front matter, or from its first
 *  heading and paragraph when it has none. */
export interface CardFacts { name?: string; about?: string; triggers: string[]; hint?: string; updated?: string }
export function cardFacts(text: string): CardFacts {
  const fm = /^---\n([\s\S]*?)\n---/.exec(text);
  const rows = fm ? frontMatterRows(fm[1].split('\n')) : [];
  const get = (k: string) => rows.find(r => r.key === k);
  const body = fm ? text.slice(fm[0].length) : text;
  const heading = /^#\s+(.+)$/m.exec(body)?.[1];
  const para = body.split(/\n\s*\n/).map(p => p.trim()).find(p => p && !p.startsWith('#') && !p.startsWith('>') && !p.startsWith('|'));
  return {
    name: get('name')?.value || heading,
    about: get('description')?.value || get('brief')?.value || para?.replace(/\s+/g, ' ').slice(0, 280),
    triggers: get('triggers')?.items ?? [],
    hint: get('argument-hint')?.value,
    updated: get('updated')?.value,
  };
}

const claudeRoot = () => /^(\/(?:Users|home)\/[^/]+\/\.claude)\//.exec(decodeURIComponent(location.pathname))?.[1] ?? null;
let skillNames: Promise<Set<string>> | null = null;
const looked = new WeakSet<HTMLElement>();
const facts = new Map<string, Promise<CardFacts | null>>();

/** Turn the references in the page's rendered markdown into links with cards. */
export function linkGccRefs(): void {
  const root = claudeRoot();
  if (!root) return;
  const codes = [...document.querySelectorAll<HTMLElement>('.fe-md code')].filter(c => !looked.has(c) && !c.closest('pre, a'));
  if (!codes.length) return;
  codes.forEach(c => looked.add(c));
  skillNames ??= fetchFileText(`file://${root}/skills/`)
    .then(html => new Set(parseListing(html, `file://${root}/skills/`).filter(e => e.isDir && !e.isParent).map(e => e.name.replace(/\/$/, ''))))
    .catch(() => new Set<string>());
  void skillNames.then(skills => {
    for (const code of codes) {
      const ref = refOf(code.textContent ?? '', skills);
      if (!ref) continue;
      const url = `file://${root}/${ref.rel}`;
      void fileExists(url).then(ok => {
        if (!ok || !code.isConnected) return;
        const a = document.createElement('a');
        a.className = 'fe-ref';
        a.href = url;
        a.dataset.kind = ref.kind;
        code.replaceWith(a);
        a.appendChild(code);
        hoverCard(a, () => card(ref, url), { place: 'below', align: 'start' });
      });
    }
  });
}

// The card draws at once and fills in when the file has been read.
function card(ref: GccRef, url: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'fe-ctx fe-ref-card';
  el.innerHTML = `<div class="fe-ref-head"><span class="badge" data-size="sm">${ref.kind}</span><span class="fe-ref-path">${esc(ref.rel)}</span></div><p class="fe-ref-about">Reading…</p>`;
  if (!facts.has(url)) facts.set(url, fetchFileText(url).then(cardFacts).catch(() => null));
  void facts.get(url)!.then(f => {
    if (!f) { el.querySelector('.fe-ref-about')!.textContent = 'Could not read this file.'; return; }
    el.innerHTML = `<div class="fe-ref-head"><span class="badge" data-size="sm">${ref.kind}</span><span class="fe-ref-name">${esc(f.name ?? ref.rel)}</span></div>`
      + (f.about ? `<p class="fe-ref-about">${esc(f.about)}</p>` : '')
      + (f.hint ? `<p class="fe-ref-hint">${esc(f.hint)}</p>` : '')
      + (f.triggers.length ? `<div class="fe-ref-chips">${f.triggers.slice(0, 8).map(t => `<span class="chip" data-size="sm">${esc(t)}</span>`).join('')}</div>` : '')
      + `<div class="fe-ref-foot">${esc(ref.rel)}${f.updated ? ` · updated ${esc(f.updated)}` : ''}</div>`;
  });
  return el;
}
