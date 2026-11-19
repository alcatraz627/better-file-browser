ISSUES-FOUND: one blocker (Rich block edit corrupts the file when the text changes on disk while a block is open), three majors, minors below.

Range 503a44d..9257a69, HEAD confirmed 9257a69 at start and end. Tree clean after my runs (styles-ui.ts restored by copy, diff empty, `git status` empty).

## What I ran

| Run | Result |
|---|---|
| `node e2e/rich-edit-walk.mjs` | 13/13 PASS |
| `node e2e/settings-extras-walk.mjs` | all PASS |
| `node e2e/settings-layout-walk.mjs` | 9/9 clean (baseline, and again after restore) |
| `node e2e/settings-truth-walk.mjs` | 31 pass, 0 fail |
| `node e2e/smoke.mjs` | all checks passed |
| `npx vitest run` | 67 files, 985 tests pass (none cover export-parts, localOnly or the rich block code) |
| Own probes (scratchpad `validator/`) | findings below |

The walks pass; every finding below is something they do not exercise.

## Findings, ranked

### 1. BLOCKER: a block open in Rich keeps stale offsets when the text changes on disk, and the next keystroke splices into the wrong place

Claim 1 ("a save never changes other bytes") is false in this state.
- Code: `src/file-editor.ts` `openBlock` stores `block.start/end` once (about line 396 to 402) and `sync` (about line 417 to 422) does `whole.slice(0, block.start) + ed.value + whole.slice(block.end)` against whatever `tw.text()` is now. Neither `takeFromDisk` (line 588) nor the banner's `reload` action (line 661) calls `closeBlock`, and `drawView` is suppressed while `block` is set.
- Repro 1 (`validator/rich-probe.mjs`, scenario E, follow on): open the last paragraph in Rich, do not type, another program writes two lines to the top of the file, the 2 s poll takes it silently, then type ` TYPED`. Disk afterwards: `NEW LINE ONE\nNEW LINE TWO\n\n# Hegamma para TYPEDpara\n\nbeta para\n\ngamma para\n`. The heading, the "alpha para" paragraph and the blank line are destroyed.
- Repro 2 (`validator/rich-probe2.mjs`, scenario E2, follow off): same setup, banner appears, click Reload (the block stays open), type `ZZ`. Disk: `...# Head\n\nalpha gZZamma para para\n\ngamma para\n`. Mangled too, so the new off switch does not protect against it.
- Likelihood is real for this owner: agents and sync tools write markdown files while it is open. Recoverable through the 14-day backup, but silent.
- Fix direction: `closeBlock()` before `takeFromDisk`, the `reload` action, and `use` (versions) at line 783; or recompute `start/end` from the lines on every `sync`.

### 2. MAJOR: Import overwrites existing marks and dark-mode choices with no undo, no warning, and no validation

Claim 3 (Undo after import, malformed web values).
- Code: `src/settings-ui.ts` import-apply handler (about line 616 to 620): `chrome.storage.local.set(pendingWeb)` is called directly. `applyWrites` and `UNDO_KEY` (`src/storage.ts:467`) only see the text store, so Undo cannot restore web keys. The values are not checked either.
- Repro (`validator/addons-probe.mjs`, S2): seeded `bfb-lights-v1` (object), a marks array with a note, and an index. Imported a file with `bfb-lights-v1: "oops"`, `bfb-marks-v1:https://keep.com/: null`, `bfb-marks-index-v1: 5`. Result in chrome.storage: the three were overwritten with `"oops"`, `null`, `5`. Clicked the reload's Undo toast: storage unchanged (still `"oops"`/`null`/`5`). The user's note was gone for good.
- The plan text for that import read "changes 0 items and adds 0 ... It also brings dark mode choices and marks (4 entries)". It never says it replaces what is there, and the toast says "Imported 0 settings".
- Readers survive most junk (`readSettings` in `src/site-lights-settings.ts:25`, `Array.isArray` in `src/site-marks.ts:52`), but `src/site-marks.ts:59-62` `save()` does `index[key] = ...` on `bfb-marks-index-v1`. With a string or number index that is a TypeError in strict mode (content.js starts with "use strict"; line-equivalent check in S4: "Cannot create property 'k' on string 'x'"). So a bad import of the index key stops marks from saving on every page. I did not drive that on a live web page: UNCONFIRMED end to end, confirmed by code reading plus the S4 equivalent.
- Fix direction: validate shapes (lights object, marks array, index object) and include web keys in the Undo record (read the old values from chrome.storage before the set).

