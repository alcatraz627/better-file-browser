// Where a decision page reads its files and sends its answer work. In the
// extension that is file:// through the worker and gcc's command through the
// notes host; the web build of the page (dp-web.ts) swaps in plain http
// against gcc's page server, so one page draws the same in both places.
import { fetchFileText, fileExists } from './file-fetch';
import { notes } from './notes';

export type DpVerb = 'compose' | 'submit' | 'seen' | 'parse';
export interface DpIo {
  /** A file of the page as text; throws when it cannot be read. */
  text: (url: string) => Promise<string>;
  /** Whether a file of the page is there, without an error when it is not. */
  exists: (url: string) => Promise<boolean>;
  /**
   * gcc's answer work: compose resolves {answer}, parse the picks in gcc's
   * shape, submit the server's reply with how the asker was told as notify.
   * A refusal rejects with a code: dp_conflict, dp_unavailable or dp_failed.
   */
  dp: (verb: DpVerb, slug: string, payload?: unknown) => Promise<unknown>;
  /** Where gcc's page server is, for links to its boards: its loopback address in the extension, '' (this origin) on the web. */
  server: string;
}

let io: DpIo = { text: url => fetchFileText(url), exists: fileExists, dp: notes.dp, server: 'http://127.0.0.1:5106' };

export const dpIo = (): DpIo => io;
/** Replace where the page reads and sends; the web build calls this once before drawing. */
export function setDpIo(next: DpIo): void { io = next; }
