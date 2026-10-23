#!/usr/bin/env python3
"""Checks for the AI host's model list: the aliases and the gemini models are
read from `lm models --json`, so these pin that shape."""
import importlib.util
import os

spec = importlib.util.spec_from_file_location('llm_host', os.path.join(os.path.dirname(__file__), 'llm_host.py'))
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)

MODELS = """{"default": "gemma4-e4b-warm", "resident": [], "available": [],
 "tiers": [{"alias": "small", "model": "gemma4-e4b-warm"}, {"alias": "code", "model": "qwen3.6:35b-a3b"}, {"alias": "broken"}],
 "gemini": [{"name": "gemini-3.8-flash", "default": true}, {"name": "gemini-4-argon", "default": false}]}"""

tiers, gemini = h.parse_models(MODELS)
assert tiers == [
    {'alias': 'small', 'model': 'gemma4-e4b-warm'},
    {'alias': 'code', 'model': 'qwen3.6:35b-a3b'},
], tiers
assert gemini == [
    {'name': 'gemini-3.8-flash', 'default': True},
    {'name': 'gemini-4-argon', 'default': False},
], gemini
# With Ollama stopped, lm still names the tiers and Gemini models in its error.
DOWN = '{"ok":false,"code":"server_down","tiers":[{"alias":"small","model":"gemma4-e4b-warm"}],"gemini":[{"name":"gemini-3.8-flash","default":true}]}'
assert h.parse_models(DOWN) == ([{'alias': 'small', 'model': 'gemma4-e4b-warm'}], [{'name': 'gemini-3.8-flash', 'default': True}]), h.parse_models(DOWN)
assert h.parse_models('') == ([], [])
assert h.parse_models('{"default": "x"}') == ([], [])
assert set(h.GEMINI_PROMPTS) == {'summarize', 'explain-code', 'qa'}

# Attached files: text under its name, binaries left out, images through see.
import tempfile
d = tempfile.mkdtemp()
open(os.path.join(d, 'notes.txt'), 'w').write('hello notes')
open(os.path.join(d, 'blob.bin'), 'wb').write(b'\0\1\2')
open(os.path.join(d, 'shot.png'), 'wb').write(b'\x89PNG')
see = os.path.join(d, 'see')
open(see, 'w').write('#!/bin/sh\necho \'{"ok":true,"text":"a red button","model":"minicpm"}\'\n')
os.chmod(see, 0o755)
steps = []
os.environ['BFB_SEE_BIN'] = see
got = h.read_files('/nowhere/lm', [os.path.join(d, n) for n in ('notes.txt', 'blob.bin', 'shot.png')], 'what is it', steps.append)
assert got == '=== notes.txt ===\nhello notes\n\n=== blob.bin ===\n(not text, left out)\n\n=== Image shot.png (read by minicpm) ===\na red button', got
assert steps == ['Reading shot.png'], steps
m = h.with_files('/nowhere/lm', {'ctx': 'page text', 'ctxName': 'readme.md', 'files': [os.path.join(d, 'notes.txt')]})
assert m['ctx'] == 'page text\n\n=== notes.txt ===\nhello notes' and m['ctxName'] == 'readme.md and 1 attached file', m
assert h.with_files('/nowhere/lm', {'ctx': 'x'}) == {'ctx': 'x'}
print('all llm host checks passed')
