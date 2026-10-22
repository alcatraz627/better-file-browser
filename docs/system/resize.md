---
reader: a developer adding or changing anything the reader can resize
---

# Resize

One way to change a size: drag a handle, or focus it and press the arrows.
A double-click goes back to the first size.

It serves the sidebar edge, the preview's corner and docked edge, the
listing's columns, and every rendered table.

## Contract

| | |
|---|---|
| Code | `resizable(handle, spec)` in `src/resize.ts` |
| Drag | follows the pointer; saves when it lets go |
| Keys | Left and Right move 16px; Shift moves 64px |
| Corner keys | Up and Down too, on a corner grip |
| Reset | double-click |
| Look | class `rz`: a 2px accent line that grows in on hover, drag or focus |
| Corner look | `data-axis="xy"` keeps two faint lines at rest |
| Screen readers | `role="separator"`, one Tab stop, a label |

## Tables

`src/col-resize.ts` serves every table with class `fe-rz`, from one handler.

- A column's right edge can be grabbed in its header or in any cell below.
- The resize cursor shows wherever an edge can be grabbed.
- A data table wider than its box starts with widths from its content.
- Each column gets room for nine cells in ten, between 56 and 420px.
- Text is measured in the cells' own font.
- A table that fits its box is left to the browser.
- Column edges are not Tab stops: a table can have many columns.

## Banned

- A hand-written pointer or mouse drag for a size. Use `resizable`.
- For a drag that starts in a table cell, use `startDrag`.

## What it replaced

Five resizers with three looks and three event models. None of them answered
the keyboard, and table columns could be dragged only from the header.
