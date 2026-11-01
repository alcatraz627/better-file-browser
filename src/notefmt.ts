// The notes folder format, read and written one way. This is the TypeScript half of
// the shared notes spec; native/notefmt.py is the Python half, and both are held to
// the same fixture files (tests/fixtures/notes-spec). When code here and a fixture
// disagree, the fixture is right.

export const KNOWN_KEYS = ['title', 'created', 'tags', 'expires', 'remind_at', 'remind_repeat',
  'remind_on', 'remind_persist', 'reminder_id', 'pinned', 'color', 'agent', 'source', 'url', 'device', 'pos'] as const;
export const COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'] as const;
export const REPEATS = ['daily', 'weekly', 'monthly'] as const;
export const DEVICES = ['mac', 'phone'] as const;

const POS_RE = /^[0-9a-z]{0,31}[1-9a-z]$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** One parsed file, with the field names the fixtures use. */
export interface ParsedNote {
  title: string; body: string; tags: string[]; color: string | null; pinned: boolean; pos: string | null;
  url: string | null; device: string | null; agent: string | null; source: string | null;
  expires: string | null; created: string | null; remindAt: string | null; remindRepeat: string | null;
  remindOn: string | null; remindPersist: boolean; reminderId: string | null; conflicted: boolean; extraLines: string[];
}

const KEY_TO_FIELD: Record<string, keyof ParsedNote> = {
  title: 'title', created: 'created', tags: 'tags', expires: 'expires', remind_at: 'remindAt',
  remind_repeat: 'remindRepeat', remind_on: 'remindOn', remind_persist: 'remindPersist',
  reminder_id: 'reminderId', pinned: 'pinned', color: 'color', agent: 'agent', source: 'source',
  url: 'url', device: 'device', pos: 'pos',
};

/** Line endings become \n, as every reader does before parsing. */
export const normalise = (text: string): string => text.replace(/\r\n/g, '\n');

export const isOpener = (line: string): boolean => line.startsWith('<<<<<<< ') || line === '<<<<<<<';
export const isCloser = (line: string): boolean => line.startsWith('>>>>>>> ') || line === '>>>>>>>';

/** Whether any line of the file starts a clash block, header included. */
export const hasClash = (text: string): boolean => normalise(text).split('\n').some(isOpener);

export const validPos = (s: string): boolean => !!s && POS_RE.test(s);
export const validId = (s: string): boolean => ID_RE.test(s);

