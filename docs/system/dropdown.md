# Dropdown

A button showing the current choice that opens a list of options: sort and
group in the toolbar panels, the type filter, Settings choices, and the Ask
model picker. Built by `ddHtml()` in `src/controls.ts` and wired by
`upgradeControls()`. There is no native `<select>` in the extension.

## When to reach for it

- One choice from a list too long for Segmented, or whose labels are long.
- Options that come in families (local models, Gemini models): give each a
  `group`.
- Not for actions: a list of things to do is a Menu.

## Contract

| | |
|---|---|
| Markup | `ddHtml(id, opts, title, size?)`: `.fe-dd` holding a `.fe-dd-btn` |
| Options | `{ value, label?, icon?, hint?, group? }`; options sharing a `group` sit under its name |
| Value | `value` property, `change` event; mirrored to `data-value`, and the options to `data-opts`, for code outside the script |
| Late options | `setOptions(opts)` replaces the list (models arrive after load) |
| A missing value | a saved value no longer listed still shows on the button |
| Sizes | md 28 (default), lg 32 for dialogs |
| List | one floating list, opened through the Layer service; closes on pick, Esc, Tab or a click outside |
| Keys | Arrow Up or Down opens it; arrows move, Home and End jump, typing jumps to a match, Enter or Space picks |

## Narrow

The button keeps a 160px minimum width unless its place sets one; the label
ends in an ellipsis. The list is at least as wide as the button.

## Sanctioned and banned

- Sanctioned: a leading status dot laid over the button's padding, as the Ask
  picker does.
- Banned: a native `<select>`; `e2e/check-system.mjs` counts them
  (`js-native-control`).
- Banned: setting a dropdown's height from its context. Pass the size.

## Snippet

```ts
ddHtml('fe-ask-model', [{ value: '', label: 'Default' }], 'Which model answers')
pick.setOptions([{ value: 'big', label: 'big', hint: 'gemma4:26b', group: 'On this machine' }])
```

## What it replaced

The Ask lens's native select with optgroups, and the 28px height override in
the sort and filter panels.
