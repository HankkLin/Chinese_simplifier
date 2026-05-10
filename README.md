# TC Token Optimizer

[English](README.md) | [繁體中文](docs/locale/README.zh-TW.md) | [简体中文](docs/locale/README.zh-CN.md)

TC Token Optimizer is a working MVP for reducing Traditional Chinese token overhead in coding-agent workflows. It combines a compact agent skill, Claude Code hooks, a CLI wrapper, and a reproducible token-savings experiment.

The architectural reason for the wrapper (full notes in [docs/TC_TOKEN_OPTIMIZER_HANDOFF.md](docs/TC_TOKEN_OPTIMIZER_HANDOFF.md)): Claude Code hooks can modify tool inputs with `updatedInput`, but `UserPromptSubmit` cannot rewrite the user prompt before it enters context. Prompt optimization therefore has to happen before the `claude` binary receives the prompt.

The wrapper's prompt optimizer is **lossy** — see "Limits" below before relying on it for prompts that need verbatim preservation.

## Quick Start

```bash
npm install
npm test
npm run measure:tokens
```

Use the wrapper directly:

```bash
npx tc-claude "請修正 `parseUser()` 的錯誤處理流程"
```

Or install the shell alias:

```bash
bash wrapper/install.sh
```

If the alias would recurse into itself, point the wrapper at the real Claude binary:

```bash
export TC_CLAUDE_REAL_BIN=/absolute/path/to/claude
```

## Setup Tiers

| Tier | Component | Setup | Purpose |
|---|---|---:|---|
| 1 | `SKILL.md` | Copy into agent skills | Enforce concise English-first reasoning and compact output. |
| 2 | `hooks/*.js` | Copy `.claude/settings.json.example` and update paths | Shadow TC-heavy reads, compact traces, preserve compact session state. |
| 3 | `wrapper/tc-claude.js` | Use `tc-claude` or shell alias | Optimize TC prompts before Claude Code receives them. |

## Claude Hook Configuration

Copy `.claude/settings.json.example` into your Claude Code settings and replace `/path/to/tc-token-optimizer` with this repository path.

The MVP hook behavior is intentionally conservative:

- `PreToolUse` on `Read` creates an OS-temp shadow file for TC-heavy files.
- `PostToolUse --mode=trace` compacts JS, Python, and Java-like traces.
- `PostToolUse --mode=restore` fails closed for shadow writes unless safe restore metadata exists.
- `PreCompact` emits compact `additionalContext` from payload fields that are actually available.

## Experimental Token Test

Run:

```bash
npm run measure:tokens
```

Method:

- **Tokenizer-of-record:** `js-tiktoken` with the `cl100k_base` encoding. The script fails closed if the library is unavailable.
- The control group is the raw Traditional-Chinese prompt, source file, trace, or response. The variable group is the optimized version produced by the wrapper, source-shadow compactor, trace compactor, or `SKILL.md` schema.
- A fair char-weighted **proxy** in `src/tokenizer.js` is reported alongside the tokenizer for offline runs. The build fails if the proxy and tokenizer percentages diverge by more than 8 percentage points on any fixture, so the proxy stays honest.
- A fixture pair is valid only if every constraint in the control prompt also appears in the variable prompt. `npm run audit:fixtures` enforces this.
- Passing threshold: at least 30% fewer **tokenizer-measured** tokens on every fixture.

These numbers measure compression in the project's test harness, not Claude Code billing. Use exported Claude usage logs for billing-grade validation.

## Latest Recorded Results

Measured on 2026-05-07 with `js-tiktoken` (`cl100k_base`).

| Fixture | Transformation | Tokenizer control | Tokenizer variable | Tokenizer reduction | Proxy reduction | Gap (pp) |
|---|---|---:|---:|---:|---:|---:|
| tc-prompt | protected prompt optimization | 151 | 50 | 66.89% | 67.24% | 0.35 |
| tc-source | shadow file comment compaction | 180 | 62 | 65.56% | 66.67% | 1.11 |
| verbose-trace | trace compaction | 134 | 51 | 61.94% | 61.60% | 0.34 |
| verbose-response | `SKILL.md` schema response | 153 | 23 | 84.97% | 88.66% | 3.69 |
| fixture-file-tc-prompt (audited) | protected prompt optimization | 151 | 59 | 60.93% | 57.14% | 3.79 |
| fixture-file-tc-source | shadow file comment compaction | 193 | 75 | 61.14% | 62.73% | 1.59 |

The generated files are committed at:

- `test/results/token-savings.json`
- `test/results/token-savings.md`

## Compatibility

| Feature | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| `SKILL.md` | Native skill-style instruction | Adapt into `GEMINI.md` | Adapt into system/project prompt |
| Shadow file hook | `PreToolUse` (`updatedInput`) | `command` event hook on tool dispatch | Wrap binary; intercept `read_file` calls |
| Trace compaction | `PostToolUse --mode=trace` | `command` event hook on tool result | Wrap binary; rewrite stderr/stdout |
| CLI wrapper | Native (`tc-claude` binary) | Adapt `binary` target in CLI config | Adapt `model.binary` in Codex config |

## Development

```bash
npm test
npm run measure:tokens
npm run smoke
```

The project is JavaScript-only ESM. Tests use Node's built-in `node:test` and run files sequentially for Windows sandbox compatibility.

## Limits

- **Prompt optimization is lossy.** `optimizeChinesePrompt` reduces the input to a templated `Task / Preserve refs / Tests` shape derived from a hint table. Constraints outside that table — preservation rules, rare verbs, multi-paragraph context — can be dropped silently. If your prompt needs to be preserved verbatim, bypass the wrapper.
- **Wrapper only optimizes the last non-file positional argument.** Flags are passed through unchanged; arguments that look like file paths (contain `.` extensions or path separators) are skipped. Interactive stdin is unoptimized — pipe through `node wrapper/tc-claude.js "$(cat prompt.txt)"` if you need it for now.
- **TC→Simplified translation does not save tokens on real tokenizers.** `cl100k_base` (and Anthropic's tokenizer) charge roughly the same per Han character regardless of script. The wrapper retains the path because OpenCC normalisation occasionally helps downstream tools, not because it cuts tokens.
- **Hook scope is Traditional Chinese only.** Source files containing Japanese kana, or Simplified Chinese without TC-distinctive characters, are left alone (`shouldTranslateTraditional`). The output-schema rule in `SKILL.md` still applies.
- **Shadow restore is fail-closed.** If the original file's SHA-256 changed between read and write, the restore is rejected — the user keeps their newer content. Shadow directories live at `os.tmpdir()/tc-shadow/<24-hex>/` with `0700` perms; remove them manually if disk pressure becomes a concern.
- **Ollama TC-to-English translation and MCP indexing are out of scope** for this MVP and tracked in the handoff doc.
