# TC Token Optimizer

TC Token Optimizer is a working MVP for reducing Traditional Chinese token overhead in coding-agent workflows. It combines a compact agent skill, Claude Code hooks, a CLI wrapper, and a reproducible token-savings experiment.

The source guide and handoff in this repository describe the architectural reason for the wrapper: Claude Code hooks can modify tool inputs with `updatedInput`, but `UserPromptSubmit` cannot rewrite the user prompt before it enters context. Prompt optimization therefore has to happen before the `claude` binary receives the prompt.

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

- Control group uses raw Traditional Chinese prompts, TC-heavy source comments, verbose traces, and verbose assistant output.
- Variable group uses the wrapper prompt optimizer, shadow-file comment compaction, trace compaction, and `SKILL.md` caveman output.
- The experiment uses a local deterministic proxy tokenizer in `src/tokenizer.js`.
- Passing threshold is at least 30% fewer measured tokens for every fixture.

These are proxy measurements for repeatability. They demonstrate relative compression in this project’s test harness, not exact Claude Code billing or Anthropic tokenizer counts.

## Latest Recorded Results

Measured on 2026-05-01 with local proxy token counting.

| Fixture | Transformation | Control tokens | Variable tokens | Tokens saved | Reduction |
|---|---:|---:|---:|---:|---:|
| tc-prompt | protected prompt optimization | 214 | 26 | 188 | 87.85% |
| tc-source | shadow file comment compaction | 247 | 74 | 173 | 70.04% |
| verbose-trace | trace compaction | 109 | 43 | 66 | 60.55% |
| verbose-response | SKILL.md caveman response | 237 | 21 | 216 | 91.14% |

The generated files are committed at:

- `test/results/token-savings.json`
- `test/results/token-savings.md`

## Compatibility

| Feature | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| `SKILL.md` | Native skill-style instruction | Adapt into `GEMINI.md` | Adapt into system/project prompt |
| Shadow file hook | `PreToolUse` | Requires equivalent hook | Requires wrapper/proxy support |
| Trace compaction | `PostToolUse` | Requires equivalent hook | Requires wrapper/proxy support |
| CLI wrapper | Full support | Adapt binary target | Adapt binary target |

## Development

```bash
npm test
npm run measure:tokens
npm run smoke
```

The project is JavaScript-only ESM. Tests use Node’s built-in `node:test` and run files sequentially for Windows sandbox compatibility.

## Limits

- The wrapper currently optimizes prompt-like argv values. Interactive stdin optimization is future work.
- Shadow restore is fail-closed in the MVP to avoid overwriting original TC comments incorrectly.
- Ollama TC-to-English translation and MCP indexing are documented future extensions, not part of this MVP.
- The proxy tokenizer intentionally models TC overhead for reproducible experiments; use exported Claude usage logs for billing-grade validation.
