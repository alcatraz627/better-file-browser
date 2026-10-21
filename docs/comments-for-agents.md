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

## Paragraph for a project's CLAUDE.md

Paste this into a project whose markdown files people comment on:

> **Comments on markdown files.** A file `X.md` may have review comments in
> `X.md.bfb.json` beside it, written by the owner in better-file-browser or by
> other agents. At the start of work, run `bfb-docs comments inbox` to see
> threads waiting on you, and `bfb-docs comments list X.md` before changing a
> markdown file. Answer with `bfb-docs comments reply X.md <thread> "..."`.
> Close a thread with `bfb-docs comments done X.md <thread> "what you did"`
> only when you have done what it asked. To propose wording rather than change
> it, use `bfb-docs comments suggest`; never accept a suggestion yourself.
> Never edit or delete someone else's comment, never edit the `.bfb.json`
> file by hand, and never put comment markers in the markdown.

## Mentions

`@claude` puts a thread in every agent's inbox. `@claude:<alias>` puts it in
the inbox of the agent with that claude-ipc alias. `@user` is the owner.
Mentions do not message anyone; agents find them with `inbox`.
