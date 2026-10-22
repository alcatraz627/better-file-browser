# Disclosure

The chevron on anything that folds: a History section, a tree folder, a Saved
or Notes group, the comments panel's Done group, a JSON tree node. It points
down while open and turns right when folded.

## Contract

The icon is `DISCLOSE` from `src/icons.ts` (an SVG with class `chev`). One
rule turns it, reading the fold state the markup already carries:

- a button with `aria-expanded="false"`, or
- a `<summary>` whose `<details>` is closed.

The chevron is a direct child of that button or summary. The turn eases over
`--t-fast`. Whatever folds sets `aria-expanded` as the fold starts, so the
chevron moves with the click, not after the animation.

A group label that folds is also a SectionTitle at the group level
(`class="sect" data-level="group"`), so it reads as a heading.

## Sanctioned and banned

- Banned: a rotate rule written for one kind of fold.
- Not a Disclosure: a dropdown or menu button's chevron (`aria-haspopup`),
  which opens a list and does not turn.

## What it replaced

Five turn rules written separately (sidebar sections, Saved groups, tree
folders, Notes groups, JSON trees) at 10 and 12px. Saved group chevrons grow
from 10 to 12px. The Saved, Notes and comments group labels take the
SectionTitle group type (11px, 600, .07em); the size is unchanged, and the
Notes groups' letter spacing moves from .06 to .07em.

Checked by `e2e/disclosure-walk.mjs`, which reads the chevron's turn open and
folded on History, the tree and a JSON tree, and fails if a folding chevron
sits outside the rule.
