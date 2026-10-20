---
reader: anyone styling the explorer; the owner when judging the sample sheet
---

# Design system

<!-- sessions: bfb@2026-10-20 -->

Every colour, size, gap and animation in the explorer comes from the tokens
below, and every button, toolbar, section title and markdown block is one of
the primitives below. A value that is not here is a bug. The census
(`e2e/census.mjs`) measures how far the live UI is from this.

## Colour: one neutral ramp per theme

Surfaces step up in lightness in dark mode and down in light mode, one step
per layer. Text has three weights of emphasis. Accent colours are unchanged.

| Token | Use | Dark | Light |
|---|---|---|---|
| `--bg` | Page | `#0d1117` | `#ffffff` |
| `--s1` | Bars, sidebar, code blocks | `#151b23` | `#f6f8fa` |
| `--s2` | Raised: table header, hover card, inline code | `#1c232d` | `#eff2f5` |
| `--s3` | Pressed, selected | `#252e3a` | `#e5e9ee` |
| `--bd` | Hairlines | `#2a313c` | `#dde3e9` |
| `--bd2` | Control borders, dividers that must show | `#3a434f` | `#c9d1d9` |
| `--tx` | Body text | `#e6edf3` | `#1f2328` |
| `--mt` | Secondary text, labels | `#9aa4af` | `#59636e` |
| `--dm` | Tertiary text, placeholders, disabled | `#6e7781` | `#8c959f` |
| `--shade` | The semi-transparent fill for shaded buttons | `rgb(139 148 158 / .14)` | `rgb(110 119 129 / .10)` |
| `--shade2` | Shade on hover over a shaded button | `rgb(139 148 158 / .24)` | `rgb(110 119 129 / .18)` |

`--dm` was `#484f58` in dark, which failed contrast for any text; it is
lifted to `#6e7781`.

## Type

One family for UI and reading, one for code. UI sizes are fixed steps; reading
sizes are relative to the reader size in Settings, so every heading and code
size moves with it.

| Role | Size | Weight | Use |
|---|---|---|---|
| `micro` | 11px, caps, +.06em | 600 | Section labels, table headers |
| `small` | 12px | 400 | Metadata, status bar, tooltips |
| `ui` | 13px | 400 | Controls, sidebar rows, lists |
| `ui-strong` | 13px | 600 | Titles in bars and dialogs |
| `title` | 15px | 600 | Dialog and panel titles |
| reading body | `--rd-size` (15px default) | 400 | Markdown, notes |
| h1 / h2 / h3 / h4 | 1.75 / 1.4 / 1.15 / 1em | 600 | Markdown headings |
| code | .875em of its context | 400 | Inline and block code |

## Space, shape, motion

- Space steps: 2, 4, 6, 8, 12, 16, 20, 24, 32px. Nothing else.
- Radius: 4px for chips and inline code, 6px for controls and blocks, 10px
  for panels and dialogs, full round for icon buttons and pills.
- Motion: `--t-fast` 120ms (hover, press), `--t-base` 180ms (open, close,
  collapse), `--t-slow` 260ms (panels, sidebar). Easing
  `cubic-bezier(.2,.8,.2,1)`. Under `prefers-reduced-motion` every duration is 0.

## Button

Plain by default: no border, no fill, text colour `--mt`, `--tx` on hover.

| Attribute | Values | Effect |
|---|---|---|
| `data-variant` | (none), `solid`, `outline`, `shade` | solid: accent fill, white text. outline: `--bd2` border. shade: `--shade` fill always |
| `data-hover-shade` | present or absent | Shows `--shade` on hover; on a shaded button it shows `--shade2` |
| `data-icon` | present or absent | Icon only: a circle, 26px (24px in dense bars), the label lives in `title` |
| `data-size` | `sm`, (md) | 22px or 26px tall; font `small` or `ui` |

Every button gets the `--t-fast` transition on colour and fill, a 2px focus
ring in `--ac`, and `copied`, `on` and `busy` states drawn the same way
everywhere (copied: a green check for 3s).

## Toolbar

One height (36px), 8px side padding, 4px between controls, 12px between
groups, icon buttons with `data-hover-shade`. The preview header, AI bar, file
bar, editor toolbar and listing toolbar all use it. A toolbar narrower than its
content wraps its groups, never its buttons.

## Section title

Icon, title, optional subtitle, optional actions on the right. Used by sidebar
sections, dialog headers and panel headers.

