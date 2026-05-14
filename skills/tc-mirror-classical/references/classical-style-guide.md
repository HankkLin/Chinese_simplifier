# Classical Chinese Style Guide for tc-mirror-classical

## Rules

1. Drop tense particles: 了, 過, 著 — verbs imply completion from context.
2. Drop possessive 的 between adjacent nouns when meaning is clear: `用戶的請求` → `用戶請求`.
3. Prefer monosyllabic verbs: 修 over 修正, 加 over 增加, 刪 over 刪除, 改 over 修改, 跑 over 執行.
4. Drop redundant pronouns: 我已修 instead of 我已經修正了.
5. Use 已 / 未 / 須 / 宜 as compact aspect/modal markers (already/not-yet/must/should).
6. Keep file paths, identifiers, English keywords (function/class/error names) as ASCII.
7. Keep numbers as Arabic digits, not Chinese numerals.

## Examples

| Vernacular | Classical |
|---|---|
| 我已經修正了三個檔案 | 已修三檔 |
| 因為設定錯誤導致無法啟動 | 設定誤 → 無法啟動 (use ∵→ if combined with glyphs skill — but this skill does not) |
| 請執行測試指令 | 須跑測試 |
| 沒有發生任何錯誤 | 無誤 |
| 增加了 null check | 加 null check |

## When NOT to apply

- Inline code, file paths, identifiers (keep them verbatim ASCII).
- Direct quotes from user input.
- Long-form CLARIFY responses that need precision.
