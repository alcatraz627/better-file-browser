import { describe, it, expect } from 'vitest';
import { slowRegex } from '../src/slow-regex';
import { ruleFor } from '../src/icons';
import { matchesFind, textPatternError, EMPTY_FIND } from '../src/find';
import { RULE_SUGGESTIONS } from '../src/settings-ui';
import { DEFAULT_ICON_RULES } from '../src/storage';
import type { Entry, IconRule } from '../src/types';

describe('slowRegex', () => {
  it('flags a repeat inside a repeated group', () => {
    for (const p of ['^(a+)+$', '(a*)*', '(.*)*x', '(\\w+\\s?)+$', '(a+){2,}', '((a+))+', '(?:a+)+', '(a+)+?', '(a+){1,50}'])
      expect(slowRegex(p), p).toBe(true);
  });
  it('flags a repeated group whose choices start alike or can be empty', () => {
    for (const p of ['(a|aa)+$', '(a|a)*', '(x|)+', '(\\d|\\d\\d)+'])
      expect(slowRegex(p), p).toBe(true);
  });
  it('lets ordinary name patterns through', () => {
    for (const p of ['\\.md$', '^readme', '^\\.git(ignore|attributes|modules)?$', '\\.(test|spec)\\.[jt]sx?$', '(foo|bar)+', '^node_modules/$',
      '[(a+)+]+', '\\(a+\\)+', 'a+b+c*', '(ab)+', '(a+)?', '(a+){1}', '^.*\\.d\\.ts$', '(^claude\\.md$|\\.claude$)'])
      expect(slowRegex(p), p).toBe(false);
  });
  it('passes every rule bfb ships or suggests', () => {
    for (const r of [...DEFAULT_ICON_RULES, ...RULE_SUGGESTIONS]) expect(slowRegex(r.pattern), r.pattern).toBe(false);
  });
});

describe('the guard is wired where a typed pattern runs', () => {
  const rule = (pattern: string) => ({ id: 'x', pattern, label: 'X', color: '#fff', enabled: true }) as IconRule;
  it('an icon rule with a freezing pattern gives no icon, and the next rule still wins', () => {
    expect(ruleFor('aaa', false, [rule('^(a+)+$')])).toBe(-1);
    expect(ruleFor('aaa', false, [rule('^(a+)+$'), rule('^a')])).toBe(1);
  });
  it('Find by name matches nothing with a freezing pattern', () => {
    expect(matchesFind({ name: 'aaa' } as Entry, { ...EMPTY_FIND, name: '^(a+)+$', regex: true })).toBe(false);
    expect(matchesFind({ name: 'aaa' } as Entry, { ...EMPTY_FIND, name: '^a+$', regex: true })).toBe(true);
  });
  it('Find in text refuses a freezing pattern with a reason', () => {
    expect(textPatternError({ ...EMPTY_FIND, text: '(a+)+$', textRegex: true })).toMatch(/freeze/);
    expect(textPatternError({ ...EMPTY_FIND, text: 'a+$', textRegex: true })).toBe(null);
  });
});
