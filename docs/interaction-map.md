# Keys, gestures, and how the parts work together

A reference for the file browser: what every key and gesture does on each
surface, how the surfaces interact, common workflows, and current limits. Keys
are shown as `code`.

## Global rules

- Single-letter keys fire only when no text field is focused and no dialog is open.
- `⌘`/`Ctrl` and middle clicks on anything with an address reach the browser,
  except on listing rows, where `⌘` and `⇧` clicks belong to multi-select.
- `Esc` closes the topmost overlay: a menu, then a dialog, then the preview. When
  the filter box has focus, `Esc` also clears it; elsewhere it does not.

## Keys (listing has focus, nothing else open)

| Key | Action |
|---|---|
| `↑` `↓` | move the selection |
| `Enter` | open the selection |
| `Space` | preview the selection; a toast on a folder |
| `Backspace` `⌘↑` | parent folder |
| `⌘A` | select all |
| `⌘C` | copy the selected paths |
| `⌘F` | focus the filter box; again falls through to the browser's find |
| `?` `,` | open Help; open Settings |
| `n` | new note (only when a Notes folder is set) |
| `r` | raw or rendered (file page only) |
| `t` `w` `p` | keep, close, pin the current tab |
| `T` | reopen the last closed tab, at its place |
| `[` `]` | previous, next tab |
| `1`..`9` | jump to a tab |

## Listing rows and tiles

A click on a file opens it in the preview panel with the address unchanged, but
only when the file is previewable and "Click on a file" is set to look (the
default). A non-previewable file, or the go setting, navigates on a single click.
A folder always navigates.

| Gesture | File | Folder |
|---|---|---|
| click | look in the panel (see above), else go | go |
| double-click | go to the file page | go |
| `⌥`-click | keep as a background strip tab | same |
| middle-click | browser tab | same |
| `⇧`-click `⌘`-click | toggle the row in the selection | same |
| `⇧⌘`-click | range from the anchor | same |
| right-click | menu: Preview, Copy path, Copy name, Open in terminal | same, no Preview |
| hover | a tip, plus a separate eye button (preview) and copy buttons | same, no eye |

## Strip tabs

| Gesture | Kept | Temporary | Pinned |
|---|---|---|---|
| click | switch | nothing | switch |
| double-click | nothing | keep | nothing |
| middle-click | close | nothing | nothing |
| `⌘`/`⇧`-click | browser tab or window | same | same |
| drag | reorder within the block | none | reorder among pinned |
| hover `…` | menu: copy path, save, pin, close, close others | none | same |
| hover `✕` | close | none | no `✕` |

`w` on a pinned or temporary tab does nothing. `p` on a temporary tab keeps and
pins it.

## Sidebar

| Gesture | Saved, Recent, Favorites, System | Notes |
|---|---|---|
| click | open as a strip tab, switching to an open one, and go | open in the editor |
| double-click the label | rename (Saved) | rename |
| `⌥`-click | keep as a background strip tab | same |
| middle / `⌘`-click | browser tab | same |
| hover `#` | edit tags | none |
| hover `✕` | remove | move to a trash folder |
| drag | reorder | none |
| tag dot | cycle the colour | |
| filter box | narrow by label, path, or tag; `Esc` clears | |

A saved search view navigates and applies the query; it does not keep a strip tab.

## Path bar and toolbar

| Control | Action |
|---|---|
| `≡` (top left) | show or hide the sidebar |
| sidebar right edge | drag to resize; the width persists |
| crumb click / `⌥` / middle / `⌘` | go / background tab / browser tab |
| crumb `▾` | dropdown of that folder; type to narrow, `Enter` opens the first |
| `★` | save or unsave the current place |
| terminal | open here; `⇧`-click copies the command instead |
| sun / moon | toggle the theme |
| `?` gear | Help, Settings |
| view buttons | Details, List, Tiles, Icons |
| Sort, Filter | open the panel |
| column header / edge | sort / drag to resize |
| eye | show hidden files |
| zoom slider | scale the list only |

## Preview panel

| Gesture or key | Action |
|---|---|
| scrim / `✕` / `Esc` / `Space` | close |
| `↑` `↓` `←` `→` | previous, next previewable file |
| `open` / `Enter` | go to the file page |
| `+ tab` / `t` | keep as a background strip tab (stays on the current place) |
| copy button | copy the whole file's contents |
| dock button | float or dock to the side |
| corner grip / side edge | resize |
| header name / open raw / rendered links | new browser tab |
| table header | sort that column |

