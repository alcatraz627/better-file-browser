import type { Entry } from './types';

export function parseEntries(): Entry[] {
  const table = document.querySelector('table') || document.getElementById('listing-table');
  if (!table) return [];
  return Array.from(table.querySelectorAll('tr')).slice(1).flatMap(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) return [];
    const link = cells[0]?.querySelector('a');
    if (!link) return [];
    const rawName  = link.textContent!.trim();
    const href     = link.getAttribute('href')!;
    const rawBytes = parseInt(cells[1]?.getAttribute('data-value') ?? cells[1]?.textContent ?? '-1');
    const dateStr  = cells[2]?.textContent?.trim() ?? '';
    const isParent = href === '../';
    const isDir    = !isParent && (href?.endsWith('/') ?? false);
    const name     = isParent ? '..' : (isDir ? rawName.replace(/\/$/, '') : rawName);
    const isHidden = !isParent && name.startsWith('.');
    return [{ name, href, isDir, isParent, isHidden, rawBytes, dateStr }];
  });
}

export function parseFetchedDoc(doc: Document, baseUrl: string): Entry[] {
  const table = doc.querySelector('table');
  if (!table) return [];
  return Array.from(table.querySelectorAll('tr')).slice(1).flatMap(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) return [];
    const link = cells[0]?.querySelector('a');
    if (!link) return [];
    const rawName = link.textContent!.trim();
    const rel     = link.getAttribute('href')!;
    if (rel === '../') return [];
    const href     = new URL(rel, baseUrl).href;
    const isDir    = rel?.endsWith('/') ?? false;
    const name     = isDir ? rawName.replace(/\/$/, '') : rawName;
    const isHidden = name.startsWith('.');
    return [{ name, href, isDir, isParent: false, isHidden, rawBytes: -1, dateStr: '' }];
  });
}
