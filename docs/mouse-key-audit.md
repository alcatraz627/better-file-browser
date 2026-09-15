# Mouse and key contract

One table per surface: what each gesture and key does. The code follows this
file; `npm run e2e` exercises the rows marked with a check, and the tooltip
sweep in the same run fails if any control lacks a title. Written 2026-09-15
after the owner found the strip's middle and double clicks unreliable.

Conventions that hold everywhere:

- Middle-click and cmd-click on anything with an address reach Chrome
  untouched, so they open a Chrome tab or window the way they do on any page.
- Esc closes the topmost thing: a menu, a dialog, the preview, then it clears
  the filter box.
- Single-letter keys only fire when no input has focus and no dialog is open.
- A double-click never repeats the single click's action; the first click of
  the pair may still fire on its own.

## Listing rows and tiles

| Gesture | File | Folder |
|---|---|---|
| click | look: opens the panel, URL unchanged ✓ | go ✓ |
| double-click | go: the file page in this tab ✓ | go (first click already went) |
| ⌥-click | keep as a background strip tab ✓ | same ✓ |
| middle-click (name or whitespace) | Chrome tab ✓ | same |
| ⇧-click, ⌘-click | toggle the row in the selection ✓ | same |
| ⇧⌘-click | range from the anchor | same |
| right-click | context menu: Preview, Copy path, Copy name, Open in terminal | same, no Preview |
| hover | tip: path, type, size, modified, the gesture line | same |
| hover, eye button | preview | none |
| hover, copy buttons | copy path, copy name | same |

| Key | Action |
|---|---|
| ↑ ↓ | move the selection |
| Enter | go |
| Space | preview the selection; on a folder, a toast |
| Backspace, ⌘↑ | parent folder |
| ⌘A | select all |
| ⌘C | copy the selected paths |
| ⌘F | focus the filter box; again, Chrome's find |
| n | new note when a Notes folder is set |
| t, w, p | keep, close, pin the current tab |
| [ ] | previous, next tab ✓ |
| 1 to 9 | jump to a tab |

## Strip tabs

| Gesture | Kept tab | Temporary tab | Pinned tab |
|---|---|---|---|
| click | switch, real navigation ✓ | nothing | switch |
| double-click | nothing beyond the first click ✓ | keep ✓ | nothing |
| middle-click | close, URL unchanged ✓ | nothing | nothing ✓ |
| ⌘-click, ⇧-click | Chrome's own new tab or window | same | same |
| drag | reorder within the pinned or unpinned block | none | reorder among pinned |
| hover, … | menu: copy path, save or unsave, pin or unpin, close, close others ✓ | none | same |
| hover, ✕ | close | none | no ✕ |

`w` on a pinned or temporary tab does nothing. `p` on a temporary tab keeps
it and pins it.

## Preview panel

| Gesture or key | Action |
|---|---|
| click on the scrim, ✕, Esc, Space | close ✓ |
| ↑ ↓ ← → | previous, next previewable file |
| dock button | move between floating and side ✓ |
| corner grip, side edge | resize ✓ |
| name in the header, open raw, links in rendered markdown | new Chrome tab ✓ |
| table header click | sort that column |
| AI bar: Enter in the ask box | ask |

## Notes editor, inside the panel

| Key | Action |
|---|---|
| ⌘S | save ✓ |
| ⌘B, ⌘I, ⌘E | bold, italic, code |
| ⌥↑ ⌥↓ | move lines |
| ⌥⇧↑ ⌥⇧↓ | duplicate lines |
| Tab, ⇧Tab | indent, outdent |
| Enter | continue a list |
| ⌘Z, ⌘⇧Z | undo, redo |
| Esc | close the panel |
| paste or drop an image | saved under attachments/ and linked ✓ |

## Sidebar: Saved, Notes, Recent, Favorites, System

The same gestures as a listing row, for every row that has an address.

| Gesture | Folder row | File row (Saved) | Notes row |
|---|---|---|---|
| click | go ✓ | look: the panel, URL unchanged ✓ | open in the editor ✓ |
| double-click on the icon or whitespace | go | go: the file page ✓ | go: the file page |
| double-click on the label | rename (Saved) ✓ | rename ✓ | rename |
| ⌥-click | keep as a background strip tab ✓ | same | same |
| middle-click, ⌘-click | Chrome tab | same | same, plain text |
| hover, # | edit tags ✓ | same | none |
| hover, ✕ | remove ✓ | same | move to .trash ✓ |
| drag | reorder ✓ | same | none |
| tag heading dot | cycle the colour ✓ | | |
| filter box | narrows by label, path, tag; Esc clears ✓ | | |

## Path bar and toolbar

| Gesture | Action |
|---|---|
| crumb click | go |
| crumb ⌥-click | keep as a background strip tab ✓ |
| crumb middle-click, ⌘-click | Chrome tab |
| crumb ▾ | dropdown of that folder; type to narrow, Enter opens the first match, Esc closes ✓ |
| dropdown item click, ⌥-click | go; keep as a background tab |
| ★ | save or unsave this folder ✓ |
| terminal button | open here; ⇧-click copies the command instead |
| sun or moon | toggle the theme ✓ |
| ? and gear | Help, Settings ✓ |
| view buttons | Details, List, Tiles, Icons ✓ |
| Sort, Filter | open the panel ✓ |
| column header | sort; again flips ✓ |
| column edge | drag to resize ✓ |
| eye | show hidden files |
| zoom slider | scale the list |
| folder button by the filter | deep search ✓ |

## Dialogs

| Gesture or key | Action |
|---|---|
| tab click | show that pane ✓ |
| [ ] | previous, next tab |
| Esc, ✕, scrim click | close, focus returns ✓ |

## File page

The file page is the listing's shell with the file in the main column: the
bar, the sidebar, the strip and the status bar sit in the same place on both
(checked to the pixel in e2e) and take the same gestures.

| Gesture or key | Action |
|---|---|
| r, raw button | raw or rendered ✓ |
| copy | copy the contents |
| ToC link | jump to the heading |
| Backspace, ⌘↑ | the folder |
| ⌘F | Chrome's own find |
| strip, sidebar, path bar | as above |

## Changed in the second pass, 2026-09-16

- The file page no longer builds its own shell. It is the explorer shell in
  file mode, so nothing moves when a file opens.
- Sidebar rows, crumbs and dropdown items take the listing's gestures: a
  saved file looks in the panel, double-click goes, ⌥ keeps a background tab,
  ⌘ and middle clicks stay Chrome's.

## Changed in the first pass, 2026-09-15

- Strip: middle-click closes a kept tab and leaves a pinned one; a double-click
  on a kept tab no longer switches twice; cmd-click and shift-click reach
  Chrome instead of being swallowed.
- Listing: the double-click goes through the `dblclick` event, so the timing
  is Chrome's; middle-click on row whitespace opens a Chrome tab like the
  name does.
- Tooltips on every control that lacked one: crumbs, column headers, the crumb
  dropdown, dialog tabs, Settings inputs, the find case box, the AI explain
  button, the conflict and error buttons, ToC links. Rows and tiles gained a
  gesture line in their hover tip; strip tabs name their gestures.
