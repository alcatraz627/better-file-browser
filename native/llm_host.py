#!/usr/bin/env python3
"""Native messaging host — runs the local `lm` CLI for the extension's AI features.

One Chrome port = one host process = at most one lm subprocess. Ops:
  {op:"status"}                          -> {"t":"status","data":{...lm status --json}}
  {op:"models"}                          -> {"t":"models","tiers":[{alias,model}],"gemini":[{name,default}]}
  {op:"query", ctx, ctxName?, intent?,
   question?, model?, maxCtx?, timeout?,
   files?: [path]}                       -> streamed {"t":"step"|"chunk"|"done"|"error",...}
Closing the port (stdin EOF) SIGTERMs the lm child, which aborts the
in-flight generation — that is the cancellation path.

A model named gpt:<slug> is answered by the Codex CLI on the ChatGPT sign-in,
and models also lists those as "gpt": [{name,label,default}].

Overrides, all optional: BFB_LM_BIN (the lm binary), BFB_SEE_BIN (the see
binary that reads attached images; by default the one beside lm),
BFB_CODEX_BIN (the codex binary), BFB_CODEX_HOME (Codex's folder, else
CODEX_HOME, else ~/.codex).
"""
import sys, os, re, json, struct, subprocess, tempfile, threading, time
from shutil import which

def read_msg():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4: return None
    length = struct.unpack('=I', raw)[0]
    return json.loads(sys.stdin.buffer.read(length).decode('utf-8'))

def write_msg(obj):
    enc = json.dumps(obj).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('=I', len(enc)))
    sys.stdout.buffer.write(enc)
    sys.stdout.buffer.flush()

def find_lm():
    # Chrome spawns hosts with a minimal PATH, so check known locations first.
    candidates = [
        os.environ.get('BFB_LM_BIN'),
        os.path.expanduser('~/.local/bin/lm'),
        '/opt/homebrew/bin/lm',
        '/usr/local/bin/lm',
    ]
    for c in candidates:
        if c and os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return which('lm')

def handle_status(lm):
    try:
        out = subprocess.run([lm, 'status', '--json'], capture_output=True, timeout=8)
        write_msg({'t': 'status', 'data': json.loads(out.stdout.decode('utf-8') or '{}')})
    except Exception as e:
        write_msg({'t': 'error', 'code': 'host_status_failed', 'message': str(e)})

def handle_warm(lm, msg):
    # Runs the user-facing `lm warm on|off` — an explicit user toggle, not an
    # automatic side effect of querying.
    sub = 'on' if msg.get('on') else 'off'
    try:
        out = subprocess.run([lm, 'warm', sub], capture_output=True, timeout=60)
        write_msg({'t': 'warm', 'ok': out.returncode == 0, 'on': bool(msg.get('on'))})
    except Exception as e:
        write_msg({'t': 'error', 'code': 'host_warm_failed', 'message': str(e)})

def parse_models(text):
    """The model aliases and gemini models from `lm models --json`, the only
    shape lm promises; an unreadable answer gives empty lists."""
    try:
        data = json.loads(text)
    except ValueError:
        return [], []
    tiers = [{'alias': t['alias'], 'model': t['model']} for t in data.get('tiers') or [] if t.get('alias') and t.get('model')]
    gemini = [{'name': g['name'], 'default': bool(g.get('default'))} for g in data.get('gemini') or [] if g.get('name')]
    return tiers, gemini

def handle_models(lm):
    text = ''
    if lm:
        try:
            # stdin closed: the host's own stdin is Chrome's message pipe.
            text = subprocess.run([lm, 'models', '--json'], capture_output=True, stdin=subprocess.DEVNULL, timeout=15).stdout.decode('utf-8', 'replace')
        except Exception:
            pass
    tiers, gemini = parse_models(text)
    gpt = codex_models(codex_home()) if find_codex() else []
    write_msg({'t': 'models', 'tiers': tiers, 'gemini': gemini, 'gpt': gpt})

