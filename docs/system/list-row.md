# ListRow

One line in any list: a sidebar place, a saved item, a note, a menu or
dropdown option, a palette entry, a key-map line, a contents heading, a
document in the comments lens, a chat in Ask's history, a tree row. One class,
`row`, gives every list the same two looks.

## Contract

| State | Looks like | Set by |
|---|---|---|
| rest | `--mt` text, no background | the part |
| hover, keyboard cursor | `--hover` wash, `--tx` text | `:hover`, `.kb`, `:focus-visible` |
| selected, current, active | `--on` wash, `--tx` text, accent icon | `.active`, `.on`, `.selected`, `[aria-selected="true"]`, `[aria-current="page"]`, or a direct child with `.active` |

The part sets height (`--row-h`), padding (`--row-px`), gap, corner, type and
the two washes. The place may set its own height and padding where its list
differs (the palette's taller rows, the tree's indent); it never sets the
washes or the text colour for a state.

Screen readers hear the state too: the sidebar's current place carries
`aria-current="page"`, palette and dropdown rows carry `aria-selected`.

Two lists cannot take the class, because `row` is a flex line: the listing's
table rows and its tiles. They keep their own state rules, written with the
same two tokens (`#fe-table tbody tr.selected td` and `.fe-tile.selected` use
`--on`, their hover uses `--hover`), and the ratchet does not count them.

A button inside a menu (the note properties menu) is a Button, not a row; the
Button part gives its keyboard cursor the same `--hover` wash.

The palette has no separate cursor: the highlighted entry is the selected one,
and Enter runs it, so it shows `--on`. A dropdown option that is both the
chosen value and under the cursor shows `--on`.

## Sanctioned and banned

- Banned: a row kind's own `:hover`, `.kb`, `.on`, `.active`, `.selected` or
  aria-state rule that sets a background or colour. `css-row-paint` in
  `e2e/check-system.mjs` counts them; the count is 0.
- Sanctioned: a child that floats over a row (a note's actions) paints its
  fade from the same tokens, so it matches the row in both themes.
- Not a ListRow: the autocomplete list under a comment box (`.fe-cm-ac`), which
  keeps its own two looks for now, and the tab strip's tabs.

## What it replaced

Seven selected looks (accent wash, accent wash with accent text, accent text
only, the hover look, a ring, a wash with an accent border, none) and two
keyboard-cursor looks (`--on` in menus, `--hover` in dropdowns). A selected
row's text is now body text with an accent icon, where the sidebar and tree
used accent text. The menu cursor moves from `--on` to `--hover`.

Checked by `e2e/rows-walk.mjs` on the sidebar, palette, item menu, dropdown,
contents rail, tree and table, in both themes.
