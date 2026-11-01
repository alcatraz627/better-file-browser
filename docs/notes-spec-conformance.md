# Notes folder: following the shared spec

The notes folder has one written definition, `specs/notes.md` in the `mnt-sync` repo. Switchboard, the Android app, the `note` command and this extension all follow it. [The older contract page](notes-contract.md) still describes paths and cross-tool use, and where the two differ the spec wins.

## How the extension is held to it

The spec ships fixture files that say exactly how awkward input must read and write. A copy lives in `tests/fixtures/notes-spec/`, with its hash in `tests/fixtures/notes-spec.sha256`. Three tests use it:

- `npx vitest run tests/notefmt.test.ts` reads every fixture through `src/notefmt.ts` and the editor's own readers in `src/notes.ts`.
- `python3 native/test_notefmt.py` does the same for `native/notefmt.py` and the host's list and title code.
- Both compare the copy's hash with the recorded one, and with `/Users/alcatraz627/Code/mnt-sync/specs/notes/fixtures` when that folder is on the machine. To take a newer spec, copy the fixtures over and record the new hash with `tests/notes-spec-hash.ts`.

`src/notefmt.ts` and `native/notefmt.py` are the only places that parse a header. A file holding a clash marker anywhere is not parsed for a header: its title is its file name and it shows the settle buttons until it is settled.

## What changed for the person using it

- A note's title follows the spec everywhere: the `title` key, else the first body line without its `#` or `>`, else the file name as written. Hyphens in a file name are no longer shown as spaces. A note whose `title:` is empty shows its first body line in lists (the parse keeps the title empty, as the spec says). A file holding a merge clash is titled by its file name. The settle bar appears for any clash marker, labelled or not, and for one that was never closed.
- A note with no `created` line sorts as the oldest, and ties go by file name. A note made in bfb now gets `created` on its first save so it sorts as new.
- Colour names outside the eight in the spec (`indigo`, `mint` and so on) read as no colour, the same as on the other apps.
- New pictures are named `<id>-<stamp>.<ext>` in `attachments/`. A picture over 5 MB warns, and over 20 MB is refused.
- Every write by the host holds the repo lock (`.git/mnt-sync.lock`, waiting up to 5 seconds) and swaps files in atomically.

## Saved lives in the notes folder

Each saved row is a file in `.saved/`, named by the first 12 hex characters of the SHA-1 of its `file://` address, in the same format as a note. Tag colours live in `.meta/tags.json`.

- `chrome.storage` (`bfb-saved-v1`, `bfb-tags-v1`) stays the cache, so reading Saved is still instant and still works with no notes helper or no notes folder. Once this browser has moved Saved into a folder, the folder overrides the cache. A change made while the folder could not answer is written first.
- **Moved is a mark this browser keeps, not a fact about the folder** (`bfb-saved-moved-v1`, per notes folder). A browser that has not moved Saved makes the first move even when the folder already holds saves from another device. That move only creates files that are missing and never touches one that is there, so the other device's saves are joined, not replaced. Before it writes, the browser keeps a copy of its old rows and tag colours (`bfb-saved-premigration-v1`, `bfb-tags-premigration-v1`), says what it did, and offers Undo. Undo removes the files the move made, restores the old rows exactly, and keeps Saved in the browser until you choose "Move Saved to the notes folder" under the Saved filter.
- **A push removes only what the person removed.** The browser remembers the saves it last saw in the folder (`bfb-saved-known-v1`) and deletes a file only when it is on that list and no longer wanted. A save another device added since is never removed. The same holds for tag colours: a push writes only colours changed here (`bfb-saved-colours-v1` holds what the folder had), so another device's colour is not overwritten.
- A folder with every save deleted does not bring saves back once this browser has moved: an empty folder is read as empty.
- **A save whose file holds a merge clash keeps its row.** The row is marked "Two versions", the line under the Saved filter counts them, and a menu on the row keeps the first side, the second or both. The file is never rewritten or removed until it is settled.
- **A lasting way back.** While the earlier rows are kept, the line under the Saved filter offers "Bring back my earlier rows", which puts back any row the folder does not have, beside what is there now. It does not wait for the 12 second Undo toast.
- A link saved on the phone (`https://` and the like) is a row in bfb's Saved on the Mac, with a link icon, and opens in a new tab. It is not a Mac path, so it has no phone button, and a web row is not written with a `device` line. `file://` saves marked for the phone are still never deleted from here.
- Paths that do not survive the folder do: a `#` or `%` in a file name round-trips through its save address.
- The line under the Saved filter says where the list is kept.

## Sync state

Switchboard writes `.git/mnt-sync-state.json` inside the repo. The Notes lens and the Home Notes card read it through the host and say, in plain words, whether notes are synced, how many changes are waiting either way, what Switchboard says is wrong, and how many notes hold two versions. A report older than ten minutes reads as "Sync is not running", and a folder in no repo says it stays on this Mac.