# What the gemini lane is asked for each intent; lm q builds these prompts
# itself for local models, so only this lane needs them spelled out.
GEMINI_PROMPTS = {
    'summarize':    'Summarize the document piped in as context ({name}) in a few short paragraphs.',
    'explain-code': 'Explain what the code piped in as context ({name}) does, and flag anything dangerous.',
    'qa':           'Answer from the document piped in as context ({name}) only. Question: {question}',
}

def handle_gemini(lm, msg, model):
    intent = str(msg.get('intent') or 'qa')
    prompt = GEMINI_PROMPTS.get(intent, GEMINI_PROMPTS['qa']).format(
        name=str(msg.get('ctxName') or 'the document'), question=str(msg.get('question') or ''))
    args = [lm, 'gemini', '--json', '--timeout', str(int(msg.get('timeout') or 300))]
    if model:
        args += ['-m', model]
    args.append(prompt)
    # Chrome starts hosts with a bare environment; without a terminal type the
    # gemini CLI prints a colour warning into the answer text.
    env = {**os.environ, 'TERM': os.environ.get('TERM') or 'xterm-256color', 'COLORTERM': os.environ.get('COLORTERM') or 'truecolor'}
    child = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env)
    watch(child)
    try:
        out, _ = child.communicate((msg.get('ctx') or '').encode('utf-8'))
        r = json.loads(out.decode('utf-8') or '{}')
    except (ValueError, BrokenPipeError):
        r = {}
    if r.get('ok') and r.get('text'):
        write_msg({'t': 'chunk', 'text': r['text']})
        write_msg({'t': 'done', 'model': r.get('model') or model or 'gemini', 'ms': int(r.get('ms') or 0), 'truncated': False})
    elif child.returncode not in (None, 0) and child.returncode < 0:
        write_msg({'t': 'error', 'code': 'cancelled', 'message': 'cancelled'})
    else:
        write_msg({'t': 'error', 'code': 'gemini_unavailable', 'message': str(r.get('error') or r.get('message') or 'gemini did not answer')})

# GPT models answer through the Codex CLI and the ChatGPT sign-in it keeps in
# CODEX_HOME, so no API key is involved. Codex is an agent, so each call runs
# read-only, leaves no session behind and skips the user's Codex config.
def find_codex():
    for c in (os.environ.get('BFB_CODEX_BIN'), '/opt/homebrew/bin/codex', '/usr/local/bin/codex',
              os.path.expanduser('~/.local/bin/codex')):
        if c and os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return which('codex')

def codex_home():
    return os.environ.get('BFB_CODEX_HOME') or os.environ.get('CODEX_HOME') or os.path.expanduser('~/.codex')

def codex_models(home):
    """The GPT models Codex offers this account, read from its own model cache,
    with the one its config names marked default. Empty when Codex is absent."""
    try:
        with open(os.path.join(home, 'models_cache.json'), encoding='utf-8') as f:
            data = json.load(f)
    except (OSError, ValueError):
        return []
    default = ''
    try:
        with open(os.path.join(home, 'config.toml'), encoding='utf-8') as f:
            for line in f:
                m = re.match(r'\s*model\s*=\s*"([^"]+)"', line)
                if m:
                    default = m.group(1)
                    break
    except OSError:
        pass
    listed = [m for m in data.get('models') or [] if m.get('slug') and m.get('visibility', 'list') == 'list']
    listed.sort(key=lambda m: m.get('priority', 99))
    if not any(m['slug'] == default for m in listed):
        default = listed[0]['slug'] if listed else ''
    return [{'name': m['slug'], 'label': m.get('display_name') or m['slug'], 'default': m['slug'] == default} for m in listed]

