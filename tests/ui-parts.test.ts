// Keeps every surface on the shared controls. Reads the source, so a button
// variant that has no style, a native dropdown or a bare checkbox fails here
// before anyone sees it drawn in the browser's own look.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '../src');
const files = readdirSync(SRC).filter(f => f.endsWith('.ts') && !f.startsWith('styles'));
const read = (f: string) => readFileSync(join(SRC, f), 'utf8');
// The variants src/styles.ts gives a look to (docs/system/button.md); plain is the default and takes no attribute.
const VARIANTS = ['shade', 'surface', 'outline', 'solid'];

describe('surfaces use the shared controls', () => {
  it('every button variant named in markup has a style', () => {
    const css = read('styles.ts');
    for (const v of VARIANTS) expect(css, v).toContain(`[data-variant="${v}"]`);
    const unknown: string[] = [];
    for (const f of files) {
      const text = read(f);
      for (const m of text.matchAll(/data-variant="([a-z-]+)"/g)) if (!VARIANTS.includes(m[1])) unknown.push(`${f}: ${m[1]}`);
      for (const m of text.matchAll(/\bvariant: '([a-z-]+)'/g)) if (!VARIANTS.includes(m[1])) unknown.push(`${f}: ${m[1]}`);
    }
    expect(unknown).toEqual([]);
  });
  it('no native dropdown outside the shared control', () => {
    const found = files.filter(f => f !== 'controls.ts' && /<select\b/.test(read(f)));
    expect(found).toEqual([]);
  });
  it('a checkbox is built by the shared control, a task list, or the page toggle', () => {
    // controls.ts builds them; renderers.ts draws Markdown task lists; page.ts holds the one toggle wrapper.
    const allowed = new Set(['controls.ts', 'renderers.ts', 'page.ts']);
    const found = files.filter(f => !allowed.has(f) && /<input\b[^>]*type="checkbox"/.test(read(f)));
    expect(found).toEqual([]);
  });
});
