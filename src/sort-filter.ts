import type { Entry, SortConfig, FilterConfig, GroupMode, Group } from './types';
import { fmtType, getExt } from './utils';

export function applyFilter(entries: Entry[], config: FilterConfig, regexMatches: Set<string> = new Set()): Entry[] {
  return entries.filter(e => {
    if (config.type !== 'all') {
      if (config.type === 'folders' && !e.isDir)  return false;
      if (config.type === 'files'   && e.isDir)   return false;
      if (!['all', 'folders', 'files'].includes(config.type)) {
        if (getExt(e) !== config.type) return false;
      }
    }
    if (config.q) {
      if (config.regex) {
        if (!regexMatches.has(e.href)) return false;
      } else {
        if (!e.name.toLowerCase().includes(config.q.toLowerCase())) return false;
      }
    }
    return true;
  });
}

// Names compare by number where they hold one, so "sub 2" comes before "sub 10".
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function applySort(entries: Entry[], config: SortConfig, dirsFirst = false): Entry[] {
  if (!config.col) return dirsFirst ? [...entries.filter(e => e.isDir), ...entries.filter(e => !e.isDir)] : entries;
  return [...entries].sort((a, b) => {
    // Folders stay above files whichever way the column runs.
    if (dirsFirst && a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let va: string | number, vb: string | number;
    if      (config.col === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
    else if (config.col === 'size') { va = a.rawBytes; vb = b.rawBytes; }
    else if (config.col === 'date') { va = Number.isFinite(a.dateMs) ? a.dateMs : 0; vb = Number.isFinite(b.dateMs) ? b.dateMs : 0; }
    else if (config.col === 'type') { va = fmtType(a); vb = fmtType(b); }
    else if (config.col === 'ext')  { va = getExt(a);  vb = getExt(b); }
    else return 0;
    const cmp = typeof va === 'number'
      ? (va as number) - (vb as number)
      : collator.compare(String(va), String(vb));
    return config.dir === 'asc' ? cmp : -cmp;
  });
}

/** A fingerprint of which rows are shown and in what order, so the listing can tell a new set from the same set redrawn. */
export function rowSetKey(hrefs: string[], extra = ''): string {
  // FNV-1a over every href in order: a swap or a replaced row anywhere changes it.
  let h = 0x811c9dc5;
  for (const s of hrefs) {
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    h = Math.imul(h ^ 0x7c, 0x01000193);
  }
  return `${hrefs.length}|${extra}|${(h >>> 0).toString(36)}`;
}

export function buildGroups(entries: Entry[], mode: GroupMode): Group[] {
  if (mode === 'folders-first') {
    const dirs  = entries.filter(e => e.isDir);
    const files = entries.filter(e => !e.isDir);
    return [
      ...(dirs.length  ? [{ label: `Folders (${dirs.length})`,  items: dirs  }] : []),
      ...(files.length ? [{ label: `Files (${files.length})`,   items: files }] : []),
    ];
  }
  if (mode === 'files-first') {
    const dirs  = entries.filter(e => e.isDir);
    const files = entries.filter(e => !e.isDir);
    return [
      ...(files.length ? [{ label: `Files (${files.length})`,  items: files }] : []),
      ...(dirs.length  ? [{ label: `Folders (${dirs.length})`, items: dirs  }] : []),
    ];
  }
  if (mode === 'ext') {
    const map = new Map<string, Entry[]>();
    entries.forEach(e => {
      const key = e.isDir ? '📁 Folders' : (getExt(e) ? `.${getExt(e)}` : 'Other');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }
  if (mode === 'type') {
    const map = new Map<string, Entry[]>();
    entries.forEach(e => {
      const key = e.isDir ? 'Folder' : fmtType(e);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }
  return [{ label: 'All', items: entries }];
}
