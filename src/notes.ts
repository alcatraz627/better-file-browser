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
  | { t: 'written'; rel: string; mtime: number; backup?: string }
  | { t: 'renamed'; rel: string; to: string }
  | { t: 'deleted'; rel: string; trashed: string }
  | { t: 'history'; rel: string; versions: NoteVersion[]; repo?: boolean }
  | { t: 'version'; rel: string; sha: string; text: string }
  | { t: 'picked'; root: string }
  | { t: 'home'; home: string }
  | { t: 'file'; rel: string; text: string; mtime: number; next?: number | null }
  | { t: 'fstat'; rel: string; mtime: number; size: number }
  | { t: 'search'; hits: { rel: string; line: string }[] }
  | { t: 'error'; code: string; message: string };

/// Who wrote a comment: the owner, or an agent by its claude-ipc alias.
export interface CommentAuthor { kind: 'human' | 'agent'; name?: string; ipc?: string; alias?: string; session?: string; role?: string }
export interface DocComment { id: string; author: CommentAuthor; created: string; updated?: string; text: string; edited?: string; deleted?: boolean; suggestion?: { replace: string; state: string; decidedAt?: string; was?: string } }
/// Where a thread sits now: anchored where it was, moved (found by its words), ambiguous, or detached.
export interface ThreadPlace { state: 'anchored' | 'moved' | 'ambiguous' | 'detached'; offset: number | null; length: number; line: number | null }
export interface DocThread {
  id: string; status: 'open' | 'done'; tags?: string[]; mentions?: string[]; due?: string; created: string; updated?: string;
  anchor: { exact: string; line: number; offset: number; headings?: string[] };
  comments: DocComment[]; place: ThreadPlace; doneBy?: CommentAuthor; doneAt?: string;
}
export interface CommentsReply { rel: string; threads: DocThread[]; where: string; companion: string; notes: string[]; doc: { id: string } | null; results?: { thread?: string; comment?: string }[] }
export type CommentOp = { op: string; thread?: string; comment?: string; text?: string; start?: number; end?: number; tags?: string[]; replace?: string; due?: string; state?: 'accepted' | 'rejected'; was?: string };

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

