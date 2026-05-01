# TC Token Optimizer — Project Handoff Document
> For: Codex / coding agent continuation
> Author context: Hank (prompt engineer, VT MEng CS Fall 2026, based in Taiwan)
> Status: Architecture designed, implementation pending
> Goal: Build and publish a GitHub skill that reduces Traditional Chinese token overhead in Claude Code and other coding agents

---

## Problem Statement

Traditional Chinese (TC) developers using LLM coding agents (Claude Code, Codex CLI, Gemini CLI) face a 2–3× token penalty compared to English speakers. This happens because:

1. **BPE tokenizers are English-biased.** Trained on English-dominant corpora, vocabulary slots go to English subwords. TC characters fragment into multiple subword units or raw UTF-8 bytes.
2. **TC is penalized more than SC.** Simplified Chinese has more training data representation. TC characters are structurally more complex and statistically rarer in Western datasets.
3. **Agentic loops compound the problem.** Claude Code doesn't just send your prompt — it ingests file contents, shell outputs, stack traces, diffs on every loop turn. TC comments in code files, TC docstrings, TC error messages all bloat context on every read.
4. **The cognitive cost.** Self-attention scales quadratically with sequence length. Fragmented tokens force the model to spend attention budget re-assembling words before it can reason about meaning → elevated hallucination, faster context degradation, reduced multi-turn coherence.

**Empirical numbers from research:**
- TC requires ~2–3× tokens vs English for equivalent semantic content
- TC requires marginally more tokens than SC (SC benefits from BPE training bias)
- Chinese text: ~1.33 chars/token (character-dense but NOT token-efficient)
- English text: ~4.75 chars/token
- Claude 3.5 Sonnet uses ~34% fewer tokens than GPT-4o on TC tasks, but the baseline TC penalty remains severe
- SWE-bench Lite task resolution rate drops measurably when TC tokenization bloat fills the context

