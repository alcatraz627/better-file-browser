# Notes folder: following the shared spec

The notes folder has one written definition, `specs/notes.md` in the `mnt-sync` repo. Switchboard, the Android app, the `note` command and this extension all follow it. [The older contract page](notes-contract.md) still describes paths and cross-tool use, and where the two differ the spec wins.

## How the extension is held to it

The spec ships fixture files that say exactly how awkward input must read and write. A copy lives in `tests/fixtures/notes-spec/`, with its hash in `tests/fixtures/notes-spec.sha256`. Three tests use it:

- `npx vitest run tests/notefmt.test.ts` reads every fixture through `src/notefmt.ts` and the editor's own readers in `src/notes.ts`.
- `python3 native/test_notefmt.py` does the same for `native/notefmt.py` and the host's list and title code.
- Both compare the copy's hash with the recorded one, and with `/Users/alcatraz627/Code/mnt-sync/specs/notes/fixtures` when that folder is on the machine. To take a newer spec, copy the fixtures over and record the new hash with `tests/notes-spec-hash.ts`.

`src/notefmt.ts` and `native/notefmt.py` are the only places that parse a header. A file holding a clash marker anywhere is not parsed for a header: its title is its file name and it shows the settle buttons until it is settled.

## What changed for the person using it

- A note's title follows the spec everywhere: the `title` key, else the first body line without its `#` or `>`, else the file name as written. Hyphens in a file name are no longer shown as spaces.
- A note with no `created` line sorts as the oldest, and ties go by file name. A note made in bfb now gets `created` on its first save so it sorts as new.
- Colour names outside the eight in the spec (`indigo`, `mint` and so on) read as no colour, the same as on the other apps.
- New pictures are named `<id>-<stamp>.<ext>` in `attachments/`. A picture over 5 MB warns, and over 20 MB is refused.
- Every write by the host holds the repo lock (`.git/mnt-sync.lock`, waiting up to 5 seconds) and swaps files in atomically.

## Saved lives in the notes folder

Each saved row is a file in `.saved/`, named by the first 12 hex characters of the SHA-1 of its `file://` address, in the same format as a note. Tag colours live in `.meta/tags.json`.

- `chrome.storage` (`bfb-saved-v1`, `bfb-tags-v1`) stays the cache, so reading Saved is still instant and still works with no notes helper or no notes folder. When the folder answers, it overrides the cache. A change made while it could not answer is written first.
- The first time a notes folder with no `.saved/` is seen, the rows are written there once. The move only creates files, so running it twice changes nothing. It keeps a copy of the old rows and tag colours (`bfb-saved-premigration-v1`, `bfb-tags-premigration-v1`), says what it did, and offers Undo. Undo removes the files it made, restores the old rows exactly, and keeps Saved in the browser until you choose "Move Saved to the notes folder" under the Saved filter.
- Saves from other apps stay untouched: web links, and `file://` saves marked for the phone are not Mac rows and are never deleted from here.
- The line under the Saved filter says where the list is kept.

## Sync state

Switchboard writes `.git/mnt-sync-state.json` inside the repo. The Notes lens and the Home Notes card read it through the host and say, in plain words, whether notes are synced, how many changes are waiting either way, what Switchboard says is wrong, and how many notes hold two versions. A report older than ten minutes reads as "Sync is not running", and a folder in no repo says it stays on this Mac.

## Other header fields

A note's `url` shows as a chip with open and copy buttons. Notes with an `agent` line sit in a folded **Agents** lane, and notes past their `expires` time in a folded **Expired** lane; neither lane deletes anything. A reminder can be set, changed, dismissed and cleared from the editor's **Remind** chip. Dismissing a one-off clears the `remind_*` lines, and dismissing a repeating one moves it to its next time. `remind_on` is written only for the phone, since the Mac is the default. A reminder time that passed shows as missed. bfb never rings a reminder: the device named in `remind_on` does.

## One address, search and the waiting list

- **Copy link** on a note row copies the phone address when phone access is on (it opens on this Mac and on the phone) and a `file://` link when it is off, and says which. On the phone, a `file://` link in a note opens the same path through the phone server. On the Mac, a link to the phone server opens the file locally. The logic is in `src/address.ts` and `src/phone.ts`.
- The Search lens lists matching saves and matching comment threads after the file hits. The host searches comments through `commentsSearch`.
- Home has a **Waiting on you** card for missed reminders, comments that mention you, decision pages, unsorted captures and notes an agent left. The spec has no field for either of two things, so these are this app's choices:
  - A capture is a note with a `source`, no tags, no pin and no `agent`.
  - An item fades 7 days after it first appeared, kept in `bfb-waiting-seen-v1`. A missed reminder never fades.

## The phone build

Saved is read from and written to the notes folder through the Mac, so a save made on the phone is a file in `.saved/` and a save the Mac adds shows on the phone. The seed from the Mac no longer replaces Saved the phone has not sent, and the phone never makes the first move of Saved. Comments were already writable on the phone (the walk covers it). The server answers only localhost and tailnet host names, over plain HTTP. Ask chats still reach the phone as the Mac's copy at each load, because Ask itself is not on the phone.
