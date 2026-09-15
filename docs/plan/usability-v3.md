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
| M1 | Typography scale: 15px body, 1.65 line height, headings 26/21/17/15px with a 32px top margin on h2, 12px paragraph gap, a reading column of 80ch centred beside the ToC rail, and a full-width toggle in the file bar that persists | **default** | shot at 1400 and 1800 wide read back; the toggle survives a reload |
| M2 | Code blocks: language chip top-right, a copy button per block, horizontal scroll instead of wrap, 13px mono at 1.5 line height on the s2 surface | **default** | a fenced block in the fixture shows the chip and copies |
| M3 | Tables: zebra rows, header row sticky when the table is taller than the pane, horizontal scroll container so a wide table never widens the page | **default** | a 12-column table stays inside the pane |
| M4 | Images: centred, max 100 percent, click opens the file natively in a new tab | **default** | click on the fixture image opens a page |
| M5 | Heading anchors on hover, ToC highlights the section in view, ToC collapsible with a remembered state | **default** | scrolling to a heading marks its ToC row |
| M6 | Front matter renders as a compact key and value block instead of raw dashes | **default** | the existing note fixture shows a block, not `---` |
| M7 | Task lists render as checkboxes, read-only | **default** | `- [x]` shows a checked box |
| M8 | Reading progress: a thin bar at the top of the pane | *optional* | |
| M9 | Callouts: `> [!NOTE]` and friends styled as boxes | *optional* | |

## Preview panel and strip tabs

| # | Item | Default | Check |
|---|---|---|---|
| P1 | Panel header gains "Open in this tab" and "Open in a new strip tab"; Enter while the panel is open goes to the file page | **default** | Enter on an open panel reaches the file page |
| P2 | The panel remembers scroll per file for the session; reopening restores it | **default** | reopen after a scroll lands at the same top |
| P3 | With the panel open, `t` keeps the previewed file as a background strip tab; `[` and `]` still switch strip tabs | **default** | t with the panel open adds a tab without closing the panel |
| P4 | Strip overflow: tabs shrink to a minimum, then the strip scrolls horizontally with fade edges, the active tab scrolls into view, and a `⌄` button lists every tab | **default** | 20 tabs at 1400 wide: active visible, menu lists 20 |
| P5 | Tab labels: middle truncation, and two tabs with the same basename show their folder (`docs/readme.md`) | **default** | two readme.md tabs read differently |
| P6 | Per-tab listing scroll memory: switching back to a folder tab restores its scroll | **default** | scroll, switch away and back, same top |
| P7 | Pinned tabs collapse to their icon, as in Chrome | **default** | a pinned tab is narrower than 40px |
| P8 | Reopen the last closed tab with `T` (shift-t), from a per-Chrome-tab stack | **default** | close, T, it is back at its position |
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
