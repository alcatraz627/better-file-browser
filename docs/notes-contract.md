# The Notes folder contract

A Notes folder is a plain folder of markdown files. This extension is one
reader and writer of it; any other tool or project can read the same folder
with a directory listing and a markdown parser. Nothing in the folder is
specific to this extension.

Written 2026-09-15. The rules below are what `native/notes_host.py` enforces
and what the editor writes. Sources for the cross-tool part are in
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
- The file name is a slug of the title the note was created with
  (`kebab-case.md`, up to 60 characters, `untitled.md` if empty). The
  extension never renames a file because its first heading changed; renames
  are explicit, so links from other tools stay valid.
- Optional YAML front matter at the very top, between `---` fences:

  ```yaml
  ---
  title: Weekly plan
  tags: [work, planning]
  created: 2026-09-15T10:20:00+05:30
  updated: 2026-09-15T11:02:00+05:30
  ---
  ```

  The extension writes `created` and `updated` when it creates a note and
  refreshes `updated` on save. It never adds front matter to a note that had
  none, and never removes keys it does not know. Every key is optional; a
  note with no front matter is a valid note. These four keys are the ones
  Obsidian, GitHub, Marked, Typora and iA Writer all tolerate as unknown or
  use natively. Logseq shows them as a literal block; it is the one tool in
  the survey that wants its own `key:: value` syntax instead.

## Links and attachments

- Links between notes are relative paths: `[plan](weekly-plan.md)`. Every
  tool resolves them from the note's own location.
- `[[Note Name]]` wikilinks are rendered by the extension as links to
  `note-name.md` in the same folder, read-only. It never writes them.
- Attachments go in `attachments/` at the root, referenced by relative path.
  The extension does not write attachments yet; the folder is reserved.

## What another project can rely on

- `ls *.md` (recursively, skipping dot-folders) is the note list.
- The first `# ` heading, or the `title` front matter key, is the title.
- `updated`, or the file mtime when absent, is the recency.
- Writing a `.md` file into the folder with any tool makes it a note the
  extension shows on its next listing. Writing while the extension has the
  note open is safe: the extension carries the mtime it read, and its next
  save is refused as a conflict instead of overwriting.

## Opening the folder in another tool

- Obsidian: open the folder as a vault. Obsidian adds its own `.obsidian/`
  folder, which the host ignores. Wikilinks resolve both ways.
- Anything that renders markdown from a path (GitHub, Marked, Typora, the
  kanban board's `render-md.ts`): point it at a file; no conversion needed.
