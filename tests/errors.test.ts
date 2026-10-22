import { describe, it, expect } from 'vitest';
import { errorText, detailOf } from '../src/errors';

describe('errorText', () => {
  it('uses the words for a known code, whatever the source said', () => {
    const err = Object.assign(new Error('EACCES: permission denied, open'), { code: 'notes_io' });
    expect(errorText(err, 'Saving')).toBe('The note could not be read or written.');
  });

  it('gives the notes host its install step when it is missing', () => {
    expect(errorText({ code: 'unavailable', message: 'no reply' })).toContain('native/install.sh');
  });

  it('keeps an unknown failure\'s own words behind what was being done', () => {
    expect(errorText(new Error('disk full'), 'Copying the image')).toBe('Copying the image failed: disk full');
  });

  it('reads a plain result object or a string', () => {
    expect(errorText({ ok: false, message: 'timed out' }, 'Warming the model')).toBe('Warming the model failed: timed out');
    expect(errorText('broken')).toBe('That did not work: broken');
  });

  it('says something even with nothing to go on', () => {
    expect(errorText(undefined, 'Saving')).toBe('Saving failed.');
    expect(errorText(null)).toBe('That did not work.');
  });

  it('a timed-out match reads as a search to narrow', () => {
    const err = Object.assign(new Error('Name regex timed out'), { code: 'match-timeout' });
    expect(errorText(err)).toMatch(/took too long/);
  });

  it('detailOf returns a parser\'s own words', () => {
    expect(detailOf(new SyntaxError('Unexpected token } in JSON'))).toBe('Unexpected token } in JSON');
  });
});
