#!/usr/bin/env python3
"""Native messaging host: opens Ghostty in a directory, or an image in its default app."""
import sys, os, json, struct, subprocess

# Same set as IMG_EXTS in src/icons.ts: the only files this host will hand to `open`.
IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.avif', '.bmp'}

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
    # Pass the directory as a separate argv element to `open` — no shell, no
    # AppleScript string-building, so a maliciously-named directory cannot inject
    # commands (Ghostty opens a new window with that path as the working dir).
    try:
        if not isinstance(path, str) or not path.startswith('/'):
            raise ValueError('path must be an absolute string')
        subprocess.Popen(['open', '-a', 'Ghostty', path])
        write_msg({'success': True})
    except Exception as e:
        subprocess.Popen(['open', '-a', 'Ghostty'])   # fallback: just open Ghostty
        write_msg({'success': False, 'error': str(e)})
elif msg and msg.get('action') == 'open_file':
    # Only an existing image file: `open` would also launch an app bundle or a script.
    path = msg.get('path')
    try:
        if not isinstance(path, str) or not path.startswith('/'):
            raise ValueError('path must be an absolute string')
        real = os.path.realpath(path)
        if not os.path.isfile(real) or os.path.splitext(real)[1].lower() not in IMAGE_EXTS:
            raise ValueError('not an image file')
        subprocess.Popen(['open', real])
        write_msg({'success': True})
    except Exception as e:
        write_msg({'success': False, 'error': str(e)})
