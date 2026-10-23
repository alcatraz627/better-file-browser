#!/usr/bin/env python3
"""Native messaging host: opens a terminal in a directory, or an image in its default app."""
import sys, os, json, struct, subprocess

# Same set as IMG_EXTS in src/icons.ts: the only files this host will hand to `open`.
IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.avif', '.bmp'}

# The terminals Settings offers, by the name `open -a` knows them. Nothing else is launched.
TERMINALS = {'ghostty': 'Ghostty', 'terminal': 'Terminal', 'iterm': 'iTerm', 'wezterm': 'WezTerm', 'kitty': 'kitty'}

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
    app = TERMINALS.get(msg.get('app') or 'ghostty')
    # Pass the directory as a separate argv element to `open` — no shell, no
    # AppleScript string-building, so a maliciously-named directory cannot inject
    # commands (Ghostty opens a new window with that path as the working dir).
    try:
        if not isinstance(path, str) or not path.startswith('/'):
            raise ValueError('path must be an absolute string')
        if app is None:
            raise ValueError('unknown terminal')
        subprocess.Popen(['open', '-a', app, path])
        write_msg({'success': True})
    except Exception as e:
        write_msg({'success': False, 'error': str(e)})
elif msg and msg.get('action') == 'open_with':
    # A file or folder in an editor by its macOS app name, or shown in Finder. Only these apps.
    path = msg.get('path')
    apps = {'zed': 'Zed', 'vscode': 'Visual Studio Code', 'cursor': 'Cursor'}
    try:
        if not isinstance(path, str) or not path.startswith('/') or not os.path.exists(path):
            raise ValueError('path must be an existing absolute path')
        target = msg.get('target')
        if target == 'finder':
            subprocess.Popen(['open', '-R', path])
        elif target in apps:
            subprocess.Popen(['open', '-a', apps[target], path])
        else:
            raise ValueError('unknown app')
        write_msg({'success': True})
    except Exception as e:
        write_msg({'success': False, 'error': str(e)})
elif msg and msg.get('action') == 'run_with':
    # One of the person's own commands from Settings, with the path quoted as its
    # last argument: in a new Ghostty window that stays open, or in the background.
    import shlex
    path, cmd = msg.get('path'), msg.get('cmd')
    try:
        if not isinstance(path, str) or not path.startswith('/'):
            raise ValueError('path must be an absolute string')
        if not isinstance(cmd, str) or not cmd.strip() or '\n' in cmd:
            raise ValueError('the command must be one line')
        line = f'{cmd.strip()} {shlex.quote(path)}'
        if msg.get('terminal'):
            subprocess.Popen(['open', '-na', 'Ghostty', '--args', '-e', '/bin/zsh', '-lc', f'{line}; exec /bin/zsh -l'])
        else:
            subprocess.Popen(['/bin/zsh', '-lc', line], start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        write_msg({'success': True})
    except Exception as e:
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
