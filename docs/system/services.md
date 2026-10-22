# Services

The parts of the explorer that have no look of their own: where values are
remembered, how the page moves to another place, what a failure says, how a
file changing on disk is noticed, and how a file is drawn. Each has one home,
and the source check (`e2e/check-system.mjs`) keeps it that way.

## Store: `src/storage.ts`

Every remembered value is a `Pref` declared in storage.ts: its key, its
default and how it is written sit in one place.

| Helper | Holds |
|---|---|
| `textPref(id, init, where?)` | a word or line |
| `choicePref(id, choices, init)` | one of a fixed list; anything else reads as `init` |
| `flagPref(id, init, on, off)` | on or off, written as each key always wrote it |
| `numberPref(id, init, ok)` | a whole number |
| `jsonPref(id, init, valid, where?)` | a list or record; a damaged value reads as `init` |
| `setPref(id)` | a set of names, such as folded groups |

A `profile` Pref (the default) lives in the shared store and is seen by every
tab; a `tab` Pref lives in this tab's session. `onChange` reports another tab's
write. `exportAll` and `importAll` back Settings' export and import.

Banned: `kvGet`, `kvSet` or `localStorage`/`sessionStorage` outside kv.ts and
storage.ts (`js-storage`, 0).

## Navigation: `src/nav.ts`

`go(href, how, { hash, exact })` opens a folder or file here or in a new
Chrome tab, and adds the file viewer's address for a type Chrome would
download. `reload()` and `markPlace(hash)` cover the other two moves.

Banned: writing `location.href`, `location.reload`, `history.*State` or
`window.open` outside nav.ts (`js-navigation`, 0).

The home folder comes from the path model (`homeDir` in storage.ts: a visit
under it, or the native host). The renderers link bare paths under it through
`setLinkHome`; no source names a home folder (`js-home-literal`, 0).

## Errors: `src/errors.ts`

`errorText(err, doing)` gives the words for a failure by its code: the notes
host's codes and the page's own (`read-failed`, `write-failed`,
`match-timeout`). A failure with no known code keeps its own words behind what
was being done ("Copying the image failed: disk full").

Checker findings are not errors: a `Diagnostic`'s message is a finding in the
checker's words, and `detailOf(err)` passes a parser's words into a finding.

Banned: showing an error's raw message in a toast or a template outside
errors.ts (`js-message-shown`, 0).

## Watching files: `src/watch.ts`

`watch(check, { pause })` puts a check on one shared two-second clock. Nothing
runs while the tab is hidden, a part pauses its own check while it saves or
edits, and a check still running is not started again. The file page, the
editor and the comments panel are its three subscribers. smoke's "Updated from
disk" check goes red when the clock stops.

## Drawing a file: `renderFile` in `src/formats.ts`

`renderFile(text, ext, href, host)` draws a file for the file page or the
preview: a note for empty or binary text, a table, the format's rich view, or
highlighted code. The hosts differ only on purpose:

| | File page | Preview |
|---|---|---|
| HTML | its source | the live page, with a Source toggle (preview.ts) |
| JSON that is not strict | text; the problems strip says why | the tree's own note, then text |
| Links in markdown | as written | every one opens a new tab |

Checked by `e2e/renderers-walk.mjs`, which draws nine kinds of file in both
hosts.
