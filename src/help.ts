// User-facing help, one markdown document per Help tab, rendered via
// renderMarkdown to reuse the preview's .fe-md styling. Keep it accurate to the
// real features; it is the one doc users read in-product.
export interface HelpTab { key: string; label: string; hint: string; md: string }

export const HELP_TABS: HelpTab[] = [
  { key: 'keys', label: 'Keyboard', hint: 'every shortcut', md: `
| Key | Action |
|-----|--------|
| ↑ / ↓ | Move selection |
| Enter | Open |
| Backspace · ⌘↑ | Go to parent folder |
| Space | Preview selected file (Space again closes) |
| ⌘F | Focus the filter (again → browser find) |
| ⌘A | Select all |
| ⌘C | Copy selected path(s) |
| Esc | Close a dialog or the preview / clear the filter |
| ? · , | Open this Help · open Settings |
| t · w · p | Keep this folder or file as a tab · close it · pin it |
| [ · ] · 1-9 | Previous / next tab · jump to a tab (in a dialog: switch its tabs) |
| T (shift-t) | Reopen the last closed tab, at its place |
| n | New note (when a Notes folder is set) |
| r | Raw / rendered, on a file page |

Single-letter keys work when nothing is focused. Chrome owns ⌘T and ⌘W, so
the tab keys are bare letters.
` },
  { key: 'explorer', label: 'Explorer', hint: 'views, finding, opening', md: `
## Views & zoom

Switch layout from the toolbar: **Details** (table), **List** (compact),
**Tiles**, or **Large Icons**. Your choice is remembered. The **zoom** slider
(50–320%) scales the whole list.

The **≡** button at the top left shows or hides the sidebar, and dragging the
sidebar's right edge resizes it. To scale the whole interface, sidebar and text
included, set **Interface size** in **Settings → Appearance**.

## Finding files

- **Quick filter** — type in the **Filter…** box (top-right), or press **⌘F** to jump to it. Press **⌘F** again to fall through to Chrome's own find.
- **Text inside files** — open the **Filter** panel; the second row reads the text files the name and type fields allow (2 MB each at most) and keeps only the ones containing your words. Enter or **Run** starts it, **Cancel** stops it, and the results stay until you run again or clear the field. **Save view** keeps the folder plus these fields as a Saved row with a funnel icon; opening it brings the search back.
- **Deep search** — the folder button beside the filter box includes every subfolder. Names show their path from this folder, so **src/main.ts** matches **main**. The scan skips node_modules, .git and dot-folders (unless hidden files are shown), stops at 8 levels or 5000 items, and runs once per page.
- **Sort** — click a column header, or open the **Sort** panel to sort by name, size, type, extension, or modified date, and to **group** (folders-first, files-first, by extension, or by type).
- **Filter** panel — match names by text or regex, or show only folders / files / one extension.
- **Hidden files** — the eye button toggles dotfiles.

## Selecting & opening

- Click a file to look at it in the panel; the address bar stays put. Click a folder to go there. **Double-click** a file to open its page in this tab.
- **⌥-click** keeps a folder or file as a strip tab, in the background. **Middle-click** opens it in a new Chrome tab. Both work on sidebar rows and path segments too. A click on a sidebar row opens it as a strip tab, switching to the tab that already has it.
- **↑ / ↓** move the selection, **Enter** opens, **Backspace** or **⌘↑** goes up.
- **Multi-select**: **shift-click** or **⌘/Ctrl-click** toggles a row, **⇧⌘-click** selects a range, **⌘A** selects all. **⌘C** copies the selected paths.
- **Right-click** an item for Copy path, Copy name, Open in terminal — plus Preview for previewable files. With several items selected, the menu offers bulk Copy paths / Copy names.

## Breadcrumbs

Click any path segment to jump there. The **▾** next to a segment opens a
dropdown of that folder's contents with its own filter box — type to narrow,
**Enter** opens the first match.

## Terminal

The terminal button opens the current folder in your terminal. With the optional
native host it launches Ghostty directly; otherwise it copies a \`cd\` command to
your clipboard. Choose your terminal in **Settings → Terminal**.

## File pages

A file opened directly in the tab (markdown, code, json, jsonl, tsv/csv, txt)
renders like the preview instead of Chrome's plain text, inside the same
shell as a folder: the sidebar, the strip and the path bar stay where they
are. The main column shows a heading table of contents for markdown, **r**
for raw, a remembered scroll position, and a re-render whenever the file
changes on disk. **Settings → Files** can limit this to non-markdown files or
turn it off.
` },
  { key: 'preview', label: 'Preview and Notes', hint: 'panel, editor, AI', md: `
## File preview (Quick Look)

Click a file, or select it and press **Space**, to open a preview — **Space**
again, or **Esc**, closes it. **↑ / ↓** (or **← / →**) step between previewable
files; the **copy** button copies the raw contents. Files over 8 MB ask before
loading.

The preview is a floating window by default; drag its bottom-right corner to
resize it. The dock button in its header moves it to a **side panel** next to
the listing, where the left edge drags to set the width. Both the choice and
the sizes are remembered.

The file name in the preview header, **open raw**, and every link inside a
rendered markdown file open in a **new tab**, so the explorer stays put.

Renders by type:

| Type | Shown as |
|------|----------|
| Code (\`.sh\`, \`.ts\`, \`.py\`, \`.go\`, \`.rs\`, \`.sql\`, \`.yaml\`, …) | Syntax-highlighted, with line numbers |
| \`.tsv\` / \`.csv\` | Sortable table (numeric columns detected) |
| \`.json\` / \`.jsonl\` | Collapsible tree |
| \`.md\` / \`.mdx\` | Rendered markdown (relative images/links resolved) |
| Images | Fit-to-view, with pixel dimensions |
| PDF · audio/video · fonts | Embedded viewer / player / glyph specimen |
| Plain text & extensionless (\`.txt\`, \`.log\`, \`LICENSE\`, \`Makefile\`) | Plain text with line numbers |

## Notes

Set a **Notes folder** in **Settings → Notes** and a Notes section lists its
\`.md\` files newest first. **n** or **+** starts a note. The panel becomes an
editor with the source on the left and the render on the right: a toolbar for
bold, italic, code, lists, tasks, tables and images; ⌥↑↓ moves lines and
⌥⇧↑↓ duplicates them; Tab indents; Enter continues a list; a pasted or
dropped image is saved under \`attachments/\`. **⌘S** saves, a pause autosaves,
and an untitled note takes its first heading as its file name. Rename by
double-click; ✕ moves the note into \`.trash/\`. The folder is plain markdown
that Obsidian and any markdown tool can read.

## AI assistant (optional)

If you have the local-models **\`lm\`** CLI and its native host installed, the
preview gains an **AI bar**: **Summarize**, **Explain** (**Describe** for tables),
and an **Ask** box. Answers stream in; closing the overlay cancels them.

Pick the model and toggle **Keep warm** in **Settings → AI**. It's fully local —
nothing is sent anywhere. Without the CLI installed, the bar simply doesn't
appear and everything else works normally.
` },
  { key: 'tabs', label: 'Tabs and Saved', hint: 'open now, kept for later', md: `
## Tabs

The strip above the toolbar is the working set of this Chrome tab: folders
and files, kept through refresh and navigation, gone when the Chrome tab
closes. Open the same folder again within a day and the strip comes back with
an undo. After a Chrome crash, Chrome's own session restore brings the strip
back with the tab. The place you are in shows as an italic tab until you keep it: press
**t** or double-click it. **w** closes the current tab, **p** pins it (pinned
tabs sit first and have no ✕), **[** and **]** move between tabs, **1** to
**9** jump. **Shift-T** reopens the last closed tab at its place. Drag to
reorder. **Middle-click** a tab to close it (pinned tabs stay). Hover a tab
for **…**: copy path, save, pin, close, close others.
Navigation is real, so the address bar is always the active tab's location.

## Saved

One list of your folders, files and saved views. A click opens the row as a
strip tab, or switches to the tab that already has it; **⌥-click** keeps it
in the background. The ★ in the path bar saves or unsaves the current
folder; **+** saves it and opens the name for editing.
**Double-click** a label to rename, drag to reorder, ✕ to remove. Hover a row
and press **#** to type tags (comma separated); tagged rows group under their
first tag, and clicking the coloured dot on a tag heading changes its colour.
The filter box at the top matches label, path and tag; Esc clears it. Old
Bookmarks and My Places entries were merged in.

Tabs are what is open right now; Saved is the long-term list, the way browser
tabs sit above browser bookmarks.

## Recent, Finder Favorites, System

Folders you visited lately, and quick jumps (Root, Home, …).
` },
  { key: 'how', label: 'How it works', hint: 'the model, storage, what runs where', md: `
## The model

Four things, three actions, one key each. Learn the three actions once and
every surface behaves the same way.

- **Place** is a folder. It lives in tabs (open now), in Saved (kept), and in
  Recent, Finder Favorites and System.
- **File** is something inside a folder, shown in the listing and in search
  results.
- **Note** is a file you write here, in the Notes section, which is a Place you
  write in.
- **View** is how a Place is shown: its sort, group, filter and layout.

- **Go** (Enter, or a click) moves to a thing. A Place navigates, a File opens
  natively, a Note opens in the editor, a tab switches.
- **Look** (Space) sees a thing without leaving. A File previews, a Note reads
  in the panel. Space again stops looking.
- **Keep** (★ or **+**, and **t** for the open Place) makes a thing stay. A
  Place joins Saved, the open Place becomes a tab, a Note saves with **⌘S**.

Tabs are what is open right now; Saved is the long-term list, the way browser
tabs sit above browser bookmarks.

## Where your state lives

Everything is stored on your machine, in the browser, and nothing leaves it.

- **Settings, the Saved list, tags, view, theme and reader sizes** live in
  localStorage under \`bfb-\` keys. Settings and Saved export and import as one
  JSON file in **Settings → Data**.
- **The tab strip** lives in sessionStorage, so it belongs to one Chrome tab and
  survives refresh and navigation. A copy in \`chrome.storage.local\`, keyed by a
  per-tab id, lets a fresh Chrome tab bring back a strip closed within the last
  day, with an undo.
- **Reading choices** (the column toggle, the ToC, a file page's scroll
  position) live in localStorage, so they persist across reloads.

## What runs where

- The extension replaces Chrome's plain file listing with this UI. No page is
  fetched from a server.
- Reading a file for a preview or a file page goes through the extension's
  background worker, because a page cannot read \`file://\` URLs on its own.
- The terminal button, the notes editor and the AI bar use optional native
  hosts you install once. Without them the terminal button copies a command and
  the AI bar does not appear; notes need their host to write files.

## What you can do

Browse and open in four views with zoom. Preview any file type in a floating or
docked panel, or open a file directly as a rendered page with a table of
contents. Keep folders and files as tabs and as Saved bookmarks with tags.
Write notes in a live editor. Filter by name or regex, search the text inside
files, and search every subfolder. Save a search as a reusable view. Every
action is on the keyboard; press **?** for the full list.
` },
  { key: 'reference', label: 'Reference', hint: 'keys, gestures, how it fits', md: `
Single-letter keys work only when no text field is focused and no dialog is open.
⌘ / Ctrl and middle clicks reach the browser, except on rows where ⌘ and ⇧ select.
**Esc** closes the topmost overlay (a menu, then a dialog, then the preview), and
clears the filter box when it has focus.

## Listing keys

| Key | Action |
|-----|--------|
| ↑ ↓ | move the selection |
| Enter | open the selection |
| Space | preview the selection (a toast on a folder) |
| Backspace · ⌘↑ | parent folder |
| ⌘A · ⌘C | select all · copy the selected paths |
| ⌘F | focus the filter; again falls through to the browser's find |
| ? · , | open Help · open Settings |
| n · r | new note (with a Notes folder) · raw or rendered (file page) |
| t · w · p | keep · close · pin the current tab |
| T | reopen the last closed tab |
| [ · ] · 1-9 | previous · next · jump to a tab |

## Listing rows and tiles

A click on a file opens it in the panel with the address unchanged, but only when
the file is previewable and "Click on a file" is set to look (the default). A
non-previewable file, or the go setting, navigates. A folder always navigates.

| Gesture | Action |
|---------|--------|
| double-click | go to the file page |
| ⌥-click | keep as a background tab |
| middle-click | browser tab |
| ⇧ / ⌘-click · ⇧⌘-click | toggle in the selection · range |
| right-click | Preview, Copy path, Copy name, Open in terminal |
| hover | a tip, plus a separate eye (preview) and copy buttons |

## Strip tabs

| Gesture | Action |
|---------|--------|
| click | switch (kept or pinned); a temporary tab does nothing |
| double-click | keep a temporary tab |
| middle-click | close a kept tab; pinned and temporary stay |
| ⌘ / ⇧-click | browser tab or window |
| drag | reorder within the pinned or unpinned block |
| hover … · hover ✕ | menu (copy, save, pin, close, close others) · close |

## Sidebar

| Gesture | Action |
|---------|--------|
| click | open as a strip tab (or the editor for a note) and go |
| double-click | rename |
| ⌥-click | keep a background tab |
| middle / ⌘-click | browser tab |
| hover # · hover ✕ | tags · remove, or a note to trash |
| drag · tag dot | reorder · cycle the colour |

## Path bar and toolbar

≡ shows or hides the sidebar, and its right edge drags to resize. A crumb goes;
its ▾ opens a dropdown you can type to narrow. ★ saves the place. The terminal
button opens here, and ⇧-click copies the command. The rest: theme, Help, Settings,
the four views, Sort, Filter, hidden files, and a zoom slider that scales the list.

## Preview panel

| Gesture or key | Action |
|----------------|--------|
| scrim · ✕ · Esc · Space | close |
| ↑ ↓ ← → | previous, next previewable file |
| open · Enter | go to the file page |
| + tab · t | keep as a background strip tab |
| copy | copy the whole file |
| dock · grips | float or dock to the side · resize |
| header name · open raw · links | new browser tab |

The strip keys still work while the preview is open. A file over 8 MB asks before
loading. With a local model installed, an AI bar adds Summarize, Explain, and Ask.

## Notes editor

⌘S saves (a pause autosaves). ⌘B, ⌘I, ⌘E are bold, italic, code. ⌥↑↓ move a line
and ⌥⇧↑↓ duplicate it. Tab and ⇧Tab indent. Enter continues a list. ⌘Z and ⌘⇧Z (or
⌘Y) undo and redo. The toolbar adds list, task, table, and image, which have no
key. **open** and **+ tab** act on the note.

## File page

**r** toggles raw, a copy button, and ToC links jump. Backspace or ⌘↑ go to the
folder, and ⌘F uses the browser's find. Two buttons toggle a table-of-contents
rail and an 80-character reading column. The page reloads itself every couple of
seconds and re-renders when the file changes on disk.

## How the parts fit

- The address bar is always the active tab's location; navigation is real.
- A listing click looks or goes by the "Click on a file" setting; a sidebar click
  always goes; ⌥ keeps a background tab in both.
- A file page is the explorer with the file in the main column, so nothing moves.
- The folder you are in is a temporary (italic) tab until you keep it; leaving an
  unkept folder drops its tab.
- A dialog over the preview takes Esc first, then the preview; focus returns.
- Reader size affects the file page and the preview; Interface size scales the
  whole interface on top of the list zoom.

## Good to know

- Many controls are mouse-only: the sort, filter, view, hidden, zoom, theme, and
  terminal controls, the sidebar, and rename have no key, and the context menu is
  right-click only.
- The toast message is always dark, in both themes.
- A filename containing a # can confuse tab navigation.
- Dragging reorders tabs and saved rows; it does not move or copy files.
` },
];
