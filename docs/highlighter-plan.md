# S2.3 — Syntax highlighter upgrade (plan, hand-rolled)

<!-- sessions: catch-proj-3f@2026-06-18 -->

Decision (user): keep it **hand-rolled, no runtime dependency**. Plan first,
review against existing designs, then implement in reviewed phases. This doc is
the plan; no code ships from it until approved.

---

## 1. What we have today (`src/renderers.ts` highlightCode)

A **single flat alternation regex** built per language by `buildTokenRe`, run in
one `exec` loop. Alternatives, in order: block comment → line comment → each
string quote → `$var` (shell) → number → word (keyword-or-not). A `LangDef` is
`{line[], block[], strings[], tickML, vars, kw[]}`; `EXT_LANG` maps extensions to
~9 `LANGS`. Token classes emitted: `tok-cmt / tok-str / tok-kw / tok-num / tok-var`.

**What's actually good about it (keep):**
- One pass, no backtracking engine, ~zero cost — correct altitude for a *preview*.
- Because comments and strings are *alternatives in one regex matched by
  position*, it already avoids the classic FCFS bug (a `//` inside a string isn't
  seen as a comment). That's the same property Prism's `greedy` flag buys — we
  get it for free from single-regex alternation. **This is not broken; don't
  rewrite the core.**

**Concrete limitations (the actual targets):**
| # | Gap | Example that renders wrong today |
|---|-----|----------------------------------|
| L1 | One flat keyword color | `class`, `int`, `true`, `print` all `tok-kw` — no control/type/builtin/literal distinction |
| L2 | Python triple-quoted strings unhandled | `"""docstring"""` highlights only the first `""` pair, body bleeds |
| L3 | String prefixes ignored | `r"..."`, `f"..."`, `b"..."`, Rust `r#"..."#` not recognized |
| L4 | No decorators/annotations | `@decorator`, Java `@Override` plain |
| L5 | No regex-literal vs division | JS `/re/g` either bleeds or mis-splits |
| L6 | No type/function name accents | `function foo`, `: TypeName` undistinguished |
| L7 | Narrow language table | no diff, dockerfile, makefile, jsonc, graphql, proto; HTML/XML fall to `cstyle` |
| L8 | `cfg` is a catch-all | yaml keys vs values, toml sections not distinguished |

---

## 2. Review of existing solution designs

| Engine | Architecture | Strength | Why NOT wholesale here |
|--------|--------------|----------|------------------------|
| **single-regex** (ours, also micro-highlighters) | one alternation, one pass | tiny, fast, no state | no nesting, flat scopes |
| **Prism** | ordered grammar of token rules (`pattern`/`inside`/`greedy`/`lookbehind`/`alias`); FCFS with greedy override; nested `inside` grammars | great accuracy/size balance; nested grammars do interpolation & embedded langs | full `inside` recursion + greedy-merge is more engine than a preview needs |
| **highlight.js** | **mode stack** (`begin`/`end`/`contains`, `'self'`), categorized keywords, illegal-symbol early-out, relevance for auto-detect | stateful nesting, auto-detection | mode stack + relevance is heavy; we already know the language from the extension |
| **TextMate / Shiki** | begin/end regex rules with scopes + captures, Oniguruma (WASM) | editor-grade accuracy (VS Code) | WASM + grammar files = exactly the dependency the user ruled out |
| **CodeMirror / Lezer** | real incremental LR parsers per language | most accurate | a parser per language; absurd for a preview |

**What to borrow (and only this):**
- From **Prism**: *ordered token rules* and *token kind decoupled from styling*
  (an enum of token kinds → CSS classes). Adopt the rule-list shape so adding a
  pattern is data, not regex surgery. Skip `inside`/recursion and greedy-merge —
  our single-pass alternation already gives the greedy property.
- From **highlight.js**: *categorized keywords* (control / declaration / type /
  builtin / literal → distinct classes). Skip the mode stack — we don't need
  cross-line state for a preview, and the extension already knows the language so
  auto-detection/relevance is dead weight.

**Net design verdict:** evolve, don't replace. Stay a **single-pass,
ordered-alternation tokenizer**; enrich the *rule model* (more token kinds +
keyword categories + per-language string/number variants) and widen the language
table. No mode stack, no recursion, no sublanguages, no auto-detection. This is
"Prism-lite minus the engine."

---

## 3. Proposed design

