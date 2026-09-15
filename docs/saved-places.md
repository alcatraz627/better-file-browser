# Saved places: one sidebar model instead of Bookmarks + My Places

Status: proposal, awaiting the owner's merge-vs-keep ruling. Written 2026-09-15.

## What exists today

Five sidebar sections, four of them lists of folders (`src/main.ts:196-220`):

| Section | Add path | Rename | Reorder | Remove | Storage key |
|---|---|---|---|---|---|
| Bookmarks | star button in the path bar (`main.ts:625`) | no | drag (`main.ts:1206`) | ✕ | `bfb-bookmarks-v2` |
| My Places | `+` in the section header (`main.ts:1300`) | double-click label | drag (`main.ts:1285`, a copy of the Bookmarks block) | ✕ | `bfb-places-v1` |
| Recent | automatic, last 6 visited | | | | `bfb-recents-v1` |
| Finder Favorites | hardcoded, `main.ts:150` | | | | none |
| System | hardcoded Root and Home | | | | none |

Bookmarks and My Places store the identical record, `{ path, label }`
(`src/types.ts:12` and `:22`). They differ only in the add gesture and in
whether the label can be edited. The two drag-reorder blocks are the same forty
lines twice. A folder can sit in both lists at once. Finder Favorites carries
the owner's personal paths in source, which is also the #34 Web Store blocker.

## Why the owner notices

- Two places to look for a folder you saved, and two gestures to save one.
- The star list cannot be named, so a bookmarked `src/` from three projects
  reads as `src`, `src`, `src`.
- No way to group or colour anything, so the list is flat and grows.

## Proposal

One section, **Saved**, backed by one record:

```ts
interface SavedPlace {
  path:   string;      // identity, one entry per folder
  label:  string;      // editable, defaults to the last path segment
  tags?:  string[];    // free-form, e.g. ["work", "versable"]
}
interface Tag { name: string; color: string }   // colour lives on the tag
```

Rules:

- **The star and the `+` both add to Saved.** The star stays as the one-click
  toggle for the current folder; `+` adds and drops you straight into rename,
  as it does today.
- **Tags group the sidebar.** Items with a tag render under that tag's
  sub-heading, coloured by the tag. Untagged items render first under Saved.
  A tag is created by typing it; its colour is picked from a small palette and
  can be changed from the tag heading.
- **Colour belongs to the tag, not the item.** One colour system, and a
  folder in two tags is coloured by the group it renders in. Per-item colour is
  a possible follow-up if tag colours turn out not to be enough.
- **Finder Favorites become seeded Saved items**, created on first run under a
  `Finder` tag, derived from the first `/Users/<name>/` seen in the visited path
  rather than hardcoded. The owner can rename, retag or delete them like any
  other item. This removes the personal paths from source.
- **System stays** as a fixed two-row section. **Recent stays** as is.

Migration on first load: union of `bfb-bookmarks-v2` and `bfb-places-v1`,
deduplicated by path, Places label wins where both exist. Old keys are left in
place for one release so a rollback loses nothing.

## What the change costs in code

- `src/places.ts` gains `setTags`, `tags-of` helpers; the existing four
  functions carry over unchanged. New pure `groupByTag` for the renderer.
- `src/storage.ts`: `SAVED_KEY`, `TAGS_KEY`, `getSaved`/`saveSaved`, the
  one-time migration. `getBM`/`getPlaces` become aliases for a release, then go.
- `src/render.ts`: `renderSavedList` replaces `renderBMList` and
  `renderPlacesList`; one drag-reorder block in `main.ts` replaces two.
- Tag editing UI: a small inline chip row on hover of a Saved item, plus a
  colour dot on each tag heading. No modal.
- Sidebar surface removed: the "Bookmarks" and "My Places" headings and the
  hardcoded Finder Favorites block. Everything they showed reappears under
  Saved, so this is a rename and merge, not a loss. Parity check: every
  bookmark and place present before the migration appears under Saved after
  it, with its label and order.

## The alternative: keep both

Keep two lists but make them consistent: rename on bookmarks, one shared
drag block, and tags on both. This costs about the same and leaves the
question "which one do I put it in" unanswered, which is the owner's actual
complaint. Not recommended.

## Decision needed

Merge into Saved with tag colours (recommended), or keep two lists made
consistent. A second smaller call: seed the Finder Favorites as Saved items,
or drop them entirely and let the owner re-add what they use.
