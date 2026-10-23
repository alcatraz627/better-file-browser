#!/usr/bin/env python3
"""Protocol test for ghostty_launcher.py's open_file action. A fake `open` first on PATH
records what the host would have launched, so no app opens. Run: python3 native/test_launcher.py"""
import json, os, stat, struct, subprocess, sys, tempfile, time

HOST = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ghostty_launcher.py')
work = tempfile.mkdtemp(prefix='bfb-launcher-')
log = os.path.join(work, 'open.log')
fake = os.path.join(work, 'bin')
os.makedirs(fake)
with open(os.path.join(fake, 'open'), 'w') as fh:
    fh.write(f'#!/bin/sh\nprintf "%s\\n" "$*" >> "{log}"\n')
os.chmod(os.path.join(fake, 'open'), os.stat(os.path.join(fake, 'open')).st_mode | stat.S_IXUSR)

def ask(msg):
    enc = json.dumps(msg).encode('utf-8')
    env = dict(os.environ, PATH=fake + os.pathsep + os.environ['PATH'])
    out = subprocess.run([sys.executable, HOST], input=struct.pack('=I', len(enc)) + enc,
                         capture_output=True, timeout=10, env=env).stdout
    time.sleep(0.3)   # the fake open runs detached
    return json.loads(out[4:4 + struct.unpack('=I', out[:4])[0]].decode('utf-8'))

def launched():
    return open(log).read().split('\n')[:-1] if os.path.exists(log) else []

failed = 0
def verdict(cond, label):
    global failed
    print(('ok   ' if cond else 'FAIL ') + label)
    if not cond: failed += 1

png = os.path.realpath(os.path.join(work, 'pic.png'))
open(png, 'wb').write(b'\x89PNG')
open(os.path.join(work, 'run.sh'), 'w').write('#!/bin/sh\n')
os.makedirs(os.path.join(work, 'App.app'))

r = ask({'action': 'open_file', 'path': png})
verdict(r.get('success') is True and launched() == [png], f'an image is handed to open, and nothing else: {r} {launched()}')
before = len(launched())
for label, p in [('a script', os.path.join(work, 'run.sh')), ('an app bundle', os.path.join(work, 'App.app')),
                 ('a missing file', os.path.join(work, 'gone.png')), ('a relative path', 'pic.png'), ('a non-string', 7)]:
    r = ask({'action': 'open_file', 'path': p})
    verdict(r.get('success') is False and len(launched()) == before, f'{label} is refused: {r.get("error")}')
link = os.path.join(work, 'link.png')
os.symlink(os.path.join(work, 'run.sh'), link)
r = ask({'action': 'open_file', 'path': link})
verdict(r.get('success') is False and len(launched()) == before, f'a .png link to a script is refused: {r.get("error")}')

before = len(launched())
r = ask({'action': 'open_terminal', 'path': work, 'app': 'iterm'})
verdict(r.get('success') is True and launched()[before:] == [f'-a iTerm {work}'], f'iTerm opens on the folder: {launched()[before:]}')
before = len(launched())
r = ask({'action': 'open_terminal', 'path': work, 'app': 'Calculator'})
verdict(r.get('success') is False and len(launched()) == before, f'an app outside the terminal list is refused: {r.get("error")}')

# Open with: a known app goes to open -a, Finder reveals, anything else is refused.
target = os.path.join(work, 'doc.md')
open(target, 'w').write('x')
r = ask({'action': 'open_with', 'target': 'zed', 'path': target})
verdict(r.get('success') and launched()[-1] == f'-a Zed {target}', f'Open in Zed runs open -a Zed: {launched()[-1:]}')
r = ask({'action': 'open_with', 'target': 'finder', 'path': target})
verdict(r.get('success') and launched()[-1] == f'-R {target}', 'Show in Finder reveals the file')
r = ask({'action': 'open_with', 'target': 'calculator', 'path': target})
verdict(not r.get('success'), 'an app not on the list is refused')
# A command of the person's own runs with the path quoted as its last argument.
made = os.path.join(work, "made it's here.txt")
r = ask({'action': 'run_with', 'cmd': 'touch', 'terminal': False, 'path': made})
time.sleep(0.5)
verdict(r.get('success') and os.path.exists(made), 'a background command runs on the path, quoted (a name with a quote and spaces)')
r = ask({'action': 'run_with', 'cmd': 'cat\nls', 'terminal': False, 'path': target})
verdict(not r.get('success'), 'a command over two lines is refused')

print('\nall checks passed' if not failed else f'\n{failed} FAILED')
sys.exit(1 if failed else 0)
