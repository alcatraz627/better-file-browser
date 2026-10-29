# bfb on the phone: the mock

A clickable model of bfb rebuilt for a phone, with sample data shaped like the
owner's own. It keeps bfb's colours and type, and changes the patterns: where
things live, how you reach them, and what replaces hover, right-click and side
panels. Nothing here is wired to real files; it is for walking and judging.

## Open it

- On the phone: `http://100.65.206.85:6274/` (tailnet only). A narrow screen
  gets the app full screen with no review shell.
- On the Mac: the same address shows the review shell: every place in a rail,
  the sheets a screen opens, states to put the app in, and "Every screen".
- `?theme=light`, `?place=folder` and `?wall` open it in that state.

## The places

```
 bottom bar:  Home · Browse · Inbox · Notes · Ask
 ┌ Home ── Search, Settings          (open pages: a sheet from any top bar)
 ├ Browse ─ Folder ─ File ─┬ Edit (Write | Preview)
 │  Places|Saved|Recent    └ Diagram
 ├ Inbox ── Decision · Directions    Decisions|Comments|Directions
 ├ Notes ── Note (Read | Write)      Pinned|All
 └ Ask ──── Chat
```

`model.js` holds this list. Back, the bottom-bar highlight and every "Back to X"
label are derived from it; no screen types a destination.

## What changed from the desktop, and why

| Desktop | Phone | Why |
|---|---|---|
| Sidebar with nine lenses | Five places on a bottom bar | A thumb reaches the bottom; nine icons in a drawer were the old phone view's main complaint |
| Home counts, Decisions and Comments lenses | One Inbox with three views and a badge | Everything that waits on the owner in one place |
| Tab strip | "Open pages" sheet behind a count on the top bar | A strip of tabs does not fit 390px; a list of cards does |
| Hover buttons and right-click menu | A "…" on each row opens a sheet of actions | No hover on glass |
| Preview panel (look) then file page (go) | A tap opens the file full screen | One way to read; Back returns |
| File page toolbar (width, wrap, raw, copy, find, ToC, comments) | Four tools at the bottom: Contents, Find, Comments, Edit; the rest under "…" | The reading surface keeps the screen |
| Split editor | Write and Preview as a switch, format keys above the keyboard | Two panes do not fit side by side |
| Breadcrumb crumbs | The title names the folder; tapping it lists the folders above as full rows | Crumbs are tap targets too small for a finger |
| Multi-select with ⇧ and ⌘ | "Select" mode with checks and an action bar | No modifier keys |
| Drag to reorder | A Reorder mode that shows handles | Drag on a scrolling list fights the scroll |
| Decision page answer bar | Questions as cards, the answer bar pinned to the bottom with Send | One question at a time fits the screen |
| Directions state bar | State chips that filter, rows with a coloured pill | Same meaning, touch-sized |

## The kit

`kit.js` holds every part: top bar, bottom bar, row, card, tiles, stat, switch
(`seg`), chips, button, floating button, banner, empty state, field, toggle,
state pill, progress, toolbar, keybar, doc, diagram, thread, bubble, composer,
question. `screens.js` and `sheets.js` only call parts. `check.js` reads them
and fails any line that draws its own tag, class or style.

Rules the parts carry: taps are at least 44px, text is 16px at Medium, a filled
button is only for the one verb a place exists for (Send, Save, New note, New
chat), a sheet never covers the whole screen and has no close button (the scrim
and a swipe down close it).

## Checks

`node run-checks.mjs http://100.65.206.85:6274/` runs `runChecks()` over every
frame (each place, each state, each sheet; dark and light; three text sizes)
and `crawl()` over every tap from Home. Each was proven by planting a defect
and watching it go red: raw markup in a screen, a tap with no action, 30px
icon buttons, a tap that changes nothing. `node shoot.mjs <url> <dir>` writes
contact sheets of the wall.

## Findings for bfb itself

- bfb's light accent `#0b7a76` on its grey surface `#eaf0f2` measures 4.49 to 1,
  just under 4.5. The mock uses `#0a716d`.
- bfb's light green and orange are under 4.5 to 1 as text on its light
  backgrounds; the mock darkens them.
