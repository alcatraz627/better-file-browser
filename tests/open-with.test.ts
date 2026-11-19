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
  it('skips a damaged stored row instead of failing', () => {
    expect(ownCommands({ openWith: [null, { name: 3 }, { cmd: 'ls' }, { name: 'Ok', cmd: 'cat' }] as never }).map(c => c.name)).toEqual(['Ok']);
    expect(ownCommands({ openWith: 'junk' as never, openWithCmds: 'A: ls' }).map(c => c.name)).toEqual(['A']);
  });
  it('catches a trailing backslash and a # comment, and reads zsh $-quotes', () => {
    const row = (cmd: string) => ({ name: 'A', cmd });
    expect(commandProblem(row('foo \\'))).toBe('Ends in a backslash');
    expect(commandProblem(row('cat # note'))).toMatch(/comment/);
    expect(commandProblem(row("echo $'a\\'b'"))).toBe('');
    expect(commandProblem(row('echo a#b'))).toBe('');
  });
  it('lists a repeated name once, and reads a damaged older setting as missing', () => {
    const rows = [{ name: 'Go', cmd: 'cat', terminal: true }, { name: 'go ', cmd: 'ls', terminal: true }];
    expect(ownCommands({ openWith: rows }).map(c => c.cmd)).toEqual(['cat']);
    expect(parseCommands(5).map(c => c.cmd)).toEqual(['cat', 'bash', 'code --add']);
  });
});
