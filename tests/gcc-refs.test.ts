import { describe, it, expect } from 'vitest';
import { refOf, cardFacts } from '../src/gcc-refs';

const skills = new Set(['probe', 'plan']);

describe('gcc references', () => {
  it('names rules, features and conventions by path, with or without .md', () => {
    expect(refOf('rules/shell.md', skills)).toEqual({ kind: 'rule', rel: 'rules/shell.md' });
    expect(refOf('rules/shell', skills)).toEqual({ kind: 'rule', rel: 'rules/shell.md' });
    expect(refOf('~/.claude/features/wal.md', skills)).toEqual({ kind: 'feature', rel: 'features/wal.md' });
    expect(refOf('conventions/pages.md', skills)?.kind).toBe('convention');
  });

  it('names a skill by its folder or by /name only when the skill exists', () => {
    expect(refOf('skills/probe', skills)).toEqual({ kind: 'skill', rel: 'skills/probe/SKILL.md' });
    expect(refOf('/probe', skills)).toEqual({ kind: 'skill', rel: 'skills/probe/SKILL.md' });
    expect(refOf('/tmp', skills)).toBeNull();
    expect(refOf('scripts/x.sh', skills)).toBeNull();
    expect(refOf('plain words', skills)).toBeNull();
  });

  it('reads a card from front matter, or from the first heading and paragraph', () => {
    const skill = '---\nname: probe\ndescription: Isolates the mechanism first.\nargument-hint: "<the symptom>"\n---\n\n## Brief\n';
    expect(cardFacts(skill)).toEqual({ name: 'probe', about: 'Isolates the mechanism first.', triggers: [], hint: '<the symptom>', updated: undefined });
    const rule = '---\nbrief: One command per call\ntriggers:\n  - topic:shell\n  - tool:rm\n---\n# Shell\n';
    expect(cardFacts(rule)).toMatchObject({ name: 'Shell', about: 'One command per call', triggers: ['topic:shell', 'tool:rm'] });
    expect(cardFacts('# Title\n\nFirst line\nof the intro.\n\nMore.')).toMatchObject({ name: 'Title', about: 'First line of the intro.' });
  });
});
