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
| `data-variant` | plain (default), `shade`, `surface`, `outline`, `solid` | fill and border; `surface` is a solid fill for a button floating over content (row actions over a file name) |
| `data-shape` | `pill` | round ends on a text button, for a pill bar (the editor's Done) |
| `data-icon` | | square at its size and round; text is not allowed |
| `data-tone` | `danger`, `accent` | danger turns red on hover; accent is accent text at rest |
| on | `.on`, `.active`, `aria-pressed="true"`, `aria-expanded="true"` | accent text on the `--on` wash |
| disabled | `disabled`, `aria-disabled="true"` | 45% opacity, its rest look, and no hover or pressed state of any variant or tone |
| busy | `aria-busy="true"` | a spinner in place of the content, icon and label |
| done | `data-done` | green text; the caller removes it after a moment |

States follow spec §5.1: rest `--mt`, hover `--tx` on `--hover`, pressed
`--s3` (a solid button darkens instead), focus a 2px accent ring at 1px
offset. Text is `--type-ui` (13px). The `hidden` attribute hides a button.

## Sizes by place

| Place | Size |
|---|---|
| Close and remove inside a chip or tab; buttons inside a text field (find's previous and next) | `xs` |
| Row actions, comment tools, the tab bar's own buttons, the code-block copy, rule tools, Settings group header buttons | `sm` |
| Bar and toolbar buttons, Ask tools, Settings icon buttons (`.fe-ibtn`), dialog and preview close | `md` |
| Dialog actions (Keys, Export, Import), lens add buttons | `lg` |

These follow the owner's Appendix B table in docs/plan/component-system.md.

## Narrow

The button does not collapse itself. A bar decides what its buttons show
when narrow (Bars, slice 5). An icon button never shrinks below its size
(`flex-shrink:0`).

## Sanctioned and banned

- Sanctioned: `data-icon` with any size and variant; `solid` only for the one
  primary action of a surface. Today that is Ask send, comment Reply, Post,
  Save and Accept, the editor's Done, and Allow folder in the allow-editing
  popover.
- Banned: size, padding, border, background, colour, font, cursor, display
  or transition set on one of the old button classes, or on a `.btn` reached
  through its context (`#bar .btn{height:…}`). `e2e/check-system.mjs` counts
  these as `css-button-paint`, and the baseline is zero. Two exceptions: a
  tab's buttons over its label (`.fe-tab:not(.on) .fe-tab-x`) keep their
  backing, and a glyph drawn inside a button (`::before`) is content.
- Banned: text in a `data-icon` button. Use an icon (`UI_ICON.more`, `close`).
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

`.fe-pbn`, `data-hover-shade`, and the paint on 17 button classes:
`fe-ibtn`, `fe-lens-ib`, `fe-ask-ib`, `fe-ask-send`, `fe-act-btn`, `fe-tag-btn`,
`fe-rm-btn`, `fe-tab-more`, `fe-tab-x`, `fe-cm-ib`, `fe-cm-x`, `fe-dlg-close`,
`fe-nt-props`, `fe-nt-tab`, `fe-md-copy`, `fe-ask-h-del`, `fe-st-rule-del`;
contextual rules in the toolbar, filter bar, comment tools and docked
preview header. The view switch moved to Segmented. Still to move:
`.fe-hint-action` and `.fe-toast-act` (link-styled text actions, Bars),
`.fe-sh-collapse` and `.fe-tree-toggle` (disclosures, Lists), crumb buttons
(Breadcrumb, Bars), and the chips' remove buttons (Chip). The code-block copy
uses `data-done`; `run(action)` adopts busy and done for actions in Services.
