# Architecture v2: one model for tabs, path bar, panel and sidebar

Owner review of v2.8, 2026-09-15 evening. Verbatim asks that this answers:
"We need a coherent inter-related model for the tabs, path bar, sidebar /
modal, and else", "ENSURE a given tab's open tabs ... are retained PER tab
even if closed or refreshed, should be snappy and best-effort recovery",
"tell me if this complicates the browser url syncing". Supersedes the Tabs
section of `docs/feature-set.md`; the nouns and verbs there still hold.

## The one rule about the URL

The Chrome address bar shows the active strip tab's location and nothing
else. Everything follows from that:

- A **strip tab is a URL**: a folder (the explorer) or a file (the file
  page). Switching tabs navigates for real. `pushState` between file://
  paths is unreliable across Chrome versions (recon §D), so we never fake a
  navigation. A navigation to a folder costs one listing fetch and paints in
  under 100 ms on a local disk; that is snappy enough, and it keeps back and
  forward, bookmarks and copy-URL honest.
- **Opening a file in the panel is Look, not Go.** The URL does not change.
  The panel mode (floating or docked) is one persistent toggle, and plain
  click always uses it.
- **Strip state lives with the Chrome tab**, not the window and not the
  world. `sessionStorage` survives navigation and refresh in that Chrome tab
  and dies with it, which is exactly the lifetime asked for. A copy goes to
  `chrome.storage.local` under a per-Chrome-tab session id, stamped with a
  time, so a closed tab can be brought back best-effort.
- **Recovery** on a fresh Chrome tab (no session entry): if a stored set was
  orphaned in the last 24 h and no other tab claimed it, restore it
  silently, show one toast, "Restored 4 tabs · undo", and claim it. If
  several qualify, restore the newest. Nothing is asked.

The v2.8 shared-across-windows strip is retired by this rule. Sharing made
the record's active id ambiguous (bug found in e2e) and it is not what the
owner wants.

## Click model, listing rows

| gesture | on a file | on a folder |
|---|---|---|
| plain click | open in the panel (mode from the toggle) | go (navigate) |
| double-click, Enter | go: open the file page in this tab | go |
| ⌥ click | open in a new strip tab, in the background | new strip tab |
| middle click | Chrome's own new tab (untouched) | same |
| ⇧ click | toggle this row in the selection | same |
| ⌘ click | toggle (kept for muscle memory) | same |
| ⇧ ⌘ click | range from the anchor | same |

The name link stops being a navigation link for plain click; middle click
still reaches the browser because the anchor keeps its href.

## The strip

`Tab = { id, path, kind: 'folder' | 'file', label, pinned }` (`path` is the
decoded file path; a folder's ends with `/`). Pinned tabs sit
first, keep no close button, and survive "close others". Drag reorders.
Hover shows a small `…` that opens a menu: copy path, save or unsave (the
same Saved list, so the star and the tab agree), pin or unpin, close, close
others. Keys stay: `t` keep, `w` close, `[` `]` step, `1`-`9` jump, plus `p`
pin. A file tab's label is the file name; its icon is the file icon.

## Saved, searchable

A filter box at the top of the Saved section matches label, path and tag
text; typing collapses the groups to matches. Empty box, full list.

## Dialogs, one chrome

Help and Settings share the kanban board's dialog shape: a title row with a
mark and a subtitle, a tab strip, one scrolling pane, the chrome never
scrolls. Help tabs: Keyboard, Explorer, Preview and Notes, Tabs and Saved.
Settings tabs: Appearance, Files, Notes, Terminal, AI. Esc closes; the same
open/close helper manages focus for both and for the preview.

## The two rendering defects reported

- **Black area right of a file page** (screenshot 1): `html` keeps the dark
  `--bg` from `:root` while the light palette lives on `#fe`, so any area
  the shell does not cover paints dark. Fix: the theme sets the palette on
  `html` too, and the file-page shell fills the viewport width. Check: at
  1800 px wide in light, no pixel outside `#fe` is dark.
- **Tiles spacing** (screenshot 2): tile cells are sized by a grid with a
  fixed row height that leaves a band of empty space under every icon, and
  names wrap character by character. Fix: a compact tile of fixed width,
  icon, two-line name with ellipsis, size in a smaller muted line, tight row
  gap; selected tile outlines the cell without enlarging it. Check: the
  fixture folder in tiles at 1400 px shows four rows where it showed six.

## Build order, each with its check

1. Per-tab strip with recovery, file tabs, pin, hover menu, `p`. Check: open
   three tabs, refresh, they persist; close the Chrome tab, open the folder
   again, they come back with a toast; the address bar equals the active
   tab's URL after every action.
2. Click model. Check: plain click on a file opens the panel and the URL is
   unchanged; ⌥ click adds a background strip tab; ⇧ click toggles rows;
   double-click opens the file page; middle click opens a Chrome tab.
3. Tiles spacing and the `html` background. Check: the two pixel checks
   above, in dark and light.
4. Saved filter box. Check: typing a tag name shows only that group.
5. Dialogs on one chrome. Check: Help and Settings open with tabs, chrome
   fixed while a pane scrolls, Esc closes, both themes.
6. Extension action icon. Check: the toolbar shows the mark, not the puzzle
   piece.

Each item is scoped for an execution seat: the check is the acceptance
criterion, and the screenshots in `e2e/shots/` are the evidence.

All six shipped on 2026-09-15; every check above runs in `npm run e2e` and
`npm run e2e:light`.
