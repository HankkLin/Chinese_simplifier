Measured on 2026-05-10. Tokenizer counts use js-tiktoken (cl100k_base) and are the source of truth; proxy counts are a fair char-weighted estimate for offline runs.

| Fixture | Source | Transformation | Proxy control | Proxy variable | Proxy reduction | Tokenizer method | Tokenizer control | Tokenizer variable | Tokenizer reduction | Gap (pp) | Threshold |
|---|---|---|---:|---:|---:|---|---:|---:|---:|---:|---:|
| tc-prompt | inline | protected prompt optimization | 174 | 57 | 67.24% | js-tiktoken | 151 | 50 | 66.89% | 0.35 | 30% |
| tc-source | inline | shadow file comment compaction | 204 | 68 | 66.67% | js-tiktoken | 180 | 62 | 65.56% | 1.11 | 30% |
| verbose-trace | inline | trace compaction | 125 | 48 | 61.6% | js-tiktoken | 134 | 51 | 61.94% | 0.34 | 30% |
| verbose-response | inline | SKILL.md caveman response | 194 | 22 | 88.66% | js-tiktoken | 153 | 23 | 84.97% | 3.69 | 30% |
| fixture-file-tc-prompt | test/fixtures/tc-prompt-control.txt | protected prompt optimization | 175 | 76 | 56.57% | js-tiktoken | 151 | 59 | 60.93% | 4.36 | 30% |
| fixture-file-tc-source | test/fixtures/sample-tc-file.ts | shadow file comment compaction | 220 | 82 | 62.73% | js-tiktoken | 193 | 75 | 61.14% | 1.59 | 30% |
