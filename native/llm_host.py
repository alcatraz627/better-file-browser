#!/usr/bin/env python3
"""Native messaging host — runs the local `lm` CLI for the extension's AI features.

One Chrome port = one host process = at most one lm subprocess. Ops:
  {op:"status"}                          -> {"t":"status","data":{...lm status --json}}
  {op:"query", ctx, ctxName?, intent?,
   question?, model?, maxCtx?, timeout?} -> streamed {"t":"chunk"|"done"|"error",...}
Closing the port (stdin EOF) SIGTERMs the lm child, which aborts the
in-flight generation — that is the cancellation path.
"""
import sys, os, json, struct, subprocess, threading
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

def handle_query(lm, msg):
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
    if not lm:
        write_msg({'t': 'error', 'code': 'host_no_lm',
                   'message': 'lm CLI not found (looked in ~/.local/bin, /opt/homebrew/bin, PATH)'})
        return
    op = msg.get('op')
    if op == 'status':
        handle_status(lm)
    elif op == 'warm':
        handle_warm(lm, msg)
    elif op == 'query':
        handle_query(lm, msg)
    else:
        write_msg({'t': 'error', 'code': 'host_bad_op', 'message': f'unknown op {op!r}'})

if __name__ == '__main__':
    main()