```
[icon] TITLE ··········································· [+] [⋯]
       optional subtitle in small, --dm
```

Sidebar sections share it plus a divider below, collapse on the title, and a
drag handle on the divider that resizes the section's height.

## Markdown reading

One stylesheet, used wherever markdown renders (file page, preview, notes,
dialogs, AI answers). Contexts change only `--rd-size`.

- Block rhythm: every block (paragraph, list, code, table, quote, alert)
  has `0 0 .9em` margin. A list item's paragraphs have no margin of their own,
  so loose and tight lists look the same; items are .35em apart.
- Headings: 1.6em above (none when first), .5em below. h1 and h2 carry a
  `--bd` hairline with .3em padding; h3 and below do not.
- Inline code: `--s2` fill, no border, 4px radius, .1em .4em padding.
- Code block: `--s1` fill, `--bd` hairline, 6px radius. Header row shows the
  language in `micro` and an icon copy button (`data-icon data-hover-shade`)
  on the right. Unlabelled blocks are coloured as markdown-ish text: headings,
  list markers, `<placeholders>` and `key:` prefixes.
- Tables: `micro` header on `--s2`, rows divided by `--bd` hairlines only (no
  vertical lines, no zebra), 8px 12px cells.

## File metadata

One record per file, built once and shown by one component:

- Generic: name, kind icon, size, modified, path (click copies).
- Per type: lines and words (text), headings (markdown), rows and columns
  (CSV/TSV), keys (JSON/YAML), dimensions (images), pages (PDF).

The preview header shows name, kind and size; the status bar shows the rest
with icons, at `small` size, and the path copies on click.

## Rulings, 2026-10-20

From the decision page `bfb-edit-and-sections` (answer `D1a D2a D3b`):

- **Editing a file is in place.** Edit turns the reading column into coloured,
  numbered source. A floating pill at the top right holds the save state, a
  preview toggle and Done. There is no second bar and no fixed split.
- **A folder that is not allowed yet asks once, in a popover from the Edit
  button:** Allow folder, Just this file, or Cancel, with the 14-day backup
  note. Settings is not the way in.
- **Every sidebar section uses the icon, title and subtitle header**, with
  actions on the right, a divider below, collapse on the title and a drag
  handle on the divider. Dialogs and panels use the same title. (The sidebar
  part is superseded by the lens rail below: a lens has one title and no
  stacked sections to collapse or resize. Dialogs and panels keep it.)

From the decision page `bfb-design-directions` (answer `D1d D2d D3d D4a`,
judged against `ui-principles.md`):

- **Visual direction: Soft.** 14px UI, 36px rows, 10px corners, sidebar and
  main as floating cards, no row lines, status as pills. The owner wants more
  exploration of its colours, elements and groups before tokens are fixed:
  "D but need to explore more with colors and elements and groups". A second
  variants round follows; until then the Soft values above are provisional.
- **Rows: Type and State are columns, in words.** The column is named "Type",
  not "Kind". State and tags share one column as chips; a state chip carries a
  coloured dot so it draws the eye; words stay minimal ("Changed", "Unreadable").
- **The sidebar is a rail of lenses: Places, Notes, History**, plus Search and
  Ask when they are built. Places merges Finder Favorites and System with Home
  derived from the account. Notes holds everything kept: saved folders and
  files, saved views, notes and tags, with one filter and one tag row. History
  holds recent folders, files and closed tab sets with ages. Every lens has a
  title, a one-line subtitle, an empty state that offers the next step, and a
  filter only above about eight rows.
- **Soft, round 2** (decision page `bfb-soft-round2`, answer `D1b D2a D3d`):
  - Colour: Slate and teal is the default palette. Violet, Sand and rose, and
    Ink are offered in Settings, so every palette must work with the same
    tokens: "b default, but keep the design system coherent enough that I can
    pick any of these 4 from the settings".
  - Elements: selection and the active lens are a soft wash, never a ring or
    a thick curved border, and the selected wash is distinct from hover yet of
    the same family: "keep it soft, thick curved borders look bad, a light bg
    is often the best; different and compatible with the hover bg".
  - Groups: foldable with a chevron and count, on a soft card background:
    "d. but you can give them a soft card bg like c".
- **Contents lives in a right-hand rail on the file page**, "On this page",
  tracking the reading position. Headings show depth by indent and a small
  step in text size. A button above the list collapses and expands it. Find
  in file sits in the file bar on the right, beside Edit and Copy.
