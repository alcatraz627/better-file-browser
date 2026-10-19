import { describe, it, expect } from 'vitest';
import { editableRoot } from '../src/file-editor';

describe('editableRoot', () => {
  const home = '/Users/me';
  it('finds the allowed folder holding a file, with ~ and trailing slashes', () => {
    expect(editableRoot('/Users/me/Code/app/a.md', ['~/Code/'], home)).toBe('/Users/me/Code');
    expect(editableRoot('/srv/x/y.yaml', [' /srv/x '], home)).toBe('/srv/x');
  });
  it('refuses a file outside every allowed folder, or a sibling sharing a prefix', () => {
    expect(editableRoot('/Users/me/Codex/a.md', ['~/Code'], home)).toBeNull();
    expect(editableRoot('/Users/me/a.md', [], home)).toBeNull();
    expect(editableRoot('/Users/me/a.md', undefined, home)).toBeNull();
  });
});
