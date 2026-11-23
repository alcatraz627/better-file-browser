# Coherence audit: plan and dispositions

<!-- sessions: catch-audit-7c@2026-11-23 -->

Three read-only reviewers audited bfb on 2026-11-23: [ui.md](ui.md), [data-flow.md](data-flow.md) and [architecture.md](architecture.md). This file says what gets fixed, in what order, and what is left and why. Ids are prefixed U (UI), D (data flow) and A (architecture).

## What the audit says, in one paragraph

The code hangs together better than its paperwork. Every module is reachable, the low layers import nothing upward, messages all have handlers, and the newest Settings panes use the shared controls. The real incoherence is in four places. Stores that hold a whole list under one key still lose a change when two copies write. The background worker trusts any caller although a script now runs on every website. The checks the docs name as gates have no runner, so they decayed. A few surfaces (the note reminder menu, the web page panel) never joined the component system.

## Current behaviour that must survive

- Settings saves write only the keys that changed (src/storage.ts saveSettings). Check: tests/storage.test.ts.
- Saved, tags and history keep working across tabs and the notes folder. Checks: e2e/smoke.mjs Saved steps, e2e/sync-state-walk.mjs.
- Marks made on a web page show again on reload and in Settings, Web pages. Check: e2e/site-tools-walk.mjs.
- The extension loads after reload. Check: `ls -a` on the root, e2e/smoke.mjs.
- File pages, the phone build and extension pages can still fetch files and reach the native hosts after the worker starts checking its callers. Checks: e2e/smoke.mjs, e2e/edit-walk.mjs, e2e/phone-walk.mjs.

## Order of work

1. Data loss first: D1, D2, D3 with D15 and A6, D5, D9, D10, D4, D7, D13, D6.
2. The worker and the bundles: A2 with D20, A4.
3. Visible UI drift: U1, U10, U5, U6, U9, U11, U17, U12, U7, U8, U13.
4. Paperwork and dead code: A1, A9, A11, A7, A10, A13, A14, A16.

Each fix gets a check that fails without it, watched red then green.

## Dispositions

| Id | Finding | Call | Why |
|---|---|---|---|
| D1 | A folder allowed from the reader is erased by the next list edit in Settings, same tab | fix | Same bug the owner already hit, by another route |
| D2 | Two pages loading together lose one visit from history | fix | Owner asked for no misses in history |
| D3 | Same web page in two tabs: last save erases the other tab's marks | fix | Loses the owner's own notes |
| D4 | A save made while Saved syncs can be undone by the sync | fix if confirmed | Small guard, real loss |
| D5 | After two tabs write one key, the first keeps the wrong value in memory | fix if confirmed | Root of several lost edits |
| D6 | Full storage: changes look saved and are gone | fix | One permission and a toast |
| D7 | Two Settings dialogs overwrite each other's Open with list | fix with D1 | Same cause |
| D8 | Import replaces the notes folder and allowed folders | owner call | Import replacing everything may be what an import is for |
| D9 | One bad row empties the per-folder views store | fix | Same class as cd41b25, missed there |
| D10 | A bad kept-notes entry stops the sidebar starting | fix | One HTML file could break every page |
| D11 | Saved and history changes do not show in other open tabs | fix | Cheap: listeners on three keys |
| D12 | Phone can delete a save the Mac added | fix | One line in the keep list |
| D13 | A parked chat answer can be lost when one row fails | fix | Small |
| D14 | Duplicated Chrome tab shares a strip id | leave | Unconfirmed, low loss |
| D15 | Marks index can miss a page | fix with D3 | Same write path |
| D16 | Removals are not tracked as pending | leave | No caller hits it today |
| D17 | Old copies stay in file:// storage | leave | Deleting old copies of user data needs the owner's word |
| D18 | Phone state stored twice | leave | Cosmetic |
| D19 | Diagram view state written whole | leave | View state, cost is a redraw |
| D20 | Worker is hand-written with copied key names | part: caller checks under A2 | Building the worker is a larger change |
| A1 | README says no remote requests; Lights and Metro make them | fix | A false privacy statement |
| A2 | Worker never checks who is calling | fix | A script now runs on every site |
| A3 | No runner for the walks, three stale walks | fix the three stale walks; runner proposed | A runner is new tooling, the owner should ask for it |
| A4 | Nothing notices a stale committed bundle | fix | It happened this week |
| A5 | Ratchet cannot see direct storage use | leave with U4 | Depends on the ratchet decision |
| A6 | Marks keys spelled in four places | fix with D3 | |
| A7 | Services doc says every pref is declared in storage.ts | fix the doc | Doc describes a system that is not there |
| A8 | Phone and decision page stand-ins cover less than asked | part: guard the diagram store | Hiding phone tabs is a UI call for the owner |
| A9 | architecture-v2.md describes reversed behaviour | fix | One note and the docs map |
| A10 | component-system.md has no status per part | fix | A status table |
| A11 | README structure and changelog are behind | fix | |
| A12 | Eight relative-time formatters | leave, listed | Wording change across eight surfaces is a taste call |
| A13 | Nine dead exports | fix | |
| A14 | One import cycle in directions | fix | |
| A15 | data.json, report.html, phone mock unused | owner call | Deletion |
| A16 | file-page derives the home folder itself | fix | |
| U1 | Reminder menu uses native dropdowns and checkboxes | fix | Most visible break |
| U2 | Web page panel has its own colours and buttons | owner call | The amber may be deliberate, to stand apart from the page |
| U3 | Site mode chosen with three different controls | leave | Five modes do not fit a segmented control in a site row |
| U4 | The consistency ratchet is red on 19 of 22 rules | owner call | Re-baselining decides what counts as debt |
| U5 | Settings search count is a hand-drawn pill | fix | |
| U6 | Folder view group headings have their own type | fix | |
| U7 | Colour button has no focus ring and is taller than its row | fix | |
| U8 | Marks cannot be reached by keyboard | fix | |
| U9 | Settings search empty message is hand-made | fix | |
| U10 | `ghost` and `primary` variants do not exist | fix, with a test | |
| U11 | One Settings switch is shorter than the rest | fix | |
| U12 | 9px corners and hand-mixed washes in new rows | fix | |
| U13 | Editor mode switch is hand-built | fix if small | |
| U14 | Editor view fades on mode change | leave | It follows a click, not a page load |
| U15 | Search hits sit inside the tab list | leave | Unconfirmed with a screen reader |
| U16 | Two label classes for a small switch | leave | Low |
| U17 | Dead checkbox CSS | fix | |
| U18 | Four labels longer than four words | owner call | Wording |
| U19 | Three ways to add to a list in Tools | leave | Low |

