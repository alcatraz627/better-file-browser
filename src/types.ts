export interface Entry {
  name:     string;
  href:     string;
  isDir:    boolean;
  isParent: boolean;
  isHidden: boolean;
  rawBytes: number;
  dateMs:   number;   // epoch ms from the listing's data-value; NaN if unknown
  dateStr:  string;   // raw listing text, display fallback only
}

export interface Bookmark {
  path:  string;
  label: string;
}

export interface RecentDir {
  path: string;
  ts:   number;
}

// One saved folder in the sidebar. Bookmarks and My Places both became this.
export interface Place {
  path:  string;
  label: string;
  tags?: string[];
}

export interface Tag {
  name:  string;
  color: string;
}

export interface Settings {
  compactMode:  boolean;
  showSidebar:  boolean;
  dateFormat:   'short' | 'full';
  terminalApp:  string;
  terminalCmd:  string;
  aiModel?:     string;   // overrides the lm default model for AI queries (-m)
  notesRoot?:   string;   // absolute folder the Notes section reads and writes
  renderFilePages?: 'all' | 'not-md' | 'off';   // take over file:// text pages
  hideRecent?: boolean; hideFavorites?: boolean; hideSystem?: boolean;   // sidebar sections off
  clickOpens?: 'look' | 'go';        // a plain click on a file: the panel, or its page
  readerColumn?: boolean;            // file pages start in the reading column
  readerSize?: number;               // file page body size in px
  readerLineHeight?: number;
  readerCodeSize?: number;
  stripRestore?: boolean;            // bring a closed Chrome tab's strip back (default on)
  tooltips?: boolean;                // native title tooltips (default on)
}

// Where the Quick Look preview lives and how big the owner dragged it.
export interface PreviewLayout {
  mode:    'modal' | 'side';
  modalW?: number;
  modalH?: number;
  sideW?:  number;
}

export interface IconRule {
  id:      string;
  pattern: string;
  label:   string;
  color:   string;
  enabled: boolean;
}

export interface SortConfig {
  col: 'name' | 'size' | 'date' | 'type' | 'ext' | null;
  dir: 'asc' | 'desc';
}

export type GroupMode = 'none' | 'folders-first' | 'files-first' | 'ext' | 'type';

export interface FilterConfig {
  q:     string;
  regex: boolean;
  type:  string;
}

export interface Group {
  label: string;
  items: Entry[];
}

export interface TipData {
  icon:  string;
  name:  string;
  lines: string[];
  warn?: string;
}
