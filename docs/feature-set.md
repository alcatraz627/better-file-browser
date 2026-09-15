# The v2.8 feature set: one model for looking, going and keeping

Design for the batch the owner asked for on 2026-09-15: Notes, rendered file
pages, and tabs inside the explorer, built as one set rather than three
features. The earlier sizing notes are in `docs/explorations.md`; the recon
they build on is `.claude/output/20260915-recon/tools.md`; the Notes folder
rules are `docs/notes-contract.md`.

## The model in the owner's head

The explorer has four nouns and three verbs. Every surface in the batch is one
of the nouns acted on by one of the verbs, with the same key doing the same
job everywhere. That is the whole design: the owner learns three verbs once
and stops thinking about them.

| noun | what it is | where it lives |
|---|---|---|
| **Place** | a folder | tabs (open now), Saved (kept), Recent, Favorites, System |
| **File** | something in a folder | the listing, deep search results |
| **Note** | a file you write here | the Notes section, which is a Place you write in |
| **View** | how a Place is shown | sort, group, filter, details or tiles |

| verb | meaning | key | what it does on each noun |
|---|---|---|---|
| **Go** | move to it | Enter, click | Place: navigate. File: open natively. Note: open in the editor. Tab: switch. |
| **Look** | see it without leaving | Space | File: preview. Note: read pane. Page: the same render, full width. Space again stops looking. |
| **Keep** | make it stay | ★ or `+` | Place: Saved. Place open now: a tab. Note: Cmd+S, and autosave. |

Esc always backs out one layer: editor to reader, reader to listing, then
filter to empty. Nothing else is bound to Esc.

The pairing the owner already has from Chrome carries over unchanged: the
tab strip is the working set and the sidebar is the long-term set, exactly as
browser tabs sit above browser bookmarks. Saved is bookmarks; tabs are tabs.

Single-letter keys work when nothing is focused, the way the kanban board's
do, so the two tools share one hand: `t` opens a tab for this folder, `w`
closes the tab, `[` and `]` move between tabs, `1` to `9` jump, `n` starts a
new note. Chrome owns Cmd+T and Cmd+W and a page cannot take them, which is
why these are bare letters.

## One renderer, three frames

Look produces the same picture in three places: the floating preview, the
docked side panel, and a file opened directly in the tab. `src/renderers.ts`
already produces the picture; the batch adds the third frame.

- **File page** (`src/file-page.ts`): when the URL is a file with a known
  extension, the page's own text is already in the document, so the takeover
  reads it, replaces the document with a shell, and renders. The shell is the
  preview header again (name, size, copy, open raw, theme) with a crumb link
  back to the folder, plus a table of contents rail for markdown built from
  the headings. Raw toggle, scroll position memory and autoreload (poll the
  file through the relay every 2 s while the tab is visible, re-render on
  change) are the three cheap features Markdown Viewer has that the survey
  marked cheap; mermaid and math are the expensive two and are not in this
  batch.
- **Coexistence**: with Markdown Viewer also installed, both take over `.md`
  pages. A setting, "Render file pages", offers all, all except markdown,
  and off. The recommendation is all, with Markdown Viewer's file access
  turned off, so the picture is the same in every frame.

## Notes: a Place you write in

- Settings gains a Notes folder field. When set, a **Notes** section appears
  in the sidebar listing that folder's notes newest first, with a `+` that
  starts a new note, and the section's heading is a link to the folder as a
  normal Place.
- Opening a note uses the docked panel in an editor layout: a plain textarea
  on the left, the rendered markdown on the right, the same header. Cmd+S
  saves; a 1.5 s pause autosaves; a dot on the name shows unsaved text.
  `src/editor.ts` is the kanban board's `editor.js` carried over: undo that
  survives a re-render, coalesced history, insert at cursor.
- A new note starts empty with the caret in the body. Its file name is
  slugged from the first line at the first save and does not change after
  that; the title shown in the sidebar follows the first heading.
- Rename and delete are the row's hover actions, like Saved. Delete moves to
  `.trash/` in the folder, never unlinks.
- The host refuses any path outside the folder, and a save carries the mtime
  the editor read, so another tool writing the same file makes the next save
  a visible conflict with a reload button instead of a silent overwrite.

## Find: one record, three fields, kept as a view

The owner's question on 2026-09-15 was whether deep search and a saved filter
belong together. They do: a search is a Place plus a question, so it is kept
where Places are kept.

- **The record.** `FindQuery` (`src/find.ts`) has a scope (this folder or
  every subfolder), a name pattern (substring or regex), extensions, and text
  inside files. Name and extension filter instantly, as they always did. Text
  is a second, asynchronous pass.
- **The contents pass.** Candidates are the files the name and extension
  fields already allow, of a text type, at most 2 MB each. Four are read at a
  time through the relay; the status shows `scanning 12/40` with a Cancel
  button, then `N of M files`. Results are held until the next Run or a
  cleared text field, so sorting, grouping and previewing work on the result
  set. Changing the text does not re-run by itself; Enter or Run does. Deep
  scope waits for the folder crawl, then runs.
- **A saved view is a URL.** `Save view` writes a Saved row whose path is the
  folder plus `#find=<query>`, labelled from the fields (`plan .md "todo" in
  subfolders`). It draws with a funnel icon, and every Saved gesture works on
  it: rename, tag, drag, remove. Opening it navigates to the folder and the
  hash applies the query, including the contents pass; a hash change on an
  already open page applies it in place. Nothing new is stored, and the row
  is also a link you can paste anywhere.
- **Not in this cut.** Match snippets in the row, a match count column, and
  regex over contents. The hit map keeps the first matching line per file for
  when a snippet column is wanted.

## Tabs: the working set

- A strip above the toolbar. Each tab is a folder with its label; the active
  tab is the folder shown. The strip state lives in `chrome.storage.local`
  and every explorer window listens to `chrome.storage.onChanged`, so
  opening or closing a tab in one window updates the strip in all of them.
  The DOM `storage` event cannot do this on file:// pages; the recon has the
  citation.
- Navigation is real: a tab click sets `location.href`. Chrome's behaviour
  for `pushState` between file:// paths has changed across versions, so the
  address bar staying honest is worth more than an in-page switch.
- A folder you are in that has no tab shows as a temporary tab in italics,
  the way editors show a preview tab. `t`, double-click, or opening a second
  folder from it makes it permanent. Closing the last tab leaves the strip
  empty; the current folder still renders.

## What other tools help

- **Obsidian** opens the Notes folder as a vault with no conversion; the
  contract keeps its wikilinks and front matter compatible.
- **The kanban board** (`~/.claude/scripts/kanban`) already renders markdown
  from paths and carries the editor core; both are reused, not copied
  loosely.
- **The local model** (`lm`) already sits in the preview header; a note in
  the reader pane gets Summarize and Ask for free.
- **Markdown Viewer** stays the reference for what a full renderer offers;
  the batch takes its three cheap features and leaves the two expensive ones.

## Build order and checks

1. Notes editor and section (host is shipped). Check: create, edit, save,
   rename, delete a note from the page in `npm run e2e`, then open the same
   folder in another tool and see the file.
2. File pages. Check: open the fixture's `readme.md` directly, see the
   render with a table of contents, edit the file on disk, see it update.
3. Tabs. Check: open two explorer windows, add a tab in one, see it in the
   other; keys `t`, `w`, `[`, `]`, `1`.
4. Light theme pass over every surface; README and version.
