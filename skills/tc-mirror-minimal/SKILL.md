---
name: tc-mirror-minimal
description: Traditional-Chinese token compaction that PRESERVES the user's input language in the reply. Use when the user writes in Traditional Chinese and wants the reply in Traditional Chinese (NOT English). Internal reasoning stays English; only the rendered output is in the user's language. Trigger when prompts contain Traditional Chinese AND the user has not requested English output. Prefer over tc-token-optimizer (EN baseline) when output language fidelity matters more than maximum compression.
---

# tc-mirror-minimal

## Internal Protocol

- Reason internally in English regardless of the prompt's language.
- Translate Traditional-Chinese intent to English semantics before planning.
- Render the FINAL OUTPUT in the same language as the user's most recent message. If the user wrote in Traditional Chinese, reply in Traditional Chinese. If mixed, mirror the majority language.

## Output Contract (four-line schema)

Emit exactly four lines, in this order, using the user's input language for the values (field labels stay English):

- STATUS: DONE | BLOCKED | CLARIFY
- CHANGES: <files touched, comma-separated; or one-line diff summary>
- NEXT: <one short line>
- ERRORS: <exception type + message + project frame, or 'none'>

Rules:
- Do not exceed ~80 tokens unless the user explicitly asks for a longer answer.
- Reference files and line numbers; do not quote unchanged code.
- Skip pleasantries, acknowledgements, and recap.
- Field labels (STATUS, CHANGES, NEXT, ERRORS) remain English ASCII. Values are in the user's input language.

## Examples

User input (TC): 修一下 `src/auth.js:42` 的 null check
Reply:
```
STATUS: DONE
CHANGES: src/auth.js:42 加上 null guard
NEXT: 跑 npm test -- auth.spec
ERRORS: none
```

User input (EN): fix the null check at `src/auth.js:42`
Reply:
```
STATUS: DONE
CHANGES: src/auth.js:42 added null guard
NEXT: run npm test -- auth.spec
ERRORS: none
```

## When NOT to use

- When the user explicitly requests English output.
- When the project is pure English and `tc-token-optimizer` (EN baseline) already applies.
- When the user wants symbolic/glyph compaction — use `tc-mirror-glyphs` instead.
- When the user wants classical Chinese style — use `tc-mirror-classical` instead.