### 3. MAJOR: Follow-changes-off Reload link can show text that is no longer on disk, and survives a failed read

Claim 5. Code: `src/file-page.ts` 603-625.
- Revert case (`validator/addons-probe.mjs` D1): change the file, link says "Changed on disk · Reload", change it back to the original. `fresh === text` returns early, so the link stays and `waiting` still holds the intermediate text. Clicking it shows "CHANGE A" though the disk holds the original. Output: `click shows stale CHANGE A though disk is original: true`.
- Delete case (D2): file removed while waiting. The catch calls `live(false, ...)`, giving text "Not watching for changes" with classes `waiting off` and `role=button`, but `waiting` is still set, so a click would apply old text. Output: `{"t":"Not watching for changes","cls":"waiting off","role":"button"}`.
- Fix direction: clear `waiting` and hide the link when `fresh === text`; clear `waiting` in the catch.

### 4. MAJOR (small blast radius): Export button is enabled with every part off and writes an empty file

Claim 3, disabled state. `src/settings-ui.ts:567` sets `disabled` only inside the switch `change` handler; the open-time sync at line 345 sets the switches but not the button. Repro (S1): store all five parts false, reopen Settings, Data: `export disabled with all parts off on open: false`, and Export wrote a file containing `{}\n`. Downgrade to minor if you consider an empty file harmless.

### 5. MINOR: view tiles overflow their buttons below about 640 px (docked Settings is in that range)

`.fe-st-mini` is a fixed 84 px (`src/styles-ui.ts:286`); the tiles shrink with the pane. Measured (`validator/tiles-probe.mjs`): at 1200 and 900 px the drawn mini sits inside its tile; at 640 px tiles are 80 px wide and each mini overhangs by 2 px each side; at 520 px tiles are 60 px and the minis overhang by 12 px each side (screenshot `validator/shots/tiles-520.png`). This is the kind of defect the owner asked to be hunted "in ALL of Settings", and the layout walk misses it because it runs only at 1200x860, dark, with default state (no populated folder list, no narrow pane).

### 6. MINOR: Reload link is a span with `role=button` and no `tabindex`

`src/file-page.ts:610` plus `src/page.ts:286`. Keyboard users cannot reach "Changed on disk · Reload" (probe D2 output shows `tabindex: null`).

### 7. MINOR: Editable-folders list edge cases (claim 4)

- XSS: safe. `esc()` (`src/utils.ts:3`) escapes quotes and angle brackets; I stored `/tmp/"><img src=x onerror="window.__xss=1">` and `/tmp/it's <b>bold</b> & more`, rendered in dark and light at 1200 and 640 px: `window.__xss` stayed null and the values round-trip exactly (`validator/visual-probe.mjs`).
- Undo index drift: the toast closes over `i` and `p` (`settings-ui.ts` about line 540). Removing A then B, then using the older Undo, reinserts at a stale index; Undo does not check for a duplicate if the same folder was re-added meanwhile; and an edit to a path already listed is accepted (only Add refuses duplicates, `settings-ui.ts` about line 549 vs 528). Not exercised in a browser: UNCONFIRMED, read from code.
- An emptied edit deletes the row with no Undo (change handler, line 528).
- `fullPath` for copy and Finder: `~` expands from `homeDir(location.pathname)`; if the Settings page is not under `/Users/<name>` and no home is remembered, `~/Code` becomes `/Code` (`src/storage.ts:268-275`). Finder with a missing path is refused by the launcher with a toast (`native/ghostty_launcher.py:40-52`), so that path fails loudly; copy fails silently.

### 8. NIT

- Folder rows' title says "Edit this folder's path" instead of the (possibly truncated) path itself; at 520 px the Add row's picker icon sits about 10 px left of the copy icon column above it.
- `exportParts` lives inside `bfb-settings-v1`, so an imported settings block replaces the importer's Export switches.
- Banner `showConflict` re-renders its HTML on every 2 s poll while the follow switch is off and the file stays changed (`doc.mtime` is not advanced), so a click on a banner button can land on a node that was just replaced. Not exercised: UNCONFIRMED.

## Claims that held

