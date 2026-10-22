---
reader: a developer grouping content inside a panel or a page
---

# Card

A bounded group inside a panel or a page: a Settings card, a comment thread,
the checker's results, a Help card.

## Contract

| | |
|---|---|
| Class | `card` |
| Surface | `--card`, a `--bd` hairline |
| Corner | `--row-r`, 8px: the inner corner, a step inside a panel's 12px |
| Padding | set by the place |
| States | the place adds hover, selected and focus looks (a thread's accent ring) |

## Not a Card

- A popover or a dialog: those are Panels.
- A row in a list: that is a ListRow (Lists).
- The AI status block in Settings sits unboxed inside its card.
- The keyboard drawing in Help (`.fe-km-board`) and the AI hero
  (`.fe-ai-hero`): pictures with their own tinted surface, not groups.

## What it replaced

Four card skins: Settings cards (three rules, 12px), comment threads (12px),
checker results (10px on `--side`), Help cards and key-map groups (12px). All
now take 8px, as the corner rule says inner cards do.