## Other header fields

A note's `url` shows as a chip with open and copy buttons. Notes with an `agent` line sit in a folded **Agents** lane, and notes past their `expires` time in a folded **Expired** lane; neither lane deletes anything. A reminder can be set, changed, dismissed and cleared from the editor's **Remind** chip. Dismissing a one-off clears the `remind_*` lines, and dismissing a repeating one moves it to its next time. `remind_on` is written only for the phone, since the Mac is the default. A reminder time that passed shows as missed. bfb never rings a reminder: the device named in `remind_on` does.

The editor's **Expiry** chip sets, changes and removes `expires` (presets for tomorrow, a week and a month, or any time), and the reminder box has an "Also expire the note then" box that writes both times at once. A time that has passed moves the note to Expired and never deletes it.

New notes keep bfb's own naming: the file is named from the title once there is one, which the spec allows ("bfb names a note from its title once it has one" and every id matching `[A-Za-z0-9][A-Za-z0-9_-]{0,63}`). A title with no letters or digits gets a `YYYYMMDD-HHMMSS-xxxx` id.

## The rest of the editor

- **Duplicate** (row menu) makes a second note with the same words, tags, colour and link. It is not pinned, has no `pos`, reminder, expiry or `agent`, so nothing rings or expires twice. **Copy text** and **Copy title and text** sit beside Copy title and Copy path. The command palette has **New note from the clipboard**.
- **Deleting a note** moves any picture or file only that note links to into `.trash/attachments`; a file another note or save links to stays put. Restoring the note brings its files back.
- **Trash** also lists notes deleted on another device, read from the last 300 commits of the folder's git history, and restores them with their pictures. **Remove** (the cross) sends a trashed note to the macOS Trash. For a note found in history it only hides it from this list.
- **Tag colours** (Settings, Notes) lists every tag on a note or a save with its colour and its name. Clicking the dot walks the palette and ends at no colour. Changing the name changes it on every note and save, and the colour goes with it. Colours are written to `.meta/tags.json`, and a colour for a tag no save carries is kept in `bfb-tag-colours-v1`.

## One address, search and the waiting list

- **Copy link** is the one wording and one behaviour for every copy-address button: the note row menu, the Saved row's hover button, the tab strip's menu, the listing's menu and the top bar button. Each copies the phone address when phone access is on (it opens on this Mac and on the phone) and a `file://` link when it is off, and says which. On the phone, a `file://` link in a note opens the same path through the phone server. On the Mac, a link to the phone server opens the file locally. The logic is in `src/address.ts` and `src/phone.ts`.
- The Search lens lists matching saves and matching comment threads after the file hits. The host searches comments through `commentsSearch`.
- Home has a **Waiting on you** card for missed reminders, comments that mention you, decision pages, unsorted captures and notes an agent left. The spec has no field for either of two things, so these are this app's choices:
  - A capture is a note with a `source`, no tags, no pin and no `agent`.
  - An item fades 7 days after it first appeared, kept in `bfb-waiting-seen-v1`. A missed reminder never fades.

## The phone build

Saved is read from and written to the notes folder through the Mac, so a save made on the phone is a file in `.saved/` and a save the Mac adds shows on the phone. The seed from the Mac no longer replaces Saved the phone has not sent. The phone does not move Saved on its own: it adopts a folder that exists, waits for one that does not, and writes a save made on the phone first (create-only) so that it is never dropped. Comments were already writable on the phone. The server answers only localhost and tailnet host names, over plain HTTP.

**Ask on the phone.** Ask runs through the Mac. The phone server (`native/web_server.py`, route `POST /_bfb/llm`) runs the same AI host the extension uses (`native/llm_host.py`), so there is one runtime and one set of models. `native/ask_jobs.py` plays the part the extension's background worker plays: it keeps each answer and the text so far, so an answer survives the phone page being suspended, reloaded or losing signal. A page that comes back picks the answer up (the text so far arrives as a replay, then the rest), and an answer nobody was watching when it ended is parked on the Mac and filed into the chat history by the next page. Stop stops the model on the Mac. Chats asked on the phone are no longer lost on reload: the Mac's history is joined with the phone's chat by chat, not replaced (`src/ask-merge.ts`).

What does not carry over, and why:

- A chat asked on the phone stays on the phone. It is not written back into the Mac's history, because the Mac's history lives in the extension's own storage and the phone server has no way into it. Joining the two the other way is a separate piece of work.
- A chat deleted on the Mac comes back on the phone after the next load while the phone still holds a copy, since the join keeps every chat either side has. Deleting on the phone is undone the same way. Fixing this needs a record of deletions that both sides share.
