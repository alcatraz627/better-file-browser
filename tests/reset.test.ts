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

  it('reads an old Compact choice once into the Detail scale', async () => {
    const { takeCompactMode, densityPref } = await import('../src/storage');
    const s: { compactMode?: boolean } = { compactMode: true };
    expect(takeCompactMode(s as never)).toBe(true);
    expect(densityPref.get()).toBe(4);
    expect('compactMode' in s).toBe(false);
    expect(takeCompactMode(s as never)).toBe(false);
    densityPref.set(5);
    expect(takeCompactMode({ compactMode: true } as never)).toBe(true);
    expect(densityPref.get()).toBe(5);
    densityPref.set(2);
    expect(takeCompactMode({ compactMode: false } as never)).toBe(true);
    expect(densityPref.get()).toBe(2);
  });
});
