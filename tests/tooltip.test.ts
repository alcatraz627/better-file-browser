import { describe, it, expect } from 'vitest';
import { tipParts } from '../src/tooltip';

describe('tooltip text', () => {
  it('moves a key written into the text to the keys row', () => {
    expect(tipParts('Settings (press ,), theme, views, terminal, icon rules', [','])).toEqual({
      title: 'Settings', sub: 'theme, views, terminal, icon rules', keys: [','],
    });
  });
  it('splits on a new line, then on a middle dot', () => {
    expect(tipParts('/a/b\n1 jumps · click switches')).toEqual({ title: '/a/b', sub: '1 jumps · click switches', keys: [] });
    expect(tipParts('Close (w) · drag to reorder', ['w'])).toEqual({ title: 'Close', sub: 'drag to reorder', keys: ['w'] });
  });
  it('keeps a plain sentence whole', () => {
    expect(tipParts('Copy full file contents to clipboard').title).toBe('Copy full file contents to clipboard');
    expect(tipParts('Reads text files in this folder, or every subfolder').sub).toBe('');
  });
});
