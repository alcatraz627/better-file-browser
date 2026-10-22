---
reader: a developer adding a dialog or changing Settings or Help
---

# Dialog

A Panel over a Scrim with a page title, side tabs and one pane at a time.
Settings and Help are Dialogs.

## Contract

| | |
|---|---|
| Code | `renderDialog(spec)` and `mountDialog(id)` in `src/dialog.ts` |
| Parts | `panel` box, `scrim` behind, page-level SectionTitle, side tabs, panes |
| Title | written once, in the dialog block of `src/styles.ts` |
| Actions | size and close, top right, in `.fe-dlg-acts` |
| Keys | `[` and `]` change page; Esc closes; Tab stays inside |
| Memory | the last page and the size, per dialog |
| Narrow | under 700px the tabs run across the top |

## Rules

- Every `.fe-dlg-*` rule is written once. The ratchet's `css-dup-selector`
  rule counts any selector defined twice.
- A page with an icon gets a header: a large tile, its title and a line.

## What it replaced

Three generations of dialog CSS laid over each other. The title, box, tabs
and pane each had two to four rules, and the narrow layout undid them.
