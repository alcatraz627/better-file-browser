"""The one-writer-at-a-time lock for the notes repo.

Anything on the Mac that runs git or writes a file in the repo holds an
exclusive flock on <repo>/.git/mnt-sync.lock, waiting up to 5 seconds, and
never holds it across user input.

As a library:

    with repo_lock(repo):
        ...write files, run git...

From a shell, run one command under the lock:

    python3 tools/notes_lock.py /path/to/repo -- git -C /path/to/repo status
"""

import contextlib
import fcntl
import os
import subprocess
import sys
import time

WAIT_SECONDS = 5.0
POLL_SECONDS = 0.05


class LockTimeout(Exception):
    pass


def git_dir(repo):
    """Absolute .git directory of a repo or worktree."""
    out = subprocess.run(
        ["git", "-C", repo, "rev-parse", "--absolute-git-dir"],
        capture_output=True, text=True)
    if out.returncode != 0:
        raise ValueError("not a git repo: " + repo)
    return out.stdout.strip()


def lock_path(repo):
    return os.path.join(git_dir(repo), "mnt-sync.lock")


@contextlib.contextmanager
def repo_lock(repo, wait=WAIT_SECONDS):
    path = lock_path(repo)
    fd = os.open(path, os.O_RDWR | os.O_CREAT, 0o644)
    deadline = time.monotonic() + wait
    try:
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except OSError:
                if time.monotonic() >= deadline:
                    raise LockTimeout(
                        "another writer holds " + path + " for over %gs" % wait)
                time.sleep(POLL_SECONDS)
        yield path
    finally:
        os.close(fd)


def main(argv):
    if len(argv) < 4 or argv[2] != "--":
        sys.stderr.write(__doc__)
        return 2
    try:
        with repo_lock(argv[1]):
            return subprocess.run(argv[3:]).returncode
    except LockTimeout as e:
        sys.stderr.write(str(e) + "\n")
        return 4


if __name__ == "__main__":
    sys.exit(main(sys.argv))