**The architectural constraint (critical for Claude Code):**
Claude Code's `UserPromptSubmit` hook supports `additionalContext` and exit-code blocking, but does NOT support `updatedPrompt`. You cannot natively rewrite/translate a user's prompt before it hits the LLM context window. This is a documented missing feature (GitHub issue #27365, #34390). The workaround is a CLI wrapper layer that intercepts before the `claude` binary is invoked.

---

## Repository Target Structure

```
tc-token-optimizer/
├── README.md                        # User-facing docs, install instructions
├── SKILL.md                         # Tier 1: Drop-in Claude Code skill (pure prompt engineering)
├── hooks/
│   ├── pre-tool-use.js              # Shadow file masking (PreToolUse hook)
│   ├── post-tool-use.js             # Trace compactor + write reverse-translate (PostToolUse hook)
│   └── pre-compact.js               # State backup before context compaction (PreCompact hook)
├── wrapper/
│   ├── tc-claude.js                 # CLI wrapper — intercepts TC prompt before claude binary
│   └── install.sh                   # Sets up shell alias: alias claude="node /path/tc-claude.js"
├── mcp/
│   └── codebase-index/              # Optional: MCP server for AST-based codebase indexing
│       ├── index.js
│       └── package.json
├── .claude/
│   └── settings.json.example        # Hook configuration template users can copy
├── package.json
└── test/
    ├── sample-tc-file.ts            # Test fixture: TypeScript file with TC comments
    └── run-tests.sh
```

---

## Implementation Plan — Three Tiers

### Tier 1: SKILL.md (Zero Setup — Build First)

A pure prompt engineering skill that works immediately. Users drop it into `.claude/skills/`. No installation, no dependencies.

**What it does:**
- Enforces "Caveman Mode" — strips Claude's verbose output habits
- Instructs Claude to reason internally in English even if prompted in TC
- Forces structured, minimal output format (diffs only, no explanations)
- Injects system-level brevity constraints

**File to create: `SKILL.md`**

Content requirements:
```markdown
---
name: tc-token-optimizer
description: Reduces token consumption for Traditional Chinese developers by enforcing
  output compression and English-first internal reasoning. Drop into .claude/skills/.
  Saves 40-75% on output tokens with no setup required.
version: 1.0.0
---

[SYSTEM DIRECTIVE - TOKEN OPTIMIZATION MODE]

You are operating in Token Optimization Mode for a Traditional Chinese developer environment.

## Internal Reasoning Protocol
- Reason and plan internally in English regardless of prompt language
- Translate TC input to English semantics before processing
- Do NOT echo back TC text in intermediate reasoning steps

## Output Format — Caveman Mode
Strict brevity enforcement. Every response follows this schema:

STATUS: [DONE|BLOCKED|CLARIFY]
CHANGES: <diff or file list, nothing else>
NEXT: <1 line only>
ERRORS: <compact error if any>

Rules:
- NO explanatory prose. No "I have made the following changes..."
- NO pleasantries, acknowledgements, or summaries
- Code diffs only — never repeat unchanged code
- Error messages: extract exception type + failing line only. Not full stack trace.
- If a question requires >2 sentences to answer, answer in bullet points, max 5 bullets
- Never output TC unless explicitly asked to write TC content

## Context Window Protection
- When reading files, acknowledge only the function/section relevant to the task
- Do not reproduce file contents in your response
- Reference line numbers instead of quoting code blocks

## Benchmark
A well-optimized response to a single-file edit task should be under 80 tokens.
```

**Research note:** A 2026 paper (arXiv:2604.00025) showed strict brevity constraints improve LLM accuracy by 26 percentage points on tasks where verbosity causes logical drift. Caveman Mode is both a cost optimization AND a quality improvement.

---

### Tier 2: Hook Scripts (Medium Setup)

Hook scripts configured via `.claude/settings.json`. These intercept Claude Code's tool execution loop to prevent TC content from ever entering the LLM context window raw.

#### Hook A: `hooks/pre-tool-use.js` — Shadow File Masking

**Trigger:** `PreToolUse` on the `Read` tool
**What it does:**
1. Intercepts Claude's file read request
2. Detects TC content in the target file (regex Unicode range: `\u4E00-\u9FFF\u3400-\u4DBF`)
3. Generates a `/tmp/tc-shadow/` copy of the file
4. Translates TC comments using OpenCC (TC→SC) — preserves code logic, only touches comments
5. Returns `updatedInput` JSON pointing Claude to the shadow file instead

**Key implementation detail:** Use Abstract Syntax Tree (AST) parsing to separate code from comments before translating. Never modify code tokens — only comment strings and string literals where safe.

**For TypeScript/JavaScript files:** Use `@typescript-eslint/parser` or `acorn` for AST parsing
**For Python files:** Use Python's `ast` module via child process, or `tree-sitter` bindings
**For other files:** Fallback to regex-based comment detection (`//`, `/* */`, `#`, `"""`)

**Returns this JSON to Claude Code:**
```json
{
  "updatedInput": {
    "file_path": "/tmp/tc-shadow/src/utils.ts"
  }
}
```

**Token savings estimate:** 60–80% per file read in TC-heavy codebases

#### Hook B: `hooks/post-tool-use.js` — Trace Compactor + Write Reversal

**Trigger:** `PostToolUse` on `Bash` tool (for trace compaction) and `Write`/`Edit` tool (for TC restoration)

**Part 1 — Trace Compaction (Bash tool):**
When Claude runs a bash command and gets back a stack trace or test output:
1. Detect if output is a stack trace (look for patterns: `Error:`, `Traceback`, `at `, `File "`, etc.)
2. Extract: exception type, message, relevant file frames only (skip node_modules, stdlib frames)
3. Reformat into compact XML tag:
```
<COMPACT_TRACEBACK>
TypeError: Cannot read property 'map' of undefined
  src/utils.ts:42 in processItems()
  src/index.ts:18 in main()
</COMPACT_TRACEBACK>
```
4. Replace the verbose output before it reaches Claude's context

**Token savings estimate:** 85–95% per shell error (250 tokens → ~40 tokens)

**Part 2 — Write Reversal:**
When Claude writes to a shadow file, restore TC comments in the actual repository file:
1. Detect that the written file path is under `/tmp/tc-shadow/`
2. Apply an AST diff to extract only the code changes (not comment changes)
3. Apply those code changes to the original TC file
4. This preserves the developer's original TC comments in the source repo

#### Hook C: `hooks/pre-compact.js` — State Backup

**Trigger:** `PreCompact` — fires before Claude's auto-compaction truncates context

**What it does:**
1. Reads `context_window.remaining_percentage` from the StatusLine
2. When context drops below 25%, serializes critical state to `/tmp/tc-session-state.json`:
   - Current task description
   - Files modified so far
   - Pending decisions / open questions
   - Last N tool results
3. Writes a compact state summary back as `additionalContext` so it survives compaction

**Why this matters for TC developers:** TC prompts fill context faster, so compaction happens more frequently. Without this hook, important task context gets silently truncated.

#### `.claude/settings.json` configuration

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/tc-token-optimizer/hooks/pre-tool-use.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/tc-token-optimizer/hooks/post-tool-use.js --mode=trace"
          }
        ]
      },
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/tc-token-optimizer/hooks/post-tool-use.js --mode=restore"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/tc-token-optimizer/hooks/pre-compact.js"
          }
        ]
      }
    ]
  }
}
```

---

### Tier 3: CLI Wrapper (Full Setup — Solves the Hook Gap)

Because `UserPromptSubmit` cannot rewrite prompts natively, the CLI wrapper intercepts BEFORE the `claude` binary is invoked.

**File: `wrapper/tc-claude.js`**

Architecture:
```
User types TC prompt in terminal
        ↓
