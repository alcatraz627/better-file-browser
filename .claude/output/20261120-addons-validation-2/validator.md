# Validation of bfb add-on units 3-7 (adversarial)

Verdict: ISSUES-FOUND (3 major, 6 minor, 4 nit). No blocker: the extension loads, smoke is green, nothing throws at page load from the malformed stored data tried, except the one listed (iconRules with a null entry, pre-existing).

Validated against HEAD cd41b25 (the parent pushed "Read damaged stored rows safely, and end a search on tab steps" on top of d5e1e9d during the run). HEAD was re-checked at the end and had not moved. Every finding was re-checked on cd41b25.
Scratch work: /private/tmp/claude-501/-Users-alcatraz627-Code-better-file-browser/b6fefcef-2736-4e69-bf80-2b2ce19aaec1/scratchpad/validator/

## Baseline runs
- `npx tsc --noEmit -p .`: clean.
- `npm test --silent`: 69 files, 1001 tests pass (run on d5e1e9d).
- Walks, all green: icon-rules, open-with, sections-density, settings-search, folder-views, first-screen (on d5e1e9d); folder-views again after my mutation revert, settings-layout and smoke (on cd41b25, smoke printed no FAIL).

## Findings, ranked

### MAJOR 1. Settings search is broken while Settings is docked in the sidebar
Repro: scratchpad/validator/search-place-walk.mjs step B1, screenshot scratchpad/validator/B1-side-search.png.
With the dialog in sidebar place, typing a query sets `#fe-settings-modal.searching` and moves the matching panes into `.fe-dlg-results`, but that column has `checkVisibility() === false`, so no result is drawn. The screenshot shows a squashed tab strip with one badge and an empty body. Cause: every searching rule is scoped to `.fe-dlg.searching` (src/styles-ui.ts:324-327) and `.fe-dlg-results{display:none}` (line 325) is only overridden under it, but in sidebar place the box is moved into `#fe-side-pane` (src/dialog.ts:113-114), outside `.fe-dlg`. The module docstring (src/settings-search.ts:9-11, "every control keeps working as it does on its own tab") does not hold here. The e2e walk only searches in window place.
Recoverable: clearing the box, closing, or the place button puts every pane back (checked: A2, A3, B2, B3 in search-place-walk.mjs).

### MAJOR 2. Sort and group keys act on the global sort inside a folder that keeps its own
Repro: scratchpad/validator/load-attack-walk.mjs case 7. A folder kept with sort size/desc; pressing `s` `r` (Reverse the order) turned it into name/desc and stored `{"col":"name","dir":"desc"}` for the folder, instead of size/asc.
Cause: src/listing-input.ts:293 (`sortBy`), :298 (`sort-rev`) and :301-302 (`group` cycle) read `getSortConfig()` / `getGroupMode()`, the global values, as their starting point. Before the change those were always equal to the current listing, because every change was saved globally; now a kept folder's sort lives in `ls.sort` and the globals are stale. `s n/m/z/t` have the same flaw (the toggle direction is computed from the global column). The group cycle starts from the global group, same code path (not run separately).
Fix direction: read `ls.sort` / `ls.group` (expose them on `app`) instead of the globals.

### MAJOR 3. Dropping THIS folder from the Settings list leaves the listing believing it is still kept
Repro: scratchpad/validator/drop-here-walk.mjs. Keep the folder, open Settings > Browse, click the drop button on the row marked "this folder". The store entry goes (0 keys), but the toolbar keep button stays `aria-pressed="true"` with the tooltip "Kept for this folder; click for the default", because `keptHere` in src/listing.ts:66-67 is a closure variable only the keep button toggles. The next view change from the toolbar then silently keeps the folder again (store gets `{"view":"icons"}`, global view untouched), undoing the owner's drop. Changing the default view in Settings afterwards does not move this folder either. The folder-views walk drops a different folder (nested), so it never exercises this.

