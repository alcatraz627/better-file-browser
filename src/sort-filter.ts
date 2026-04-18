import type { Entry, SortConfig, FilterConfig, GroupMode, Group } from './types';
import { fmtType, getExt } from './utils';

export function applyFilter(entries: Entry[], config: FilterConfig): Entry[] {
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
        try { if (!new RegExp(config.q, 'i').test(e.name)) return false; }
        catch { /* invalid regex – skip */ }
      } else {
        if (!e.name.toLowerCase().includes(config.q.toLowerCase())) return false;
      }
    }
    return true;
  });
}

export function applySort(entries: Entry[], config: SortConfig): Entry[] {
  if (!config.col) return entries;
  return [...entries].sort((a, b) => {
    let va: string | number, vb: string | number;
    if      (config.col === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
    else if (config.col === 'size') { va = a.rawBytes; vb = b.rawBytes; }
    else if (config.col === 'date') { va = a.dateStr;  vb = b.dateStr; }
    else if (config.col === 'type') { va = fmtType(a); vb = fmtType(b); }
    else if (config.col === 'ext')  { va = getExt(a);  vb = getExt(b); }
    else return 0;
    const cmp = typeof va === 'number'
      ? (va as number) - (vb as number)
      : String(va).localeCompare(String(vb));
    return config.dir === 'asc' ? cmp : -cmp;
  });
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
