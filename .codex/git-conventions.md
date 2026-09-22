# Git conventions for this checkout

Source: `/Users/alcatraz627/.claude/rules/git.md` and the working agreement
supplied by the owner for this session. Re-read the owner rules
if this copy conflicts with a newer owner instruction. The user's current
commit-and-push request authorizes this task's ordinary commits and pushes.

- Check `git status`, recent log, and diff scope before each commit or push.
- Commit logical units with scoped `git add` paths. Keep subjects imperative,
  under 72 characters, and explain the reason. Do not add agent signatures.
- Keep `.claude/wal.*`, `_*.claude.md`, locks, generated screenshots, and
  unrelated files out of commits. Keep checkpoints under `.claude/`, because
  root files starting with `_` prevent Chrome from loading this extension.
- Run the changed-comment review before code commits and prose lint before
  committing docs. Inspect the actual diff, including generated `content.js`.
- Push only the commits authorized in the current user request. Use ordinary
  fast-forward pushes. Never force-push, rebase pushed work, amend a pushed
  commit, or rewrite refs without a fresh, specific owner instruction.
- `content.js` is tracked build output. Rebuild after changing `src/` and include
  it with its source change.
