"""Ask for the phone: the same AI host the extension uses, run by the phone server.

The extension keeps each Ask answer in its background worker so it outlives the
page that asked. A phone page is suspended or reloaded far more often, so the
phone server plays that worker: it runs llm_host.py (the same host the
extension talks to, no second runtime), keeps the answer so far, lets a page
come back and pick it up, and parks an answer nobody was watching when it
finished so the next page can file it into the chat history.

A request is one message in, a stream of frames out, the frames the host sends:

    for frame in ASK.stream({'op': 'query', 'ctx': ..., 'job': {'id': ...}}):
        send(frame)

Closing the generator is the page leaving. For an answer started with a job it
only detaches the page; for any other request it also stops the host, which
stops the model.
"""
import json
import os
import queue
import struct
import subprocess
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
OPS = {'status', 'warm', 'models', 'query', 'attach', 'cancel', 'running', 'orphans'}
KEEP_FINISHED_S = 15 * 60
ORPHANS_MAX = 50


def _framed(obj):
    data = json.dumps(obj).encode('utf-8')
    return struct.pack('=I', len(data)) + data


def _read_frame(f):
    head = f.read(4)
    if len(head) < 4:
        return None
    n = struct.unpack('=I', head)[0]
    body = f.read(n)
    if len(body) < n:
        return None
    try:
        return json.loads(body.decode('utf-8'))
    except ValueError:
        return {}


def _stop(child):
    try:
        child.stdin.close()
    except OSError:
        pass
    try:
        if child.poll() is None:
            child.terminate()
    except OSError:
        pass


class _Job:
    def __init__(self, job, child):
        self.id = job['id']
        self.job = job
        self.child = child
        self.text = ''
        self.steps = []
        self.got_frame = False
        self.over = False
        self.delivered = False
        self.final = None
        self.clients = set()


