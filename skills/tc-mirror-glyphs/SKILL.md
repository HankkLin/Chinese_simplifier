---
name: tc-mirror-glyphs
description: Traditional-Chinese token compaction with SYMBOLIC GLYPH shorthand (→ ← ✗ ∵ ± Δ ⇒) for operators and connectives. Use when the user writes in Traditional Chinese AND wants further body compression than tc-mirror-minimal provides. Saves a small additional amount over tc-mirror-minimal on TC content (single-token glyphs replacing 2–4-token TC connectives). Trigger when the user wants compact output with glyph shorthand or explicitly mentions glyphs/symbols. Always pair with the user's input language for non-glyph content.
---

# tc-mirror-glyphs

## Internal Protocol

- Reason internally in English regardless of the prompt's language.
- Render the FINAL OUTPUT in the same language as the user's most recent message.
- Substitute glyphs from `references/glyph-dictionary.md` in place of operator/connective words **only when the glyph costs fewer tokens than the word it replaces** (see the Net column in the dictionary).

## Output Contract

Same four-line schema as tc-mirror-minimal, with these additions:

- Replace causal/sequential connectives with `→` (saves 1 tok vs `然後`).
- Replace provenance words with `←` (saves 2 tok vs `來自`).
- Replace reason word with `∵` (saves 2 tok vs `因為`).
- Replace failure marker with `✗` (saves 1 tok vs `失敗`) — for status fields, prefer the plain TC word `完成` for success (the glyph `✓` is NET-POSITIVE and was removed from the dictionary).
- Replace fuzzy quantifier with `±` (saves 2 tok vs `大約`).
- Replace delta/diff word with `Δ` (saves 1 tok vs `變更`).
- Replace logical implication word with `⇒` (saves 1 tok vs `推論`).
- Keep file paths, identifiers, error types, numbers, and dates as ASCII.
- For line markers in file references, use `path:line` (colon) — `@` is NOT a token-saving substitution and is not part of this skill.

Read `references/glyph-dictionary.md` before producing output. Do NOT introduce glyphs outside that dictionary. The glyphs save tokens **for Traditional Chinese content**; for English-only content fall back to plain English words.

## Examples

User input (TC): 修 `src/auth.js:42` null check 然後跑測試
Reply:
```
STATUS: 完成
CHANGES: src/auth.js:42 加 null guard → 防回退 crash
NEXT: npm test -- auth.spec
ERRORS: 無
```
(Measured: 39 tokens with `→` vs 42 tokens with `然後` — saves 3 tokens.)

User input (TC): 為什麼 build 失敗？
Reply:
```
STATUS: CLARIFY
CHANGES: 無
NEXT: 提供 build log → 我才能診斷 ∵ 目前看不到錯誤
ERRORS: 無
```
(Measured: NEXT line is 26 tokens with `→` and `∵` vs 32 tokens with `然後` and `因為` — saves 6 tokens.)

## When NOT to use

- When the user is unfamiliar with the glyph set (use tc-mirror-minimal).
- When the output will be copy-pasted into a system that strips non-ASCII.
- When the user requests classical Chinese style (use tc-mirror-classical).
- When the output is English-only — for EN content, glyphs in the dictionary do not save tokens (most are net-zero or net-positive vs the English word). Use plain English instead.
