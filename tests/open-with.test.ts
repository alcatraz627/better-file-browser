import { describe, it, expect } from 'vitest';
import { parseCommands, openWithItems, DEFAULT_COMMANDS } from '../src/open-with';

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
  it('keeps a command marked (files) off folders, by its place in the list', () => {
    const cmds = parseCommands('Print (files): cat\nAdd: & code --add');
    expect(cmds[0]).toEqual({ name: 'Print', cmd: 'cat', terminal: true, filesOnly: true });
    expect(openWithItems(cmds, true)).not.toContain('Print');
    expect(openWithItems(cmds, true)).toContain('data-act="ow:#1"');
    expect(openWithItems(cmds, false)).toContain('Print');
  });
  it('reads the old default as today\'s', () => {
    expect(parseCommands('Show contents: cat\nRun with bash: bash\nAdd to VS Code: & code --add').map(c => !!c.filesOnly)).toEqual([true, true, false]);
  });
  it('offers cat, bash and code --add until Settings says otherwise', () => {
    expect(parseCommands(undefined).map(c => c.cmd)).toEqual(['cat', 'bash', 'code --add']);
    expect(parseCommands(DEFAULT_COMMANDS)).toHaveLength(3);
    expect(parseCommands('')).toEqual([]);
  });
});
