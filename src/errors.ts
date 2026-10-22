// The words a person reads when something fails, chosen by the failure's code
// so they do not depend on how a host, a library or the browser phrased it.
// A failure with no known code keeps its own words after a short lead, so
// nothing is lost while it waits for a code of its own.

/** A failure as the page sees it: a stable code, and the source's own words. */
export interface AppError { code: string; message?: string }

// The notes host's codes (native/), and the page's own.
const WORDS: Record<string, string> = {
  unavailable:      'The notes host is not installed. Run native/install.sh, then reload.',
  notes_host:       'The notes host stopped unexpectedly. Reload the page to start it again.',
  notes_bad_root:   'The notes folder is not set, or is not a folder. Pick it in Settings.',
  notes_bad_path:   'That name or place cannot be used for a note.',
  notes_missing:    'That note is not there any more; it may have been moved or deleted.',
  notes_exists:     'A note with that name already exists.',
  notes_conflict:   'The note changed on disk since it was opened. Reload it, then try again.',
  notes_io:         'The note could not be read or written.',
  notes_too_big:    'That note is too large to open here.',
  notes_bad_op:     'The notes host did not understand the request. Update the host with native/install.sh.',
  'read-failed':    'The file could not be read.',
  'write-failed':   'The change could not be saved.',
  'match-timeout':  'The search took too long. Narrow it and try again.',
};

const codeOf = (err: unknown): string => (err && typeof err === 'object' && typeof (err as AppError).code === 'string') ? (err as AppError).code : '';
const wordsOf = (err: unknown): string => err instanceof Error ? err.message : typeof err === 'string' ? err : (err as AppError | null)?.message ?? '';

/** A parser's own words, for a finding where those words are the finding (a JSON syntax error). */
export const detailOf = (err: unknown): string => wordsOf(err);

/**
 * What to tell the person about a failure. `doing` names what they were doing
 * ("Renaming the note") and leads an unknown failure's own words.
 */
export function errorText(err: unknown, doing = ''): string {
  const known = WORDS[codeOf(err)];
  if (known) return known;
  const own = wordsOf(err).trim();
  const lead = doing ? `${doing} failed` : 'That did not work';
  return own ? `${lead}: ${own}` : `${lead}.`;
}
