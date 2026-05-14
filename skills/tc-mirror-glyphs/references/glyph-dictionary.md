# Glyph Dictionary for tc-mirror-glyphs

Use these glyphs in place of common operators and connectives.
Each glyph's token cost in cl100k_base is shown alongside its TC/EN replacements (verified 2026-05-14). Only substitutions where `glyph_tokens < replacement_tokens` are listed. Glyphs whose substitutions would be net-negative against common phrasings have been removed.

| Glyph | Glyph tok | Replaces (TC) | TC tok | Replaces (EN) | EN tok | Net (TC / EN) | Use case |
|---|---|---|---|---|---|---|---|
| → | 1 | 然後 / 接著 / 導致 | 2 | then / leads to | 1 | −1 / 0 (only for TC) | causal / sequential |
| ← | 1 | 來自 / 從 | 3 | from / sourced from | 1 | −2 / 0 (only for TC) | provenance |
| ✗ | 2 | 失敗 / 未通過 | 3 | failed / not passed | 1 | −1 / +1 (only for TC) | failure marker |
| ∵ | 2 | 因為 | 4 | because | 1 | −2 / +1 (only for TC) | reason |
| ± | 1 | 大約 / 約 | 3 | approx | 1 | −2 / 0 (only for TC) | fuzzy quantifier |
| Δ | 2 | 變更 / 差異 | 3 | change / diff | 1 | −1 / +1 (only for TC) | delta |
| ⇒ | 3 | 推論 / 結論 | 4 | implies | 2 | −1 / +1 (only for TC) | logical implication |

Rules:
- Only use glyphs from this table — no improvisation.
- Glyphs replace words, not whole phrases.
- File paths, function names, error types remain ASCII.
- Numbers and dates stay ASCII digits.
- Substitutions are only valid when the glyph's token cost is less than the replaced word's token cost — see the Net column. Do not substitute if the Net is ≥ 0.
- Every surviving glyph in this dictionary saves tokens for **TC** content only; for EN content, write the English word instead of substituting a glyph.

Removed in the 2026-05-14 audit (kept here for transparency — DO NOT use):
- `✓` (2 tok) vs 完成 (1 tok) / done (1 tok) — net +1/+1, costs more than the word.
- `∴` (2 tok) vs 所以 (2 tok) / therefore (2 tok) — net 0/0, no savings.
- `⊕` (3 tok) vs 新增 (1 tok) / added (1 tok) — net +2/+2.
- `⊖` (3 tok) vs 移除 (2 tok) / removed (1 tok) — net +1/+2.
- `@` (1 tok) vs 在 (1 tok) / at (1 tok) — net 0/0, no savings. Use `:` or natural prose instead.