1. Rich editing (except finding 1): byte-exact on CRLF (disk `Title\r\n\r\nFirst para line one\r\nline two of first X\r\n...`, CRLF preserved although the block textarea shows LF), a final block with no trailing newline (`...no newline!`), two identical paragraphs (second edited, first untouched), front matter, table block (`| a | b |\n|---|---|\n| 1 | 2 |`), fence with a blank line inside, 5000-paragraph file (windowed): one character added at the exact position, 2.9 s end to end, undo after switching to Raw restores the text. Selecting text in the view is left alone by the click handler (`file-editor.ts` `isCollapsed` guard); a plain click on a link opens the block while Cmd or Ctrl-click follows it (by design; I did not drive the link click).
2. Only on this Mac: one `llmQuery` call site (`src/tool-lenses.ts:404`), host routes only by `gpt:`/`gemini:` prefix (`native/llm_host.py:288-292`), no other port to the host (`rg bfb-llm`: `llm.ts`, `web-shim.ts`, `background.js`). With the lm stub (`validator/addons-probe.mjs`): saved remote pick plus switch on loads with the picker holding only `[""]`, and zero codex or gemini calls across a normal ask, `@gpt` and `@gemini`; with a remote pick active and the switch turned on from another place, the ask is refused with the `local_only` text and zero remote calls. Remaining gap, UNCONFIRMED: the guard tests `opts.model && isRemote(opts.model)`, so an empty model (lm's own default) or a bare `gemini-...` name set as `aiModel` is not blocked (`src/llm.ts:148`); with the stub, `aiModel: 'gemini-3.5-flash'` went out as `lm q -m gemini-3.5-flash` (the local path). Whether real `lm` routes that name online, I could not check. `settings-ui.ts` only offers local models for `aiModel`, and the code at `tool-lenses.ts:270` does anticipate a `gemini` default, so it is worth a one-line check with the lm owner. The walk for this switch (`settings-extras-walk.mjs`) only asserts the saved flag, not the block.
3. Export parts: the five predicates partition every key by construction (`export-parts.ts:19-24`); chats off by default excludes `bfb-ask-history-v1`; web keys export as objects and a well-formed import writes them back as objects; Reset leaves marks and lights (they are not in the text-store cache, `kv.ts` keeps strings only; probe S3 confirmed both survive).
4. Folders list: see finding 7.
5. Follow off: page waits behind Reload and editor shows the banner (walk plus code); see findings 1 and 3 for the failures.
6. Settings layout walk mutation tests, each on a scratch copy restored by `cp` and rebuilt:
   - Removed `.fe-set.wide .fe-set-c>:only-child{...}`: red, `div.fe-appicons lays 24 items one per line in 700px`.
   - Removed `.fe-set-h .sect-acts{margin-block:-6px}`: red, `heading "Icon rulesRule" is 32px, the others 22px`.
   - Set `.fe-st-parts` left padding to 0: red, `div#fe-st-export-parts.fe-st-parts starts at 1px, its card's rows at 17px`.
   - Restored, rebuilt, walk green again. The walk guards what it claims at one viewport; see finding 5 for what it does not.

## Could not exercise

- Marks saving on a live web page after a malformed index import (finding 2, last paragraph).
- Real `lm` behaviour for an empty or bare-gemini model with the switch on.
- Link click inside a rendered block, and a drag-select followed by Comment in Rich.
- Banner re-render race (finding 8).

## Artifacts created

Removed: `/private/tmp/claude-501/-Users-alcatraz627/` (created by a mistyped path), `/var/folders/t8/k_k3y4h95qqfmnhp3k3fgqkh0000gn/T/bfb-import-83525.json` and `bfb-long-83525.md` (smoke leftovers).

Kept, none removable by me without guessing:
- `/private/tmp/claude-501/-Users-alcatraz627-Code-better-file-browser/b6fefcef-2736-4e69-bf80-2b2ce19aaec1/scratchpad/validator/` (probes `rich-probe.mjs`, `rich-probe2.mjs`, `addons-probe.mjs`, `visual-probe.mjs`, `tiles-probe.mjs`, `folders-probe.mjs`, logs, `styles-ui.ts.orig` backup, `shots/` screenshots).
- The walks' own tmp leftovers from earlier sessions in `/var/folders/t8/k_k3y4h95qqfmnhp3k3fgqkh0000gn/T/` (`bfb-docx-*`, `bfb-import-*`, `bfb-long-*`), not mine to sort by pid, except the two above.
- `/Users/alcatraz627/Code/better-file-browser/.claude/output/20261120-addons-validation/validator.md` (this file).
