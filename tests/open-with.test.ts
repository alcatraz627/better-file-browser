import { describe, it, expect } from 'vitest';
import { parseCommands, DEFAULT_COMMANDS } from '../src/open-with';

describe('open with: the person\'s own commands', () => {
  it('reads Name: command lines; & runs one without a window', () => {
    expect(parseCommands('Show: cat\nAdd: & code --add')).toEqual([
      { name: 'Show', cmd: 'cat', terminal: true },
      { name: 'Add', cmd: 'code --add', terminal: false },
    ]);
  });
  it('skips lines without a name or a command, and blank lines', () => {
    expect(parseCommands('cat\n: ls\nName:\n\n  Ok: bash  ')).toEqual([{ name: 'Ok', cmd: 'bash', terminal: true }]);
  });
  it('offers cat, bash and code --add until Settings says otherwise', () => {
    expect(parseCommands(undefined).map(c => c.cmd)).toEqual(['cat', 'bash', 'code --add']);
    expect(parseCommands(DEFAULT_COMMANDS)).toHaveLength(3);
    expect(parseCommands('')).toEqual([]);
  });
});