class AskJobs:
    def __init__(self, host=None, orphans_path=None):
        self.host = host or os.environ.get('BFB_ASK_HOST') or os.path.join(HERE, 'llm_host.py')
        self.orphans_path = orphans_path or os.environ.get('BFB_PHONE_ORPHANS') or os.path.expanduser(
            '~/Library/Application Support/better-file-browser/phone-ask-orphans.json')
        self.lock = threading.RLock()
        self.jobs = {}
        self.finished = {}

    def _spawn(self, query):
        child = subprocess.Popen([sys.executable, self.host], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                 stderr=subprocess.DEVNULL)
        child.stdin.write(_framed(query))
        child.stdin.flush()
        return child

    def stream(self, msg):
        """The frames answering one request; stops when the answer ends or the caller closes it."""
        op = msg.get('op')
        if op not in OPS:
            yield {'t': 'error', 'code': 'host_bad_op', 'message': f'unknown op {op!r}'}
            return
        if op == 'running':
            with self.lock:
                jobs = [{'id': j.id, 'job': j.job, 'text': j.text, 'steps': list(j.steps)} for j in self.jobs.values()]
            yield {'t': 'running', 'jobs': jobs}
            return
        if op == 'orphans':
            yield {'t': 'orphans', 'list': self.take_orphans()}
            return
        if op == 'cancel':
            self.cancel(msg.get('id'))
            yield {'t': 'cancelled'}
            return
        if op == 'attach':
            yield from self._attach(msg.get('id'))
            return
        if op == 'query' and isinstance(msg.get('job'), dict) and msg['job'].get('id'):
            yield from self._job_stream(msg)
            return
        yield from self._one_shot(msg)

    def _one_shot(self, msg):
        try:
            child = self._spawn(msg)
        except OSError as e:
            yield {'t': 'native-gone', 'message': str(e)}
            return
        try:
            while True:
                frame = _read_frame(child.stdout)
                if frame is None:
                    break
                yield frame
                if frame.get('t') in ('done', 'error'):
                    return
            yield {'t': 'native-gone', 'message': ''}
        finally:
            _stop(child)

    def _job_stream(self, msg):
        query = {k: v for k, v in msg.items() if k != 'job'}
        with self.lock:
            j = self.jobs.get(msg['job']['id'])
            existing = j is not None
            if j is None:
                try:
                    child = self._spawn(query)
                except OSError as e:
                    yield {'t': 'native-gone', 'message': str(e)}
                    return
                j = _Job(msg['job'], child)
                self.jobs[j.id] = j
                threading.Thread(target=self._pump, args=(j,), daemon=True).start()
        yield from self._follow(j, replay=existing)

    def _follow(self, j, replay=False):
        """Frames of a running answer. A watcher is added and the text so far is read in one step, so none is missed between them."""
        q = queue.Queue()
        with self.lock:
            j.clients.add(q)
            first = {'t': 'replay', 'text': j.text, 'steps': list(j.steps)} if replay else None
        if first:
            yield first
        try:
            while True:
                try:
                    frame = q.get(timeout=15)
                except queue.Empty:
                    yield {'t': 'ping'}
                    continue
                yield frame
                if frame.get('t') in ('done', 'error'):
                    j.delivered = True
                    return
        finally:
            with self.lock:
                j.clients.discard(q)
                if j.over and not j.delivered and not j.clients and j.final is not None:
                    self._park(j)

    def _attach(self, job_id):
        with self.lock:
            j = self.jobs.get(job_id)
            done = self.finished.get(job_id)
        if j is None and done is None:
            yield {'t': 'gone'}
            return
        if j is None:
            yield {'t': 'replay', 'text': done['text'], 'steps': done['steps']}
            yield done['frame']
            return
        yield from self._follow(j, replay=True)

    def _pump(self, j):
        while True:
            frame = _read_frame(j.child.stdout)
            if frame is None:
                self._finish(j, {'t': 'error', 'code': 'disconnected' if j.got_frame else 'unavailable', 'message': ''})
                return
            t = frame.get('t')
            with self.lock:
                if j.over:
                    return
                if t == 'chunk':
                    j.got_frame = True
                    j.text += frame.get('text') or ''
                elif t == 'step':
                    j.got_frame = True
                    j.steps.append(frame.get('text') or '')
                if t in ('done', 'error'):
                    pass
                else:
                    for q in j.clients:
                        q.put(frame)
                    continue
            self._finish(j, frame)
            return

    def _finish(self, j, frame):
        with self.lock:
            if j.over:
                return
            j.over = True
            j.final = frame
            self.jobs.pop(j.id, None)
            now = time.time()
            self.finished = {k: v for k, v in self.finished.items() if now - v['at'] < KEEP_FINISHED_S}
            self.finished[j.id] = {'text': j.text, 'steps': list(j.steps), 'frame': frame, 'at': now}
            watchers = list(j.clients)
            for q in watchers:
                q.put(frame)
            if not watchers:
                self._park(j)
        _stop(j.child)

    def cancel(self, job_id):
        with self.lock:
            j = self.jobs.pop(job_id, None)
            if j is None:
                return
            j.over = True
        _stop(j.child)

    def _park(self, j):
        o = {'job': j.job, 'text': j.text, 'steps': list(j.steps), 'frame': j.final}
        with self.lock:
            lst = self._orphans()
            if any(x.get('job', {}).get('id') == j.id for x in lst):
                return
            lst.append(o)
            self._save_orphans(lst[-ORPHANS_MAX:])

    def _orphans(self):
        try:
            with open(self.orphans_path, encoding='utf-8') as f:
                lst = json.load(f)
            return lst if isinstance(lst, list) else []
        except (OSError, ValueError):
            return []

    def _save_orphans(self, lst):
        os.makedirs(os.path.dirname(self.orphans_path), exist_ok=True)
        tmp = self.orphans_path + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(lst, f)
        os.replace(tmp, self.orphans_path)

    def take_orphans(self):
        with self.lock:
            lst = self._orphans()
            if lst:
                self._save_orphans([])
            return lst


ASK = AskJobs()
