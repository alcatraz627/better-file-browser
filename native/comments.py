"""Where a comment sits in a document, and what a comment's text says.

Anchors point at a span of the document's source text by its exact words
plus a little context. When the document changes, an anchor first follows
a diff from the text it was last confirmed against (exact, whoever edited
the file); only a span whose own text changed falls back to searching for
its words: exact, then ignoring whitespace, then fuzzy. A fuzzy result is
shown as moved and never replaces the stored words. Nothing here reads or
writes files. Spec: .claude/specs/bfb-docs.md sections 2 and 6.
"""
import difflib
import hashlib
import re

CONTEXT = 32          # characters of prefix and suffix kept around a span
QUOTE_MAX = 1000      # longest span a comment can anchor to
CLEAR_MARGIN = 8      # context characters a best match must win by
FUZZY_MIN = 0.75      # similarity a fuzzy match needs (about 25% edits)
CHAR_DIFF_MAX = 20000 # a changed hunk larger than this is not diffed by character


def fingerprint(text):
    return hashlib.sha256(text.replace('\r\n', '\n').encode('utf-8')).hexdigest()


def line_of(text, offset):
    return text.count('\n', 0, offset) + 1


def headings_at(text, offset):
    """The markdown heading path that contains `offset`, outermost first."""
    path = []
    in_fence = False
    for m in re.finditer(r'^.*$', text[:offset], re.M):
        line = m.group(0)
        if re.match(r'^\s*(```|~~~)', line):
            in_fence = not in_fence
            continue
        h = None if in_fence else re.match(r'^(#{1,6})\s+(.*?)\s*#*\s*$', line)
        if h:
            level = len(h.group(1))
            path = [p for p in path if p[0] < level] + [(level, h.group(2))]
    return [t for _, t in path]


def make_anchor(text, start, end):
    """An anchor for text[start:end], with context and hints from this text."""
    if not 0 <= start < end <= len(text):
        raise ValueError('the span is empty or outside the document')
    if end - start > QUOTE_MAX:
        raise ValueError(f'a comment can anchor to at most {QUOTE_MAX} characters')
    return {
        'exact': text[start:end],
        'prefix': text[max(0, start - CONTEXT):start],
        'suffix': text[end:end + CONTEXT],
        'line': line_of(text, start),
        'offset': start,
        'headings': headings_at(text, start),
    }


def occurrences(text, quote):
    out, i = [], text.find(quote)
    while i != -1:
        out.append(i)
        i = text.find(quote, i + 1)
    return out


# ── Following a diff ────────────────────────────────────────────────────

def _segments(base, cur):
    """Runs of text that did not change, as (base_start, cur_start, length),
    by lines first and then by characters inside each changed hunk."""
    bl, cl = base.splitlines(keepends=True), cur.splitlines(keepends=True)
    bpos, cpos = [0], [0]
    for l in bl: bpos.append(bpos[-1] + len(l))
    for l in cl: cpos.append(cpos[-1] + len(l))
    segs = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, bl, cl, autojunk=False).get_opcodes():
        b0, b1, c0, c1 = bpos[i1], bpos[i2], cpos[j1], cpos[j2]
        if op == 'equal':
            segs.append((b0, c0, b1 - b0))
        elif op == 'replace' and (b1 - b0) + (c1 - c0) <= CHAR_DIFF_MAX:
            sm = difflib.SequenceMatcher(None, base[b0:b1], cur[c0:c1], autojunk=False)
            for a, b, n in sm.get_matching_blocks():
                if n: segs.append((b0 + a, c0 + b, n))
    return segs


def carry(base, cur, offset, length, segs=None):
    """Where base[offset:offset+length] is in `cur`, if that span and nothing
    inside it changed; None when the span's own text was edited."""
    if segs is None:
        segs = _segments(base, cur)
    end = offset + length
    for b0, c0, n in segs:
        if b0 <= offset and end <= b0 + n:
            return c0 + (offset - b0)
    return None