def parse_codex(text):
    """The answer, token counts and any failure from `codex exec --json` output.
    Warnings arrive as error items and are not failures; a failed turn is."""
    answer, usage, failure = '', {}, ''
    for line in text.splitlines():
        try:
            ev = json.loads(line)
        except ValueError:
            continue
        kind = ev.get('type')
        item = ev.get('item') or {}
        if kind == 'item.completed' and item.get('type') == 'agent_message':
            answer = item.get('text') or answer
        elif kind == 'turn.completed':
            usage = ev.get('usage') or {}
        elif kind in ('turn.failed', 'error'):
            err = ev.get('error')
            failure = (err.get('message') if isinstance(err, dict) else err) or ev.get('message') or 'codex failed'
    return answer, usage, failure

def handle_codex(msg, model):
    codex = find_codex()
    if not codex:
        write_msg({'t': 'error', 'code': 'gpt_unavailable', 'message': 'codex CLI not found'})
        return
    home = codex_home()
    if not model:
        model = next((m['name'] for m in codex_models(home) if m['default']), '')
    intent = str(msg.get('intent') or 'qa')
    prompt = ('Answer directly in markdown. Do not run commands or open files; the document is in the stdin block. '
              + GEMINI_PROMPTS.get(intent, GEMINI_PROMPTS['qa']).format(
                  name=str(msg.get('ctxName') or 'the document'), question=str(msg.get('question') or '')))
    args = [codex, 'exec', '--json', '--ephemeral', '--ignore-user-config', '--ignore-rules',
            '-s', 'read-only', '--skip-git-repo-check', '-C', tempfile.gettempdir()]
    if model:
        args += ['-m', model]
    args.append(prompt)
    started = time.time()
    child = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                             env={**os.environ, 'CODEX_HOME': home})
    watch(child)
    try:
        out, _ = child.communicate((msg.get('ctx') or '').encode('utf-8'))
    except BrokenPipeError:
        out = b''
    answer, usage, failure = parse_codex(out.decode('utf-8', 'replace'))
    if answer and not failure:
        write_msg({'t': 'chunk', 'text': answer})
        write_msg({'t': 'done', 'model': model or 'gpt', 'ms': int((time.time() - started) * 1000), 'truncated': False,
                   'tokens_in': int(usage.get('input_tokens') or 0), 'tokens_out': int(usage.get('output_tokens') or 0)})
    elif child.returncode is not None and child.returncode < 0:
        write_msg({'t': 'error', 'code': 'cancelled', 'message': 'cancelled'})
    else:
        write_msg({'t': 'error', 'code': 'gpt_unavailable', 'message': failure or 'codex did not answer'})

# Files attached to a question. Text joins the context under its name; an
# image is read by the local vision model (`see`), so it never leaves this Mac.
IMAGE_EXT = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.bmp', '.tif', '.tiff'}
FILES_MAX, TEXT_MAX = 8, 100_000

def find_see(lm):
    # `see` ships beside `lm`; the env var lets the walks put a stand-in there.
    for c in (os.environ.get('BFB_SEE_BIN'), lm and os.path.join(os.path.dirname(lm), 'see')):
        if c and os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return which('see')

def read_files(lm, files, question, step):
    """The attached files as one block of context, in the order given. `step`
    reports each image as it is read, which takes a while."""
    parts = []
    for path in [str(p) for p in files][:FILES_MAX]:
        name = os.path.basename(path.rstrip('/')) or path
        if os.path.splitext(name)[1].lower() in IMAGE_EXT:
            step(f'Reading {name}')
            see = find_see(lm)
            r = {}
            if see:
                try:
                    out = subprocess.run([see, path, *([question] if question else []), '--json'],
                                         capture_output=True, stdin=subprocess.DEVNULL, timeout=180)
                    r = json.loads(out.stdout.decode('utf-8', 'replace') or '{}')
                except (ValueError, subprocess.TimeoutExpired, OSError):
                    r = {}
            if r.get('ok') and r.get('text'):
                parts.append(f"=== Image {name} (read by {r.get('model') or 'the vision model'}) ===\n{r['text']}")
            else:
                parts.append(f"=== Image {name} ===\n(could not be read: {r.get('message') or 'the vision model did not answer'})")
            continue
        try:
            with open(path, 'rb') as f:
                raw = f.read(TEXT_MAX + 1)
        except OSError as e:
            parts.append(f'=== {name} ===\n(could not be read: {e.strerror})')
            continue
        if b'\0' in raw[:4096]:
            parts.append(f'=== {name} ===\n(not text, left out)')
            continue
        text = raw[:TEXT_MAX].decode('utf-8', 'replace')
        parts.append(f"=== {name} ===\n{text}{' …(cut)' if len(raw) > TEXT_MAX else ''}")
    return '\n\n'.join(parts)

