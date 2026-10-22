# Toolbar

A row of controls along the top or bottom of a page or panel: the path bar,
the listing toolbar, the file bar, the preview header, the editor bar, the
image and HTML bars, and the status bar. One class, `bar`.

## When to reach for it

- Controls that act on the page or panel below them: a bar along its edge.
- A few tools inside content (a code block's copy, a comment's tools, a lens's
  add button): an inset bar, `data-inset`.
- Not for a form: a panel of labelled fields (sort, filter) is FieldRows.

## Contract

| | |
|---|---|
| Height | `--bar-h`, 40px, for every bar along an edge (owner, 2026-10-22) |
| Sides | 12px (`--sp-5`) |
| Gap | 4px between controls; `<span class="bar-sep">` between groups makes 12px |
| Controls | md (28px) Buttons, TextBoxes, Dropdowns and Segmented groups |
| Inset | `data-inset`: no height or side padding of its own; the place sets them, the gap stays 4px |
| Surface | each bar keeps its own background and hairline; the part sets size and spacing only |

## Narrow

A bar that can run out of room wraps (`flex-wrap`, as the editor and image
bars do) or folds its middle (the path bar's `…`). A docked preview's header
turns its text buttons into icon buttons.

## Sanctioned and banned

- Banned: height, padding or gap set on a bar by its id or class. The ratchet's
  space rule counts raw pixels; the bars walk checks the measured result.
- Banned: a hand-made separator (`.fe-tb-sep`, `.fe-ed-sep`). Use `bar-sep`.

## Snippet

```html
<div id="fe-fp-bar" class="bar">…<span class="bar-sep" aria-hidden="true"></span>…</div>
<div class="bar fe-cm-tools" data-inset>…</div>
```

## What it replaced

Eight bars with five heights (30 to 49px), two side paddings (12 and 14px)
and gaps from 2 to 14px, plus two separator styles. The path bar grows from
36 to 40px and the status bar from 30 to 40px. `e2e/bars-walk.mjs` measures
every bar.
