// User-facing help, shown in the Help modal. Authored as markdown and rendered
// through renderMarkdown so it reuses the preview's .fe-md styling. Keep it
// accurate to the actual features — it's the one doc users read in-product.
export const HELP_MD = `
# Better File Browser

Replaces Chrome's plain \`file://\` directory listings with a modern explorer —
views, search, file previews, and an optional local-AI assistant. Everything
runs on your machine; the extension makes no network requests.

## Views & zoom

Switch layout from the toolbar: **Details** (table), **List** (compact),
**Tiles**, or **Large Icons**. Your choice is remembered. The **zoom** slider
(50–320%) scales the whole list.

## Finding files

- **Quick filter** — type in the **Filter…** box (top-right), or press **⌘F** to
  jump to it. Press **⌘F** again to fall through to Chrome's own find.
- **Sort** — click a column header, or open the **Sort** panel to sort by name,
  size, type, extension, or modified date, and to **group** (folders-first,
  files-first, by extension, or by type).
- **Filter** panel — match names by text or regex, or show only folders / files /
  one extension.
- **Hidden files** — the eye button toggles dotfiles.

## Selecting & opening

- Click a name to open it. Click a row's whitespace to **select** it.
- **↑ / ↓** move the selection, **Enter** opens, **Backspace** or **⌘↑** goes up.
- **Multi-select**: **shift-click** a range, **⌘/Ctrl-click** to toggle one,
  **⌘A** selects all. **⌘C** copies the selected paths.
- **Right-click** an item for Copy path, Copy name, Open in terminal — plus
  Preview for previewable files. With several items selected, the menu offers
  bulk Copy paths / Copy names.

## File preview (Quick Look)

Select a file and press **Space** (or click the eye button on hover, or
right-click → Preview) to open a preview overlay — **Space** again, or **Esc**,
closes it. **↑ / ↓** (or **← / →**) step between previewable files; the **copy**
button copies the raw contents. Files over 8 MB ask before loading.

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

## AI assistant (optional)

If you have the local-models **\`lm\`** CLI and its native host installed, the
preview gains an **AI bar**: **Summarize**, **Explain** (**Describe** for tables),
and an **Ask** box. Answers stream in; closing the overlay cancels them.

Pick the model and toggle **Keep warm** in **Settings → Local Model**. It's fully
local — nothing is sent anywhere. Without the CLI installed, the bar simply
doesn't appear and everything else works normally.

## Sidebar

- **Bookmarks** — click the ★ in the path bar to bookmark the current folder;
  drag to reorder, ✕ to remove.
- **My Places** — **+** adds the current folder; **double-click** a label to
  rename; drag to reorder; ✕ to remove.
- **Recent** — folders you visited lately.
- **Finder Favorites** / **System** — quick jumps (Root, Home, …).

## Breadcrumbs

Click any path segment to jump there. The **▾** next to a segment opens a
dropdown of that folder's contents with its own filter box — type to narrow,
**Enter** opens the first match.

## Terminal

The terminal button opens the current folder in your terminal. With the optional
native host it launches Ghostty directly; otherwise it copies a \`cd\` command to
your clipboard. Choose your terminal in **Settings → Terminal**.

## Settings

Theme (dark/light — also the sun/moon button), default view, compact mode,
sidebar visibility, date format, terminal app, the **Local Model** panel (AI
status, model picker, keep-warm), and **custom icon rules** (a regex matched
against filenames → a colored label badge).

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| ↑ / ↓ | Move selection |
| Enter | Open |
| Backspace · ⌘↑ | Go to parent folder |
| Space | Preview selected file (Space again closes) |
| ⌘F | Focus the filter (again → browser find) |
| ⌘A | Select all |
| ⌘C | Copy selected path(s) |
| Esc | Close preview / clear filter |
`;