/** One header value: JSON-quoted, YAML single-quoted or bare. */
export function unquote(raw: string): string {
  const v = raw.trim();
  if (v.length >= 2 && v[0] === '"') {
    try { const out: unknown = JSON.parse(v); if (typeof out === 'string') return out; } catch { /* bare text */ }
    return v;
  }
  if (v.length >= 2 && v[0] === "'" && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

/** `a, b` and `[a, b]` read the same; quotes around one entry are dropped. */
export function parseTagList(raw: string): string[] {
  let s = unquote(raw).trim();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  const out: string[] = [];
  for (let part of s.split(',')) {
    part = part.trim();
    if (part.length >= 2 && part[0] === part[part.length - 1] && '"\''.includes(part[0])) part = part.slice(1, -1).trim();
    if (part) out.push(part);
  }
  return out;
}

/** The title a file shows when it has no `title` key: its first non-empty body line, else its name. */
export function deriveTitle(body: string, name: string): string {
  for (const line of body.split('\n')) {
    if (line.trim()) {
      const t = line.replace(/^[#> ]+/, '').trim();
      return t || name;
    }
  }
  return name;
}

export function emptyNote(name: string): ParsedNote {
  return {
    title: name, body: '', tags: [], color: null, pinned: false, pos: null, url: null, device: null,
    agent: null, source: null, expires: null, created: null, remindAt: null, remindRepeat: null,
    remindOn: null, remindPersist: false, reminderId: null, conflicted: false, extraLines: [],
  };
}

/** The header lines and the body of normalised text, or null header when there is none. */
export function splitHeader(text: string): { header: string[] | null; body: string } {
  const lines = text.split('\n');
  if (lines[0] !== '---') return { header: null, body: text };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') return { header: lines.slice(1, i), body: lines.slice(i + 1).join('\n') };
  }
  return { header: null, body: text };
}

/** Read one file. `name` is the file name without `.md`. */
export function parseNote(rawText: string, name: string): ParsedNote {
  const text = normalise(rawText);
  const note = emptyNote(name);
  if (hasClash(text)) { note.conflicted = true; note.body = text; return note; }
  const { header, body } = splitHeader(text);
  note.body = body;
  let titleSeen = false;
  const set = note as unknown as Record<string, unknown>;
  for (const line of header ?? []) {
    if (line === '') continue;
    const idx = line.indexOf(':');
    const key = idx >= 0 ? line.slice(0, idx) : null;
    if (key === null || !Object.prototype.hasOwnProperty.call(KEY_TO_FIELD, key)) { note.extraLines.push(line); continue; }
    const raw = line.slice(idx + 1);
    const val = unquote(raw);
    const field = KEY_TO_FIELD[key];
    if (key === 'title') { note.title = val.trim(); titleSeen = true; }
    else if (key === 'tags') note.tags = parseTagList(raw);
    else if (key === 'pinned' || key === 'remind_persist') set[field] = val === 'true';
    else if (key === 'color') set[field] = (COLORS as readonly string[]).includes(val) ? val : null;
    else if (key === 'remind_repeat') set[field] = (REPEATS as readonly string[]).includes(val) ? val : null;
    else if (key === 'remind_on') set[field] = (DEVICES as readonly string[]).includes(val) ? val : null;
    else if (key === 'pos') set[field] = validPos(val) ? val : null;
    else set[field] = val !== '' ? val : null;
  }
  if (!titleSeen) note.title = deriveTitle(body, name);
  return note;
}

const jstr = (s: string): string => JSON.stringify(s);

/** Write a note from fields. A missing field counts as empty. */
export function renderNote(n: Partial<ParsedNote>): string {
  const out = ['---', 'title: ' + jstr(n.title ?? '')];
  if (n.created) out.push('created: ' + n.created);
  if (n.tags?.length) out.push('tags: ' + jstr(n.tags.join(', ')));
  if (n.expires) out.push('expires: ' + n.expires);
  if (n.remindAt) out.push('remind_at: ' + n.remindAt);
  if (n.remindRepeat) out.push('remind_repeat: ' + n.remindRepeat);
  if (n.remindOn) out.push('remind_on: ' + n.remindOn);
  if (n.remindPersist) out.push('remind_persist: true');
  if (n.reminderId) out.push('reminder_id: ' + jstr(n.reminderId));
  if (n.pinned) out.push('pinned: true');
  if (n.color) out.push('color: ' + n.color);
  for (const [key, val] of [['agent', n.agent], ['source', n.source], ['url', n.url], ['device', n.device]] as const) {
    if (val) out.push(key + ': ' + jstr(val));
  }
  if (n.pos) out.push('pos: ' + n.pos);
  out.push(...(n.extraLines ?? []));
  out.push('---');
  return out.join('\n') + '\n' + (n.body ?? '');
}

/** Settle every clash block: keep each block's first side, second side, or both. */
export type Keep = 'first' | 'second' | 'both';
export function settle(text: string, choice: Keep): string {
  const lines = normalise(text).split('\n');
  const out: string[] = [];
  let i = 0; const n = lines.length;
  while (i < n) {
    if (!isOpener(lines[i])) { out.push(lines[i]); i++; continue; }
    const first: string[] = [], second: string[] = [];
    let side = first, j = i + 1, closed = false;
    while (j < n) {
      const l = lines[j];
      if (side === first && l === '=======') side = second;
      else if (isCloser(l)) { closed = true; break; }
      else side.push(l);
      j++;
    }
    if (!closed) { out.push(...first, ...second); break; }
    out.push(...(choice === 'first' ? first : choice === 'second' ? second : [...first, ...second]));
    i = j + 1;
  }
  return out.join('\n');
}

function blocks(lines: string[]): { first: string[]; second: string[]; closed: boolean }[] {
  const out: { first: string[]; second: string[]; closed: boolean }[] = [];
  let i = 0; const n = lines.length;
  while (i < n) {
    if (!isOpener(lines[i])) { i++; continue; }
    const first: string[] = [], second: string[] = [];
    let side = first, j = i + 1, closed = false;
    while (j < n) {
      const l = lines[j];
      if (side === first && l === '=======') side = second;
      else if (isCloser(l)) { closed = true; break; }
      else side.push(l);
      j++;
    }
    out.push({ first, second, closed });
    i = j + 1;
  }
  return out;
}

/** True when every block is closed and every changed line is `pos:`. */
export function posOnlyClash(text: string): boolean {
  const bs = blocks(normalise(text).split('\n'));
  if (!bs.length) return false;
  return bs.every(b => b.closed && [...b.first, ...b.second].every(l => l.startsWith('pos:')));
}

/** Whether a clash may be settled with no one asking (the Mac's side wins). */
export function autoSettles(text: string, relpath: string): boolean {
  if (!hasClash(text)) return false;
  if (relpath.startsWith('.reminders/')) return true;
  return posOnlyClash(text);
}

/** The shared order: pinned first; then no `pos`, newest created first; then `pos` in byte order; ids break ties. */
export function sortNotes<T extends { id: string; pinned?: boolean; pos?: string | null; created?: string | null }>(list: T[]): T[] {
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return [...list].sort((x, y) => {
    if (!!x.pinned !== !!y.pinned) return x.pinned ? -1 : 1;
    if (!x.pos !== !y.pos) return x.pos ? 1 : -1;
    if (!x.pos) return cmp(y.created ?? '', x.created ?? '') || cmp(x.id, y.id);
    return cmp(x.pos, y.pos!) || cmp(x.id, y.id);
  });
}

/** Trim spaces, lowercase the scheme and host; everything else stays as written. */
export function normaliseUrl(raw: string): string {
  const url = raw.trim();
  const m = /^([A-Za-z][A-Za-z0-9+.\-]*):([\s\S]*)$/.exec(url);
  if (!m) return url;
  const scheme = m[1].toLowerCase();
  let rest = m[2];
  const a = /^\/\/([^/?#]*)([\s\S]*)$/.exec(rest);
  if (a) {
    const auth = a[1], at = auth.lastIndexOf('@');
    const user = at >= 0 ? auth.slice(0, at + 1) : '', host = at >= 0 ? auth.slice(at + 1) : auth;
    rest = '//' + user + host.toLowerCase() + a[2];
  }
  return scheme + ':' + rest;
}

/** SHA-1 as lowercase hex, through the browser's own crypto. */
export async function sha1Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** A save's file name stem: the first 12 hex characters of the SHA-1 of its normalised url. */
export async function saveKey(url: string): Promise<string> {
  return (await sha1Hex(normaliseUrl(url))).slice(0, 12);
}

/** A new note id: UTC `YYYYMMDD-HHMMSS-xxxx`, four hex characters at the end. */
export function newId(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`;
  const r = crypto.getRandomValues(new Uint8Array(2));
  return `${stamp}-${[...r].map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

/** ISO 8601 UTC with whole seconds, as the header writes times. */
export const isoNow = (now = new Date()): string => now.toISOString().replace(/\.\d{3}Z$/, 'Z');
