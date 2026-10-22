import { describe, it, expect } from 'vitest';
import { errorText, detailOf } from '../src/errors';

describe('errorText', () => {
  it('uses the words for a code with one cause, whatever the source said', () => {
    const err = Object.assign(new Error('stale mtime 123'), { code: 'notes_conflict' });
    expect(errorText(err, 'Saving')).toBe('The file changed on disk since it was opened. Reload it, then try again.');
  });

  it('keeps the host reason for a code the host reuses for many causes', () => {
    const err = Object.assign(new Error('the file is read-only'), { code: 'notes_bad_path' });
    expect(errorText(err, 'Opening it for editing')).toBe('Opening it for editing failed: the file is read-only');
  });

  it('gives the notes host its install step when it is missing', () => {
    expect(errorText({ code: 'unavailable', message: 'no reply' })).toMatch(/did not answer.*native\/install\.sh/);
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
