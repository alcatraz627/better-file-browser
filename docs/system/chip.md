# Chip

A short label in a pill: a tag on a file, a filter in a lens, a fact on a
comment, a value in a list field. One class, `chip`.

## When to reach for it

- A tag or a fact that sits beside other content: a `<span class="chip">`.
- A filter the reader turns on and off: a `<button class="chip">` with `.on`
  or `aria-pressed`.
- A value someone can remove: a chip ending in an xs Button.
- Not for an action: that is a Button, even when small and round. Ask's quick
  questions are sm outline pill Buttons for this reason.

## Contract

| | |
|---|---|
| Sizes | `data-size`: sm 18 in listing rows, md 22 (the default) everywhere else |
| Colour | `--chip` on the element: a tag's colour, used for the border at 55%, the fill and the on state |
| Dot | a leading `<i>` with a background is a 6px colour dot |
| Fill | `data-fill`: a soft fill instead of a border (comment facts, list-field values) |
| Tones | `data-tone`: `due` (orange), `done` (green), `quiet` (neutral grey fill) |
| Text | `data-mono` for code-like values (`.pdf`); a long label ends in an ellipsis inside a `<span>` |
| Add | `data-add`: a dashed border, for a suggestion that adds something when clicked |
| On | a filter chip sets both `.on` and `aria-pressed`: text `--tx` on its colour at 22% |
| Remove | `<button class="btn" data-icon data-size="xs" data-tone="danger">` as the last child |
| Keys | a row of filter chips is one Tab stop with arrows (RovingFocus); Backspace in a list field removes the last value |

## Narrow

A row of chips wraps; in a listing cell it clips, and the last chip shows
`+N` for the rest (`.fe-chip-more`).

## Sanctioned and banned

- Banned: a pill drawn by its own class (border-radius, padding and fill on
  `.fe-…-tag`). Use `chip` and keep the old class only as a hook.
- Banned: text such as `×` for remove. Use the xs Button with the close icon.

## Snippet

```html
<button type="button" class="chip fe-lens-tag on" style="--chip:#f78166"><i style="background:#f78166"></i>work</button>
<span class="chip" data-fill data-tone="due">${UI_ICON.clock}Tue, Nov 3<button class="btn" data-icon data-size="xs" data-tone="danger" title="Clear the due date">${UI_ICON.close}</button></span>
```

## What it replaced

Two conflicting `.fe-chip` rules (listing tags and note properties), two
meanings of `.fe-chip-x` (a Settings value pill and a remove button), the
lens tags, the comment facts and the Settings rule suggestions.
