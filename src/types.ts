export interface Entry {
  name:     string;
  href:     string;
  isDir:    boolean;
  isParent: boolean;
  isHidden: boolean;
  rawBytes: number;
  dateStr:  string;
}

export interface Bookmark {
  path:  string;
  label: string;
}

export interface Settings {
  compactMode:  boolean;
  showSidebar:  boolean;
  dateFormat:   'short' | 'full';
  terminalApp:  string;
  terminalCmd:  string;
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
