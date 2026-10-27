import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderMarkdown } from '../src/renderers';
import { readDirections, stateWord, whenOf, sectionKind, lastUpdatedOf } from '../src/directions-model';

const doc = (name: string) => {
  const root = document.createElement('div');
  root.innerHTML = renderMarkdown(readFileSync(join(__dirname, 'fixtures/directions', name), 'utf8'));
  return readDirections(root);
};

describe('directions model: the standard shape', () => {
  const m = doc('standard.md');
  it('reads the sections and their kinds', () => {
    const kinds = m.sections.map(s => `${s.kind}:${s.title.replace(/[^\w ]/g, '').trim()}`);
    expect(kinds).toContain('waiting:Waiting on you');
    expect(kinds).toContain('direction:Seeds');
    expect(kinds).toContain('goal:Import every supplier');
  });
  it('gives a goal its accepted-when line', () => {
    const g = m.sections.find(s => s.title.includes('Import every supplier'))!;
    expect(g.accepted).toMatch(/^code complete, exercised by the agent/);
    expect(g.parent?.title).toContain('Seeds');
  });
  it('reads the asks with what is needed and what happens on silence', () => {
    const w1 = m.rows.find(r => r.id === 'W1')!;
    expect(w1).toMatchObject({ asks: true, state: 'needs', text: 'Pick the moisture sensor', need: 'A yes on model B, or another model', silent: 'I order model B on Friday' });
  });
  it('reads state and when from the marks', () => {
    expect(m.rows.find(r => r.id === 'S2')).toMatchObject({ state: 'ready', when: 'now', text: 'Parse the fourth feed ⏩' });
    expect(m.rows.find(r => r.id === 'S3')?.when).toBe('next');
    expect(m.rows.find(r => r.id === 'A1')?.state).toBe('needs');
  });
  it('knows an overview row from a task', () => {
    expect(m.rows.filter(r => r.summary).map(r => r.text.replace(/[^\w ]/g, '').trim())).toEqual(['Seeds', 'Watering']);
    expect(m.rows.find(r => r.id === 'S2')?.summary).toBe(false);
  });
  it('skips the key to the marks and reads the date', () => {
    expect(m.rows.some(r => /needs you · 🟠/.test(r.text))).toBe(false);
    expect(m.lastUpdated?.toISOString().slice(0, 10)).toBe(new Date('2026-10-20T00:00:00').toISOString().slice(0, 10));
  });
});

describe('directions model: docs that drift', () => {
  it('takes states written as words in a state column', () => {
    const m = doc('freetext.md');
    expect(m.rows.find(r => r.id === 'L1')?.state).toBe('waiting');
    expect(m.rows.find(r => r.id === 'L2')?.state).toBe('ready');
    expect(m.rows.find(r => r.id === 'R2')?.state).toBe('needs');
    expect(m.rows.find(r => r.text === 'Alerts')?.when).toBe('next');
  });
  it('keeps unmarked rows as unmarked instead of dropping them', () => {
    const m = doc('buckets.md');
    const finding = m.rows.find(r => r.text.startsWith('Prices without currency'));
    expect(finding).toBeTruthy();
    expect(finding!.state).toBeNull();
    expect(m.rows.find(r => r.id === 'H1')).toMatchObject({ state: 'needs', text: 'Crash on empty page' });
    expect(m.lastUpdated).toBeNull();
  });
  it('skips a key row for any mark set, not only states', () => {
    expect(doc('buckets.md').rows.some(r => /now · ⏭/.test(r.text) || r.text === 'When')).toBe(false);
  });
  it('reads numbered buckets as directions', () => {
    const m = doc('buckets.md');
    expect(m.sections.filter(s => s.kind === 'direction').map(s => s.title)).toEqual(['1. Hotfixes', '2. Coverage', '3. Data quality']);
  });
});

describe('directions model: the small readers', () => {
  it('reads words and marks', () => {
    expect(stateWord('waiting on review')).toBe('waiting');
    expect(stateWord('open')).toBeNull();
    expect(whenOf('⏸ later')).toBe('later');
    expect(sectionKind('Needs you today')).toBe('waiting');
    expect(lastUpdatedOf('_Last updated: 2026-10-26_')?.getDate()).toBe(26);
  });
});