### MINOR 4. Command check calls working commands "not installed"
Repro: scratchpad/validator/check_cmd.py (calls native/ghostty_launcher.py directly).
The launcher looks up the first shlex word literally (native/ghostty_launcher.py check_cmd). Reported not found though zsh runs them: `FOO=1 cat`, `~/bin/x`, `$HOME/bin/x`, `cat; echo hi` (program shown as `cat;`), `cd /tmp; ls` (`cd;`). The row turns red with a false claim; ownCommands ignores the launcher result, so the menu is unaffected. A personal script under `~/` is the likeliest command this owner writes.
Related, same area:
- A trailing backslash (`foo \`) passes `commandProblem` (the quote loop in src/open-with.ts skips past the end), stays in the menu, and runs as `foo \ '/path'`: the backslash escapes the space and the path gets a leading space. The launcher flags it as "A quote is left open" (wrong words), so Settings shows red, the menu does not drop it.
- `echo $'a\'b'` (valid zsh quoting) is reported "A quote is left open" and removed from the menu.
- `cat # note`: the path lands in a comment; not caught.
The "check_cmd never executes the command" claim held: `$(touch M)`, backticks, `; touch M`, `&& touch M`, `=(touch M)`, `${(e)...}` as the command left no marker file (check_cmd.py, "marker exists: False"). The docstring's "Nothing is run but zsh's own lookup" is slightly off: `zsh -lc` also sources the owner's login startup files, and the check fires on every keystroke with no debounce (0.13 s per spawn here).

### MINOR 5. A non-string `openWithCmds` stops Settings from opening at all
Repro: load-attack-walk.mjs case 4c (`settings.openWithCmds = 5`): clicking the Settings button does nothing, page error `.split is not a function`. `refreshOpenWith()` runs inside `openSettings`, and `parseCommands` (src/open-with.ts) still does `.split` on whatever it gets. The cd41b25 fix hardened `openWith` rows but not this field, which is the one an old import can carry. `ownCommands({openWithCmds: 5})` also throws (context menu, palette). Needs a hand-edited or foreign import to trigger.

### MINOR 6. `iconRules` containing a null entry blanks the listing
Repro: load-attack-walk.mjs case 6a (`bfb-icon-rules-v1` = `[null]`): 0 rows drawn, page error from `ruleFor` (`Cannot read properties of null (reading 'enabled')`). `getIconRules` (src/storage.ts:47-52) only checks `Array.isArray`. The old inline loop had the same read, so not new, but ruleFor is the new shared matcher and the Try box calls it too.

### MINOR 7. Stored data that hides every lens leaves a rail with nothing on it
Repro: load-attack-walk.mjs case 1 (`lensOff` = every lens but History, `hideRecent: true`). The UI path is guarded (setLensOn refuses the last lens), but a stored value or an import is not: rail shows no buttons, the Notes panel is shown anyway (`show()` falls back to `'notes'` when `usable` is empty, src/sidebar.ts), and nothing says why. Recoverable: Settings > Sidebar lists all nine off, and switching one on brings the rail back (case 1b/1c). No page error.

### MINOR 8. Reset clears every kept folder view, and nothing says so
Repro: reset-dd-walk.mjs ("before reset" has the entry, "after reset null"). `bfb-folder-views-v1` is in no BUILT_UP list (src/storage.ts:436-441), so `resetPreferences` removes it; Undo exists for 120 s. The Reset blurb (src/settings-page.ts:220) says "Saved places, your folders, commands and icon rules stay". Export lands it in the Settings part (probe2.mjs: `bfb-folder-views-v1 -> settings kept: true`), which is consistent with Reset but arguably a list the owner built up, like icon rules. Needs a decision, not a bug as coded. No unit test covers the key in either path (tests/reset.test.ts only covers compactMode).

### MINOR 9. ruleFor's empty-pattern rule is unguarded
Mutation: removing `|| !rule.pattern` in src/icons.ts ruleFor left tests/icons.test.ts green (12 pass) and nothing in e2e/icon-rules-walk.mjs uses an empty pattern (only an empty Try box). Behaviour change vs before: an empty pattern used to match every file (`new RegExp('')`), now it matches none. That is the better behaviour and nothing in src relied on the old one (grep of getIcon callers), but it is untested. Reverted exactly.

### NIT 10. Folder rules cannot match a folder; the Try box advertises them
`ruleFor('foo', true, [pattern 'foo/'])` returns -1 (probe1.mjs) because listing names have the trailing slash stripped (src/parse.ts:33) while a folder rule must end in `/` (src/icons.ts ruleFor). Only an alternation such as `^foo$|/` works. Try box and listing agree (both draw no match), but the Try title "end with / for folders" (src/settings-page.ts:168) leads nowhere. Same logic existed before.

### NIT 11. A duplicate command name is flagged in Settings but still listed in the menu
`commandProblem` takes `others` for the repeated-name check, `ownCommands` calls it without, so both rows appear in the menu while Settings shows one red. The brief's "ownCommands filters rows with problems out" holds for everything but this.

### NIT 12. Try box trims a name with trailing spaces
src/settings-ui.ts tryName does `input.value.trim()`, so `a.md ` reports the `\.md$` rule winning while the listing (`ruleFor('a.md ', ...)` = -1, probe1.mjs) would not give a file of that exact name the icon.

### NIT 13. A pathological pattern freezes the tab (pre-existing)
`^(a+)+$` against a 31-character name ran 42 s in ruleFor (probe1.mjs). The old matcher had the same shape; the Try box and `hits()` now run it on every keystroke too.

## Mutation tests
1. src/icons.ts `ruleFor` empty-pattern guard removed: tests/icons.test.ts stayed GREEN (finding 9). Reverted with the exact inverse edit; git diff of src empty afterwards.
2. src/lens-list.ts `setLensOn` last-lens guard (`=== 0` to `=== -1`): tests/lens-list.test.ts went RED ("keeps the last lens on", expected true to be false). Reverted exactly.
3. src/listing.ts `syncSortUi` kept-folder write (`if (keptHere)` to `if (false && keptHere)`): e2e/folder-views-walk.mjs went RED on "a view and sort changed here stay with this folder" and "and the defaults are untouched". Reverted exactly, rebuilt, walk green again (16 PASS).
`git status` at the end shows no change under src/ from me; build outputs (content.js, design.js, assets/*) were already modified by the parent and by every walk's own `npm run build`, and were rebuilt from the restored source.

## Checked and held
- Search plus place switch: pressing the place button mid-search ends the search cleanly and every pane returns to the box (search-place-walk.mjs A2, A3); closing mid-search (X, either place) and reopening shows no searching state and all nine panes in the box (B2, B3, C5, C6); `]` mid-search ends the search and opens the next tab (C3, the cd41b25 fix); a dropdown inside the results opens beside its button, inside the viewport, and its pick saves (reset-dd-walk.mjs); the Help dialog opens normally after a search (D1). No page errors in any of these.
- Detached panes: `run()` calls `results.replaceChildren()` which detaches panes with no hit in the new round, but `stop()` re-inserts every pane from its own `panes` array; confirmed no pane lost or duplicated (state of all nine after each run).
- ownCommands index mapping: `openWithItems` and `runOpenWith` are always handed the same filtered list in all five callers (listing context menu and palette in src/listing-input.ts, preview.ts, docview-media.ts); filesOnly rows keep their index. Read, not run per caller beyond the open-with walk.
- Malformed stored data at load, no page error and a normal listing (load-attack-walk.mjs): `bfb-folder-views-v1` as `5`, `[]`, `null`, `{{{`, `{path: 5}`, `{path: {view:'zzz', sort:'x', group:7}}`, `{path: {sort:{}}}`, `__proto__`; `openWith` as null rows, a row with a numeric name, a string, `{}`; `lensOrder` with numbers, null, objects, duplicates, a string; `lensOff` as a string or with junk entries; `compactMode` true with density 5 (stays 5), with density 1 (becomes 4), as the string `"yes"` (4), false with density 2 (stays 2); `bfb-icon-rules-v1` as `{}` or a rule with a numeric pattern.
- Folder views: key lands in the Settings export part; Reset clears it (see finding 8); defaults change does not move a kept folder (walk); a junk kept entry still lists as kept and falls back to defaults per field.
- fillTiles (fill-walk.mjs, 3000 files): a restored lead tile at index 2500 is in view after reload and fill; Select All during the fill ended with 3000 selected of 3001 tiles and "3000 selected"; switching to Details mid-fill leaves 0 tiles and 101 rows, no busy flag; Tiles to Gallery quickly ends with 3001 tiles; a sort key mid-fill ends with 3001 tiles; no page error.
- check_cmd never executes (finding 4 note), refuses non-string, empty and multi-line input with `success:false`, 10 000-character command answers normally.
- Sections: last-lens guard in the UI path, order survives reload, a lens switched off is not opened from its hidden button (sections-density walk).

## Not exercised (UNCONFIRMED)
- Select All and Arrow-key preview stepping into tiles not yet drawn, timed inside the fill: the fill of 3000 tiles finished before a keypress could be sent, so only the end state was checked. UNCONFIRMED for the in-between frames.
- `group` key cycle in a kept folder: same code path as finding 2, not run (key binding not confirmed).
- Home page (#home) with a kept root folder `/`: main.ts excludes home mode from the kept view, but `initListing` computes `folderView(app.folderPath)` without a home check (src/listing.ts:65). Whether `folderPath` is `/` on Home was not checked. UNCONFIRMED.
- Importing an old export that still carries `compactMode`: by code it would raise Detail to at least 4 on the next load. Not run.
- Light theme and narrow widths for any of the new surfaces: only the dark theme at 1300 px was driven; screenshots read: B1-side-search.png and dd-in-results.png only.
- Preview and docview-media "Open with" menus with a damaged row: read in code only.

## Artifacts created
- Throwaway scripts and screenshots under /private/tmp/claude-501/-Users-alcatraz627-Code-better-file-browser/b6fefcef-2736-4e69-bf80-2b2ce19aaec1/scratchpad/validator/ (scratchpad, not removed).
- This report.
- The temp directory the command check used for its marker file was removed with `trash`. Walk fixtures and profiles are removed by the harness on exit; none left in the system temp folder at the end.
