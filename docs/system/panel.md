---
reader: a developer adding or changing a surface that floats over the page or docks beside it
---

# Panel

A bounded surface with a head, a scrolling body and an optional foot. It
floats over the page on a Scrim, or docks into the page. The preview and the
Settings and Help dialogs are Panels.

## Contract

| | |
|---|---|
| Class | `panel` |
| Surface | `--card`, a `--pop-bd` hairline, `--pop-r` corner (12px), `--pop-sh` shadow |
| Layout | a column; it clips its content to the corner |
| Docked | `data-dock`: no corner, no border, no shadow; the place draws the seam |
| Opens | rises in; the Scrim fades in |
| Scrim | class `scrim`: the dimmed, blurred page behind a floating panel |
| Size | `data-size` `lg` or `xl`, from the size button; none is md |

## Size

One button in the title bar steps md, lg, xl. Each panel remembers its own.

| Size | Width | Height |
|---|---|---|
| md | the panel's own | the panel's own |
| lg | 85% of the window, never less than md | 90% |
| xl | the window less 16px each side | the window less 16px |

The owner asked for lg at 75%. The preview's own size is already about 79% of a
1400px window, so lg at 75% made it smaller. lg is 85% instead.

Code: `wireSize(button, panel, key)` and `SIZE_BTN(id)` in `src/panel-size.ts`.
Dragging the preview's corner, or double-clicking it, sets it back to md. In a
window narrower than about 1180px, md is already wider than 85%, so lg grows
only the height there.

## Not a Panel yet

These float or dock with a skin of their own and move later: the contents
rail when it peeks over a narrow page (`#fe-toc-rail`), the narrow sidebar
overlay (`#fe-side.open #fe-lenses`) and the allow-editing popover
(`#fe-allow`, a Layer).

## Docked preview and the sidebar

A docked preview folds the sidebar away while it shows. Closing it, or
floating it, brings the sidebar back to its own setting. Settings, Folders,
"Make room for a docked preview" turns this off. A floating preview leaves the
sidebar alone: it sits over a Scrim and needs no room.

## Banned

- A floating surface with its own corner, shadow or scrim colour.
- A size held only in pixels for a panel that has the size button.

## What it replaced

Two skins: the preview at a 10px corner, a `0 24px 64px` shadow and a `#0009`
scrim; the dialogs at 14px, `--pop-sh` and `#00000088`.
