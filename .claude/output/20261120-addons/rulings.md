---
reader: the bfb owner, and the next agent building these add-ons
---

# Parked add-ons: what the owner chose on 2026-11-20

The owner said build to all fourteen parked add-ons. Seven came with notes that change what gets built, quoted below in the owner's words. The Settings layout fixes are done. The rest is built in the order at the end.

## What gets built, with the owner's notes

**Settings additions**

- **View thumbnails.** The View setting shows a small drawing of each view instead of bare icons. No note.
- **Try a name for icon rules.** A box where a file name shows which rule wins. Note: "Mis-alignment of card title / toolbar / chips, identify + fix and build". The misalignment is fixed. The box is still to build.
- **One Density setting.** Row spacing and the toolbar's Detail slider become one scale. Note: "Fine but why does the App Icons list wrap on one icon? Please check and fix for ALL such defects in settings modal". Fixed for every pane.
- **Sidebar sections.** A switch and a drag handle for each sidebar section. No note.
- **Settings search.** Note: "Take ideas from other apps that show filtered settings list and what exactly is matched in the sidebar".
- **Follow changes on disk.** An off switch for live reloading. No note.
- **Only on this Mac.** Keeps Ask from sending text online. No note.
- **Open with as rows.** Note: "Also validate command + allow picking a color ball from color picker to show for each in the actual options menu when calling".
- **Named icon rules.** No note.
- **Export picks what goes in.** Note: "Use toggles instead of checkboxes".
- **Editable folders.** Note: "Instead of chips, use a list that can be edited per item / deleted per item / option icon at right of each list item to copy path or open in finder".

**Browsing**

- **Per-folder views, only when asked for.** Note: "For each folder here, show the view as a dropdown I can change here itself, also allow viewing as a freeform list / grouped by view type and a toggle for tree view to add a slight but enough indent for nested paths".
- **Big folders draw their first screen first.** No note.

**Another app**

- **Switchboard's controls** get the same cleanup bfb's got, after this batch.

## Order of work

1. Settings layout defects. Done: App icon grid, heading heights, chip wrap.
2. Small Settings rows: follow changes, only on this Mac, Export toggles, view thumbnails, the Editable folders list. Done.
3. Icon rules: names, then try a name. Done.
4. Open with as rows, with command checks and a colour shown in the Open with menu. Done.
5. One Density setting, then sidebar sections. Done.
6. Settings search, after looking at how other apps show matches. Done. It borrows from VS Code (results from every section, counts in the contents) and Chrome (matches marked in place).
7. Per-folder views, then first screen first. Done.
8. Switchboard, after bfb.

How each built add-on works, and the walk that checks it, is in `docs/settings-addons.md`.

## What the independent check found

An outside reviewer tried to break the first built units (rich editing, layout fixes, the small Settings rows). Fixed, each with a check that fails without the fix:

- An open Rich block could damage other lines when the file changed on disk. Fixed. The block ends before outside text arrives, and the format bar now acts on an open block.
- Import replaced marks and dark mode with no check and no Undo. Fixed: damaged values are left out and said so, and Undo puts back what was replaced.
- The Reload link could show text no longer on disk. Fixed, and it is now reachable by keyboard.
- Export could be pressed with every part off. Fixed.
- View drawings overflowed narrow tiles. Fixed.

Left for later, all minor:

- Undo for a folder removed twice in a row can land in a stale place.
- An emptied folder row has no Undo.
- Only on this Mac does not block a bare online model name set as the default, which Settings never offers.

## What the second check found

A second outside reviewer tried to break units 3 to 7. Its report is `.claude/output/20261120-addons-validation-2/validator.md`. Fixed, each with a check that fails without the fix:

- Settings search showed nothing while Settings sat in the sidebar. It now works there, with counts on the tab icons.
- In a folder that keeps its own view, the sort keys started from the default order. They now start from the folder's own.
- Dropping the open folder from the Settings list left the page pinned, and the next view change pinned it again. The page now follows at once, and Undo pins it back.
- The command check called `VAR=1 cmd`, `~/bin/x`, `$HOME/bin/x` and `cat; echo` not installed. It now finds them. A trailing backslash and a `#` comment are caught, and zsh's `$'...'` quote is read correctly. The check waits for a pause in typing.
- Damaged stored data no longer stops Settings or the listing: an old commands text that is not text, a broken icon rule, and lens settings that switch every lens off.
- A repeated command name shows once in the menu. A folder rule ending in `/` now matches the folder. The Try box tries a name as typed.

Default applied, silence means agreement: Reset keeps folders kept with their own view, as it keeps Saved and your folders.

Left as it was: a pattern with catastrophic backtracking, such as `^(a+)+$`, can freeze the tab. That was true before this work.

## Sources

- Decision page `bfb-addons-1120`, previews in `~/.claude/assets/decision-pages/bfb-addons-1120/`, answered 2026-11-20 with every card set to build. Card codes in page order: D1 view thumbnails, D2 try a name, D3 Density, D4 sidebar sections, D5 search, D6 follow changes, D7 only on this Mac, D8 Open with rows, D9 named rules, D10 Export, D11 Editable folders, D12 per-folder views, D13 first screen first, D14 Switchboard.
- Layout fixes: commit `fce1cd7`, checked by `e2e/settings-layout-walk.mjs`.
