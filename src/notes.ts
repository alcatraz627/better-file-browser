// Client for the notes native host: one request, one reply, through the
// background worker's one-shot relay (content scripts cannot connectNative).
// Every call names the notes root the owner picked in Settings.

export interface NoteMeta { rel: string; size: number; mtime: number; title?: string; color?: string; pinned?: boolean; tags?: string[]; pos?: string; created?: number }
export interface NoteDoc  { rel: string; text: string; mtime: number }

export class NotesError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'NotesError'; }
}

type Frame =
  | { t: 'stat'; root: string; count: number }
  | { t: 'list'; notes: NoteMeta[] }
  | { t: 'note'; rel: string; text: string; mtime: number }
  | { t: 'written'; rel: string; mtime: number }
  | { t: 'renamed'; rel: string; to: string }
  | { t: 'deleted'; rel: string; trashed: string }
  | { t: 'history'; rel: string; versions: NoteVersion[]; repo?: boolean }
  | { t: 'version'; rel: string; sha: string; text: string }
  | { t: 'picked'; root: string }
  | { t: 'error'; code: string; message: string };

/// One saved version of a note, from the folder's git log: short hash, epoch ms, the commit's reason.
export interface NoteVersion { sha: string; when: number; reason: string }

const HOST = 'com.better_file_browser.notes';

function call(payload: Record<string, unknown>): Promise<Frame> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ type: 'bfb-native-oneshot', host: HOST, payload }, res => {
        if (chrome.runtime.lastError || !res) return reject(new NotesError('unavailable', chrome.runtime.lastError?.message || 'no reply'));
        if (!res.ok) return reject(new NotesError('unavailable', res.error || 'notes host not installed'));
        const f = res.response as Frame;
        if (f.t === 'error') return reject(new NotesError(f.code, f.message));
        resolve(f);
      });
    } catch (e) { reject(new NotesError('unavailable', String(e))); }
  });
}

export const notes = {
  stat:   (root: string) => call({ op: 'stat', root }) as Promise<{ t: 'stat'; root: string; count: number }>,
  list:   (root: string) => call({ op: 'list', root }).then(f => (f as { notes: NoteMeta[] }).notes),
  read:   (root: string, rel: string) => call({ op: 'read', root, rel }) as Promise<NoteDoc>,
  write:  (root: string, rel: string, text: string, expectMtime?: number) =>
            call({ op: 'write', root, rel, text, expectMtime }) as Promise<{ rel: string; mtime: number }>,
  create: (root: string, rel: string, text = '') => call({ op: 'create', root, rel, text }) as Promise<{ rel: string; mtime: number }>,
  rename: (root: string, rel: string, to: string) => call({ op: 'rename', root, rel, to }),
  writeBinary: (root: string, rel: string, base64: string) =>
            call({ op: 'writeBinary', root, rel, base64 }) as Promise<{ rel: string; mtime: number }>,
  delete: (root: string, rel: string) => call({ op: 'delete', root, rel }),
  /// The system folder chooser, opened on `start`; resolves to '' when the person cancels.
  pick: (start?: string) => call({ op: 'pick', start }).then(f => (f as { root: string }).root),
  history: (root: string, rel: string) => call({ op: 'history', root, rel }).then(f => f as { versions: NoteVersion[]; repo?: boolean }),
  version: (root: string, rel: string, sha: string) => call({ op: 'version', root, rel, sha }) as Promise<{ rel: string; sha: string; text: string }>,
};

