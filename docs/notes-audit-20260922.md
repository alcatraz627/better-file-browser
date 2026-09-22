# Notes audit, 2026-09-22

Notes uses an ordinary Markdown folder, a native messaging host, a sidebar
list, and an editor in the preview panel. This review checked the implementation
and exercised the browser and host paths named below.

## Verified behavior

| Case | Evidence |
|---|---|
| Notes is visible before setup and opens the folder setting | `node e2e/smoke.mjs` in dark and light themes; `e2e/shots/notes-unconfigured*.png` |
| Create an empty note, save with `⌘S`, and name it from a heading | Browser smoke; file read from the fixture Notes folder |
| Autosave after a 1.5-second pause | Browser smoke reads the added text back from disk |
| Open a note as a rendered tab in the page strip | Browser smoke checks the URL, heading, and strip; `e2e/shots/notes-page-tab*.png` |
| Paste an image, detect an external edit, reload, and move a note to `.trash/` | Browser smoke |
| Refuse stale writes, deleted targets, path escapes, and attachment overwrites | `python3 native/test_notes_host.py` |

The note row's tab button opens a rendered reading page. The editable source
stays in the preview panel. The editor's **+ tab** and `⌥`-click keep the note
as a background page tab.

## Corrections made in this review

- A write could finish after newer typing and clear the unsaved state. The
  editor now records an edit version and follows a completed write with another
  save when the text changed during that write (`src/preview.ts`). The ordinary
  autosave path was exercised in Chrome; a deliberately delayed host write was
  not part of this run.
- New notes contained an `Untitled` title in front matter, which could keep
  the first filename from following the user's heading. New notes now start
  empty and use the first heading or first text line on first save
  (`src/sidebar.ts`, `src/notes.ts`).
- Saving a note removed by another tool could recreate the deleted file.
  The host now returns `notes_missing` when an expected target is absent
  (`native/notes_host.py`).

## Recorded limitations

The owner chose to ship without follow-up work on these cases in v2.11. Keep
them here as observed behavior, not as release tasks.

| Priority at review | Trigger | Current result | Possible handling if revisited |
|---|---|---|---|
| High | Close or switch from a dirty editor while the native write fails | The panel closes before the write finishes. A toast reports the failure, but the editor text is no longer visible. | Keep a recoverable draft or hold the panel open until the save settles; test a host failure on close. |
| Medium | Rename or trash the note from the sidebar while its editor is open | The row action does not retarget or close the editor. A later save can fail against the old path. | Coordinate row actions with the editor and test an edit followed by rename and delete. |
| Medium | Another tool rewrites a note within the same millisecond | Conflict checks compare millisecond file modification times and can miss that change. | Use a stronger file identity or content revision token in the host protocol. |
| Low | Edit the first heading after the first save | The sidebar keeps the filename as its label. This differs from the original feature-set plan. | Decide whether the sidebar should read each note title or retain stable filename labels. |

## Documentation checked

The README, in-app Help, Notes contract, feature set, interaction map, mouse
and key audit, and architecture document were updated for the current Notes
and sidebar behavior. [The documentation map](README.md) identifies the older
plans and surveys so their starting-state claims are not mistaken for current
instructions.
