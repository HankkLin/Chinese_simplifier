Measured on 2026-05-05. Proxy counts are deterministic local estimates; tokenizer counts use js-tiktoken when available and otherwise say proxy-fallback.

| Fixture | Source | Transformation | Proxy control | Proxy variable | Proxy saved | Proxy reduction | Proxy minimum | Tokenizer method | Tokenizer control | Tokenizer variable | Tokenizer saved | Tokenizer reduction |
|---|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|
| tc-prompt | inline | protected prompt optimization | 214 | 26 | 188 | 87.85% | 0% | js-tiktoken | 151 | 25 | 126 | 83.44% |
| tc-source | inline | shadow file comment compaction | 247 | 74 | 173 | 70.04% | 30% | js-tiktoken | 180 | 68 | 112 | 62.22% |
| verbose-trace | inline | trace compaction | 109 | 43 | 66 | 60.55% | 30% | js-tiktoken | 134 | 51 | 83 | 61.94% |
| verbose-response | inline | SKILL.md caveman response | 237 | 21 | 216 | 91.14% | 30% | js-tiktoken | 153 | 23 | 130 | 84.97% |
| fixture-file-tc-prompt | test/fixtures/tc-prompt-control.txt | protected prompt optimization | 214 | 25 | 189 | 88.32% | 30% | js-tiktoken | 151 | 24 | 127 | 84.11% |
| fixture-file-tc-source | test/fixtures/sample-tc-file.ts | shadow file comment compaction | 260 | 87 | 173 | 66.54% | 30% | js-tiktoken | 193 | 81 | 112 | 58.03% |
