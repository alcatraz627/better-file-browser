"""Reference reader and writer for the notes folder format.

This is the plain-Python version of what specs/notes.md describes. Each app
(Swift, TypeScript, Java) is checked against the same fixtures in
specs/notes/fixtures/, and when this file and a fixture disagree the fixture is
right. Standard library only.
"""

import hashlib
import json
import re
import secrets
from datetime import datetime, timezone

KNOWN_KEYS = [
    "title", "created", "tags", "expires", "remind_at", "remind_repeat",
    "remind_on", "remind_persist", "reminder_id", "pinned", "color", "agent",
    "source", "url", "device", "pos",
]
COLORS = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"]
REPEATS = ["daily", "weekly", "monthly"]
DEVICES = ["mac", "phone"]

POS_RE = re.compile(r"^[0-9a-z]{0,31}[1-9a-z]$")
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")

# Parse results use these field names (camelCase), in this order.
FIELDS = [
    "title", "body", "tags", "color", "pinned", "pos", "url", "device",
    "agent", "source", "expires", "created", "remindAt", "remindRepeat",
    "remindOn", "remindPersist", "reminderId", "conflicted", "extraLines",
]

# header key -> parse field name
_KEY_TO_FIELD = {
    "title": "title", "created": "created", "tags": "tags",
    "expires": "expires", "remind_at": "remindAt",
    "remind_repeat": "remindRepeat", "remind_on": "remindOn",
    "remind_persist": "remindPersist", "reminder_id": "reminderId",
    "pinned": "pinned", "color": "color", "agent": "agent",
    "source": "source", "url": "url", "device": "device", "pos": "pos",
}


def normalise(text):
    """Line endings become \\n, as every reader does before parsing."""
    return text.replace("\r\n", "\n")


def _is_opener(line):
    return line.startswith("<<<<<<< ") or line == "<<<<<<<"


def _is_closer(line):
    return line.startswith(">>>>>>> ") or line == ">>>>>>>"


def has_clash(text):
    return any(_is_opener(l) for l in normalise(text).split("\n"))


def valid_pos(s):
    return bool(s) and bool(POS_RE.match(s))


def valid_id(s):
    return bool(ID_RE.match(s))


def _unquote(raw):
    """Read one header value: JSON-quoted, YAML single-quoted or bare."""
    v = raw.strip()
    if len(v) >= 2 and v[0] == '"':
        try:
            out = json.loads(v)
            if isinstance(out, str):
                return out
        except ValueError:
            pass
        return v
    if len(v) >= 2 and v[0] == "'" and v[-1] == "'":
        return v[1:-1].replace("''", "'")
    return v


def _parse_tags(raw):
    s = _unquote(raw).strip()
    if s.startswith("[") and s.endswith("]"):
        s = s[1:-1]
    out = []
    for part in s.split(","):
        part = part.strip()
        if len(part) >= 2 and part[0] == part[-1] and part[0] in "\"'":
            part = part[1:-1].strip()
        if part:
            out.append(part)
    return out


def _derive_title(body, name):
    for line in body.split("\n"):
        if line.strip():
            t = line.lstrip("#> ").strip()
            return t if t else name
    return name


def empty_note(name):
    return {
        "title": name, "body": "", "tags": [], "color": None, "pinned": False,
        "pos": None, "url": None, "device": None, "agent": None,
        "source": None, "expires": None, "created": None, "remindAt": None,
        "remindRepeat": None, "remindOn": None, "remindPersist": False,
        "reminderId": None, "conflicted": False, "extraLines": [],
    }


def split_header(text):
    """Return (header_lines, body) for normalised text, or (None, text)."""
    lines = text.split("\n")
    if lines[0] != "---":
        return None, text
    for i in range(1, len(lines)):
        if lines[i] == "---":
            return lines[1:i], "\n".join(lines[i + 1:])
    return None, text