# ── Searching for the words ─────────────────────────────────────────────

def _context_score(text, at, length, anchor):
    """How many characters of stored prefix (read backwards) and suffix agree."""
    pre, suf = anchor.get('prefix', ''), anchor.get('suffix', '')
    score = 0
    for k in range(1, len(pre) + 1):
        if at - k < 0 or text[at - k] != pre[-k]: break
        score += 1
    for k in range(len(suf)):
        e = at + length + k
        if e >= len(text) or text[e] != suf[k]: break
        score += 1
    return score


def _pick(text, hits, length, anchor):
    """The best of several matches: context first, then same headings, then
    nearness to the line hint. Ambiguous unless it wins by a clear margin."""
    if len(hits) == 1:
        return hits[0], False
    want_h = anchor.get('headings') or []
    hint = anchor.get('line') or 0
    def score(at):
        s = _context_score(text, at, length, anchor) * 10
        if want_h and headings_at(text, at) == want_h: s += 15
        if hint: s -= min(abs(line_of(text, at) - hint), 500) / 100
        return s
    ranked = sorted(hits, key=score, reverse=True)
    top, second = score(ranked[0]), score(ranked[1])
    return ranked[0], top - second < CLEAR_MARGIN * 10


def _collapse(text):
    """Text with whitespace runs made single spaces, and a map back to offsets."""
    out, idx, prev_ws = [], [], False
    for i, ch in enumerate(text):
        if ch.isspace():
            if prev_ws: continue
            out.append(' '); idx.append(i); prev_ws = True
        else:
            out.append(ch); idx.append(i); prev_ws = False
    idx.append(len(text))
    return ''.join(out), idx


