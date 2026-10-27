import { describe, it, expect, beforeEach } from 'vitest';
import { resetPreferences, ICON_RULES_KEY, SETTINGS_KEY } from '../src/storage';

describe('resetPreferences', () => {
  beforeEach(() => localStorage.clear());

  it('keeps icon rules, Open-With and terminal commands and excluded extensions', () => {
    const rules = JSON.stringify([{ pattern: '*.log', icon: 'x' }]);
    localStorage.setItem(ICON_RULES_KEY, rules);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      compactMode: true, openWithCmds: 'Code: code "$p"', terminalApp: 'custom', terminalCmd: 'cd "${p}"',
      excludedFileExtensions: ['pyc'], notesRoot: '/n',
    }));
    resetPreferences();
    expect(localStorage.getItem(ICON_RULES_KEY)).toBe(rules);
    const kept = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    expect(kept).toEqual({ openWithCmds: 'Code: code "$p"', terminalApp: 'custom', terminalCmd: 'cd "${p}"', excludedFileExtensions: ['pyc'], notesRoot: '/n' });
  });

  it('still resets a plain preference', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ compactMode: true }));
    localStorage.setItem('bfb-view', 'tiles');
    resetPreferences();
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull();
    expect(localStorage.getItem('bfb-view')).toBeNull();
  });
});
