---
reader: the owner, deciding what each feature should become; agents building the design system
---

# What the explorer can do today, and what each part is missing

<!-- sessions: bfb@2026-10-20 -->

This is the inventory for the consistency pass
(`docs/plan/20261020-consistency-pass.md`). Each feature lists where it shows,
how you reach it, the settings that shape it, and the gaps, with the owner's
review rows (R1 to R15) where they apply. Gestures and keys are not repeated
here; they live in `docs/interaction-map.md` and `docs/mouse-key-audit.md`.

## The surfaces

```
┌ Path bar ───────────────────────────────────────────────────────────────┐
│ ≡  / › Users › … › folder ▾        terminal  ★  theme  ?  settings       │
├ Sidebar ────────┬ Strip (tabs) ───────────────┬ Preview (docked) ────────┤
│ Contents (md)   │ Toolbar: count, Sort, Filter,│ header: name, size,      │
│ Saved + tags    │  hidden, zoom, views, Filter │  copy, open, raw, folder,│
│ Notes           │ Filter bar / Find panel      │  dock, close             │
│ Recent + sets   │ Listing (5 views)            │ AI bar                   │
│ Favorites       │                              │ body (renderer)          │
│ System          │ Status bar                   │                          │
└─────────────────┴──────────────────────────────┴──────────────────────────┘
File page: path bar + sidebar + strip + file bar (Contents, width, Raw, Copy,
Edit) + reader. Dialogs: Settings (8 tabs), Help.
```

## Features

| Feature | Where | Reached by | Settings | State | Gaps |
|---|---|---|---|---|---|
| Listing | Main pane | Any folder URL | Default view, sort, group, date format, compact, zoom, hidden | Works | Toolbar wraps into three rows when the pane is narrow (R5) |
| Sort and group | Sort panel, column headers | Toolbar Sort, header click | Settings sort and group | Works, one global order | Panel and Settings use different controls for the same value (R5) |
| Filter and Find | Filter field, Find panel | Cmd+F, Filter button | none | Name filter instant; text search is a second pass with a status line | One status line, no per-folder progress, no result list outside the listing, depth is the only scope control, no include/exclude folders, no file-size or date filters (R13) |
| Deep search | Folder button by the filter | Click | Skip list is hard-coded (`node_modules`, `.git`, …) | Crawls up to depth 8; the status line counts folders as it goes; turning it off abandons the crawl | No count of files found or current folder, no explicit Stop, a hit cap shows only as "(capped)", no way to see or change what is skipped (R13) |
| Saved views | Saved list | Save view in Find | none | Works | Not discoverable outside Find |
| Preview panel | Floating or docked | Click a row, Space | Panel mode, click opens | Works | Header and AI bar are two toolbars with different button styles (R5); no find in file (R7) |
| File page | Whole page | Open a file | File pages on/off, exclusions, reader width, size, line height, code size | Works | File bar differs from the preview header for the same actions (R5); Chrome's Cmd+F is the only find (R7) |
| Renderers | Preview, file page | By extension | none | Markdown (GFM), code, JSON tree, CSV/TSV table, YAML/SQL/XML via folder view, images, HTML page, Mermaid | Search inside a rendered doc is missing (R7) |
| Editing | File page, preview | e, Edit button | Editable folders | Works with backups and a conflict banner | Editor toolbar differs from the Notes toolbar (R5) |
| Notes | Sidebar Notes, preview editor | Notes rows, + | Notes folder | Works, with props, pin, colour, tags, versions, content search | Editor source pane has no colouring (plan N1); two front-matter parsers (N6) |
| Tab strip | Above the toolbar | t, ⌥-click, double-click | none | Works; closed sets restore from Recent | none known after 2026-10-20 |
| Sidebar | Left | ≡ | Show sidebar; hide Recent, Favorites, System | Works | Sections differ: only Contents has a bottom border, none can be resized in height, headers carry different actions (R9) |
| Path bar | Top | Always | none | Crumbs with folder dropdowns, star, terminal, theme, Help, Settings | No editable path, no copy path in the bar (only on a row's right-click menu), no back/forward, no recent-folders jump, no search-from-here (R10) |
| AI | Preview AI bar; Settings AI tab | Summarize, Explain/Describe, Ask | Model, warm toggle | One question at a time, answer replaces the last | No follow-ups or history, takes a whole row in the preview, no AI section of its own, no agent tasks such as searching (R8) |
| Terminal | Path bar | Click; ⇧-click copies | App or custom command | Every listed app opens the folder | none known |
| Tooltips | Everywhere | Hover | Tooltips on/off | Styled label after 350ms; rich card on rows | Card and label are two styles (R2, R6) |
| Settings and Help | Dialogs | `,` and `?` | n/a | Works, export and import | Settings has 8 tabs with uneven density; no search in Settings |
| Animation | Everywhere | n/a | none | 41 of 69 controls have no transition; panels and sidebar snap open | No shared durations or easing (R15) |

## What the local model can already do

`lm q` supports, today: follow-ups on an earlier exchange (`-c N`), its own
history (`q history`, `q show N`), grounded Q&A over a document (`qa`),
summaries, code explanation, data profiles, web search (`--web`), and a
planner that routes a prompt itself (`--diy`). `lm index find X` answers
"where is X" over a repo. The extension uses only one-shot `q` with a
document. A chat with history, and an agent mode that can search, need no new
model capability; they need a thread store and a host op that passes the
conversation.

## Consistency, measured

From `e2e/census.mjs`, baseline before any redesign, dark theme:

| Measure | Today | Target in the spec |
|---|---|---|
| Distinct button corner radii | 5 (0, 3, 4, 5, 6px) | 2: one for buttons, full round for icon buttons |
| Buttons with a border | 30 of 50 | Only `variant="outline"` |
| Button font sizes | 7, 18 at Chrome's default 13.33px | 1 per size step |
| Text sizes | 13 (4.5px to 26px) | A named scale of about 6 |
| Icon-only controls without a label | 0 of 22 | 0 |
| Controls with no transition | 41 of 69 | 0 for interactive controls |

## Open questions for the owner (phase E, one decision page)

1. AI: a chat panel per file, a global AI section in the sidebar, or both;
   what agent tasks first (search files, summarise a folder, answer across
   files).
2. Find in file: one find bar shared by the preview and the file page, or
   Chrome's own find on file pages.
3. Deep search: a results view separate from the listing, or keep results in
   the listing with grouping by folder.
4. Path bar: which of editable path, copy path, back/forward, jump to recent,
   search-from-here.
5. Icons: which icons read wrong today (an icon sheet will be on the page).
