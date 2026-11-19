---
reader: the bfb owner, and whoever changes Settings next
---

# Settings: what was added in November 2026

These are the parked add-ons the owner chose on 2026-11-20. Each one is
described as it is used, then where its code lives. The plan behind them, with
the owner's notes, is `.claude/output/20261120-addons/rulings.md`.

## Finding a setting

The box under the Settings title searches every tab.

- The settings that match appear together, with the matched words marked.
- Each tab in the list shows how many matched and names them. A click on a
  name goes straight to that setting.
- Esc clears the box. A second Esc closes Settings.
- Picking a tab, or stepping with `[` and `]`, ends the search.
- ⌘F inside Settings goes to the box.

The settings are not copied for the results. Each tab's page moves into one
column while you search and goes back after, so every control works the same.
The code is in `src/settings-search.ts`.

## Look

**Detail** is one scale from Overview to Full detail, the same one as the
toolbar's slider. Moving either moves both. It replaced Row spacing. An old
Compact choice became Detailed, once.

## Browse

**View** shows a small drawing of each view.

**Folders with their own view.** Nothing is kept per folder unless you ask.

- The pin beside the view switch keeps the view, sort and grouping you see, for
  that folder alone.
- Changes made in a kept folder stay with it. Other folders keep the defaults.
- Press the pin again and the folder follows the defaults.

Settings lists every kept folder:

- Each row has the folder's view as a dropdown you can change there.
- Show the list plain, or grouped by view.
- The Tree switch indents a folder kept inside another kept folder, and names
  it by the part of its path below that folder.
- The ✕ on a row lets that folder follow the defaults again, with Undo.
- Reset keeps kept folders, as it keeps Saved.

**Big folders.** A folder with thousands of items in the Tiles or Large Icons
view shows its first screen at once, then fills in the rest. Lists were
already drawn this way.

| What | Code |
|---|---|
| Kept views | `src/folder-views.ts` |
| The Settings list | `src/settings-folder-views.ts` |
| First screen first | `fillTiles` in `src/listing.ts` |

## Reading

**Follow changes on disk.** When it is off, a file changed by another program
waits behind a "Changed on disk · Reload" button.

**Editable folders** is a list. Each row can be edited, copied as a path,
shown in Finder or removed with Undo.

## Sidebar and Home

**Sections** lists every sidebar lens with a switch and a handle.

- A switch takes a lens off the sidebar. One section always stays on.
- Drag a row, or press Alt with an arrow on its handle, to change the order.
- A lens that is off still opens when something asks for it by name, such as
  Ask from a menu.

The code is in `src/lens-list.ts` and `src/settings-lenses.ts`.

## Tools

**Open with** commands are rows. Each row has a colour, a name, the command, a
Files only switch and a Window switch. With Window on, the command runs in a
new Ghostty window. With it off, the command runs in the background. The path
is added last, quoted.

Each command is checked as you type, in two steps.

1. Its shape, at once: a missing name, an open quote, a repeated name, or a
   line ending in `;`, a trailing backslash, or a `#` comment that would hide
   the path.
2. Its program: the launcher looks it up in the same login shell that will run
   it, and says where it found it or that it is not installed. It reads past a
   `VAR=value` at the start, and expands `~` and `$HOME`. The check never runs
   the command, and it waits for a pause in typing.

A row with a problem stays out of the menu. A colour picked for a command
shows as a dot beside it in the Open with menu.

| What | Code |
|---|---|
| The rows | `src/settings-open-with.ts` |
| The shape check | `commandProblem` in `src/open-with.ts` |
| The program check | `check_cmd` in `native/ghostty_launcher.py` |

**Icon rules** have names. The "Try a file name" box says which rule gives a
name its icon, using the listing's own matcher, and marks the winning row. End
a name with `/` to try it as a folder. A folder rule ends in `/` too, such as
`^node_modules/$`. The matcher is `ruleFor` in
`src/icons.ts`.

## AI

**Only on this Mac** keeps Ask from sending text to an online model.

## Data

**Export** has a switch for each part: Settings, Saved, History, Ask chats and
Dark mode and marks. Ask chats is off by default. Import checks dark mode and
marks before taking them, and its Undo puts back what it replaced.

## How each is checked

Every add-on has a walk under `e2e/` that drives it in a throwaway Chrome
profile. Each walk was shown to fail without the code it covers.

| Add-on | Walk |
|---|---|
| Search | `settings-search-walk.mjs` |
| Detail and Sections | `sections-density-walk.mjs` |
| Kept folders | `folder-views-walk.mjs` |
| First screen first | `first-screen-walk.mjs` |
| Open with | `open-with-walk.mjs`, and `native/test_launcher.py` for the check |
| Icon rules | `icon-rules-walk.mjs` |
| Layout of every pane | `settings-layout-walk.mjs` |
