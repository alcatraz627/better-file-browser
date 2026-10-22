# TextBox

Every place the reader types: filters, the path editor, Go to, search, Settings
fields, the comment box. The part is one class, `tb`, on an `<input>` or
`<textarea>`; the field's old class or id now only places it.

## When to reach for it

- One line of text: `<input class="tb">`.
- A note or a reply: `<textarea class="tb">`, which grows from one control
  high and can be dragged taller.
- A list of short values: the chip box (`chipsHtml`), which wraps chips and
  a borderless input inside the same surface and height.

## Contract

| | |
|---|---|
| Sizes | `data-size`: sm 22, md 28 (the default), lg 32 |
| Surface | `--bg` fill, `--bd2` hairline, `--row-r` corners, `--type-ui` text |
| Hover, focus | the hairline darkens on hover and turns accent on focus |
| Invalid | `aria-invalid="true"`: a danger hairline; the message goes in a toast or below |
| Disabled | 45% opacity |
| Textarea | `textarea.tb`: auto height from `min-height`, vertical resize |
| Leading icon | the search magnifier is a background image on the filter fields; it moves into a slot in cleanup |

## Sizes by place

| Place | Size |
|---|---|
| Sidebar and Comments filters, Go to, Settings fields, Search lens, key-map search | lg |
| Toolbar filter, filter-bar fields, path editor, crumb list filter, preview question | md |
| A menu's add field (new tag) | sm |

## Narrow

The field takes the width its place gives it (`width:100%` by default) and
never changes height.

## Sanctioned and banned

- Sanctioned: a box that holds a borderless input and other things (find in
  page, the palette, the Ask composer, the chip box) draws the surface on the
  box, not the input.
- Banned: height, padding, border, background, colour or font set on a
  field's old class or id. Set the size; the place only sets width and margin.

## Snippet

```html
<input id="fe-lens-filter" class="tb" data-size="lg" type="text" placeholder="Filter">
<textarea class="tb" rows="2" placeholder="Reply…"></textarea>
```

## What it replaced

Fifteen field styles with seven heights (26 to 34px), three corner radii and
two borders: the sidebar and Comments filters, `.fe-in-box` fields, the path
editor, Go to, the crumb list filter, Settings fields, the Search lens field,
the key-map search, the preview question, the comment box, and the new-tag
field. Find in page, the palette and the Ask composer keep their own boxes
for now; Bars and Panels take them.