def parse(text, name):
    """Parse one file. `name` is the file name without `.md`."""
    text = normalise(text)
    note = empty_note(name)
    if has_clash(text):
        note["conflicted"] = True
        note["body"] = text
        return note
    header, body = split_header(text)
    note["body"] = body
    title_seen = False
    if header is not None:
        for line in header:
            if line == "":
                continue
            idx = line.find(":")
            key = line[:idx] if idx >= 0 else None
            if key not in _KEY_TO_FIELD:
                note["extraLines"].append(line)
                continue
            raw = line[idx + 1:]
            val = _unquote(raw)
            field = _KEY_TO_FIELD[key]
            if key == "title":
                note["title"] = val.strip()
                title_seen = True
            elif key == "tags":
                note["tags"] = _parse_tags(raw)
            elif key in ("pinned", "remind_persist"):
                note[field] = val == "true"
            elif key == "color":
                note[field] = val if val in COLORS else None
            elif key == "remind_repeat":
                note[field] = val if val in REPEATS else None
            elif key == "remind_on":
                note[field] = val if val in DEVICES else None
            elif key == "pos":
                note[field] = val if valid_pos(val) else None
            else:
                note[field] = val if val != "" else None
    if not title_seen:
        note["title"] = _derive_title(body, name)
    return note


def _jstr(s):
    return json.dumps(s, ensure_ascii=False)


def render(note):
    """Write a note from fields. Missing fields count as empty."""
    g = lambda k, d=None: note.get(k, d)
    out = ["---", "title: " + _jstr(g("title") or "")]
    if g("created"):
        out.append("created: " + g("created"))
    tags = g("tags") or []
    if tags:
        out.append("tags: " + _jstr(", ".join(tags)))
    if g("expires"):
        out.append("expires: " + g("expires"))
    if g("remindAt"):
        out.append("remind_at: " + g("remindAt"))
    if g("remindRepeat"):
        out.append("remind_repeat: " + g("remindRepeat"))
    if g("remindOn"):
        out.append("remind_on: " + g("remindOn"))
    if g("remindPersist"):
        out.append("remind_persist: true")
    if g("reminderId"):
        out.append("reminder_id: " + _jstr(g("reminderId")))
    if g("pinned"):
        out.append("pinned: true")
    if g("color"):
        out.append("color: " + g("color"))
    for key, field in (("agent", "agent"), ("source", "source"),
                       ("url", "url"), ("device", "device")):
        if g(field):
            out.append(key + ": " + _jstr(g(field)))
    if g("pos"):
        out.append("pos: " + g("pos"))
    out.extend(g("extraLines") or [])
    out.append("---")
    return "\n".join(out) + "\n" + (g("body") or "")


def settle(text, choice):
    """Settle every clash block. choice is 'first', 'second' or 'both'."""
    if choice not in ("first", "second", "both"):
        raise ValueError("choice must be first, second or both")
    lines = normalise(text).split("\n")
    out = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if not _is_opener(line):
            out.append(line)
            i += 1
            continue
        first, second = [], []
        j = i + 1
        side = first
        closed = False
        while j < n:
            l = lines[j]
            if side is first and l == "=======":
                side = second
            elif _is_closer(l):
                closed = True
                break
            else:
                side.append(l)
            j += 1
        if not closed:
            out.extend(first + second)
            i = n
            break
        if choice == "first":
            out.extend(first)
        elif choice == "second":
            out.extend(second)
        else:
            out.extend(first + second)
        i = j + 1
    return "\n".join(out)


def _blocks(lines):
    """Yield (first, second, closed) for each clash block."""
    i = 0
    n = len(lines)
    while i < n:
        if not _is_opener(lines[i]):
            i += 1
            continue
        first, second = [], []
        side = first
        j = i + 1
        closed = False
        while j < n:
            l = lines[j]
            if side is first and l == "=======":
                side = second
            elif _is_closer(l):
                closed = True
                break
            else:
                side.append(l)
            j += 1
        yield first, second, closed
        i = j + 1


def pos_only_clash(text):
    """True when every block is closed and every changed line is `pos:`."""
    blocks = list(_blocks(normalise(text).split("\n")))
    if not blocks:
        return False
    for first, second, closed in blocks:
        if not closed:
            return False
        for l in first + second:
            if not l.startswith("pos:"):
                return False
    return True


def auto_settles(text, relpath):
    """True when a clash may be settled with no one asking (Mac's side wins)."""
    if not has_clash(text):
        return False
    if relpath.startswith(".reminders/"):
        return True
    return pos_only_clash(text)