tc-claude.js intercepts stdin/argv
        ↓
Detect TC content (Unicode range check)
        ↓
[Fast path]  OpenCC: TC → SC       (~5ms,  no API cost)
[Full path]  Ollama: TC → English  (~400ms, local compute only)
        ↓
Spawn actual `claude` binary with translated input
        ↓
Stream claude's output back to terminal unchanged
```

**Key implementation decisions:**

1. **Translation engine choice (configurable):**
   - Default: `node-opencc` (TC→SC) — zero latency, pure JS, npm installable, no external dependencies
   - Optional: Local Ollama with Qwen2.5 (TC→EN) — higher quality, requires Ollama running locally
   - Never: Remote translation API — defeats the cost-saving purpose

2. **Detection logic:** Only translate if >15% of characters fall in CJK Unicode ranges. Pass non-TC input through untouched. This prevents latency on English-only prompts.

3. **Code block protection:** Before translating, extract and preserve fenced code blocks (` ``` `), inline code (`` ` ``), and file paths. Restore them after translation. Never translate code tokens.

4. **Passthrough architecture:** The wrapper must be transparent — all Claude Code flags, env vars, and stdin behavior must pass through correctly.

**Installation via `install.sh`:**
```bash
#!/bin/bash
# Adds alias to .bashrc/.zshrc
echo 'alias claude="node $(npm root -g)/tc-token-optimizer/wrapper/tc-claude.js"' >> ~/.zshrc
echo "TC Token Optimizer installed. Restart your terminal or run: source ~/.zshrc"
```

**npm package entry point:** Set `"bin": { "tc-claude": "./wrapper/tc-claude.js" }` in `package.json` so users can also invoke via `npx tc-claude`.

---

### Tier 4 (Bonus): MCP Codebase Index Server

An MCP server that pre-indexes the codebase as AST metadata. Instead of Claude reading raw TC-heavy files, it queries structured metadata.

**Research validation:** In benchmark testing, dependency lookups via MCP achieved 99% token reduction — from ~32,000 tokens to ~900 tokens over a 10-turn session.

**File: `mcp/codebase-index/index.js`**

What it exposes to Claude:
- `get_function_signature(file, function_name)` → returns only the signature + JSDoc/params, not the body
- `get_file_structure(file)` → returns class/function names, line numbers, no code bodies
- `get_dependencies(file)` → returns import graph metadata
- `search_symbols(query)` → fuzzy search across all symbols in the codebase

All TC comments in the raw files are translated to EN/SC in the metadata index. Claude queries metadata, never touches raw files.

**Registration:** `claude mcp add tc-codebase-index node /path/to/mcp/codebase-index/index.js`

---

## Technical Dependencies

```json
{
  "dependencies": {
    "node-opencc": "^1.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "acorn": "^8.0.0",
    "acorn-walk": "^8.0.0"
  },
  "optionalDependencies": {
    "ollama": "^0.5.0"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
}
```

**Node.js preference over Python for hooks:** Node's event-driven non-blocking I/O is significantly faster for concurrent hook executions (hooks may fire dozens of times per minute during an active session). Python has interpreter startup overhead that adds latency to every hook invocation.

---

## OpenCC Integration Notes

OpenCC (Open Chinese Convert) uses Forward Maximum Matching (FMM) against pre-compiled `.ocd2` dictionary tries. TC→SC conversion runs in single-digit milliseconds.

```javascript
// node-opencc usage
const OpenCC = require('node-opencc');

async function translateTC(text) {
  // t2s = Traditional to Simplified
  return await OpenCC.traditionalToSimplified(text);
}

// Protect code blocks before translating
function translateWithProtection(text) {
  const codeBlocks = [];
  const protected = text.replace(/```[\s\S]*?```|`[^`]+`/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });
  
  const translated = await translateTC(protected);
  
  return translated.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[i]);
}
```

---

## Performance Estimates

| Component | Mechanism | Token Savings | Latency |
|---|---|---|---|
| SKILL.md (Caveman Mode) | System prompt output compression | 40–75% output tokens | 0ms |
| Shadow File Masking | PreToolUse → updatedInput redirect | 60–80% per file read | ~50ms |
| Trace Compactor | PostToolUse bash output extraction | 85–95% per shell error | ~20ms |
| CLI Wrapper (OpenCC) | TC→SC pre-translation | 15–25% per prompt | ~5ms |
| CLI Wrapper (Ollama) | TC→EN pre-translation | 50–70% per prompt | ~400ms |
| MCP Codebase Index | AST metadata vs raw file reads | 80–99% multi-file queries | 0 API latency |

---

## README Content Requirements

The README should cover:

1. **The problem** — brief, with token overhead numbers (2–3×, cite the arXiv paper)
2. **Installation** — three tiers clearly explained with setup complexity labeled
3. **Quick start** — `npm install -g tc-token-optimizer && tc-claude init`
4. **How each tier works** — one paragraph + diagram per tier
5. **Platform compatibility table:**

| Feature | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| SKILL.md | ✅ Native | ✅ Via gemini.md | ✅ Via system prompt |
| Shadow File Hook | ✅ PreToolUse | ✅ BeforeModel hook | ⚠️ Partial (RTK proxy) |
| CLI Wrapper | ✅ Full support | ✅ Full support | ✅ Full support |
| MCP Index | ✅ `claude mcp add` | ✅ Native MCP support | ⚠️ Community tools |

6. **Contributing** — especially: adding support for more languages (Korean, Japanese face same BPE penalty)
7. **License** — MIT recommended for community adoption

---

## Build Order Recommendation

1. `SKILL.md` — ship first, immediately useful, zero dependencies
2. `hooks/pre-tool-use.js` + `hooks/post-tool-use.js` — highest ROI technical work
3. `.claude/settings.json.example` + hook wiring
4. `hooks/pre-compact.js`
5. `wrapper/tc-claude.js` with OpenCC
6. `install.sh` + `package.json` setup
7. `README.md` with full docs
8. `mcp/codebase-index/` — optional, advanced

---

## Key Research References

- **arXiv:2604.14210** — "Chinese Language Is Not More Efficient Than English in Vibe Coding" — empirical token count data, SWE-bench results
- **arXiv:2604.00025** — Brevity constraints improve LLM accuracy by 26pp (justifies Caveman Mode)
- **GitHub Issue #27365 / #34390** — anthropics/claude-code — `updatedPrompt` missing from `UserPromptSubmit` hook (architectural justification for wrapper approach)
- **Claude Code Hooks Docs** — https://code.claude.com/docs/en/hooks
- **node-opencc** — https://github.com/compulim/node-opencc
- **OpenCC** — https://github.com/BYVoid/OpenCC

---

## Notes for Codex

- All hook scripts should read from stdin (JSON payload) and write to stdout (JSON response) — this is the Claude Code hook contract
- The `updatedInput` field in `PreToolUse` response is what enables transparent shadow file redirection — this is the critical mechanism for file masking
- When in doubt about hook payload schema, refer to: https://code.claude.com/docs/en/hooks
- The wrapper (`tc-claude.js`) should handle SIGINT/SIGTERM gracefully and pass them to the child claude process
- Test fixture at `test/sample-tc-file.ts` should include: TC line comments, TC block comments, TC string literals, mixed TC/EN comments, and code with no TC (to test passthrough)
- The trace compactor regex patterns to detect stack traces: `/^\s+at /m` (JS), `/Traceback \(most recent call last\)/` (Python), `/Exception in thread/` (Java)

---

*Document generated from architecture conversation with Claude. All technical decisions above are validated against the source PDF: "Architectural Optimization of Large Language Model Tokenization for Traditional Chinese in Agentic Software Engineering Environments"*
