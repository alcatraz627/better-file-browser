import { describe, it, expect } from 'vitest';
import { parseCommands, openWithItems, ownCommands, commandProblem, DEFAULT_COMMANDS } from '../src/open-with';

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

describe('open with: commands as Settings rows', () => {
  const row = (name: string, cmd: string, extra = {}) => ({ name, cmd, terminal: true, ...extra });
  it('reads the rows once saved, and the older text until then', () => {
    expect(ownCommands({ openWithCmds: 'Show: cat' }).map(c => c.name)).toEqual(['Show']);
    expect(ownCommands({ openWithCmds: 'Show: cat', openWith: [row('Edit', 'code', { color: '#ff6b6b' })] })).toEqual([row('Edit', 'code', { color: '#ff6b6b' })]);
    expect(ownCommands({ openWith: [] })).toEqual([]);
  });
  it('leaves a row that cannot run out of the menu', () => {
    expect(ownCommands({ openWith: [row('', 'cat'), row('Half', ''), row('Quote', "echo 'x"), row('Ok', 'cat')] }).map(c => c.name)).toEqual(['Ok']);
  });
  it('says what is wrong with a command in a few words', () => {
    expect(commandProblem(row('A', 'cat'))).toBe('');
    expect(commandProblem(row('', 'cat'))).toBe('Needs a name');
    expect(commandProblem(row('A', '  '))).toBe('Needs a command');
    expect(commandProblem(row('A', 'cat\nls'))).toBe('Keep it to one line');
    expect(commandProblem(row('A', '& code'))).toMatch(/Window switch/);
    expect(commandProblem(row('A', 'cat'), [row('a', 'ls')])).toMatch(/name/);
    expect(commandProblem(row('A', 'echo "it\'s'))).toBe('A quote is left open');
    expect(commandProblem(row('A', 'echo "it\'s"'))).toBe('');
    expect(commandProblem(row('A', 'echo \\"x'))).toBe('');
    expect(commandProblem(row('A', 'cat |'))).toMatch(/path is lost/);
  });
  it('shows a command\'s colour as a dot in the menu, else the terminal icon', () => {
    const html = openWithItems([row('Red', 'cat', { color: '#ff6b6b' }), row('Plain', 'ls')]);
    expect(html).toContain('fe-ow-dot');
    expect(html.match(/fe-ow-dot/g)).toHaveLength(1);
    expect(openWithItems([row('Bad', 'cat', { color: 'red;background:url(x)' })])).not.toContain('url(x)');
  });
});