## Result (2026-11-23)

Each fixed row has a check that was watched failing without the fix, unless the table says otherwise.

| Id | Outcome | The check |
|---|---|---|
| D1, D7 | fixed | tests/storage.test.ts "a list saved through one copy". D7's listener has no test of its own |
| D2 | fixed | tests/data-coherence.test.ts "two pages that load together" |
| D3, D15, A6 | fixed | tests/site-marks-store.test.ts; e2e/site-tools-walk.mjs two-tab step (green only, not mutated) |
| D4 | fixed | tests/saved-sync.test.ts |
| D5 | fixed | tests/data-coherence.test.ts "a tab keeps its own value" |
| D6 | fixed by removing the size cap (`unlimitedStorage`) | none; a full store could not be induced here |
| D9, D10 | fixed | tests/data-coherence.test.ts "damaged stored values" |
| D11 | fixed for Saved and tags; history in other tabs still needs a reload | e2e/smoke.mjs caught the first version rebuilding Saved during a reset |
| D12, D13 | fixed | none; read only |
| A2, D20 | fixed: caller and helper checks in the worker | tests/background-callers.test.ts |
| A4 | fixed | tests/bundles.test.ts |
| A1, A7, A9 | docs corrected | read back |
| U1 | fixed: segmented controls and shared check boxes | tests/ui-parts.test.ts, e2e/note-fields-walk.mjs, screenshot read (dark) |
| U10 | fixed: `ghost` removed, `primary` is `solid` | tests/ui-parts.test.ts |
| U5, U6, U9, U11, U12, U17 | fixed | walks green, screenshots read (dark only) |
| U7 | part: focus ring added; the button is still its own class at 34px | none |

Not done this session, still worth doing: U8 (marks by keyboard), U13 (editor mode switch), A3 (three stale walks), A10, A11, A13, A14, A16, and history repaint in other tabs (rest of D11).

Also fixed before the audit, from the last checkpoint's leftovers: a pattern that could freeze the page (src/slow-regex.ts, tests/slow-regex.test.ts) and End pressed while a big tile folder fills (e2e/first-screen-walk.mjs).

Waiting on the owner: D8, A15, U2, U4 (with A5), U18.
