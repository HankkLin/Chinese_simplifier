# TC Token Optimizer

[English](README.md) | [繁體中文](docs/locale/README.zh-TW.md) | [简体中文](docs/locale/README.zh-CN.md)

TC Token Optimizer is a working MVP for reducing Traditional Chinese token overhead in coding-agent workflows. It combines a compact agent skill, Claude Code hooks, a CLI wrapper, and a reproducible token-savings experiment.

The architectural reason for the wrapper (full notes in [docs/TC_TOKEN_OPTIMIZER_HANDOFF.md](docs/TC_TOKEN_OPTIMIZER_HANDOFF.md)): Claude Code hooks can modify tool inputs with `updatedInput`, but `UserPromptSubmit` cannot rewrite the user prompt before it enters context. Prompt optimization therefore has to happen before the `claude` binary receives the prompt.

The wrapper's prompt optimizer is **lossy** — see "Limits" below before relying on it for prompts that need verbatim preservation.

## Install

Pick the path that matches what you want:

| Path | What you get | Best for |
|---|---|---|
| A. Skill only | Tier 1 (output contract) | Try it in 30 seconds, no hooks/wrapper |
| B. Plugin via marketplace | Tiers 1 + 2 | Recommended — auto-updates on `/plugin update` |
| C. Plugin via git clone | Tiers 1 + 2 | Offline / hacking on the source |
| D. Add CLI wrapper | Tier 3 on top of B or C | Optimize prompts before Claude Code sees them |

### A. Skill only (lightest)

Copy just the skill folder; no Node, no hooks.

```bash
# macOS / Linux
mkdir -p ~/.claude/skills
cp -r skills/tc-token-optimizer ~/.claude/skills/

# Windows (PowerShell)
New-Item -ItemType Directory -Force $HOME\.claude\skills | Out-Null
Copy-Item -Recurse skills\tc-token-optimizer $HOME\.claude\skills\
```

Restart Claude Code. The skill appears as `tc-token-optimizer` in `/skills`.

### B. Plugin via marketplace (recommended)

This repo ships a `.claude-plugin/marketplace.json`, so Claude Code can install it directly as a plugin from GitHub. You get the skill **and** the hooks (no `git clone`, no `npm install` step needed for the skill+hooks tier).

Inside Claude Code:

```text
/plugin marketplace add HankkLin/Chinese_simplifier
/plugin install tc-token-optimizer@chinese-simplifier
```

Or from your terminal (non-interactive):

```bash
claude plugin marketplace add HankkLin/Chinese_simplifier
claude plugin install tc-token-optimizer@chinese-simplifier
```

Update later with `/plugin marketplace update chinese-simplifier` (refreshes the catalog), then `/plugin update tc-token-optimizer@chinese-simplifier`. Remove with `/plugin uninstall tc-token-optimizer@chinese-simplifier`.

> The marketplace name is `chinese-simplifier` (kebab-case). The plugin name is `tc-token-optimizer`. The `@` separator in install commands is `plugin@marketplace`.

### C. Plugin via git clone

```bash
git clone https://github.com/HankkLin/Chinese_simplifier.git ~/.claude/plugins/tc-token-optimizer
cd ~/.claude/plugins/tc-token-optimizer
npm install   # only needed for hooks + wrapper
npm test      # optional — verifies hooks
```

Claude Code auto-loads `skills/tc-token-optimizer/SKILL.md` as a skill, and `hooks/hooks.json` wires the shadow-read, trace-compaction, and pre-compact hooks via `${CLAUDE_PLUGIN_ROOT}` (no path editing required).

### D. Optional: install the CLI wrapper

The wrapper rewrites Traditional-Chinese prompts before the `claude` binary sees them. It is **lossy** — see "Limits" below before relying on it for prompts that need verbatim preservation.

```bash
# macOS / Linux
bash wrapper/install.sh

# Windows (PowerShell)
pwsh wrapper/install.ps1
```

Or invoke it directly without an alias:

```bash
node wrapper/tc-claude.js "請修正 `parseUser()` 的錯誤處理流程"
```

If the alias would recurse into itself, point the wrapper at the real Claude binary:

```bash
export TC_CLAUDE_REAL_BIN=/absolute/path/to/claude   # Bash
$env:TC_CLAUDE_REAL_BIN = "C:\path\to\claude.exe"    # PowerShell
```

## How it works (three tiers)

| Tier | Component | Purpose |
|---|---|---|
| 1 | `skills/tc-token-optimizer/SKILL.md` | Enforce concise English-first reasoning and a four-line output schema. |
| 2 | `hooks/*.js` (wired via `hooks/hooks.json`) | Shadow TC-heavy reads, compact stack traces, preserve compact session state across `PreCompact`. |
| 3 | `wrapper/tc-claude.js` | Optimize TC prompts before Claude Code receives them. |

Hook behavior (intentionally conservative for the MVP):

- `PreToolUse` on `Read` creates an OS-temp shadow file for TC-heavy files.
- `PostToolUse --mode=trace` compacts JS, Python, and Java-like traces.
- `PostToolUse --mode=restore` fails closed for shadow writes unless safe restore metadata exists.
- `PreCompact` emits compact `additionalContext` from payload fields that are actually available.

## Experimental Token Test

```bash
npm run measure:tokens
```

Method:

- **Tokenizer-of-record:** `js-tiktoken` with the `cl100k_base` encoding. The script fails closed if the library is unavailable.
- The control group is the raw Traditional-Chinese prompt, source file, trace, or response. The variable group is the optimized version produced by the wrapper, source-shadow compactor, trace compactor, or the SKILL.md schema.
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
