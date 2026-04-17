#!/usr/bin/env python3
"""Native messaging host — opens Ghostty in the requested directory."""
import sys, json, struct, subprocess

def read_msg():
    raw = sys.stdin.buffer.read(4)
    if not raw: return None
    length = struct.unpack('=I', raw)[0]
    return json.loads(sys.stdin.buffer.read(length).decode('utf-8'))

def write_msg(obj):
    enc = json.dumps(obj).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('=I', len(enc)))
    sys.stdout.buffer.write(enc)
    sys.stdout.buffer.flush()

msg = read_msg()
if msg and msg.get('action') == 'open_terminal':
    path = msg.get('path', '/')
    # AppleScript: open Ghostty with the directory as the working dir
    script = f'''tell application "Ghostty"
    activate
    create window with default profile command "cd {repr(path)} && exec $SHELL"
end tell'''
    try:
        subprocess.Popen(['osascript', '-e', script])
        write_msg({'success': True})
    except Exception as e:
        # Fallback: just open Ghostty and let user cd manually
        subprocess.Popen(['open', '-a', 'Ghostty'])
        write_msg({'success': False, 'error': str(e)})
