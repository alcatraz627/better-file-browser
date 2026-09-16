// What every module of the page shares: the page's identity, the live
// settings, and the hooks modules hand each other once they are mounted.
// main.ts creates it; the hooks start as no-ops and are replaced by the
// module that owns them.
import type { Settings, IconRule } from './types';
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
  toast: Toast;
  strip: Strip;
  filePage: FileContent | null;
  applyAll(): void;
  refreshSaved(): void;
  refreshNotes(): void;
  newNote(): void;
  openInTerminal(path: string): void;
  openHelp(tab?: string): void;
  openSettings(): void;
  goUp(): void;
}
