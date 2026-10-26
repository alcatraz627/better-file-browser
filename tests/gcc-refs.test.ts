import { describe, it, expect } from 'vitest';
import { refOf, refsIn, cardFacts, scriptFacts } from '../src/gcc-refs';

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
    expect(refOf('scripts/x', skills)).toBeNull();
    expect(refOf('plain words', skills)).toBeNull();
  });

  it('names a script by its extension, from ~ or the absolute home path', () => {
    expect(refOf('scripts/wal/wal.sh', skills)).toEqual({ kind: 'script', rel: 'scripts/wal/wal.sh' });
    expect(refOf('/Users/me/.claude/scripts/emit-event.sh', skills)).toEqual({ kind: 'script', rel: 'scripts/emit-event.sh' });
    expect(refOf('scripts/data.json', skills)).toBeNull();
  });

  it('finds the references inside a hook command and leaves the rest of the text', () => {
    const cmd = 'bash ~/.claude/scripts/emit-event.sh Notification --from rules/shell.md, then /tmp/x';
    const hits = refsIn(cmd, skills);
    expect(hits.map(h => cmd.slice(h.start, h.end))).toEqual(['~/.claude/scripts/emit-event.sh', 'rules/shell.md']);
    expect(hits.map(h => h.ref.kind)).toEqual(['script', 'rule']);
    expect(refsIn('python3 /Users/me/Code/x/hooks/ask.py', skills)).toEqual([]);
    expect(refsIn('myscripts/x.sh', skills)).toEqual([]);
  });

  it('reads a script card from its top comment block or docstring', () => {
    const sh = '#!/usr/bin/env bash\n# FileChanged hook: notify on change\n# Filters own edits\nset -u\n# later\n';
    expect(scriptFacts(sh, 'scripts/file-changed.sh')).toEqual({ name: 'file-changed.sh', about: 'FileChanged hook: notify on change Filters own edits', triggers: [] });
    const py = '#!/usr/bin/env python3\n"""Prune the log.\n\nKeeps two sessions."""\nimport os\n';
    expect(scriptFacts(py, 'scripts/p.py').about).toBe('Prune the log. Keeps two sessions.');
    expect(scriptFacts('echo hi\n', 'scripts/a.sh').about).toBeUndefined();
  });

  it('reads a card from front matter, or from the first heading and paragraph', () => {
    const skill = '---\nname: probe\ndescription: Isolates the mechanism first.\nargument-hint: "<the symptom>"\n---\n\n## Brief\n';
    expect(cardFacts(skill)).toEqual({ name: 'probe', about: 'Isolates the mechanism first.', triggers: [], hint: '<the symptom>', updated: undefined });
    const rule = '---\nbrief: One command per call\ntriggers:\n  - topic:shell\n  - tool:rm\n---\n# Shell\n';
    expect(cardFacts(rule)).toMatchObject({ name: 'Shell', about: 'One command per call', triggers: ['topic:shell', 'tool:rm'] });
    expect(cardFacts('# Title\n\nFirst line\nof the intro.\n\nMore.')).toMatchObject({ name: 'Title', about: 'First line of the intro.' });
  });
});
