# Modal and panel patterns borrowed from the kanban board

Survey for the preview layout work, 2026-09-15. Source:
`~/.claude/scripts/kanban/shared.css`, `shared.js`, `board.html`.

## What the board does that we do not

**Help modal** (`shared.css:586`, `shared.js:770 helpModal()`): a titled
dialog whose title row and tab strip are `flex:none` siblings of one scrolling
pane, so the chrome never moves when the pane scrolls. Title row carries a
small mark, a bold title and a muted one-line subtitle. Tabs carry a label and
a sub-label. Width `min(880px, 94vw)`, height capped at `84vh`. One scrim
colour for every overlay and a single z-index scale (`--z-modal`, `--z-doc`,
`--z-tip`) declared once.

Ours (`src/styles.ts:266`, `main.ts:415`): the help modal is one long
scrolling document with no tabs; the settings modal is a header plus a
scrolling body of titled sections. Both fine, but three different dialog
chromes exist (settings, help, preview) where the board has one.

**Document preview modal** (`board.html:613`, markup at `:1560`): a bar with
the path, an "open in tab" link, a Close button, then the body filling the
rest. Bar and body are flex children of the box. This is our Quick Look
header almost exactly, which confirms the header shape and suggests the body
should own all remaining height rather than the dialog picking a fixed size.

**Right panel** (`board.html:468`): a flex sibling of the main column, width
`0` when closed and `min(520px, 42vw)` when open, `--dw` when the owner has
dragged its grip, and `46px` when collapsed to a tab rail. The toggle key is
`\`. Closing remembers nothing extra; the width persists. This is the
sidebar mode for our preview: same element, moved from a fixed overlay into
`#fe-body` as a flex sibling of `#fe-main`.

**Overlay lifecycle** (`shared.js overlayOpen()`): one helper opens any
overlay, moves focus into it, restores focus on close, and binds Esc. We
have three copies of that logic.

## What to borrow for the preview (#8)

1. A dock toggle in the preview header: modal or side panel. Persisted.
2. Side mode: the preview lives in `#fe-body` as a flex sibling, width from a
   dragged left-edge grip, persisted like the board's `--dw`. Rows stay
   clickable and change the previewed file; Esc closes the panel.
3. Modal mode: a corner grip resizes width and height, persisted. Default
   grows to `min(1100px, 90vw)` by `84vh` so a markdown file is not a
   letterbox in a dark field (today's shot: `e2e/shots/preview-md.png`).
4. Not now: unifying the three dialog chromes into one helper, and tabs in
   the help modal. Both are worth doing but are not friction the owner named.