// The host replies in slices under Chrome's 1 MB limit; join them, and start
// over if the file changed between slices so the text is never a mix.
async function fileRead(root: string, rel: string): Promise<{ text: string; mtime: number }> {
  for (let attempt = 0; ; attempt++) {
    const parts: string[] = [];
    let mtime = -1, offset: number | null | undefined = 0, torn = false;
    while (offset != null) {
      const f = await call({ op: 'fileRead', root, rel, offset }) as { text: string; mtime: number; next?: number | null };
      if (mtime !== -1 && f.mtime !== mtime) { torn = true; break; }
      mtime = f.mtime; parts.push(f.text); offset = f.next;
    }
    if (!torn) return { text: parts.join(''), mtime };
    if (attempt >= 3) throw new NotesError('notes_io', 'the file kept changing while it was read');
  }
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
  /// The system chooser: a folder, or with kind 'any' a file or a folder (a folder ends in /). Empty when cancelled.
  pick: (start?: string, kind?: 'any') => call({ op: 'pick', start, kind }).then(f => (f as { root: string }).root),
  /// The account's home folder, so Places can offer Home before any visit under it.
  home: () => call({ op: 'home' }).then(f => (f as { home: string }).home),
  history: (root: string, rel: string) => call({ op: 'history', root, rel }).then(f => f as { versions: NoteVersion[]; repo?: boolean }),
  version: (root: string, rel: string, sha: string) => call({ op: 'version', root, rel, sha }) as Promise<{ rel: string; sha: string; text: string }>,
  /// Notes whose text holds every word of the query, each with its first matching line.
  search: (root: string, query: string) => call({ op: 'search', root, query }).then(f => (f as { hits: { rel: string; line: string }[] }).hits),
  /// Any text file inside a folder allowed for editing; root is that folder.
  fileRead,
  /// A file's modified time and size, without reading it.
  fileStat: (root: string, rel: string) => call({ op: 'fileStat', root, rel }) as Promise<{ mtime: number; size: number }>,
  /// Every comment thread on a document, each with where it sits in the text now (bfb-docs).
  commentsRead: (root: string, rel: string) => call({ op: 'commentsRead', root, rel }) as unknown as Promise<CommentsReply>,
  /// Apply comment operations as the owner; the document itself is never written.
  commentsWrite: (root: string, rel: string, ops: CommentOp[]) => call({ op: 'commentsWrite', root, rel, ops }) as unknown as Promise<CommentsReply>,
  /// Every document with comments, from the bfb-docs index.
  /// Every page in gcc's decision-page registry with whether it waits on the owner (read only).
  dpPages: () => call({ op: 'dpPages' }).then(f => (f as unknown as { pages: import('./dp-lens').DpRow[] }).pages ?? []),
  /// Hand a decision page's answer work (compose, submit, seen, parse) to gcc's own command.
  dp: (verb: 'compose' | 'submit' | 'seen' | 'parse', slug: string, payload?: unknown) =>
            call({ op: 'dp', verb, slug, payload }).then(f => (f as unknown as { result: unknown }).result),
  docsIndex: () => call({ op: 'docsIndex' }).then(f => (f as unknown as { docs: import('./docs-lens').DocRow[] }).docs ?? []),
  /// Agent sessions claude-ipc sees as live or idle, for offering @claude:<alias>.
  people: () => call({ op: 'people' }).then(f => (f as unknown as { peers: { alias: string; cwd: string; status: string }[] }).peers ?? []),
  fileWrite: (root: string, rel: string, text: string, expectMtime: number) =>
            call({ op: 'fileWrite', root, rel, text, expectMtime }) as Promise<{ mtime: number; backup?: string }>,
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

// For a note without front matter the title is its first line. A rename
// rewrites that line only when it is a heading; otherwise the first line is
// the person's own writing, so a new heading goes above it instead. Returns
// null when the note is empty and only its file name can carry the title.
export function setFirstLine(text: string, title: string): string | null {
  const m = text.match(/^(\s*)([^\n]*)/);
  if (!m || !m[2].trim()) return null;
  // Only a real markdown heading (#, then a space) is a title line; "#work" is a tag.
  const marks = m[2].match(/^#{1,6}[ \t]+/)?.[0];
  if (marks) return m[1] + marks + title + text.slice(m[0].length);
  return `# ${title}\n\n` + text;
}

/** Whether a note's file name is its id: Switchboard and the phone name a
 *  note by the moment it was made (20261009-203134.md, with an optional
 *  -a1b2), and its place in their order and its git history hang on that
 *  name, so a rename changes only its title. */
export function nameIsId(rel: string): boolean {
  return /^\d{8}-\d{6}(-[0-9a-f]{4})?\.md$/i.test(rel.split('/').pop() ?? '');
}

// Give a note a new title wherever it keeps one now: the properties block
// when that names a title, otherwise the first line of the writing. Pinning or
// colouring adds a properties block without a title, and the title then still
// lives in the first line, so that is the line a rename changes.
export function retitle(text: string, title: string): string | null {
  const { head, body } = splitNote(text);
  if (head && /^title:/m.test(head)) return setTitle(text, title);
  const lined = setFirstLine(body, title);
  if (lined !== null) return head + lined;
  return head ? setTitle(text, title) : null;
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
export const setPos    = (text: string, pos: string) => setField(text, 'pos', pos);
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

/// An order key that sorts strictly between `a` and `b` (null means no bound on that side).
/// Keys compare as plain strings; the result uses only 1-9 and a-z, so it never ends in the
/// lowest character and a later key can always go below it. Existing keys may use any text.
export function keyBetween(a: string | null, b: string | null): string {
  const PICK = '123456789abcdefghijklmnopqrstuvwxyz';
  if (a !== null && b !== null && a >= b) b = null;   // keys out of order: settle for "after a"
  const lo = a ?? '';
  let hi = b, out = '';
  for (let i = 0; i < 64; i++) {
    const lc = i < lo.length ? lo.charCodeAt(i) : 47;               // just below '0'
    const hc = hi !== null && i < hi.length ? hi.charCodeAt(i) : 123; // just above 'z'
    const between = [...PICK].filter(d => d.charCodeAt(0) > lc && d.charCodeAt(0) < hc);
    if (between.length) return out + between[Math.floor(between.length / 2)];
    // Nothing fits at this place: take lo's character (or '0') and look one place further.
    const c = i < lo.length ? lo[i] : '0';
    if (c.charCodeAt(0) < hc) hi = null;
    out += c;
  }
  return out + 'i';
}

/// The `pos` writes that make the shared order read as `order`, after `rel` was dropped at its place in it.
/// `order` is one group (pinned or not) as it should read. Unarranged notes above the dropped one stay
/// unarranged; from the dropped note down, each note that would not already sort after the one before
/// it gets a key, so a drop below arranged notes writes one file.
export function arrangeWrites(order: { rel: string; pos?: string }[], rel: string): Map<string, string> {
  const out = new Map<string, string>();
  const k = order.findIndex(n => n.rel === rel);
  if (k < 0) return out;
  let prev: string | null = null;
  for (let i = k - 1; i >= 0; i--) if (order[i].pos) { prev = order[i].pos!; break; }
  for (let i = k; i < order.length; i++) {
    const own = i === k ? undefined : order[i].pos;
    if (own && (prev === null || own > prev)) break;
    let upper: string | null = null;
    for (let j = i + 1; j < order.length; j++) if (order[j].pos) { upper = order[j].pos!; break; }
    if (upper !== null && prev !== null && upper <= prev) upper = null;
    prev = keyBetween(prev, upper);
    out.set(order[i].rel, prev);
  }
  return out;
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
