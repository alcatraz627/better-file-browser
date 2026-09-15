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

## Sidebar

| Gesture | Saved row | Notes row |
|---|---|---|
| click | go ✓ | open in the editor ✓ |
| middle-click | Chrome tab | Chrome tab, plain text |
| double-click on the label | rename ✓ | rename |
| hover, # | edit tags ✓ | none |
| hover, ✕ | remove ✓ | move to .trash ✓ |
| drag | reorder ✓ | none |
| tag heading dot | cycle the colour ✓ | none |
| filter box | narrows by label, path, tag; Esc clears ✓ | none |

## Path bar and toolbar

| Gesture | Action |
|---|---|
| crumb click | go |
| crumb ▾ | dropdown of that folder; type to narrow, Enter opens the first match, Esc closes ✓ |
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

| Gesture or key | Action |
|---|---|
| r, raw button | raw or rendered ✓ |
| copy | copy the contents |
| ToC link | jump to the heading |
| Backspace, ⌘↑ | the folder |
| strip keys | as above |

## Changed in this pass

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