def _fuzzy(text, exact, anchor):
    """The window of `text` most like `exact`, if it is like enough and wins."""
    n = len(exact)
    if n < 8:
        return None
    starts = set()
    for probe in (exact[:12], anchor.get('prefix', '')[-12:]):
        if len(probe) >= 6:
            for at in occurrences(text, probe):
                starts.add(at if probe == exact[:12] else at + len(probe))
    for probe in (exact[-12:], anchor.get('suffix', '')[:12]):
        if len(probe) >= 6:
            for at in occurrences(text, probe):
                starts.add(max(0, (at + len(probe) if probe == exact[-12:] else at) - n))
    best = []
    step = max(1, n // 10)
    for s in sorted(starts)[:200]:
        for m in range(int(n * 0.75), int(n * 1.25) + 1, step):
            for shift in (-step, 0, step):
                a = max(0, s + shift)
                win = text[a:a + m]
                if not win: continue
                r = difflib.SequenceMatcher(None, exact, win, autojunk=False).ratio()
                best.append((r, a, len(win)))
    if not best:
        return None
    best.sort(reverse=True)
    r, a, m = best[0]
    if r < FUZZY_MIN:
        return None
    rival = next((x for x in best[1:] if abs(x[1] - a) > n), None)
    if rival and r - rival[0] < 0.05:
        return None
    return a, m


def locate(text, anchor):
    """Search `text` for an anchor's words. Returns (state, offset, length)
    with state anchored, ambiguous, moved or detached."""
    exact = anchor.get('exact', '')
    if not exact:
        return 'detached', None, 0
    hits = occurrences(text, exact)
    if hits:
        at, ambiguous = _pick(text, hits, len(exact), anchor)
        return ('ambiguous' if ambiguous else 'anchored'), at, len(exact)
    flat, idx = _collapse(text)
    q = _collapse(exact)[0].strip()
    if q:
        fh = occurrences(flat, q)
        if fh:
            at, ambiguous = _pick(flat, fh, len(q), {**anchor, 'prefix': '', 'suffix': ''})
            s, e = idx[at], idx[at + len(q)]
            return ('ambiguous' if ambiguous else 'moved'), s, e - s
    f = _fuzzy(text, exact, anchor)
    if f:
        return 'moved', f[0], f[1]
    return 'detached', None, 0


def resolve(anchor, text, base=None, segs=None):
    """Where an anchor is in `text` now: through the diff from `base` when the
    span survived unchanged, else by searching. Returns a dict with state,
    offset, length and line (offset None when detached)."""
    off, exact = anchor.get('offset'), anchor.get('exact', '')
    if off is not None and text[off:off + len(exact)] == exact and (base is None or base == text):
        state, at, n = 'anchored', off, len(exact)
    else:
        at = None
        if base is not None and off is not None and base[off:off + len(exact)] == exact:
            at = carry(base, text, off, len(exact), segs)
            if at is not None and text[at:at + len(exact)] != exact:
                at = None
        if at is not None:
            state, n = 'anchored', len(exact)
        else:
            state, at, n = locate(text, anchor)
    return {'state': state, 'offset': at, 'length': n, 'line': line_of(text, at) if at is not None else None}


# ── What a comment says ─────────────────────────────────────────────────

_CODE = re.compile(r'```.*?```|~~~.*?~~~|`[^`\n]*`', re.S)
_LINK_TARGET = re.compile(r'\]\([^)]*\)|<[a-z]+://[^>]*>|\b[a-z]+://\S+', re.I)
_EMAIL = re.compile(r'\b[\w.+-]+@[\w-]+\.[\w.-]+')
_TAG = re.compile(r'(?:(?<=\s)|^)#([A-Za-z][\w/-]*)', re.M)
_MENTION = re.compile(r'(?:(?<=\s)|^)@([A-Za-z][\w.-]*)', re.M)
_DUE = re.compile(r'(?:(?<=\s)|^)@due\s+(\d{4}-\d{2}-\d{2})\b', re.M)
_DUE_WORD = re.compile(r'(?:(?<=\s)|^)@(today|tomorrow)\b', re.M)
_DONE = re.compile(r'^\s*/done\s*$', re.M)
_REOPEN = re.compile(r'^\s*/reopen\s*$', re.M)
_DATE_WORDS = {'due', 'today', 'tomorrow'}
HEX_COLOUR = re.compile(r'[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8}')


def _plain(text):
    """The text with code, link targets, URLs and email addresses blanked."""
    blank = lambda m: ' ' * len(m.group(0))
    for rx in (_CODE, _LINK_TARGET, _EMAIL):
        text = rx.sub(blank, text)
    return text


def parse(text, today=None):
    """What a comment's text asks for: tags, mentions, a due date, done or reopen.
    `today` is a datetime.date for @today and @tomorrow."""
    import datetime
    t = _plain(text)
    tags = []
    for m in _TAG.finditer(t):
        line_start = t.rfind('\n', 0, m.start()) + 1
        if m.start() == line_start and re.match(r'#\s', t[m.start():m.start() + 2]):
            continue
        tag = m.group(1).rstrip('.,;:!?').lower()
        if HEX_COLOUR.fullmatch(tag) and (re.search(r'\d', tag) or len(set(tag)) == 1):
            continue   # a colour such as #fff or #e0e0e0, not a tag
        if tag and tag not in tags: tags.append(tag)
    mentions = []
    for m in _MENTION.finditer(t):
        name = m.group(1).rstrip('.,;:!?')
        if name.lower() in _DATE_WORDS or not name: continue
        if name not in mentions: mentions.append(name)
    due = None
    d = _DUE.search(t)
    if d:
        due = d.group(1)
    else:
        w = _DUE_WORD.search(t)
        if w:
            base = today or datetime.date.today()
            due = (base + datetime.timedelta(days=1 if w.group(1) == 'tomorrow' else 0)).isoformat()
    return {
        'tags': tags,
        'mentions': mentions,
        'due': due,
        'done': bool(_DONE.search(t)),
        'reopen': bool(_REOPEN.search(t)),
    }
