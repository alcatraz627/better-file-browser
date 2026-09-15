# Usability v3: Settings, the markdown viewer, preview and tabs

Owner ask, 2026-09-16: "Settings panel is lacking", "md viewer can be
massively improved in spacing / visual display", "the file preview in all the
way and tab shenanigans are still pretty primitive, I want this to be up to
mark for a daily power user who does not have to think about its limitations
or clunky UX or confusing / nonintuitive ways". Private use only; nothing is
published.

Every item carries a default. Items marked **default** get built without
asking; the owner flips what he dislikes. Items marked *optional* wait for a
yes. Each item names its check, and `npm run e2e` in both themes stays the
gate.

Build order: markdown viewer first (it is what the owner reads all day), then
preview and tabs, then Settings, because the Settings items mostly expose
knobs the first two passes create.

## Markdown viewer

| # | Item | Default | Check |
|---|---|---|---|
| M1 | Typography scale: 15px body, 1.65 line height, headings 26/21/17/15px with a 32px top margin on h2, 12px paragraph gap; full width by default (owner ask 2026-09-15) with a reading-column toggle of 80ch in the file bar that persists, and a ToC toggle beside it | **default**, shipped 2026-09-16 | e2e: 15px, column narrows and survives a reload, toc button hides the rail |
| M2 | Code blocks: language chip, a copy button per block, horizontal scroll instead of wrap, 13px mono at 1.5 line height on the s2 surface | **default**, shipped | e2e: the fixture's js fence shows the chip and the button |
| M3 | Tables: zebra rows and a horizontal scroll container so a wide table never widens the page. The sticky header was dropped: a sticky row needs the table's own ancestor to be the scrolling box, and the scroll container is that ancestor, so the two cannot coexist | **default**, shipped | e2e: the fixture table sits in a wrap |
| M4 | Images: centred, max 100 percent, click opens the file natively in a new tab | **default**, shipped, click unchecked in e2e | |
| M5 | Heading anchors on hover, ToC highlights the section in view, ToC collapsible with a remembered state | **default**, shipped | e2e: scrolling to section 12 marks its row; ids and anchors on every heading |
| M6 | Front matter renders as a compact key and value block instead of raw dashes | **default**, shipped | e2e: the fixture's title and tags rows |
| M7 | Task lists render as checkboxes, read-only | **default**, shipped | e2e: one checked, one open |
| M8 | Reading progress: a thin bar at the top of the pane | *optional* | |
| M9 | Callouts: `> [!NOTE]` and friends styled as boxes | *optional* | |

## Preview panel and strip tabs

| # | Item | Default | Check |
|---|---|---|---|
| P1 | Panel header gains "Open in this tab" and "Open in a new strip tab"; Enter while the panel is open goes to the file page | **default**, shipped | e2e: Enter reaches the file page; header shows open and + tab |
| P2 | The panel remembers scroll per file for the session; reopening restores it | **default**, shipped, unchecked in e2e (the fixture is too short to scroll) | |
| P3 | With the panel open, `t` keeps the previewed file as a background strip tab; `[` and `]` still switch strip tabs | **default**, shipped | e2e: t with the panel open keeps the file, panel stays |
| P4 | Strip overflow: tabs shrink to a minimum, then the strip scrolls horizontally with fade edges, the active tab scrolls into view, and a `⌄` button lists every tab | **default**, shipped | e2e: 21 tabs, strip scrolls, active visible, list menu names every tab |
| P5 | Tab labels: middle truncation, and two tabs with the same basename show their folder (`docs/readme.md`) | **default**, shipped | unit: displayLabels shows the folder on collisions |
| P6 | Per-tab listing scroll memory: switching back to a folder tab restores its scroll | **default**, shipped | e2e: 60px restored after leaving and returning |
| P7 | Pinned tabs collapse to their icon, as in Chrome | **default**, shipped | e2e: 36px |
| P8 | Reopen the last closed tab with `T` (shift-t), from a per-Chrome-tab stack | **default**, shipped | e2e: shift-T puts nested back at its index |
| P9 | Docked panel remembers the open file per folder tab and restores it when the tab returns | *optional* | |
| P10 | Drag a listing row onto the strip keeps a tab; drag a tab onto Saved saves it | *optional* | |

## Settings

| # | Item | Default | Check |
|---|---|---|---|
| S1 | Sidebar sections on or off: Recent, Finder Favorites, System | **default** | off hides the section after reload |
| S2 | Click on a file: look in the panel, or go to its page | **default**, look | the go setting makes a plain click navigate |
| S3 | Preview: default placement floating or docked; reset the remembered sizes | **default** | a fresh profile opens docked when set |
| S4 | Reader: column width (80ch or full), base size 13 to 17, line height 1.5 to 1.8, code size | **default** | the file page follows the values |
| S5 | Strip: restore closed strips on or off; reopen stack depth | **default** | off skips recovery |
| S6 | Export and import settings plus the Saved list as one JSON file | **default** | export, wipe, import, same Saved rows |
| S7 | Tooltips on or off | **default**, on | off strips every title |
| S8 | Keyboard tab of Help reachable from Settings by a link | **default** | the link opens Help on Keyboard |

## Out of scope in this pass

Web Store prep (deferred, private use), highlighter P3 and P4 (deferred), the
optional rows above.