### Token kinds (→ CSS classes)
Extend from 5 to ~11, each a stable class so themes can target them:
`cmt, str, esc, num, kw, kw-ctrl, type, fn, builtin, lit, deco, var, regex, punct?`
(punct optional — likely skip; over-coloring hurts readability).

Minimal palette addition to the existing dark/light CSS: `tok-type` (teal),
`tok-fn` (yellow), `tok-builtin` (cyan), `tok-lit` (orange), `tok-deco` (violet),
`tok-regex` (green-ish), `tok-esc` (dim within strings). Reuse existing 5.

### Rule model
Replace the `LangDef` flag-bag with an **ordered rule list** per language:
```
type Rule = { kind: TokenKind; re: string };   // re = a regex fragment (no flags)
interface Lang {
  rules: Rule[];          // ordered; first match at each position wins
  keywords?: Record<TokenKind, string[]>;  // word→kind lookup after a generic \w+ match
}
```
`buildTokenRe` becomes "join rule fragments into one alternation with named
groups, in order"; the exec loop maps the matched group → kind. Keyword
categorization happens on the `word` rule: look the lexeme up in the per-language
`keywords` map (control/type/builtin/literal) else plain.

This keeps the **one-regex/one-pass** core (and its greedy property) while making
token kinds and language coverage *data*.

### Specific gap fixes
- **L2/L3** triple-quotes + prefixes: add string rules `[rbfu]*"""[\s\S]*?"""`,
  `[rbf]?"(?:\\.|[^"\\])*"`, Rust raw `r#*"..."#*` before the plain-string rule
  (order = the greedy guarantee).
- **L4** decorators: rule `@[\w.]+` → `tok-deco` (py/java/ts).
- **L5** regex literals: JS rule for `/.../flags` gated by a lookbehind of
  `[=(,:;[!&|?{}\n]` whitespace (the standard "regex allowed here" heuristic);
  accept occasional miss — it's a preview.
- **L6** type/fn accents: cheap heuristics — `\bfunction\s+(\w+)`,
  Capitalized-word → `tok-type` in typed langs, `\w+(?=\()` → `tok-fn`.
- **L1** keyword categories via the `keywords` map.
- **L7/L8** new langs: `diff`, `dockerfile`, `makefile`, `jsonc`, `graphql`,
  `proto`, real `html`/`xml`, split `yaml`/`toml` out of `cfg`.

---

## 4. Phased implementation (each phase: tests green + build)

- **P0 — refactor, zero behavior change.** Introduce `TokenKind` + ordered-rule
  model; port the existing 9 langs to it; keep the same 5 classes. Existing
  highlightCode tests must pass unchanged. (De-risks the engine change.)
- **P1 — keyword categories.** Add category maps for js/ts, py, go, rs, sql;
  add `tok-kw-ctrl/type/builtin/lit` classes + CSS. Tests assert categories.
- **P2 — string/number/decorator gaps (L2–L4).** Triple-quotes, prefixes, raw
  strings, decorators, numeric separators/suffixes. Regression tests for each.
- **P3 — accents (L5/L6).** Regex literals, function/type-name heuristics. Tests
  including the "division is not a regex" near-miss cases.
- **P4 — language coverage (L7/L8).** diff/dockerfile/makefile/jsonc/graphql/
  proto/html/xml; split yaml/toml. One test per new lang.

Ship as **v2.6** at P2 (clear value), or carry P3/P4 depending on appetite.
Each phase is independently revertable.

## 5. Out of scope (explicit)
Mode stack / cross-line state · grammar recursion / `inside` · embedded
sublanguages (JS-in-HTML) · auto-detection / relevance · any runtime dependency
(Shiki/Prism/hljs) · perfect correctness (it's a preview, not an editor).

## 6. Test plan
Pure `highlightCode(src, ext)` is already unit-tested. Add, per phase: the L1–L8
examples above as explicit assertions (esp. the *regression* cases — Python
docstring, `http://` in a string staying a string, division-vs-regex, keyword
categories). Target ~25–30 new assertions across phases. No e2e needed (pure fn).

## 7. Size/risk budget
P0–P2 ≈ +120–180 lines in renderers.ts + ~10 CSS lines, no deps. Risk
concentrated in P0 (engine port) — mitigated by "existing tests pass unchanged"
as the P0 gate. P3 (regex-literal heuristic) is the only accuracy-fuzzy bit;
acceptable for a preview and isolated to one rule.
