// References between the files of ~/.claude (a skill, a rule, a feature, a
// convention, a persona) become links, and hovering one shows a card saying
// what it is, read from that file's own front matter. Only pages under
// ~/.claude look for them, and a name that matches nothing stays plain text.
import { fetchFileText, fileExists } from './file-fetch';
import { parseListing } from './parse';
import { frontMatterRows } from './renderers';
import { hoverCard } from './layer';
import { esc } from './utils';

export type RefKind = 'skill' | 'rule' | 'feature' | 'convention' | 'persona' | 'script';
export interface GccRef { kind: RefKind; rel: string }
const DIRS: Record<string, RefKind> = { skills: 'skill', rules: 'rule', features: 'feature', conventions: 'convention', personas: 'persona' };
const SCRIPT = /^scripts\/[\w.-]+(?:\/[\w.-]+)*\.(?:sh|bash|zsh|py|ts|mjs|js)$/;

/** What an inline-code token names inside ~/.claude, before the disk is asked.
 *  `rules/shell.md`, `rules/shell` and `~/.claude/rules/shell.md` name a rule;
 *  `skills/probe` names a skill's SKILL.md; `/probe` names a skill only when a
 *  skill by that name exists, so a stray path such as `/tmp` is left alone.
 *  `scripts/wal/wal.sh` names a script when it has a script's extension. */
export function refOf(token: string, skills: Set<string>): GccRef | null {
  const t = token.trim().replace(/^(?:~|\/(?:Users|home)\/[^/]+)\/\.claude\//, '');
  const slash = /^\/([a-z][\w-]*)$/.exec(t);
  if (slash) return skills.has(slash[1]) ? { kind: 'skill', rel: `skills/${slash[1]}/SKILL.md` } : null;
  if (SCRIPT.test(t)) return { kind: 'script', rel: t };
  const m = /^(skills|rules|features|conventions|personas)\/([\w.-]+(?:\/[\w.-]+)*)\/?$/.exec(t);
  if (!m) return null;
  if (m[1] === 'skills' && !m[2].endsWith('.md')) return { kind: 'skill', rel: `skills/${m[2].split('/')[0]}/SKILL.md` };
  return { kind: DIRS[m[1]], rel: `${m[1]}/${m[2]}${/\.\w+$/.test(m[2]) ? '' : '.md'}` };
}

/** Where references sit inside a longer piece of text, such as a hook command
 *  in settings.json ("~/.claude/scripts/emit-event.sh Notification"). Each hit
 *  gives the span to link and what it names. */
export interface RefHit { start: number; end: number; ref: GccRef }
export function refsIn(text: string, skills: Set<string>): RefHit[] {
  const hits: RefHit[] = [];
  const re = /(^|[\s"'=(:])((?:~\/\.claude\/|\/(?:Users|home)\/[^/\s"']+\/\.claude\/)?(?:skills|rules|features|conventions|personas|scripts)\/[\w.\/-]+)/g;
  for (let m; (m = re.exec(text));) {
    const token = m[2].replace(/[.,/]+$/, '');
    const ref = refOf(token, skills);
    const start = m.index + m[1].length;
    if (ref) hits.push({ start, end: start + token.length, ref });
  }
  return hits;
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

/** What a card says about a script: the comment block at its top, after the
 *  shebang, or a Python docstring. */
export function scriptFacts(text: string, rel: string): CardFacts {
  const lines = text.replace(/^#!.*\n/, '').split('\n');
  const doc = /^\s*(?:"""|''')([\s\S]*?)(?:"""|''')/.exec(lines.join('\n'))?.[1];
  const head: string[] = [];
  for (const l of lines) {
    const c = /^\s*(?:#|\/\/)\s?(.*)$/.exec(l);
    if (!c) break;
    if (/^(?:shellcheck|eslint|-\*-)/.test(c[1])) continue;
    head.push(c[1].trim());
  }
  const about = (head.join(' ').trim() || doc?.trim() || '').replace(/\s+/g, ' ').slice(0, 280);
  return { name: rel.split('/').pop(), about: about || undefined, triggers: [] };
}

const claudeRoot =() => /^(\/(?:Users|home)\/[^/]+\/\.claude)\//.exec(decodeURIComponent(location.pathname))?.[1] ?? null;
let skillNames: Promise<Set<string>> | null = null;
const looked = new WeakSet<HTMLElement>();
const facts = new Map<string, Promise<CardFacts | null>>();

const exists = new Map<string, Promise<boolean>>();
const existsOnce = (url: string) => { if (!exists.has(url)) exists.set(url, fileExists(url)); return exists.get(url)!; };

function refLink(ref: GccRef, url: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'fe-ref';
  a.href = url;
  a.dataset.kind = ref.kind;
  hoverCard(a, () => card(ref, url), { place: 'below', align: 'start' });
  return a;
}

/** Turn the references on the page into links with cards: inline code in
 *  rendered markdown, and paths inside the string values of a JSON tree. */
export function linkGccRefs(): void {
  const root = claudeRoot();
  if (!root) return;
  const codes = [...document.querySelectorAll<HTMLElement>('.fe-md code')].filter(c => !looked.has(c) && !c.closest('pre, a'));
  const strs = [...document.querySelectorAll<HTMLElement>('.fe-jt-root .tok-str, .fe-jl-root .tok-str')].filter(s => !looked.has(s));
  if (!codes.length && !strs.length) return;
  [...codes, ...strs].forEach(c => looked.add(c));
  skillNames ??= fetchFileText(`file://${root}/skills/`)
    .then(html => new Set(parseListing(html, `file://${root}/skills/`).filter(e => e.isDir && !e.isParent).map(e => e.name.replace(/\/$/, ''))))
    .catch(() => new Set<string>());
  void skillNames.then(skills => {
    for (const code of codes) {
      const ref = refOf(code.textContent ?? '', skills);
      if (!ref) continue;
      const url = `file://${root}/${ref.rel}`;
      void existsOnce(url).then(ok => {
        if (!ok || !code.isConnected) return;
        const a = refLink(ref, url);
        code.replaceWith(a);
        a.appendChild(code);
      });
    }
    for (const s of strs) void linkInString(s, root, skills);
  });
}

// A JSON string keeps its text; only the spans that name a file that is there become links.
async function linkInString(s: HTMLElement, root: string, skills: Set<string>): Promise<void> {
  const text = s.textContent ?? '';
  const hits = refsIn(text, skills);
  if (!hits.length) return;
  const urls = hits.map(h => `file://${root}/${h.ref.rel}`);
  const ok = await Promise.all(urls.map(existsOnce));
  if (!ok.some(Boolean) || !s.isConnected || s.textContent !== text) return;
  const frag = document.createDocumentFragment();
  let at = 0;
  hits.forEach((h, i) => {
    if (!ok[i]) return;
    frag.append(text.slice(at, h.start));
    const a = refLink(h.ref, urls[i]);
    a.textContent = text.slice(h.start, h.end);
    frag.append(a);
    at = h.end;
  });
  frag.append(text.slice(at));
  s.replaceChildren(frag);
}

// The card draws at once and fills in when the file has been read.
function card(ref: GccRef, url: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'fe-ctx fe-ref-card';
  el.innerHTML = `<div class="fe-ref-head"><span class="badge" data-size="sm">${ref.kind}</span><span class="fe-ref-path">${esc(ref.rel)}</span></div><p class="fe-ref-about">Reading…</p>`;
  const read = ref.kind === 'script' ? (t: string) => scriptFacts(t, ref.rel) : cardFacts;
  if (!facts.has(url)) facts.set(url, fetchFileText(url).then(read).catch(() => null));
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
