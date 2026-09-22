# The Notes folder contract

A Notes folder is a plain folder of markdown files. This extension is one
reader and writer of it; any other tool or project can read the same folder
with a directory listing and a markdown parser. Nothing in the folder is
specific to this extension.

Updated 2026-09-22. The rules below describe what `native/notes_host.py`
enforces and what the editor writes. Sources for the cross-tool part are in
`.claude/output/20260915-recon/tools.md` §A.

## The folder

- Any folder the owner picks. Its path is the only thing the extension
  stores (in Settings, `localStorage` key `bfb-settings-v1`, field
  `notesRoot`).
- No marker file, no index, no database. Two things exist under it that a
  reader should ignore: dot-folders (the host never lists them) and
  `.trash/`, where deleted notes go with a timestamp prefix.
- Subfolders are allowed and listed recursively. Other tools that expect a
  flat folder still work; they just see the top level.

## A note

- One note per file, extension `.md`, UTF-8, LF line endings. Nothing else
  is a note: the host refuses to write any other extension.
- A new note is created as an empty `untitled-<timestamp>.md` file. On its first
  save, the first `#` heading or first nonblank text line supplies a slugged
  name (`kebab-case.md`, up to 60 characters). If no title is present, the
  temporary name stays. Later heading changes do not rename the file; use
  the sidebar rename action to change it explicitly.
- Optional YAML front matter at the very top, between `---` fences:

  ```yaml
  ---
  title: Weekly plan
  tags: [work, planning]
  created: 2026-09-15T10:20:00+05:30
  updated: 2026-09-15T11:02:00+05:30
  ---
  ```

  New notes start without front matter. The editor refreshes `updated` on
  save when front matter already exists, adds that key if absent, and leaves
  unrelated keys alone. It does not add front matter to a plain note. Every key is optional; a
  note with no front matter is a valid note. These four keys are the ones
  Obsidian, GitHub, Marked, Typora and iA Writer all tolerate as unknown or
  use natively. Logseq shows them as a literal block; it is the one tool in
  the survey that wants its own `key:: value` syntax instead.

## Saving and conflicts

- A pause of 1.5 seconds after the last edit starts a save. `⌘S` starts one
  immediately. Closing or switching away from a dirty editor also starts a
  save. Edits made while a write is running are written in a follow-up save.
- The editor shows an unsaved dot until its latest text is written. If a save
  fails while the editor is open, the header shows the error. A conflict offers
  **Reload from disk** or **Overwrite**; reloading replaces the editor text.
- The native host writes through a temporary file and replaces the old file
  only after the write succeeds. It rejects a stale or missing target when the
  editor supplies the mtime it read. A removed file reports a save error; the
  editor does not recreate it.

## Links and attachments

- Links between notes are relative paths: `[plan](weekly-plan.md)`. Every
  tool resolves them from the note's own location.
- Attachments go in `attachments/` at the root, referenced by relative path.
  Pasting, dropping, or choosing an image saves it there and inserts a Markdown
  image link. The native host refuses to overwrite an existing attachment.
- Wikilinks such as `[[Note Name]]` are ordinary text in this editor. Use
  Markdown links for navigation between notes.

## What another project can rely on

- `ls *.md` (recursively, skipping dot-folders) is the note list.
- In the editor, `title` front matter takes precedence over the first `#`
  heading, then the first nonblank text line, then the filename. The sidebar
  currently labels notes from their filenames.
- The file modification time determines the sidebar order, newest first.
- Writing a `.md` file into the folder with any tool makes it a note the
  extension shows on its next listing. Writing while the extension has the
  note open is detected: the extension carries the mtime it read, and its next
  save is refused as a conflict instead of overwriting. A note deleted by
  another tool reports a missing-file error. The comparison uses millisecond mtime, so
  edits that share that timestamp may not be distinguished.

## Opening the folder in another tool

- Obsidian: open the folder as a vault. Obsidian adds its own `.obsidian/`
  folder, which the host ignores. Ordinary relative Markdown links work in
  both tools.
- Anything that renders markdown from a path (GitHub, Marked, Typora, the
  kanban board's `render-md.ts`): point it at a file; no conversion needed.
