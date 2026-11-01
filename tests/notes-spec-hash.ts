// A fingerprint of a folder of fixture files, so a vendored copy can be told apart
// from the spec's own. Python's native/test_notefmt.py computes the same value:
// sha256 over, for each file in path order, "<relative path>\0<sha256 of its bytes>\n".
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, base = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name), rel = base ? `${base}/${name}` : name;
    if (statSync(full).isDirectory()) out.push(...walk(full, rel)); else out.push(rel);
  }
  return out;
}

export function folderHash(dir: string): string {
  const h = createHash('sha256');
  for (const rel of walk(dir)) {
    const content = createHash('sha256').update(readFileSync(join(dir, rel))).digest('hex');
    h.update(`${rel}\0${content}\n`);
  }
  return h.digest('hex');
}
