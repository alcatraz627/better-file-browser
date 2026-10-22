# Slider

A slider over a fixed list of values, with the chosen value shown beside it:
the listing's Detail slider and the Settings sizes. Built by `sliderHtml()` in
`src/controls.ts` and wired by `upgradeControls()`.

## When to reach for it

- A value on an ordered scale where the steps matter less than the feel
  (density, interface size): Slider.
- A few named choices the reader should compare: Segmented.

## Contract

| | |
|---|---|
| Markup | `sliderHtml(id, values, unit, title, names?)`: `.fe-sld` holding a native range input and an `<output>` |
| Value | the host's `value` is the chosen value, snapped to the nearest stop when set |
| Events | `input` while dragging (preview live), `change` on release (save) |
| Names | with `names`, the output and `aria-valuetext` show the stop's name instead of the number |
| Keys | the native range keys: arrows, Home, End, Page Up and Down |

## Narrow

The host is 240px wide by default; a bar sets the input's width
(`#fe-density input` is 72px) and may hide the output.

## Sanctioned and banned

- Sanctioned: a bar may reorder the input and output with `order` and drop
  the output's backing, as the Detail slider does.
- Banned: a second range input outside `sliderHtml`.

## Snippet

```ts
sliderHtml('fe-st-uiscale', [80, 90, 100, 110, 125, 150], '%', 'Interface size')
```

## What it replaced

Nothing: it was already the only slider.
