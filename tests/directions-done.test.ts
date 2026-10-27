import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderMarkdown } from '../src/renderers';
import { readDirections } from '../src/directions-model';
import { doneLevels, markDone } from '../src/directions-done';

const ids = (t: string) => doneLevels(t).map(l => l.id);

describe('what done means', () => {
  it('names each bar a line asks for, in the order work reaches them', () => {
    expect(ids('code complete, exercised by the agent on all five feeds, reviewed by the bot')).toEqual(['code', 'exercised', 'reviewed']);
    expect(ids('tested on deploy for a week')).toEqual(['tested', 'deployed']);
    expect(ids('suites pass and it is live in production')).toEqual(['tested', 'deployed']);
  });
  it('names none for a line in other words', () => {
    expect(ids('the owner says the digest reads well')).toEqual([]);
    expect(ids('')).toEqual([]);
  });
  it('adds the line under goals that have one, and invents nothing elsewhere', () => {
    const root = document.createElement('div');
    root.innerHTML = renderMarkdown(readFileSync(join(__dirname, 'fixtures/directions/standard.md'), 'utf8'));
    markDone(readDirections(root));
    const lines = [...root.querySelectorAll('.fe-dir-done')].map(l => [...l.children].map(c => c.textContent?.trim()).join(' '));
    expect(lines).toEqual(['Done when code complete exercised reviewed', 'Done when tested deployed']);
    expect(root.querySelector('.fe-dir-done')?.previousElementSibling?.textContent).toContain('Import every supplier');
    const bare = document.createElement('div');
    bare.innerHTML = renderMarkdown(readFileSync(join(__dirname, 'fixtures/directions/freetext.md'), 'utf8'));
    markDone(readDirections(bare));
    expect(bare.querySelectorAll('.fe-dir-done').length).toBe(0);
  });
  it('ticks a bar once a finished row of the goal says so', () => {
    const root = document.createElement('div');
    root.innerHTML = renderMarkdown('## 🎯 Ship it\n\n✅ Accepted when: code complete and reviewed.\n\n| id | state | task |\n| --- | --- | --- |\n| T1 | ✅ done | Code complete for the parser |\n| T2 | 🟢 ready | Bot review |\n');
    markDone(readDirections(root));
    const met = [...root.querySelectorAll('.fe-dir-done-l')].map(c => [c.textContent?.replace('✓ ', ''), c.hasAttribute('data-met')]);
    expect(met).toEqual([['code complete', true], ['reviewed', false]]);
  });
});