The strip keys `[` `]` `1`..`9` and `t` still work while the preview is open. A
file over 8 MB asks before it loads. When a local model is available, an AI bar
adds Summarize, Explain (Describe for tables), and Ask.

## Notes editor (inside the panel)

| Key | Action |
|---|---|
| `⌘S` | save (a pause also autosaves) |
| `⌘B` `⌘I` `⌘E` | bold, italic, code |
| `⌥↑` `⌥↓` | move the line |
| `⌥⇧↑` `⌥⇧↓` | duplicate the line |
| `Tab` `⇧Tab` | indent, outdent |
| `Enter` | continue a list |
| `⌘Z` `⌘⇧Z` `⌘Y` | undo, redo |
| `Esc` | close the editor |
| `open` / `+ tab` | go to the note's page / keep the note as a strip tab |

The toolbar also has buttons for bold, italic, code, list, task, table, and image.
The list, task, table, and image buttons have no key. Pasting or dropping an image
saves it beside the note and links it.

## Dialogs (Help, Settings)

| Key or gesture | Action |
|---|---|
| tab click | show that pane |
| `[` `]` | previous, next tab |
| `Esc` / `✕` / scrim | close, focus returns |

## File page

`r` toggles raw, a copy button, ToC links jump, `Backspace` or `⌘↑` go to the
folder, and `⌘F` uses the browser's find. Two buttons toggle a table-of-contents
rail and an 80-character reading column. While the page is visible it reloads
itself every couple of seconds and re-renders when the file changes on disk.

## How the parts work together

- The address bar is always the active tab's location; every navigation is real.
- Look versus go: a listing click looks when "Click on a file" is set to look;
  set it to go and a click opens the file page. A sidebar click always goes. `⌥`
  keeps a background tab in both cases.
- One shell: a file page is the explorer with the file in the main column, so the
  bar, sidebar, strip, and status bar stay in place.
- Overlays stack: a dialog opened over the preview takes `Esc` first, then the
  preview. Focus returns to where it was, so nesting is safe.
- Temporary versus kept tabs: the folder you are in shows as an italic temporary
  tab until `t` or a double-click keeps it. Opening a place from the sidebar keeps
  that folder as a tab so you do not lose it; leaving another way drops an unkept
  folder.
- The notes editor is the preview panel in edit mode; its `open` and `+ tab` act
  on the note.
- Reader size applies to the file page and the preview panel; interface size
  scales the whole interface and stacks on top of the list zoom.
- The tab strip belongs to one browser tab and is restored into a fresh one for a
  day after it closes, with an undo.

## Common workflows

1. Look, keep, go: click a file to look, `Space` or arrows to step, `t` to keep,
   click the tab for the file page. Pressing `t` before the panel appears keeps
   the current folder as a tab instead.
2. Multi-select and copy: `⇧` or `⌘` click rows, `⌘C` copies their paths.
3. Save and organise: `★` saves the folder, hover `#` to tag it, the filter box
   narrows by tag, and a click reopens it.
4. Notes: `n` starts a note, `⌘S` saves, `+ tab` keeps it.
5. Deep search: the folder button beside the filter searches every subfolder, and
   Save view keeps it as a reopenable row. The crawl skips build folders and,
   unless hidden files are shown, dotfolders, and stops at 8 levels or 5000 items.
6. Many tabs: past a dozen the strip scrolls, the `⌄` button lists them all, and
   `1`..`9` reach the first nine.
7. Recovery: close the browser tab and reopen it to restore the strip, with an undo.
8. Two overlays: with a preview open, press `,` for Settings; `Esc` closes
   Settings, then `Esc` closes the preview.
9. Resize and scale: drag the sidebar edge, `≡` hides it, and Interface size
   scales everything; all three persist across reloads.
10. External change: edit a note or an open file from another program. The note
    shows a conflict prompt instead of overwriting, and an open file page
    re-renders on its own.

## Good to know

- Many controls are mouse-only. There is no key for the sort, filter, view, hidden,
  zoom, theme, or terminal controls, the sidebar and its rows, the breadcrumb
  dropdown, or renaming a saved item, and the context menu is right-click only.
- The toast message is always dark, in both themes.
- A saved bookmark to a file whose name contains a `#` may be read as a search
  view rather than opened.
- There is no drag and drop to move or copy files; dragging reorders tabs and
  saved rows only.
