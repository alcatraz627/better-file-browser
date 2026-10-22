# SectionTitle

The heading over a part of the page: a dialog's title, a Settings pane's
header, the contents or comments rail's title, a Settings group, a sidebar
section. One class, `sect`, at one of three levels.

## Contract

| Level | Looks like | Where |
|---|---|---|
| `page` | a tile, then a title (`--fs-xl`, 650) over a line (`--fs-md`, `--dm`) | dialog title, Settings and Help pane headers |
| `panel` | an icon, a title (`--type-ui`, 600, `--tx`) and a count | contents and comments rail |
| `group` | a small capital label (`--type-micro`, 600, .07em, `--dm`) | Settings groups, sidebar sections |

Markup: `<h3 class="sect" data-level="…">`; for `page`, the title and line sit
in a `.sect-tx` as its first and second child. Actions go last, in `.sect-acts`,
pushed to the end. The place sets the padding; the part sets type, gap and
alignment.

## Sanctioned and banned

- Banned: a heading's font size, weight, case or colour set by its own class.
- Not a SectionTitle: a status line (`.fe-st-ai-head`) or a tab's label
  (`.fe-tab-head`), which the ledger listed.

## What it replaced

The dialog title and pane header type rules, the rail title, the Settings
group header (two rules that disagreed at 10 and 13px), and the sidebar
section label, and the group labels in the palette, the key map and Help.
Settings group labels move from 10 to 11px to match the sidebar's. The rail
title moves from 12 to 13px. Help's section labels go from 650 to 600 weight.

With Lists, the comments rail's group labels (`.fe-cm-group`), the saved
items' tag groups (`.fe-sv-tag`) and the notes groups (`.fe-nt-grp`) joined
the group level too; their fold is a Disclosure (docs/system/disclosure.md).
