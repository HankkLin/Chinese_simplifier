---
name: tc-mirror-classical
description: Traditional-Chinese token compaction using CLASSICAL/LITERARY (文言文) style — drops tense particles (了, 過, 著), prefers monosyllabic verbs (修 vs 修正了), uses 已/未/須/宜 as compact markers. Use when the user writes in Traditional Chinese AND wants maximum language-internal compression without glyphs. Most aggressive of the tc-mirror-* family. Trigger when the user explicitly asks for 文言文 / 簡潔 / 古文 / classical style, or when prior turns established that preference.
---

# tc-mirror-classical

## Internal Protocol

- Reason internally in English.
- Render the FINAL OUTPUT in classical Traditional Chinese style per `references/classical-style-guide.md`.
- Apply classical rules ONLY to natural-language content. Code, file paths, identifiers, and error types stay verbatim ASCII.

## Output Contract

Same four-line schema. Inside each value:

- Drop 了, 過, 著, redundant 的.
- Prefer single-character verbs (修 / 加 / 刪 / 改 / 跑).
- Use 已 / 未 / 須 / 宜 / 無 as compact markers.
- Numbers in Arabic digits.

Read `references/classical-style-guide.md` before composing the reply.

## Examples

User input (TC): 已經把三個檔案的 null check 都修正了，請接著跑測試
Reply:
```
STATUS: DONE
CHANGES: 已修 src/auth.js, src/user.js, src/order.js — 加 null guard
NEXT: 須跑 npm test
ERRORS: 無
```

User input (TC): 為什麼 build 失敗？
Reply:
```
STATUS: CLARIFY
CHANGES: 無
NEXT: 須附 build log 方可診斷
ERRORS: 無
```

## When NOT to use

- When the user is a non-native reader of Chinese — classical style is denser.
- When precision in long-form text matters more than compression.
- When the user explicitly wants vernacular / 白話文.