// A note's file name from its first heading or first line, safe for a path.
export function slugForTitle(title: string): string {
  const s = title.replace(/^#+\s*/, '').trim().toLowerCase()
    // Keep letters from any script. The upper bound stays below U+FFFE:
    // Chrome refuses a content script containing a Unicode noncharacter.
    .replace(/[^a-z0-9À-ɏͰ-﷏]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return (s || 'untitled') + '.md';
}

// A frontmatter value as written: JSON-quoted (Switchboard, setTitle), YAML single-quoted
// ('' is a literal quote), or bare. Matches notes_host.py and the Pi.
function unquoteYaml(v: string): string {
  if (v.length >= 2 && v[0] === '"' && v.endsWith('"')) {
    try { return JSON.parse(v) as string; } catch { return v.slice(1, -1); }
  }
  if (v.length >= 2 && v[0] === "'" && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

// The title a note shows, derived as Switchboard does: front matter title, else the
// first body line with its leading # stripped, else the file name without extension.
export function noteTitle(rel: string, text?: string): string {
  if (text) {
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    const raw = fm?.[1].match(/^title:\s*(.+)$/m)?.[1].trim();
    const t = raw && unquoteYaml(raw).trim();
    if (t) return t;
    const first = splitNote(text).body.trim().split('\n')[0].replace(/^#+/, '').trim();
    if (first) return first;
  }
  return rel.split('/').pop()!.replace(/\.md$/i, '').replace(/[-_]+/g, ' ');
}

// Set the title field inside existing front matter, JSON-quoted as Switchboard
// writes it. Returns null for a note without front matter: the contract never
// adds front matter, so such a note is renamed by its file name instead.
export function setTitle(text: string, title: string): string | null {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const line = `title: ${JSON.stringify(title)}`;
  const fm = /^title:.*$/m.test(m[1]) ? m[1].replace(/^title:.*$/m, () => line) : `${line}\n${m[1]}`;
  return text.replace(m[0], () => `---\n${fm}\n---`);
}

// A note edited in two places holds both sides between git-style markers. settleClash keeps
// the first side, the second, or both (first then second); same rules as Switchboard and the Pi.
export type Keep = 'first' | 'second' | 'both';
export function settleClash(text: string, keep: Keep): string {
  const out: string[] = []; let first: string[] = [], second: string[] = [];
  let part: 'out' | 'first' | 'second' = 'out';
  for (const line of text.split('\n')) {
    if (part === 'out' && (line.startsWith('<<<<<<< ') || line === '<<<<<<<')) { part = 'first'; first = []; second = []; }
    else if (part === 'out') out.push(line);
    else if (part === 'first' && line === '=======') part = 'second';
    else if (part === 'first') first.push(line);
    else if (line.startsWith('>>>>>>> ') || line === '>>>>>>>') {
      part = 'out';
      out.push(...(keep === 'second' ? second : keep === 'first' ? first : [...first, ...second]));
    } else second.push(line);
  }
  if (part !== 'out') out.push(...first, ...second);   // an unclosed block loses nothing
  return out.join('\n');
}

// The two sides of a note's first clash, named as a person says them; null when there is none.
export function clashSides(text: string): [string, string] | null {
  const a = text.match(/^<<<<<<< (.+)$/m)?.[1], b = text.match(/^>>>>>>> (.+)$/m)?.[1];
  if (!a || !b) return null;
  const name = (m: string) => m === 'HEAD' ? "this Mac's" : /^pi\b|csync/.test(m) ? "the Pi's" : m === 'phone' ? "the phone's" : `${m}'s`;
  return [name(a.trim()), name(b.trim())];
}

// Refresh `updated` inside existing front matter; a note without front
// matter is left exactly as written (contract: never add front matter).
export function stampUpdated(text: string, now = new Date()): string {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return text;
  const iso = now.toISOString();
  // Function replacements: a `$&` or `$$` in any property value must stay literal.
  const fm = /^updated:.*$/m.test(m[1]) ? m[1].replace(/^updated:.*$/m, () => `updated: ${iso}`) : m[1] + `\nupdated: ${iso}`;
  return text.replace(m[0], () => `---\n${fm}\n---`);
}

// ── Properties: title, colour, pin and tags, read and written the way Switchboard does ──

/// The eight colours Switchboard and the phone offer, in their order.
export const NOTE_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'] as const;
export type NoteColor = typeof NOTE_COLORS[number];
const LEGACY_COLORS: Record<string, NoteColor> = { indigo: 'purple', mint: 'green', brown: 'orange', gray: 'blue', cyan: 'teal' };

/// A saved colour name as one of the eight, or null when it is none of them.
export function colorName(v: string | undefined): NoteColor | null {
  if (!v) return null;
  const n = LEGACY_COLORS[v] ?? v;
  return (NOTE_COLORS as readonly string[]).includes(n) ? n as NoteColor : null;
}

/// `pos` is the shared order key, kept as the raw text on the line (`no`, `1e5` and `null` are all just strings).
export interface NoteProps { title: string; color: NoteColor | null; pinned: boolean; tags: string[]; pos?: string }

/// Frontmatter keys in the order Switchboard writes them (csync notes_store.py KEY_ORDER).
const KEY_ORDER = ['title', 'created', 'tags', 'expires', 'remind_at', 'remind_repeat', 'remind_on', 'reminder_id',
                   'pinned', 'color', 'agent', 'source', 'url', 'pos'];

// The frontmatter block at the top of a note, closing fence and its newline included.
// A block holding git clash markers is not frontmatter: it stays visible as text.
const FM_RE = /^---\n(?:([\s\S]*?)\n)?---(?:\n|$)/;

/// Splits a note into its frontmatter block (exactly as written, or '') and the body.
/// head + body is always the original text.
export function splitNote(text: string): { head: string; body: string } {
  const m = text.match(FM_RE);
  if (!m || /^(<{7}|={7}|>{7})/m.test(m[0])) return { head: '', body: text };
  return { head: m[0], body: text.slice(m[0].length) };
}

function fmLines(head: string): string[] {
  const m = head.match(FM_RE);
  return m && m[1] !== undefined ? m[1].split('\n') : [];
}

/// The properties a note's frontmatter holds: title as noteTitle reads it, colour, pin, tags.
export function readProps(rel: string, text: string): NoteProps {
  const { head } = splitNote(text);
  const f: Record<string, string> = {};
  for (const line of fmLines(head)) {
    const i = line.indexOf(':');
    if (i > 0) f[line.slice(0, i).trim()] = unquoteYaml(line.slice(i + 1).trim());
  }
  return { title: noteTitle(rel, text), color: colorName(f.color), pinned: f.pinned === 'true',
           tags: parseTags(f.tags), ...(f.pos ? { pos: f.pos } : {}) };
}

// `a, b` and the YAML flow list `[a, b]` read the same, as in notes_host.py.
export function parseTags(v: string | undefined): string[] {
  const s = (v ?? '').trim();
  return (s.startsWith('[') && s.endsWith(']') ? s.slice(1, -1) : s).split(',').map(t => t.trim().replace(/^(["'])(.*)\1$/, '$2')).filter(Boolean);
}

/// Set (string) or remove (null) one frontmatter field, touching only that line.
/// A new line goes where Switchboard would put it; a note with no frontmatter gets
/// a block holding just that field, so every app still reads its title the same way.
export function setField(text: string, key: string, value: string | null): string {
  const line = value === null ? null : `${key}: ${value}`;
  const { head, body } = splitNote(text);
  if (!head) return line === null ? text : `---\n${line}\n---\n${text}`;
  const lines = fmLines(head);
  const at = lines.findIndex(l => l.slice(0, Math.max(l.indexOf(':'), 0)).trim() === key);
  if (at >= 0) { if (line === null) lines.splice(at, 1); else lines[at] = line; }
  else if (line !== null) {
    const rank = KEY_ORDER.indexOf(key);
    let pos = lines.length;
    if (rank >= 0) {
      // Known keys come in KEY_ORDER, unknown ones (like `updated`) after them all.
      const later = lines.findIndex(l => { const r = KEY_ORDER.indexOf(l.slice(0, Math.max(l.indexOf(':'), 0)).trim()); return r < 0 || r > rank; });
      if (later >= 0) pos = later;
    }
    lines.splice(pos, 0, line);
  }
  if (!lines.length && at >= 0) return body;   // the last property went: drop the block with it
  return `---\n${lines.length ? lines.join('\n') + '\n' : ''}---\n${body}`;
}

export const setPinned = (text: string, on: boolean) => setField(text, 'pinned', on ? 'true' : null);
export const setColor  = (text: string, c: NoteColor | null) => setField(text, 'color', c);
export const setTags   = (text: string, tags: string[]) =>
  setField(text, 'tags', tags.length ? JSON.stringify(tags.join(', ')) : null);

/// The frontmatter lines that differ between two texts, ignoring the named keys and `updated`.
/// Empty means the block round-trips unchanged except for what the person changed.
export function frontmatterDrift(before: string, after: string, allowed: Iterable<string>): string[] {
  const skip = new Set([...allowed, 'updated']);
  const keep = (t: string) => fmLines(splitNote(t).head).filter(l => !skip.has(l.slice(0, Math.max(l.indexOf(':'), 0)).trim()));
  const a = keep(before), b = keep(after);
  return a.length === b.length && a.every((l, i) => l === b[i]) ? [] : [...a.filter(l => !b.includes(l)).map(l => `- ${l}`), ...b.filter(l => !a.includes(l)).map(l => `+ ${l}`)];
}

/// The shared note order (specs/order.md): pinned first, then notes never arranged (newest created first),
/// then arranged notes by `pos` in byte order; the file name breaks ties. Editing a note does not move it.
export function sharedOrder<T extends { rel: string; pinned?: boolean; pos?: string; created?: number; mtime: number }>(list: T[]): T[] {
  const made = (n: T) => n.created ?? n.mtime;
  return [...list].sort((x, y) => {
    if (!!x.pinned !== !!y.pinned) return x.pinned ? -1 : 1;
    if (!x.pos !== !y.pos) return x.pos ? 1 : -1;
    if (!x.pos) return made(y) - made(x) || (x.rel < y.rel ? -1 : x.rel > y.rel ? 1 : 0);
    return x.pos! < y.pos! ? -1 : x.pos! > y.pos! ? 1 : (x.rel < y.rel ? -1 : x.rel > y.rel ? 1 : 0);
  });
}

/// Notes whose title, file name, tags or colour contain every word typed; `#work` matches a tag only.
export function filterNotes<T extends { rel: string; title?: string; color?: string; tags?: string[] }>(list: T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter(n => {
    const tags = (n.tags ?? []).map(t => t.toLowerCase());
    const hay = `${n.title || noteTitle(n.rel)} ${n.rel} ${colorName(n.color) ?? ''} ${tags.join(' ')}`.toLowerCase();
    return words.every(w => w.startsWith('#') ? w.length > 1 && tags.some(t => t.includes(w.slice(1))) : hay.includes(w));
  });
}

export interface PropChange { color?: NoteColor | null; pinned?: boolean; tags?: string[] }

/// Applies chip changes to a note's text: only the changed fields' lines are touched.
export function applyChange(text: string, c: PropChange): string {
  let t = text;
  if (c.color !== undefined) t = setColor(t, c.color);
  if (c.pinned !== undefined) t = setPinned(t, c.pinned);
  if (c.tags !== undefined) t = setTags(t, c.tags);
  return t;
}

/// The frontmatter keys a change writes.
export function changedKeys(c: PropChange): string[] {
  return (['color', 'pinned', 'tags'] as const).filter(k => c[k] !== undefined);
}
