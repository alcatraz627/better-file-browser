#!/usr/bin/env python3
"""A stand-in for native/llm_host.py in tests: same framing, canned answers, no model.

A query answers "one two three" a word at a time, 0.7s apart (BFB_FAKE_GAP seconds),
then finishes. Closing stdin before it ends stops it, as the real host does.
"""
import json
import os
import struct
import sys
import threading
import time


def read_msg():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        return None
    return json.loads(sys.stdin.buffer.read(struct.unpack('=I', raw)[0]).decode('utf-8'))


def write_msg(obj):
    enc = json.dumps(obj).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('=I', len(enc)) + enc)
    sys.stdout.buffer.flush()


def main():
    msg = read_msg()
    if msg is None:
        return
    op = msg.get('op')
    gap = float(os.environ.get('BFB_FAKE_GAP', '0.7'))
    if op == 'status':
        write_msg({'t': 'status', 'data': {'api_version': 1, 'server': 'up', 'default_model': 'fake', 'warm': True, 'latency_class': 'warm'}})
    elif op == 'models':
        write_msg({'t': 'models', 'tiers': [{'alias': 'fake', 'model': 'fake'}], 'gemini': [], 'gpt': []})
    elif op == 'query':
        def watch():
            while os.read(0, 65536):
                pass
            os._exit(0)
        threading.Thread(target=watch, daemon=True).start()
        for word in ('one ', 'two ', 'three'):
            write_msg({'t': 'chunk', 'text': word})
            time.sleep(gap)
        write_msg({'t': 'done', 'model': 'fake', 'ms': 1, 'truncated': False})
    else:
        write_msg({'t': 'error', 'code': 'host_bad_op', 'message': str(op)})


if __name__ == '__main__':
    main()
