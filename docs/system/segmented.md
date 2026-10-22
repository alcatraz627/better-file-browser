# Segmented

A row of buttons where exactly one is on: the listing's view switch, sort
direction, and the Settings choices such as Click a file and Dates. Built by
`segHtml()` in `src/controls.ts` and wired by `upgradeControls()`.

## When to reach for it

- Two to six choices that are all worth seeing at once: Segmented.
- More choices, or long labels: Dropdown.
- On or off: a Toggle button or a Switch, not a two-item Segmented.

## Contract

| | |
|---|---|
| Markup | `segHtml(id, opts, title, size?)`: `.fe-seg` with `role="radiogroup"`, items `.fe-seg-b` with `role="radio"` and `data-v` |
| Value | the host has a `value` property and fires `change`, like a `<select>` |
| Sizes | md (default): a 28px group with 24px items. lg: 32 with 28, for dialogs |
| Items | rounded squares (`--r-sm`) inside the group (`--row-r`); an icon-only item (`.ico`) is square and needs a `hint`, which becomes its name |
| On | `.on` and `aria-checked="true"`: accent text on the `--on` wash, the same as a Button's on state |
| Keys | one Tab stop; arrows move the choice and Home and End jump (RovingFocus) |

## Narrow

The group does not wrap or collapse. A bar that runs out of room hides the
whole group or moves it into an overflow menu (Bars, slice 5).

## Sanctioned and banned

- Sanctioned: the editor's mode switch keeps a pill shape (`.fe-fe-modes`)
  because it sits inside the editor pill. Only the radius differs.
- Banned: a hand-built group of buttons with its own `.active` look. The view
  switch was one; it is now `segHtml('fe-view-group', …)`.
- Banned: setting a Segmented's height from its context. Pass the size.

## Before you adopt this

1. Is exactly one choice always on? If none can be on, it is a row of Toggles.
2. Do icon-only items have a hint? It is their only name.

## Travels with

RovingFocus from `src/layer.ts`; the key map, whose `view-*` commands click
the view switch's items.

## Snippet

```ts
segHtml('fe-st-click', [{ value: 'look', label: 'Preview', icon: UI_ICON.eye }, { value: 'go', label: 'Open', icon: UI_ICON.external }], 'What a click on a file does', 'lg')
```

## What it replaced

The view switch's own buttons and `.active` rules (`#fe-view-group
.fe-view-btn`), a second `.fe-seg` rule that added a border, the 24px height
override in the sort and filter panels, and the editor modes' own button
rules. The rail (`.fe-rail-btn`) is Tabs, not Segmented; it moved to the 32px
control height here and moves into Tabs with Lists.
