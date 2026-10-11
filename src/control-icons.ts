const svg = (body: string) => `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const UI_ICON = {
  appearance: svg('<circle cx="7" cy="7" r="2.5"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1.1 1.1m6.2 6.2 1.1 1.1m0-8.4-1.1 1.1m-6.2 6.2-1.1 1.1"/>'),
  preview: svg('<rect x="1.5" y="2" width="11" height="10" rx="1.5"/><path d="M8 2v10"/>'),
  files: svg('<path d="M3 1.5h5l3 3V12H3z"/><path d="M8 1.5v3h3M5 7h4M5 9h4"/>'),
  exclusions: svg('<path d="M7 1l5 2v3.5c0 3-2 5-5 6.5-3-1.5-5-3.5-5-6.5V3z"/><path d="M5 7h4"/>'),
  notes: svg('<path d="M2 2h10v10H2zM4 5h6M4 7h6M4 9h4"/>'),
  tab: svg('<path d="M1.5 3h4l1.2 1.5h5.8v7H1.5z"/><path d="M8.5 7.5v3M7 9h3"/>'),
  terminal: svg('<rect x="1" y="2" width="12" height="10" rx="1.5"/><path d="m3.5 5 2 2-2 2M7 9h3"/>'),
  data: svg('<ellipse cx="7" cy="3" rx="5" ry="2"/><path d="M2 3v7c0 1.1 2.2 2 5 2s5-.9 5-2V3M2 6.5c0 1.1 2.2 2 5 2s5-.9 5-2"/>'),
  ai: svg('<path d="M7 1.5 8.2 5.8 12.5 7l-4.3 1.2L7 12.5 5.8 8.2 1.5 7l4.3-1.2z"/>'),
  keyboard: svg('<rect x="1" y="3" width="12" height="8" rx="1.5"/><path d="M3 5h.5M5.5 5H6M8 5h.5M10.5 5h.5M3 7.5h.5M5.5 7.5H6M8 7.5h.5M10.5 7.5h.5M4.5 9h5"/>'),
  reset: svg('<path d="M2.5 5A5 5 0 1 1 2 8M2.5 2.5V5H5"/>'),
  add: svg('<path d="M7 2v10M2 7h10"/>'),
  export: svg('<path d="M7 1.5v7m-2.5-2.5L7 8.5 9.5 6M2 10v2h10v-2"/>'),
  import: svg('<path d="M7 9V2m-2.5 2.5L7 2l2.5 2.5M2 10v2h10v-2"/>'),
  warm: svg('<path d="M7 1.5c1 2-1 2.7-.5 4 1-1 1.8-1.2 2-2 .5 2 3 3.1 3 5.1A4.5 4.5 0 0 1 7 13a4.5 4.5 0 0 1-4.5-4.4c0-2 1.4-3.8 3-4.8-.2 1.2.2 1.8.6 2.2C7 4.5 6 3.5 7 1.5z"/>'),
  unload: svg('<path d="M7 1v12M2 4l10 6M2 10l10-6M4.5 2.5 7 4l2.5-1.5M4.5 11.5 7 10l2.5 1.5"/>'),
  close: svg('<path d="m3 3 8 8M11 3l-8 8"/>'),
  // the notes editor's toolbar and header (owner: an icon left of the text on every button)
  list: svg('<path d="M5 3.5h7M5 7h7M5 10.5h7"/><circle cx="2.5" cy="3.5" r=".6"/><circle cx="2.5" cy="7" r=".6"/><circle cx="2.5" cy="10.5" r=".6"/>'),
  task: svg('<rect x="1.5" y="2" width="4" height="4" rx=".8"/><path d="m2.5 4 1 1 1.5-2M7.5 4h5M1.5 9h4v3h-4zM7.5 10.5h5"/>'),
  table: svg('<rect x="1.5" y="2.5" width="11" height="9" rx="1"/><path d="M1.5 5.5h11M5.5 2.5v9M9 2.5v9"/>'),
  image: svg('<rect x="1.5" y="2.5" width="11" height="9" rx="1"/><circle cx="5" cy="5.5" r="1"/><path d="m1.5 10 3.5-3 3 2.5 2-1.5 2.5 2"/>'),
  versions: svg('<path d="M2.5 5A5 5 0 1 1 2 8M2.5 2.5V5H5M7 4.5V7l2 1.5"/>'),
  external: svg('<path d="M8 2h4v4M12 2 6.5 7.5M10 8.5V12H2V4h3.5"/>'),
};
