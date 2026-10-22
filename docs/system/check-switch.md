# Check and Switch

Two on-or-off controls, both native check boxes underneath. A Check is an
option inside a form ("Match case" while searching). A Switch is a setting
that takes effect at once (Settings rows, a rule's enable).

## When to reach for which

- The choice changes how the next action runs: Check.
- The choice changes the app now and stays changed: Switch.
- A tool that stays on in a bar (Wrap, Hidden files): a Toggle button, not
  either of these.
- A markdown task-list box is content, not a control, and stays native.

## Contract

| | Check | Switch |
|---|---|---|
| Builder | `checkHtml(id, label, title, checked?)` | `switchHtml({ id?, title, checked?, small?, cls? })` |
| Markup | `<label class="fe-check">` around the input and its label | `<input type="checkbox" role="switch" class="fe-switch">` |
| Size | a 14px box in a 22px row | 34 by 20; small is 28 by 16 |
| On | accent fill with a tick | accent track, knob to the right |
| Mixed | `input.indeterminate = true` shows a bar | not supported |
| Keys | Space | Space |

Both read and write with the input's `checked` and fire `change`.

## Sanctioned and banned

- Banned: a raw `type="checkbox"` outside `controls.ts` and the markdown
  renderer. `e2e/check-system.mjs` counts them (`js-native-control`).
- Banned: `accent-color` to tint a browser check box; use Check.

## What it replaced

The search lens's two raw check boxes (`.fe-tl-opt`), and the two hand-written
switch inputs in Settings and the Files rules.
