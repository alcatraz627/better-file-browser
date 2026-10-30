# Comments on markdown, for agents and other tools

People comment on markdown files from better-file-browser, the way they would
in a Google Doc. Agents read and answer those comments from a terminal with
`bfb-docs`. This page is the contract both sides rely on.

## Where comments live

A document `plan.md` keeps its comments in `plan.md.bfb.json` next to it.
The file is JSON, written by bfb and by `bfb-docs`; read it if you like, but
change it only through `bfb-docs`, which takes a lock, merges with other
writers and never drops a thread. Inside a git repo the companion is kept out
of git through the clone's local exclude file unless the repo opts in with
`bfb-docs config commit on`.

A comment never changes the document. The one exception is a person pressing
Accept on a suggested edit in the browser, which replaces the quoted words
and keeps a backup.

## The commands an agent needs

```
bfb-docs comments inbox                         # threads waiting on you, in every folder
bfb-docs comments list plan.md                  # open threads in one file (--all for done ones too)
bfb-docs comments show plan.md <thread>         # one thread in full
bfb-docs comments reply plan.md <thread> "..."  # #tag, @mention, @due 2026-11-03 and /done work in the text
bfb-docs comments done plan.md <thread> "what you did"
bfb-docs comments tag plan.md <thread> risk     # untag removes one
bfb-docs comments new plan.md --quote "exact words in the file" "your comment"
bfb-docs comments suggest plan.md --quote "exact words" --replace "new words" "why"
```

Add `--json` to any command for machine-readable output. A thread id can be
shortened to its first 6 or more characters. `bfb-docs whoami` shows who you
write as: your claude-ipc alias when you have one, otherwise your session id.

## When you move or rewrite commented text

A thread holds on to the words it quotes. After an edit, bfb finds them again
on its own when it can: text added above or below, a paragraph moved within
the file, a word changed inside the quote (shown as "moved"). When the words
are gone, the thread is "detached" and waits to be placed again. Placement is
best effort; you keep it right by fixing what you moved.

If you moved, reworded or deleted text that has comments, put the threads back
before you finish:

```
bfb-docs comments reanchor plan.md              # where every thread is now: anchored, moved or detached
bfb-docs comments attach plan.md <thread> --quote "the words it is about now"
bfb-docs comments move plan.md <thread> other.md --quote "the words in other.md"
bfb-docs comments reanchor plan.md --write      # save the places it found, once they look right
bfb-docs comments doctor .                      # comments whose document you renamed or moved
bfb-docs comments relink plan.md.bfb.json new-name.md
```

- Rewrote a sentence: `attach` the thread to the new wording.
- Moved a section to another file: `move` the thread; its replies, tags and
  status go with it.
- Renamed or moved the file itself: `doctor`, then `relink`.
- Deleted what a thread was about: leave it detached and say so in a reply.
  The owner can place it again from the comments panel.

The owner can also place a thread by hand in the browser: a thread that is
moved or detached has "Attach to selection"; select the new words on the
page, press it, then "Attach here".

## Paragraph for a project's CLAUDE.md

Paste this into a project whose markdown files people comment on:

> **Comments on markdown files.** A file `X.md` may have review comments in
> `X.md.bfb.json` beside it, written by the owner in better-file-browser or by
> other agents. At the start of work, run `bfb-docs comments inbox` to see
> threads waiting on you, and `bfb-docs comments list X.md` before changing a
> markdown file. Answer with `bfb-docs comments reply X.md <thread> "..."`.
> Close a thread with `bfb-docs comments done X.md <thread> "what you did"`
> only when you have done what it asked. When you move, reword or delete
> commented text, put its threads back before you finish: `bfb-docs comments
> reanchor X.md` shows where each one is, `attach` and `move` place them again
> (see docs/comments-for-agents.md in better-file-browser). To propose wording rather than change
> it, use `bfb-docs comments suggest`; never accept a suggestion yourself.
> Never edit or delete someone else's comment, never edit the `.bfb.json`
> file by hand, and never put comment markers in the markdown.

## Mentions

`@claude` puts a thread in every agent's inbox. `@claude:<alias>` puts it in
the inbox of the agent with that claude-ipc alias. `@user` is the owner.
Mentions do not message anyone; agents find them with `inbox`.

## Send

**Send** on a thread (or **⇧S**) does message an agent. The owner picks the
agent, and bfb's native host hands the thread to it through claude-ipc. The
message names the doc, the quoted words and every comment, and gives the
`bfb-docs comments show` and `reply` commands to answer with.

It goes out as a `request` from `user`:

- `user` is the owner's claude-ipc name. Chrome runs the host outside any
  session, so the host has no alias of its own.
- A request wakes an idle session. An `inform` would wait for its next turn.
- No reply to bfb is expected. The answer belongs in the thread.
