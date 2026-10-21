#!/usr/bin/env python3
"""Checks for the AI host's model list: the aliases and the gemini models are
read from lm's own output, so these pin the shapes lm prints today."""
import importlib.util
import os

spec = importlib.util.spec_from_file_location('llm_host', os.path.join(os.path.dirname(__file__), 'llm_host.py'))
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)

MODELS = """models on disk  (● resident · tier = q -m <tier>)
    gemma4-e4b-warm:latest       5.7GB   small
    gemma4:26b                   16.7GB  big
tiers   small=gemma4-e4b-warm · big=gemma4:26b · code=qwen3.6:35b-a3b  (q --big / q -m code / q -m <literal>)
"""
GEMINI = """gemini models (* = default):
    gemini-3.8-flash
  * gemini-3.5-flash
    gemini-4-argon
pick per call: lm gemini -m <model> · set the default: GEMINI_MODEL in config.sh · extend the list: GEMINI_MODELS
"""

assert h.parse_tiers(MODELS) == [
    {'alias': 'small', 'model': 'gemma4-e4b-warm'},
    {'alias': 'big', 'model': 'gemma4:26b'},
    {'alias': 'code', 'model': 'qwen3.6:35b-a3b'},
], h.parse_tiers(MODELS)
assert h.parse_tiers('no tiers here') == []
assert h.parse_gemini_models(GEMINI) == [
    {'name': 'gemini-3.8-flash', 'default': False},
    {'name': 'gemini-3.5-flash', 'default': True},
    {'name': 'gemini-4-argon', 'default': False},
], h.parse_gemini_models(GEMINI)
assert h.parse_gemini_models('') == []
assert set(h.GEMINI_PROMPTS) == {'summarize', 'explain-code', 'qa'}
print('all llm host checks passed')
