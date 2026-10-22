# Badge

A count in a small pill: open comments on a row, matches in a file, chats in
the history, threads on a document. One class, `badge`.

## When to reach for it

- A number about the thing beside it: Badge.
- A word, a tag or a fact: Chip.
- A state with no number (ready, cold, down): a status dot (`.dot`), which
  stays its own small part.

## Contract

| | |
|---|---|
| Sizes | `data-size`: md 18 (the default), sm 14 on an icon's corner |
| Tones | soft (the default): accent at 16% with `--tx`; `solid`: accent with `--tx-on-ac`; `quiet`: `--s2` with `--dm` |
| Content | digits in tabular figures, optionally after a 10px icon |
| Empty | an empty badge hides, so code can set `textContent = ''` |

## Sanctioned and banned

- Sanctioned: the place positions the badge (the Ask history count sits on
  its button's corner; the find count is indented under the name).
- Banned: a count pill drawn by its own class.

## Snippet

```html
<span class="badge fe-row-cm" title="2 open comments">${UI_ICON.comment}2</span>
<span class="badge fe-ask-n" data-size="sm" data-tone="solid"></span>
```

## What it replaced

The row comment count (`.fe-row-cm`), the find match count
(`.fe-find-badge`, which was an outlined pill), the document thread count
(`.fe-doc-n`), the Ask history count (`.fe-ask-n`) and the comments rail's
count (`.fe-rt-n`). Still separate: the Settings icon rules' match counts,
which move with Lists. A bare number in a heading (a tag group's or comment
group's count) is text, not a Badge.
