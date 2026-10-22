# Notice

A line that tells the reader something about the page itself: the file is
empty, the text was cut short, it could not render, another program changed
it. One class, `notice`.

## Contract

| | |
|---|---|
| Look | `--type-small` text in `--dm`, 6px by 12px padding, wraps |
| Tone | `data-tone`: `danger` (could not read, conflict), `warn`, `ok`; none for plain facts |
| Actions | Buttons inside it act on what it says (Reload from disk, Overwrite, Retry) |

## Sanctioned and banned

- Banned: a raw colour for an error line. Use `data-tone="danger"`.
- `.fe-ql-note` stays on preview notices as a hook: find in page uses it to
  tell that a page was cut short.

## What it replaced

The preview's note line and its `err` variant (`#f85149`), used by the
renderers, the format checker fallback, the preview and the note editor's
conflict and clash lines. The checker results card (`.fe-diag`) is an
expander and moves with Panels.
