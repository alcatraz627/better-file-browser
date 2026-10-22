# Button

Every clickable control that does one thing when pressed is a `<button class="btn">`.
One part covers text buttons, icon buttons, toggles and busy buttons; the old
per-surface classes only say where a button sits and when it shows.

## When to reach for it

- An action in a bar, a row, a panel header, a dialog or a menu: Button.
- An action shown as an icon alone: Button with `data-icon`, and a name in
  `title` or `aria-label`.
- Something that stays on (Wrap, Hidden files, a lens that is open): Button
  with an on state.
- Not for a link to a place (use `<a>`), a choice of one from a few (Segmented,
  slice 4), a checkbox or switch (slice 4), or a crumb (Breadcrumb, slice 5).

## Contract

| Attribute | Values | Does |
|---|---|---|
| `class="btn"` | | the part; no other class may set size, colour, border, font or padding |
| `data-size` | `xs` 18, `sm` 22, `md` 28 (default), `lg` 32 | height from `--ctl-*`; icon 10, 12, 14, 16px |
| `data-variant` | plain (default), `shade`, `outline`, `solid` | fill and border |
| `data-icon` | | square at its size and round; text is not allowed |
| `data-tone` | `danger`, `accent` | danger turns red on hover; accent is accent text at rest |
| on | `.on`, `.active`, `aria-pressed="true"`, `aria-expanded="true"` | accent text on the `--on` wash |
| disabled | `disabled`, `aria-disabled="true"` | 45% opacity and no hover; a plain button stays clear, a variant keeps its fill dimmed |
| busy | `aria-busy="true"` | a spinner in place of the icon |
| done | `data-done` | green text; the caller removes it after a moment |

States follow spec §5.1: rest `--mt`, hover `--tx` on `--hover`, pressed
`--s3`, focus a 2px accent ring at 1px offset. Text is `--type-ui` (13px).

## Sizes by place

| Place | Size |
|---|---|
| Close and remove inside a chip or tab | `xs` |
| Row actions, chips' tools, comment tools, settings rule tools | `sm` |
| Bar and toolbar buttons, Ask tools | `md` |
| Dialog close and dialog actions, lens add buttons | `lg` |

## Narrow

The button does not collapse itself. A bar decides what its buttons show
when narrow (Bars, slice 5). An icon button never shrinks below its size
(`flex-shrink:0`).

## Sanctioned and banned

- Sanctioned: `data-icon` with any size and variant; `solid` only for the one
  primary action of a surface. Today that is Ask send, comment Reply, Post,
  Save and Accept, the editor's Done (a pill inside the editor pill), and the
  file page's folder action.
- Banned: setting `width`, `height`, `padding`, `border*`, `background*`,
  `color`, `font*`, `line-height` or `cursor` on one of the old icon-button
  classes. `e2e/check-system.mjs` counts these as `css-button-paint`, and the
  baseline is zero. Two exceptions: a tab's buttons over its label
  (`:not(.on)`) keep their backing, and a glyph drawn inside a button
  (`::before`) is content.
- Banned: an icon button without a name. `e2e/buttons-shots.mjs` checks every
  visible one.

## Before you adopt this

1. Is it an action? If it navigates, it is a link.
2. Which size is the place? Use the table above; do not pick by eye.
3. Does it need to look different from its neighbours? Usually not: use a
   tone or variant, never a new class with colours.

## Travels with

Icons from `control-icons.ts` or `icons.ts`; the key from the key map in its
`title` ("Close (Esc)"); the command layer for what it runs.

## Snippet

```html
<button class="btn" data-icon data-size="sm" data-tone="danger" title="Remove">…svg…</button>
<button class="btn" aria-pressed="true">…svg… Wrap</button>
```

## What it replaced

`.fe-pbn`, `data-hover-shade`, and the paint on 14 icon-button classes:
`fe-ibtn`, `fe-lens-ib`, `fe-ask-ib`, `fe-ask-send`, `fe-act-btn`, `fe-tag-btn`,
`fe-rm-btn`, `fe-tab-more`, `fe-tab-x`, `fe-cm-ib`, `fe-cm-x`, `fe-dlg-close`,
`fe-nt-props`, `fe-nt-tab`. Still to move: `.fe-hint-action` (a link-styled
text action), `.fe-tree-toggle` (Lists, slice 7), crumb buttons (slice 5),
and the view switch (Segmented, slice 4). No caller sets busy or done yet;
`run(action)` adopts them in slice 8.
