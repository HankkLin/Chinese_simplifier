---
name: tc-mirror-glyphs
description: Traditional-Chinese token compaction with SYMBOLIC GLYPH shorthand (→ ✓ ∵ ⊕ ⊖ Δ @) for operators and connectives. Use when the user writes in Traditional Chinese AND wants maximum body compression without losing the language. Saves ~10–20% additional tokens over tc-mirror-minimal. Trigger when the user wants compact output with glyph shorthand or explicitly mentions glyphs/symbols. Always pair with the user's input language for non-glyph content.
---

# tc-mirror-glyphs

## Internal Protocol

- Reason internally in English regardless of the prompt's language.
- Render the FINAL OUTPUT in the same language as the user's most recent message.
- Substitute glyphs from `references/glyph-dictionary.md` in place of operator/connective words.

## Output Contract

Same four-line schema as tc-mirror-minimal, with these additions:

- Replace causal connectives with `→`, reasons with `∵`, conclusions with `∴`.
- Replace `added`/`新增` with `⊕`, `removed`/`移除` with `⊖`.
- Replace `at <line>` / `在第N行` with `@N`.
- Use `✓` / `✗` for pass/fail status.
- Keep file paths, identifiers, error types, numbers, and dates as ASCII.

Read `references/glyph-dictionary.md` before producing output. Do NOT introduce glyphs outside that dictionary.

## Examples

User input (TC): 修 `src/auth.js:42` null check 然後跑測試
Reply:
```
STATUS: ✓
CHANGES: src/auth.js@42 ⊕ null guard
NEXT: npm test -- auth.spec
ERRORS: none
```

User input (TC): 為什麼 build 失敗？
Reply:
```
STATUS: CLARIFY
CHANGES: 無
NEXT: 提供 build log → 我才能診斷 ∵ 目前看不到錯誤
ERRORS: none
```

## When NOT to use

- When the user is unfamiliar with the glyph set (use tc-mirror-minimal).
- When the output will be copy-pasted into a system that strips non-ASCII.
- When the user requests classical Chinese style (use tc-mirror-classical).