def with_files(lm, msg):
    """The query with its attached files folded into the context."""
    files = msg.get('files') or []
    if not files:
        return msg
    extra = read_files(lm, files, str(msg.get('question') or ''), lambda text: write_msg({'t': 'step', 'text': text}))
    ctx = str(msg.get('ctx') or '')
    if not ctx:     # an image's own page: the image is the whole context
        return {**msg, 'ctx': extra}
    return {**msg, 'ctx': f'{ctx}\n\n{extra}',
            'ctxName': f"{msg.get('ctxName') or 'this page'} and {len(files)} attached file{'s' if len(files) != 1 else ''}"}

def watch(child):
    def watch_disconnect():
        # Blocks until Chrome closes the port; q's SIGTERM handler then emits
        # its `cancelled` frame (nobody reads it) and stops Ollama generating.
        # Raw fd read, NOT sys.stdin.buffer — a daemon thread blocked on the
        # buffered reader deadlocks interpreter shutdown (_enter_buffered_busy).
        while os.read(0, 65536):
            pass
        if child.poll() is None:
            child.terminate()
    threading.Thread(target=watch_disconnect, daemon=True).start()

def handle_query(lm, msg):
    msg = with_files(lm, msg)
    model = str(msg.get('model') or '')
    if model.startswith('gpt:'):
        return handle_codex(msg, model[len('gpt:'):])
    if model.startswith('gemini:'):
        return handle_gemini(lm, msg, model[len('gemini:'):])
    args = [lm, 'q', '--stream-json', '--ctx', '-']
    if msg.get('ctxName'):  args += ['--ctx-name', str(msg['ctxName'])]
    if msg.get('intent'):   args += ['--intent', str(msg['intent'])]
    if msg.get('model'):    args += ['-m', str(msg['model'])]
    if msg.get('maxCtx'):   args += ['--max-ctx', str(int(msg['maxCtx']))]
    if msg.get('timeout'):  args += ['--timeout', str(int(msg['timeout']))]
    question = str(msg.get('question') or '')
    if question:
        args.append(question)

    child = subprocess.Popen(args, stdin=subprocess.PIPE,
                             stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    watch(child)

    try:
        child.stdin.write((msg.get('ctx') or '').encode('utf-8'))
        child.stdin.close()
    except BrokenPipeError:
        pass    # child already failed; its error frame arrives below

    for line in child.stdout:
        line = line.strip()
        if not line:
            continue
        try:
            write_msg(json.loads(line.decode('utf-8')))
        except ValueError:
            pass    # non-protocol noise on stdout — skip, never crash the port
        except BrokenPipeError:
            child.terminate()
            return
    child.wait()

def main():
    msg = read_msg()
    if msg is None:
        return
    lm = find_lm()
    op = msg.get('op')
    # GPT goes through Codex, so its models and answers need no lm.
    gpt_only = op == 'models' or (op == 'query' and str(msg.get('model') or '').startswith('gpt:'))
    if not lm and not gpt_only:
        write_msg({'t': 'error', 'code': 'host_no_lm',
                   'message': 'lm CLI not found (looked in ~/.local/bin, /opt/homebrew/bin, PATH)'})
        return
    if op == 'status':
        handle_status(lm)
    elif op == 'warm':
        handle_warm(lm, msg)
    elif op == 'models':
        handle_models(lm)
    elif op == 'query':
        handle_query(lm, msg)
    else:
        write_msg({'t': 'error', 'code': 'host_bad_op', 'message': f'unknown op {op!r}'})

if __name__ == '__main__':
    main()
