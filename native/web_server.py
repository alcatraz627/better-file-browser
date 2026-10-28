#!/usr/bin/env python3
"""bfb for a phone: this Mac's folders and files as web pages on the tailnet.

The server answers the same pages Chrome shows for file:// addresses, at the
same paths, so the bfb web build (assets/web/web.js) runs on them as the
extension runs on Chrome's own: a folder is an "Index of" page with a table, a
text file is its text in a <pre>, and anything else is the file itself. A
request from the app (it sends X-Bfb-Raw) always gets the file's bytes.

    python3 web_server.py --port 5123

It listens on 127.0.0.1 only. `tailscale serve` puts it on the tailnet; the
bfb setting "Open on my phone" runs both (see phone_ctl in notes_host.py).
Requests must name localhost or a *.ts.net host, and a POST must come from a
page this server served (Origin matches Host), which also stops DNS rebinding.

Routes:
  GET  /<any absolute path>   the folder listing, the file page, or the raw file
  GET  /_bfb/<asset>          the web build, mermaid, the search worker, app icons
  POST /_bfb/native           {host, payload} -> {ok, response | error}: one
                              request to a bfb native host, as the extension sends it
"""
import argparse
import html
import json
import mimetypes
import os
import re
import struct
import subprocess
import sys
import urllib.parse
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# The extension files a page may load, by the path chrome.runtime.getURL gives.
ASSETS = {'web.js': 'assets/web/web.js', 'vendor-mermaid.js': 'vendor-mermaid.js', 'search-worker.js': 'search-worker.js'}
ASSET_DIRS = ('assets/app-icons/',)
# Native hosts the phone may reach, and ops that only make sense at the Mac's own screen.
HOSTS = {'com.better_file_browser.notes': os.path.join(HERE, 'notes_host.py')}
DESK_ONLY_OPS = {'pick', 'phone'}
HOST_OK = re.compile(r'^(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+(\.[a-z0-9-]+)*\.ts\.net)(:\d+)?$', re.I)
TEXT_LIMIT = 20 * 1024 * 1024
# The Mac's bfb settings, pushed by the extension while phone access is on (op phoneSeed).
SEED = os.environ.get('BFB_PHONE_SEED') or os.path.expanduser('~/Library/Application Support/better-file-browser/phone-seed.json')
# Chrome renders these itself; a phone gets the same.
RENDERED = {'.html', '.htm', '.pdf'}


def is_text(path):
    try:
        with open(path, 'rb') as f:
            head = f.read(8192)
    except OSError:
        return False
    if b'\0' in head:
        return False
    try:
        head.decode('utf-8')
        return True
    except UnicodeDecodeError as e:
        return e.start > len(head) - 4   # a character cut at the end of the sample


def fmt_size(n):
    for unit in ('B', 'kB', 'MB', 'GB'):
        if n < 1024 or unit == 'GB':
            return f'{n:.0f} {unit}' if unit == 'B' else f'{n:.1f} {unit}'
        n /= 1024


def listing_html(path):
    """The folder as Chrome lists a file:// folder: a title starting "Index of" and a table."""
    rows = []
    try:
        names = sorted(os.listdir(path), key=str.lower)
    except OSError as e:
        raise PermissionError(str(e))
    for name in names:
        full = os.path.join(path, name)
        try:
            st = os.stat(full)
        except OSError:
            continue
        is_dir = os.path.isdir(full)
        href = urllib.parse.quote(name) + ('/' if is_dir else '')
        size = 0 if is_dir else st.st_size
        when = datetime.fromtimestamp(st.st_mtime).strftime('%d/%m/%Y, %H:%M:%S')
        rows.append(
            f'<tr><td data-value="{html.escape(name)}"><a class="icon {"dir" if is_dir else "file"}" href="{html.escape(href)}">'
            f'{html.escape(name)}{"/" if is_dir else ""}</a></td>'
            f'<td class="detailsColumn" data-value="{size}">{"" if is_dir else fmt_size(size)}</td>'
            f'<td class="detailsColumn" data-value="{int(st.st_mtime)}">{when}</td></tr>')
    title = html.escape(path if path.endswith('/') else path + '/')
    return page(f'Index of {title}',
                f'<h1>Index of {title}</h1><table><thead><tr><th>Name</th><th>Size</th><th>Date Modified</th></tr></thead>'
                f'<tbody>{"".join(rows)}</tbody></table>')


def page(title, body):
    return ('<!doctype html><html><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
            f'<title>{html.escape(title, quote=False)}</title></head><body>{body}'
            '<script src="/_bfb/web.js"></script></body></html>').encode('utf-8')


