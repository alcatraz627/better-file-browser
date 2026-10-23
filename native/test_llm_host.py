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
print('all llm host checks passed')
