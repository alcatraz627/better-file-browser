// Keeps controls short across the whole product: a button says what it does in
// a few words and a tooltip adds one short line. Reads the source, so a new
// wordy control fails here before anyone sees it.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '../src');
const files = readdirSync(SRC).filter(f => f.endsWith('.ts') && !f.startsWith('styles') && f !== 'help.ts');
const MAX_LABEL = 3, MAX_TIP = 8;

describe('controls stay short', () => {
  it(`no tooltip runs past ${MAX_TIP} words`, () => {
    const long: string[] = [];
    for (const f of files) for (const m of readFileSync(join(SRC, f), 'utf8').matchAll(/(?:title|data-title)="([^"$]{20,})"/g)) {
      if (m[1].split(/\s+/).length > MAX_TIP) long.push(`${f}: ${m[1]}`);
    }
    expect(long).toEqual([]);
  });
  it('a labelled button carries an icon', () => {
    const bare: string[] = [];
    for (const f of files) for (const m of readFileSync(join(SRC, f), 'utf8').matchAll(/<button\b[^>]*class="btn\b[^"]*"[^>]*>([A-Za-z][^<]*)<\/button>/g)) bare.push(`${f}: ${m[1]}`);
    expect(bare).toEqual([]);
  });
  it('a button keeps its icon when its words change', () => {
    const wiped: string[] = [];
    for (const f of files) for (const m of readFileSync(join(SRC, f), 'utf8').matchAll(/\b(?:submitBtn|depthBtn|more)\.textContent\s*=/g)) wiped.push(`${f}: ${m[0]}`);
    expect(wiped).toEqual([]);
  });
  it('no icon is written out as text inside a plain string', () => {
    const literal: string[] = [];
    for (const f of files) for (const m of readFileSync(join(SRC, f), 'utf8').matchAll(/'<button[^'`\n]*\$\{UI_ICON[^'`\n]*'/g)) literal.push(`${f}: ${m[0].slice(0, 60)}`);
    expect(literal).toEqual([]);
  });
  it(`no button label runs past ${MAX_LABEL} words`, () => {
    const long: string[] = [];
    for (const f of files) for (const m of readFileSync(join(SRC, f), 'utf8').matchAll(/<button\b[^>]*>([^<>$`]+)<\/button>/g)) {
      if (m[1].trim().split(/\s+/).length > MAX_LABEL) long.push(`${f}: ${m[1].trim()}`);
    }
    expect(long).toEqual([]);
  });
});
