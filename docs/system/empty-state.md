# EmptyState

What a list shows in place of rows. Every list says why it is empty in the
same shape, so "still loading", "nothing here", "your filter hid it all" and
"this could not be read" never look alike.

## Contract

`emptyHtml(state, text, opts)` in `src/empty-state.ts` returns the markup.

| State | Means | Offers |
|---|---|---|
| `loading` | the rows are on their way | nothing; the text is dim |
| `empty` | there is nothing in the list | a hint saying how to add one, where there is a way |
| `filtered` | a filter hides every row | `CLEAR`, the shared Clear filter button |
| `failed` | the list could not be read | Try again where a list can read again in place, and the error's words as the hint; a tree level or crumb menu says how to retry instead |

Options: `hint` (plain text) or `hintHtml` (for a `<kbd>`), `icon` (a large
round icon above, for panels), `actions` (buttons wired by the list through
`data-a` or an `id`), `inline` (left aligned among rows, for menus, the
sidebar and a tree level; the default is centered in the list's space).

The list's own click handler reads `data-a`: `clear` drops the filter,
`retry` reads again. A message that stands alone carries `role="status"`, so a
screen reader announces it; an inline one sits among menu, list or tree rows
and does not.

## Where it is used

The listing (empty folder, only hidden files, filtered, an empty subfolder
search), each tree level, the crumb menus, the palette, Saved, Notes, History,
Ask's history, a note's versions, Settings' icon rules, the comments lens and
the comments panel.

## Sanctioned and banned

- Banned: a list writing its own empty, loading or error message markup.
- Not an EmptyState: the search lens's status line (`#fe-srch-status`), which
  reports progress and counts as it runs, and the Go-to box's message.
- The palette's filtered state has a hint instead of a Clear button, because
  the palette is driven from the keyboard and Esc closes it.

## What it replaced

Seven classes (`.fe-hint` in lists, `.fe-cm-empty`, `.fe-pal-none`,
`.fe-dd-empty`, `.fe-dd-spinner`, `.fe-tree-message`, `.fe-ask-h-none`) in
italic, plain and centered variants. The listing showed nothing at all when
empty or filtered. The inline messages lose their italic.

Checked by `e2e/empty-walk.mjs` (listing, palette, Saved, Notes, crumb menu)
and the Clear step in `e2e/notes-ergonomics-walk.mjs`.