def sort_notes(notes):
    """Order records with keys id, pinned, pos, created. Returns new list."""
    def key(n):
        pinned = 0 if n.get("pinned") else 1
        pos = n.get("pos")
        if not pos:
            # no pos first; newest created first (inverted below)
            return (pinned, 0, "", _neg(n.get("created") or ""), n["id"])
        return (pinned, 1, pos, (), n["id"])
    return sorted(notes, key=key)


class _neg:
    """Reverses string order inside a sort key."""
    def __init__(self, s):
        self.s = s

    def __lt__(self, other):
        return self.s > other.s

    def __eq__(self, other):
        return self.s == other.s

    def __bool__(self):
        return True


_SCHEME_RE = re.compile(r"^([A-Za-z][A-Za-z0-9+.\-]*):(.*)$", re.S)
_AUTH_RE = re.compile(r"^//([^/?#]*)(.*)$", re.S)


def normalise_url(url):
    """Trim spaces, lowercase the scheme and host. Everything else is kept."""
    url = url.strip()
    m = _SCHEME_RE.match(url)
    if not m:
        return url
    scheme, rest = m.group(1).lower(), m.group(2)
    a = _AUTH_RE.match(rest)
    if a:
        auth = a.group(1)
        user, at, host = auth.rpartition("@")
        rest = "//" + user + at + host.lower() + a.group(2)
    return scheme + ":" + rest


def save_key(url):
    """File name stem for a save: first 12 hex of SHA-1 of the url."""
    return hashlib.sha1(normalise_url(url).encode("utf-8")).hexdigest()[:12]


def new_id(now=None):
    now = now or datetime.now(timezone.utc)
    return now.strftime("%Y%m%d-%H%M%S") + "-" + secrets.token_hex(2)


def iso_now(now=None):
    now = now or datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%SZ")


_B36 = "0123456789abcdefghijklmnopqrstuvwxyz"


def pos_between(a, b):
    """A valid pos strictly between a and b in byte order. None means no bound."""
    a = a or ""
    if b is not None:
        n = 0
        while n < len(b) and (a[n] if n < len(a) else "0") == b[n]:
            n += 1
        if n > 0:
            return b[:n] + pos_between(a[n:], b[n:])
    da = _B36.index(a[0]) if a else 0
    db = _B36.index(b[0]) if b else 36
    if db - da > 1:
        return _B36[(da + db) // 2]
    if b is not None and len(b) > 1:
        return b[0]
    return _B36[da] + pos_between(a[1:], None)


def edit_header(text, changes):
    """Change header lines in place and keep every other byte.

    `changes` maps a known header key to its new bare text, or None to remove
    it. A key already there is replaced where it stands, a new one goes after
    the nearest known key that sorts before it, and a note with no header
    gets one. Body, unknown lines and line endings are left alone.
    """
    lines = text.split("\n")
    crlf = lines[0].endswith("\r")
    cr = "\r" if crlf else ""
    is_fence = lambda l: l.rstrip("\r") == "---"
    close = None
    if is_fence(lines[0]):
        for i in range(1, len(lines)):
            if is_fence(lines[i]):
                close = i
                break
    adds = [k for k in KNOWN_KEYS if changes.get(k) is not None]
    if close is None:
        if not adds:
            return text
        head = ["---" + cr] + ["%s: %s%s" % (k, changes[k], cr) for k in adds]
        head.append("---" + cr)
        return "\n".join(head) + "\n" + text
    header = lines[1:close]
    seen = set()
    out = []
    for line in header:
        body = line.rstrip("\r")
        idx = body.find(":")
        key = body[:idx] if idx >= 0 else None
        if key in changes:
            if key in seen or changes[key] is None:
                continue
            seen.add(key)
            out.append("%s: %s%s" % (key, changes[key], cr))
        else:
            out.append(line)
    for key in adds:
        if key in seen:
            continue
        rank = KNOWN_KEYS.index(key)
        at = 0
        for i, line in enumerate(out):
            body = line.rstrip("\r")
            idx = body.find(":")
            k = body[:idx] if idx >= 0 else None
            if k in KNOWN_KEYS and KNOWN_KEYS.index(k) < rank:
                at = i + 1
        out.insert(at, "%s: %s%s" % (key, changes[key], cr))
    return "\n".join([lines[0]] + out + lines[close:])
