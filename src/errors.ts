// The words a person reads when something fails, chosen by the failure's code
// so they do not depend on how a host, a library or the browser phrased it.
// A failure with no known code keeps its own words after a short lead, so
// nothing is lost while it waits for a code of its own.

/** A failure as the page sees it: a stable code, and the source's own words. */
export interface AppError { code: string; message?: string }

// Codes whose cause is always the same get fixed words. The notes host (native/)
// reuses its other codes (notes_bad_path, notes_io, notes_exists, notes_too_big,
// notes_bad_op, notes_bad_root) for many causes, so those keep the host's own
// reason, which it writes for people, behind what was being done.
const WORDS: Record<string, string> = {
  unavailable:      'The notes host did not answer. If it is new, run native/install.sh, then reload.',
  notes_missing:    'That file is not there any more; it may have been moved or deleted.',
  notes_conflict:   'The file changed on disk since it was opened. Reload it, then try again.',
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