def run_host(script, payload):
    """One request to a native host, framed as Chrome frames it: a 4-byte length, then JSON."""
    data = json.dumps(payload).encode('utf-8')
    r = subprocess.run([sys.executable, script], input=struct.pack('<I', len(data)) + data,
                       capture_output=True, timeout=60)
    out = r.stdout
    if len(out) < 4:
        raise RuntimeError((r.stderr or b'the host answered nothing').decode('utf-8', 'replace')[-400:])
    n = struct.unpack('<I', out[:4])[0]
    return json.loads(out[4:4 + n].decode('utf-8'))


class Handler(BaseHTTPRequestHandler):
    server_version = 'bfb-phone'

    def log_message(self, fmt, *args):
        sys.stderr.write('%s %s\n' % (self.command, self.path[:200]))

    def send(self, code, body=b'', ctype='text/plain; charset=utf-8', extra=None):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def host_ok(self):
        if HOST_OK.match(self.headers.get('Host', '')):
            return True
        self.send(421, b'This server answers only on localhost and the tailnet.\n')
        return False

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if not self.host_ok():
            return
        url = urllib.parse.urlsplit(self.path)
        path = urllib.parse.unquote(url.path)
        if path.startswith('/_bfb/'):
            return self.asset(path[len('/_bfb/'):])
        path = os.path.normpath(path) + ('/' if path.endswith('/') and path != '/' else '')
        raw = self.headers.get('X-Bfb-Raw') == '1' or self.headers.get('Sec-Fetch-Dest') not in (None, 'document', 'iframe')
        if os.path.isdir(path):
            if not path.endswith('/'):
                return self.send(301, b'', extra={'Location': urllib.parse.quote(path + '/')})
            try:
                return self.send(200, listing_html(path), 'text/html; charset=utf-8')
            except PermissionError as e:
                return self.send(403, f'This folder cannot be read: {e}\n'.encode())
        if not os.path.isfile(path):
            return self.send(404, b'Not found\n')
        ext = os.path.splitext(path)[1].lower()
        text = is_text(path)
        if not raw and text and ext not in RENDERED and os.path.getsize(path) <= TEXT_LIMIT:
            with open(path, 'rb') as f:
                body = f.read().decode('utf-8', 'replace')
            return self.send(200, page(os.path.basename(path), f'<pre>{html.escape(body, quote=False)}</pre>'), 'text/html; charset=utf-8')
        ctype = 'text/plain; charset=utf-8' if text and (raw or ext not in RENDERED) else (mimetypes.guess_type(path)[0] or 'application/octet-stream')
        if ext in RENDERED and not raw:
            ctype = mimetypes.guess_type(path)[0] or ctype
        try:
            with open(path, 'rb') as f:
                return self.send(200, f.read(), ctype)
        except OSError as e:
            return self.send(403, f'This file cannot be read: {e}\n'.encode())

    def asset(self, rel):
        rel = rel.split('?')[0]
        if rel == 'seed.json':
            try:
                with open(SEED, 'rb') as f:
                    return self.send(200, f.read(), 'application/json')
            except OSError:
                return self.send(404, b'{}', 'application/json')
        target = ASSETS.get(rel) or (rel if rel.startswith(ASSET_DIRS) and '..' not in rel else None)
        full = os.path.join(ROOT, target) if target else None
        if not full or not os.path.isfile(full):
            return self.send(404, b'Not found\n')
        with open(full, 'rb') as f:
            body = f.read()
        ctype = 'text/javascript; charset=utf-8' if full.endswith('.js') else (mimetypes.guess_type(full)[0] or 'application/octet-stream')
        self.send(200, body, ctype)

    def do_POST(self):
        if not self.host_ok():
            return
        origin = urllib.parse.urlsplit(self.headers.get('Origin', '')).netloc
        if origin != self.headers.get('Host', '') or self.headers.get('X-Bfb-Web') != '1':
            return self.send(403, b'Only a page this server served may send.\n')
        if self.path != '/_bfb/native':
            return self.send(404, b'Not found\n')
        try:
            body = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'{}')
        except ValueError:
            return self.send(400, b'Bad JSON\n')
        script = HOSTS.get(body.get('host'))
        payload = body.get('payload') or {}
        if not script:
            reply = {'ok': False, 'error': 'This needs the Mac itself; it is not available on the phone.'}
        elif payload.get('op') in DESK_ONLY_OPS:
            reply = {'ok': False, 'error': 'This needs the Mac itself; it is not available on the phone.'}
        else:
            try:
                reply = {'ok': True, 'response': run_host(script, payload)}
            except Exception as e:  # the host crashed or timed out: say so to the page
                reply = {'ok': False, 'error': str(e)}
        self.send(200, json.dumps(reply).encode('utf-8'), 'application/json')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--port', type=int, default=5123)
    a = ap.parse_args()
    srv = ThreadingHTTPServer(('127.0.0.1', a.port), Handler)
    srv.daemon_threads = True
    print(f'bfb phone server on http://127.0.0.1:{srv.server_address[1]}', flush=True)
    srv.serve_forever()


if __name__ == '__main__':
    main()
