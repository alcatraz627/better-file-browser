#!/usr/bin/env python3
"""Checks for ask_jobs.py: the phone's Ask jobs, run against e2e/fake-llm-host.py."""
import os
import sys
import tempfile
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
os.environ['BFB_FAKE_GAP'] = '0.3'
from ask_jobs import AskJobs  # noqa: E402

FAKE = os.path.join(os.path.dirname(HERE), 'e2e', 'fake-llm-host.py')
fails = []


def check(ok, what):
    print(('ok   ' if ok else 'FAIL ') + what)
    if not ok:
        fails.append(what)


tmp = tempfile.mkdtemp()
jobs = AskJobs(host=FAKE, orphans_path=os.path.join(tmp, 'orphans.json'))

# A one-off request streams the host's frames and ends with them.
frames = list(jobs.stream({'op': 'status'}))
check(frames[0]['t'] == 'status' and frames[0]['data']['server'] == 'up', 'status comes back from the host')

# A question with a job streams chunks, then done.
job = {'id': 'j1', 'subject': '/a', 'chatId': 'c1', 'turn': {}}
got = list(jobs.stream({'op': 'query', 'ctx': 'x', 'job': job}))
check(''.join(f.get('text', '') for f in got if f['t'] == 'chunk') == 'one two three' and got[-1]['t'] == 'done', 'a question streams its answer and ends with done')
check(list(jobs.stream({'op': 'running'}))[0]['jobs'] == [], 'nothing is left running after it ends')

# The page leaves mid-answer: the answer keeps going, and a page that comes back sees what was said.
job2 = {'id': 'j2', 'subject': '/a', 'chatId': 'c1', 'turn': {}}
gen = jobs.stream({'op': 'query', 'ctx': 'x', 'job': job2})
first = next(gen)
gen.close()
check(first['t'] == 'chunk', 'the first chunk arrives')
run = list(jobs.stream({'op': 'running'}))[0]['jobs']
check(len(run) == 1 and run[0]['id'] == 'j2' and run[0]['text'].startswith('one'), 'the answer is still running with the text so far')
back = list(jobs.stream({'op': 'attach', 'id': 'j2'}))
check(back[0]['t'] == 'replay' and back[0]['text'].startswith('one') and back[-1]['t'] == 'done', 'coming back replays what was said and finishes')
check(''.join([back[0]['text']] + [f.get('text', '') for f in back[1:] if f['t'] == 'chunk']) == 'one two three', 'replay plus the rest is the whole answer, none twice or missed')
check(list(jobs.stream({'op': 'orphans'}))[0]['list'] == [], 'an answer a page watched to its end is not parked')

# Nobody watching when it ends: it is parked for the next page, once.
job3 = {'id': 'j3', 'subject': '/b', 'chatId': 'c2', 'turn': {'q': 'hi'}}
gen = jobs.stream({'op': 'query', 'ctx': 'x', 'job': job3})
next(gen)
gen.close()
time.sleep(1.6)
parked = list(jobs.stream({'op': 'orphans'}))[0]['list']
check(len(parked) == 1 and parked[0]['job']['id'] == 'j3' and parked[0]['text'] == 'one two three' and parked[0]['frame']['t'] == 'done', 'an answer that ended unwatched is parked whole')
check(list(jobs.stream({'op': 'orphans'}))[0]['list'] == [], 'taking the parked answers empties the list')
late = list(jobs.stream({'op': 'attach', 'id': 'j3'}))
check(late[0]['t'] == 'replay' and late[-1]['t'] == 'done', 'a page that returns soon after still gets the finished answer')
check(list(jobs.stream({'op': 'attach', 'id': 'nope'})) == [{'t': 'gone'}], 'an answer that never existed is gone')

# Cancel stops it.
job4 = {'id': 'j4', 'subject': '/c', 'chatId': 'c3', 'turn': {}}
gen = jobs.stream({'op': 'query', 'ctx': 'x', 'job': job4})
next(gen)
jobs.cancel('j4')
gen.close()
check(list(jobs.stream({'op': 'running'}))[0]['jobs'] == [], 'cancel removes a running answer')

# A request that is not an Ask op is refused.
check(list(jobs.stream({'op': 'rm'}))[0]['code'] == 'host_bad_op', 'an unknown op is refused')

# Two pages on one answer both see it to the end.
job5 = {'id': 'j5', 'subject': '/d', 'chatId': 'c4', 'turn': {}}
out = {}


def watcher(name, op):
    out[name] = list(jobs.stream(op))


a = threading.Thread(target=watcher, args=('a', {'op': 'query', 'ctx': 'x', 'job': job5}))
a.start()
time.sleep(0.4)
b = threading.Thread(target=watcher, args=('b', {'op': 'attach', 'id': 'j5'}))
b.start()
a.join()
b.join()
check(out['a'][-1]['t'] == 'done' and out['b'][-1]['t'] == 'done', 'two pages on one answer both reach its end')

print('\nall checks passed' if not fails else f'\n{len(fails)} failed')
sys.exit(1 if fails else 0)
