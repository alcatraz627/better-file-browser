// What every module of the page shares: the page's identity, the live
// settings, and the hooks modules hand each other once they are mounted.
// main.ts creates it; the hooks start as no-ops and are replaced by the
// module that owns them.
import type { Settings, IconRule, SortConfig, GroupMode } from './types';
import type { Toast } from './toast';
import type { Strip } from './strip';
import type { FileContent } from './file-page';

export interface App {
  fileMode: boolean;
  rawPath: string;      // this page's decoded path; a folder's ends with /
  folderPath: string;   // the folder this page belongs to, the path itself for a listing
  fileName: string;
  fe: HTMLElement;
  settings: Settings;   // one live object, mutated in place and saved
  iconRules: IconRule[];
  entryNames: string[];   // names in this folder's listing, for rule match counts
  toast: Toast;
  strip: Strip;
  filePage: FileContent | null;
  applyAll(): void;
  // Change the order every folder uses, and re-sort this one.
  setOrder(sort: SortConfig, group: GroupMode): void;
  refreshSaved(): void;
  refreshNotes(): void;
  newNote(): void;
  pickNotesFolder(): void;
  openInTerminal(path: string): void;
  openHelp(tab?: string): void;
  openSettings(tab?: string): void;
  // Switch the sidebar to a lens (null keeps the current one); hideHistory
  // removes or restores the History lens's rail button.
  showLens?(lens: string | null, hideHistory?: boolean): void;
  /** Whether a Saved or Notes row can be moved one place with the keyboard (not while a filter hides part of its list). */
  canMoveRow?(row: HTMLElement): boolean;
  /** Move a Saved or Notes row one place up (-1) or down (1) and keep the keyboard on it. */
  moveRow?(row: HTMLElement, dir: 1 | -1): void;
  /** Close the sidebar shown over the page in a narrow window; true when it was open. */
  closeSideOverlay?(): boolean;
  goUp(): void;
}
