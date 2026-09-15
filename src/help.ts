// User-facing help, one markdown document per tab of the Help dialog,
// rendered through renderMarkdown so it reuses the preview's .fe-md styling.
// Keep it accurate to the actual features; it is the one doc users read
// in-product.
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
| t · w · p | Keep this folder or file as a tab · close it · pin it |
| [ · ] · 1-9 | Previous / next tab · jump to a tab (in a dialog: switch its tabs) |
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

## Finding files

- **Quick filter** — type in the **Filter…** box (top-right), or press **⌘F** to jump to it. Press **⌘F** again to fall through to Chrome's own find.
- **Text inside files** — open the **Filter** panel; the second row reads the text files the name and type fields allow (2 MB each at most) and keeps only the ones containing your words. Enter or **Run** starts it, **Cancel** stops it, and the results stay until you run again or clear the field. **Save view** keeps the folder plus these fields as a Saved row with a funnel icon; opening it brings the search back.
- **Deep search** — the folder button beside the filter box includes every subfolder. Names show their path from this folder, so **src/main.ts** matches **main**. The scan skips node_modules, .git and dot-folders (unless hidden files are shown), stops at 8 levels or 5000 items, and runs once per page.
- **Sort** — click a column header, or open the **Sort** panel to sort by name, size, type, extension, or modified date, and to **group** (folders-first, files-first, by extension, or by type).
- **Filter** panel — match names by text or regex, or show only folders / files / one extension.
- **Hidden files** — the eye button toggles dotfiles.

## Selecting & opening

- Click a file to look at it in the panel; the address bar stays put. Click a folder to go there. **Double-click** a file to open its page in this tab.
- **⌥-click** keeps a folder or file as a strip tab, in the background. **Middle-click** opens it in a new Chrome tab. The same gestures work on sidebar rows and on path segments.
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
an undo. The place you are in shows as an italic tab until you keep it: press
**t** or double-click it. **w** closes the current tab, **p** pins it (pinned
tabs sit first and have no ✕), **[** and **]** move between tabs, **1** to
**9** jump. Drag to reorder. **Middle-click** a tab to close it (pinned
tabs stay). Hover a tab for **…**: copy path, save, pin, close, close others.
Navigation is real, so the address bar is always the active tab's location.

## Saved

One list of your folders, files and saved views. The ★ in the path bar saves
or unsaves the current folder; **+** saves it and opens the name for editing.
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
];
