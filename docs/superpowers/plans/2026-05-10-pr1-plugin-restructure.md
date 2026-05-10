# PR 1 — Claude Code Plugin Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure tc-token-optimizer so a user can `git clone` it into `~/.claude/plugins/` and have the skill + hooks auto-load with zero hand-editing of `settings.json`.

**Architecture:** Adopt the Claude Code plugin convention — `.claude-plugin/plugin.json` for metadata, `hooks/hooks.json` for hook wiring (using the `${CLAUDE_PLUGIN_ROOT}` substitution token), and `skills/<name>/SKILL.md` as the canonical skill location. Move heavy reference material under the skill directory per the writing-skills convention. Replace the bash-only `wrapper/install.sh` setup story with a portable doc + PowerShell sibling. None of these changes touch the SKILL.md *body* (the protocol, schema, when-not-to-use rules), so this PR does not require RED-GREEN-REFACTOR subagent testing — only existing-test regression.

**Tech Stack:** Node 20 ESM, Claude Code plugin spec, JSON config, Markdown.

---

## File Structure

**Created:**
- `.claude-plugin/plugin.json` — plugin metadata (name, description, version, keywords, repository).
- `hooks/hooks.json` — hook wiring previously in `.claude/settings.json.example`, with paths rewritten to use `${CLAUDE_PLUGIN_ROOT}`.
- `skills/tc-token-optimizer/SKILL.md` — moved from repo root, content unchanged.
- `skills/tc-token-optimizer/references/Optimizing Chinese Tokenization for Coding Agents.pdf` — moved from `reference/`.
- `wrapper/install.ps1` — Windows/PowerShell sibling of `install.sh`.

**Modified:**
- `README.md` — quickstart collapsed to one block; tier table demoted; settings.json.example references replaced with plugin auto-load instructions; SKILL.md path updated; Windows install path added.
- `docs/locale/README.zh-TW.md` — same edits as English README.
- `docs/locale/README.zh-CN.md` — same edits as English README.
- `docs/TC_TOKEN_OPTIMIZER_HANDOFF.md` — append a "Post-restructure layout" note so the handoff doc doesn't contradict the new tree.

**Deleted:**
- `SKILL.md` (at repo root — moved).
- `.claude/settings.json.example` (replaced by `hooks/hooks.json`).
- `reference/` directory (now empty after PDF move).

**Untouched:**
- `src/`, `scripts/`, `test/`, `hooks/*.js`, `wrapper/tc-claude.js`, `wrapper/install.sh`, `package.json` — code paths use relative imports from their own location and do not reference `SKILL.md` or `.claude/settings.json.example` as files.

---

## Notes for the Executor

- **Shell:** Commands below use Bash syntax. The user is on Windows (PowerShell). `git`, `npm`, and `node` commands are identical in PS. For `mkdir -p X/Y`, PS users substitute `New-Item -ItemType Directory -Force -Path X/Y`.
- **Working directory:** Run all commands from the repo root: `D:/antigravitty/skill/.claude/worktrees/jolly-knuth-23e844`.
- **Iron Law check:** This PR does not modify the body of SKILL.md (the schema, rules, examples). It only moves the file and updates README/locale references. If a step here ever proposes editing SKILL.md *content*, stop and switch to PR 2 which requires RED-GREEN-REFACTOR.

---

## Task 1: Baseline regression check

**Files:**
- Test: `test/token-optimizer.test.js`, `test/wrapper.test.js`

- [ ] **Step 1: Run full smoke before any changes**

Run:

```bash
npm install
npm run smoke
```

Expected: every test passes; `npm run audit:fixtures` reports OK; `npm run measure:tokens` writes `test/results/token-savings.json` and `test/results/token-savings.md` without errors.

If smoke fails *before* we change anything, stop and fix or report — do not proceed. We need a green baseline so any later breakage is attributable to this PR.

- [ ] **Step 2: Record baseline measurement file mtime**

Run:

```bash
git status --short
```

Expected: clean working tree (smoke regenerates committed result files but should produce identical content). If `git diff` shows numeric drift in `test/results/token-savings.*`, commit that as a pre-PR baseline so later diffs are reviewable:

```bash
git add test/results/token-savings.json test/results/token-savings.md
git diff --cached --stat
git commit -m "chore: refresh token-savings baseline before plugin restructure"
```

If the smoke run produced no diff, skip the commit.

---

## Task 2: Add plugin manifest

**Files:**
- Create: `.claude-plugin/plugin.json`

- [ ] **Step 1: Create the directory**

Run:

```bash
mkdir -p .claude-plugin
```

- [ ] **Step 2: Write the plugin manifest**

Create `.claude-plugin/plugin.json` with this exact content:

```json
{
  "name": "tc-token-optimizer",
  "description": "Compact, English-first reasoning for Traditional-Chinese coding workflows. Bundles the SKILL.md, hooks for shadow reads and trace compaction, and a CLI wrapper for prompt optimization before the claude binary receives it.",
  "version": "1.0.0",
  "license": "MIT",
  "homepage": "https://github.com/HankkLin/Chinese_simplifier",
  "repository": "https://github.com/HankkLin/Chinese_simplifier",
  "keywords": [
    "claude-code",
    "codex",
    "tokenization",
    "traditional-chinese",
    "coding-agents"
  ]
}
```

(If the actual repository URL differs, replace both `homepage` and `repository`. The description, version, and keywords mirror `package.json` so the two manifests don't drift.)

- [ ] **Step 3: Verify it parses as JSON**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8')); console.log('ok')"
```

Expected output: `ok`

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "feat(plugin): add .claude-plugin/plugin.json manifest"
```

---

## Task 3: Add hooks manifest using ${CLAUDE_PLUGIN_ROOT}

**Files:**
- Create: `hooks/hooks.json`

The Claude Code plugin loader auto-discovers `hooks/hooks.json` and substitutes `${CLAUDE_PLUGIN_ROOT}` with the absolute plugin path at runtime. This eliminates the `/path/to/tc-token-optimizer` placeholder edit step.

- [ ] **Step 1: Write the hooks manifest**

Create `hooks/hooks.json` with this exact content:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/pre-tool-use.js"
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
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/post-tool-use.js --mode=trace"
          }
        ]
      },
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/post-tool-use.js --mode=restore"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/pre-compact.js"
          }
        ]
      }
    ]
  }
}
```

This is `.claude/settings.json.example` with three changes:

1. Top-level `{ "hooks": ... }` shape preserved (Claude Code accepts the same schema in both files).
2. `node /path/to/tc-token-optimizer/hooks/...` → `node ${CLAUDE_PLUGIN_ROOT}/hooks/...`
3. No more user-editable placeholder.

- [ ] **Step 2: Verify it parses as JSON**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8')); console.log('ok')"
```

Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add hooks/hooks.json
git commit -m "feat(plugin): wire hooks via hooks/hooks.json with CLAUDE_PLUGIN_ROOT"
```

---

## Task 4: Move SKILL.md into the conventional plugin skill path

**Files:**
- Move: `SKILL.md` → `skills/tc-token-optimizer/SKILL.md`

- [ ] **Step 1: Create the destination directory**

Run:

```bash
mkdir -p skills/tc-token-optimizer
```

- [ ] **Step 2: Move with git mv (preserves history)**

Run:

```bash
git mv SKILL.md skills/tc-token-optimizer/SKILL.md
```

Expected: `git status` shows `renamed: SKILL.md -> skills/tc-token-optimizer/SKILL.md`.

- [ ] **Step 3: Verify the file is at the new path and unchanged**

Run:

```bash
git diff --stat HEAD
node -e "const s=require('fs').readFileSync('skills/tc-token-optimizer/SKILL.md','utf8'); console.log('lines:', s.split('\n').length, 'starts:', s.startsWith('---'))"
```

Expected: stat shows a pure rename (`SKILL.md => skills/tc-token-optimizer/SKILL.md`) with 0 insertions / 0 deletions, and the node check prints `lines: 69 starts: true` (or whatever the original line count is — the point is content is unchanged).

If `git mv` shows insertions/deletions, abort with `git restore --staged --worktree skills SKILL.md` and try again — Git's rename detection is content-similarity-based, so a clean move should be 100% similar.

- [ ] **Step 4: Verify no source code reads SKILL.md by path**

Run:

```bash
grep -rn "fs.readFile.*SKILL\|require.*SKILL\|import.*SKILL" src test scripts hooks wrapper 2>/dev/null || echo "no path-based reads"
```

Expected output: `no path-based reads`. (`src/experiment.js:72` references the string `'SKILL.md caveman response'` as a label, not a file path — that's fine.)

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(plugin): move SKILL.md to skills/tc-token-optimizer/SKILL.md"
```

---

## Task 5: Move the heavy PDF reference under the skill directory

**Files:**
- Move: `reference/Optimizing Chinese Tokenization for Coding Agents.pdf` → `skills/tc-token-optimizer/references/Optimizing Chinese Tokenization for Coding Agents.pdf`
- Delete: `reference/` (now empty)

Per the writing-skills convention, heavy reference material (100+ lines / large binaries) lives next to the skill that uses it, under a `references/` subdirectory.

- [ ] **Step 1: Create the destination directory**

Run:

```bash
mkdir -p skills/tc-token-optimizer/references
```

- [ ] **Step 2: Move the PDF with git mv**

Run:

```bash
git mv "reference/Optimizing Chinese Tokenization for Coding Agents.pdf" "skills/tc-token-optimizer/references/Optimizing Chinese Tokenization for Coding Agents.pdf"
```

Expected: `git status` shows the file as renamed.

- [ ] **Step 3: Confirm the source directory is now empty and remove it**

Run:

```bash
ls reference/ 2>/dev/null
rmdir reference 2>/dev/null && echo "removed" || echo "directory not empty or already gone"
```

Expected: empty `ls` output, then `removed`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(plugin): colocate reference PDF with the skill it documents"
```

---

## Task 6: Delete the obsolete settings.json.example

**Files:**
- Delete: `.claude/settings.json.example`

Now that `hooks/hooks.json` auto-wires with `${CLAUDE_PLUGIN_ROOT}`, the example file is misleading — keeping it invites users to do the manual path-edit dance we are explicitly removing.

- [ ] **Step 1: Delete the file**

Run:

```bash
git rm .claude/settings.json.example
```

- [ ] **Step 2: Confirm `.claude/` is now empty (or contains only worktree internals)**

Run:

```bash
ls -la .claude/ 2>/dev/null
```

If `.claude/` is empty after the rm and is not under any other repo's tracking, leave it alone — git won't track empty directories. Do **not** `rmdir` `.claude/` if the worktree's host repo writes session state there.

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(plugin): drop settings.json.example (replaced by hooks/hooks.json)"
```

---

## Task 7: Add a Windows/PowerShell wrapper installer

**Files:**
- Create: `wrapper/install.ps1`

The existing `wrapper/install.sh` only handles bash/zsh. On Windows, the equivalent is appending a function to `$PROFILE`.

- [ ] **Step 1: Write the PowerShell installer**

Create `wrapper/install.ps1` with this exact content:

```powershell
#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Resolve-Path (Join-Path $ScriptDir '..')
$WrapperJs = Join-Path $RootDir 'wrapper\tc-claude.js'

if (-not (Test-Path $WrapperJs)) {
    Write-Error "tc-claude.js not found at $WrapperJs"
    exit 1
}

if (-not (Test-Path $PROFILE)) {
    New-Item -ItemType File -Path $PROFILE -Force | Out-Null
}

$FunctionLine = "function claude { node `"$WrapperJs`" @args }"

$existing = Get-Content $PROFILE -ErrorAction SilentlyContinue
if ($existing -notcontains $FunctionLine) {
    Add-Content -Path $PROFILE -Value "`n$FunctionLine"
    Write-Host "TC Token Optimizer installed. Restart your shell or run: . `$PROFILE"
} else {
    Write-Host "TC Token Optimizer alias already present in $PROFILE"
}
```

Notes:
- Uses `function claude { ... @args }` because PowerShell aliases cannot pass arguments to a node command directly.
- Idempotent: re-running it does not duplicate the function.
- Mirrors `install.sh` semantics (idempotent append, prints a "restart your shell" hint).

- [ ] **Step 2: Lint-check by parsing the PS file**

Run:

```bash
node -e "const t=require('fs').readFileSync('wrapper/install.ps1','utf8'); if(!t.includes('function claude')) process.exit(1); console.log('ok')"
```

Expected output: `ok`

(We do not execute the installer here — it would mutate `$PROFILE`. Manual smoke-test by the user is documented in the README update below.)

- [ ] **Step 3: Commit**

```bash
git add wrapper/install.ps1
git commit -m "feat(wrapper): add PowerShell installer for Windows users"
```

---

## Task 8: Rewrite the English README install section

**Files:**
- Modify: `README.md`

We're collapsing the four onboarding sections (Quick Start / Setup Tiers / Claude Hook Configuration / Experimental Token Test) into a single **Install** section that works as a copy-paste block, then keeping everything else as below-the-fold reference.

- [ ] **Step 1: Replace the install/setup region of README.md**

Find the block starting at `## Quick Start` (around line 12) and ending at the line before `## Latest Recorded Results` (line 73 in the current file). Replace that whole block with:

```markdown
## Install

This repo is a Claude Code plugin. Drop it under `~/.claude/plugins/` (or symlink it there) and Claude Code auto-loads the skill and hooks.

```bash
git clone https://github.com/HankkLin/Chinese_simplifier.git ~/.claude/plugins/tc-token-optimizer
cd ~/.claude/plugins/tc-token-optimizer
npm install
npm test
```

That's it — `skills/tc-token-optimizer/SKILL.md` becomes available as a skill, and `hooks/hooks.json` wires the shadow-read, trace-compaction, and pre-compact hooks via `${CLAUDE_PLUGIN_ROOT}` (no path editing required).

### Optional: install the CLI wrapper

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

```

The exact replacement keeps:
- The note about lossy prompt optimization.
- The `TC_CLAUDE_REAL_BIN` escape hatch.
- The hook behavior list.
- The experimental token test methodology.

It removes:
- The "Setup Tiers" table that listed manual `Copy .claude/settings.json.example and update paths` (no longer needed).
- The "Claude Hook Configuration" section (replaced by the auto-wire description).
- A duplicate of `npx tc-claude` that won't work for unpublished packages — replaced with `node wrapper/tc-claude.js`.

- [ ] **Step 2: Verify README still renders without dangling references**

Run:

```bash
grep -n "settings\.json\.example\|/path/to/tc-token-optimizer\|^npx tc-claude" README.md || echo "no stale references"
```

Expected output: `no stale references`

- [ ] **Step 3: Verify SKILL.md path references are updated**

Run:

```bash
grep -n "SKILL\.md" README.md
```

Expected: every match is either `skills/tc-token-optimizer/SKILL.md` or refers to "the SKILL.md schema" / "the SKILL.md output schema" generically (no bare `\`SKILL.md\`` referring to a root-level file).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README install for plugin auto-load"
```

---

## Task 9: Update Traditional Chinese locale README

**Files:**
- Modify: `docs/locale/README.zh-TW.md`

Mirror the English changes so locale docs do not drift.

- [ ] **Step 1: Replace the install/setup region of `docs/locale/README.zh-TW.md`**

Find the block starting at `## 快速開始` (around line 9) and ending before `## 最近一次量測結果` (the equivalent of "Latest Recorded Results"; verify the exact heading by reading the file first). Replace that block with the Traditional-Chinese translation of the new English Install + How-it-works + Experimental sections:

```markdown
## 安裝

本專案是 Claude Code plugin。把它 clone 到 `~/.claude/plugins/`（或建立 symlink），Claude Code 會自動載入 skill 與 hooks。

```bash
git clone https://github.com/HankkLin/Chinese_simplifier.git ~/.claude/plugins/tc-token-optimizer
cd ~/.claude/plugins/tc-token-optimizer
npm install
npm test
```

完成。`skills/tc-token-optimizer/SKILL.md` 會被當作 skill 載入；`hooks/hooks.json` 透過 `${CLAUDE_PLUGIN_ROOT}` 自動串接 shadow-read、trace 壓縮與 pre-compact hooks（不需要修改任何路徑）。

### 選用：安裝 CLI wrapper

Wrapper 會在 `claude` binary 收到提示前，先改寫繁體中文 prompt。它是**有損**的——若你的 prompt 必須逐字保留，請見下方「限制」。

```bash
# macOS / Linux
bash wrapper/install.sh

# Windows (PowerShell)
pwsh wrapper/install.ps1
```

或直接呼叫，不安裝 alias：

```bash
node wrapper/tc-claude.js "請修正 `parseUser()` 的錯誤處理流程"
```

若 alias 造成遞迴呼叫，請指定真正的 Claude binary：

```bash
export TC_CLAUDE_REAL_BIN=/absolute/path/to/claude   # Bash
$env:TC_CLAUDE_REAL_BIN = "C:\path\to\claude.exe"    # PowerShell
```

## 運作原理（三個層級）

| 層級 | 元件 | 目的 |
|---|---|---|
| 1 | `skills/tc-token-optimizer/SKILL.md` | 強制精簡輸出、英文優先推理、四行輸出 schema。 |
| 2 | `hooks/*.js`（透過 `hooks/hooks.json` 串接） | 對繁中重度檔案建立 shadow read、壓縮 trace、`PreCompact` 時保留精簡 session state。 |
| 3 | `wrapper/tc-claude.js` | 在 Claude Code 收到繁中 prompt 前先做最佳化。 |

MVP hook 行為刻意保守：

- `PreToolUse` 的 `Read` 會針對繁中重度檔案建立 OS temp shadow file。
- `PostToolUse --mode=trace` 會壓縮 JS、Python、Java 類型的 trace。
- `PostToolUse --mode=restore` 在沒有安全還原 metadata 時 fail closed，避免覆寫原始繁中註解。
- `PreCompact` 只會根據 payload 中實際存在的欄位輸出精簡 `additionalContext`。

## Token 實驗

```bash
npm run measure:tokens
```
```

(Keep the rest of the file — methodology, results table, compatibility, dev, limits — unchanged.)

- [ ] **Step 2: Verify no stale references**

Run:

```bash
grep -n "settings\.json\.example\|/path/to/tc-token-optimizer" docs/locale/README.zh-TW.md || echo "no stale references"
```

Expected output: `no stale references`

- [ ] **Step 3: Commit**

```bash
git add docs/locale/README.zh-TW.md
git commit -m "docs(zh-TW): mirror English plugin install rewrite"
```

---

## Task 10: Update Simplified Chinese locale README

**Files:**
- Modify: `docs/locale/README.zh-CN.md`

Apply the same edits as Task 9 with Simplified Chinese characters. The structural changes (heading names, code blocks, paths) are identical; only the prose text differs.

- [ ] **Step 1: Replace the install/setup region of `docs/locale/README.zh-CN.md`**

Find the block starting at `## 快速开始` and ending before the equivalent of "Latest Recorded Results". Replace with the Simplified Chinese translation of the same content used in Task 9 — convert each Traditional Chinese paragraph to Simplified Chinese (e.g., 繁體 → 简体, 設定 → 设置, 專案 → 项目, 透過 → 通过), and keep all code blocks, file paths, and English technical terms (`hooks/hooks.json`, `${CLAUDE_PLUGIN_ROOT}`, etc.) byte-identical.

The key sentences to translate:

- "本專案是 Claude Code plugin" → "本项目是 Claude Code plugin"
- "完成" → "完成"
- "Wrapper 會在 `claude` binary 收到提示前，先改寫繁體中文 prompt" → "Wrapper 会在 `claude` binary 收到提示前，先改写繁体中文 prompt"
- "它是**有損**的" → "它是**有损**的"
- "強制精簡輸出、英文優先推理、四行輸出 schema" → "强制精简输出、英文优先推理、四行输出 schema"
- "對繁中重度檔案建立 shadow read" → "对繁中重度文件建立 shadow read"
- "壓縮 trace" → "压缩 trace"
- "在沒有安全還原 metadata 時 fail closed" → "在没有安全还原 metadata 时 fail closed"
- "避免覆寫原始繁中註解" → "避免覆写原始繁中注释"

- [ ] **Step 2: Verify no stale references**

Run:

```bash
grep -n "settings\.json\.example\|/path/to/tc-token-optimizer" docs/locale/README.zh-CN.md || echo "no stale references"
```

Expected output: `no stale references`

- [ ] **Step 3: Commit**

```bash
git add docs/locale/README.zh-CN.md
git commit -m "docs(zh-CN): mirror English plugin install rewrite"
```

---

## Task 11: Append a post-restructure note to the handoff doc

**Files:**
- Modify: `docs/TC_TOKEN_OPTIMIZER_HANDOFF.md`

The handoff doc has a "Repository Target Structure" tree that now contradicts the new layout. Rather than rewriting the whole doc (it's a historical design record), append a short note at the top so any future reader sees the divergence.

- [ ] **Step 1: Insert a banner after the front-matter block**

Read the file. The existing top is:

```markdown
# TC Token Optimizer — Project Handoff Document
> For: Codex / coding agent continuation
> Author context: Hank (prompt engineer, VT MEng CS Fall 2026, based in Taiwan)
> Status: Architecture designed, implementation pending
> Goal: Build and publish a GitHub skill that reduces Traditional Chinese token overhead in Claude Code and other coding agents

---

## Problem Statement
```

Insert a new block immediately after the `---` separator and before `## Problem Statement`:

```markdown
> **Update (2026-05-10):** This document captures the original design. The repo has since been restructured as a Claude Code plugin:
> - `SKILL.md` → `skills/tc-token-optimizer/SKILL.md`
> - `reference/*.pdf` → `skills/tc-token-optimizer/references/`
> - `.claude/settings.json.example` → replaced by `hooks/hooks.json` (auto-wired via `${CLAUDE_PLUGIN_ROOT}`)
> - Plugin metadata lives at `.claude-plugin/plugin.json`
>
> Where the "Repository Target Structure" section below shows the older tree, the current canonical layout is the one described in `README.md`.

---
```

- [ ] **Step 2: Commit**

```bash
git add docs/TC_TOKEN_OPTIMIZER_HANDOFF.md
git commit -m "docs(handoff): note plugin restructure on 2026-05-10"
```

---

## Task 12: Final regression check

**Files:**
- Test: `test/token-optimizer.test.js`, `test/wrapper.test.js`
- Verify: hooks discoverability, plugin manifest, skill location

- [ ] **Step 1: Run the full smoke**

Run:

```bash
npm run smoke
```

Expected: every test passes; `npm run audit:fixtures` reports OK; `npm run measure:tokens` finishes and reports the same fixtures green (the SKILL.md content is unchanged, so token reductions should be byte-identical to the baseline from Task 1).

- [ ] **Step 2: Verify the plugin layout invariants**

Run:

```bash
node -e "
  const fs = require('fs');
  const checks = [
    ['.claude-plugin/plugin.json',           'plugin manifest'],
    ['hooks/hooks.json',                     'hooks manifest'],
    ['skills/tc-token-optimizer/SKILL.md',   'skill at canonical path'],
    ['skills/tc-token-optimizer/references/Optimizing Chinese Tokenization for Coding Agents.pdf', 'reference colocated'],
    ['wrapper/install.ps1',                  'PowerShell installer'],
  ];
  let bad = 0;
  for (const [p, label] of checks) {
    if (fs.existsSync(p)) console.log('OK   ' + label + ' (' + p + ')');
    else { console.log('MISS ' + label + ' (' + p + ')'); bad++; }
  }
  const gone = ['SKILL.md', '.claude/settings.json.example', 'reference'];
  for (const p of gone) {
    if (!fs.existsSync(p)) console.log('OK   removed ' + p);
    else { console.log('STAY ' + p + ' should be gone'); bad++; }
  }
  process.exit(bad ? 1 : 0);
"
```

Expected: all `OK` lines, exit code 0.

- [ ] **Step 3: Verify the hooks manifest will resolve at runtime**

This is a static check — we cannot actually exercise Claude Code's plugin loader from this test suite. But we can simulate the substitution and confirm each command resolves to a real file:

```bash
node -e "
  const fs = require('fs');
  const path = require('path');
  const root = process.cwd();
  const manifest = JSON.parse(fs.readFileSync('hooks/hooks.json','utf8'));
  let bad = 0;
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      if (node.command) {
        const expanded = node.command.replace('\${CLAUDE_PLUGIN_ROOT}', root);
        const tokens = expanded.split(/\s+/);
        const script = tokens.find(t => t.endsWith('.js'));
        if (script && !fs.existsSync(script)) { console.log('MISS', expanded); bad++; }
        else console.log('OK  ', node.command);
      }
      for (const v of Object.values(node)) walk(v);
    }
  }
  walk(manifest);
  process.exit(bad ? 1 : 0);
"
```

Expected: every `OK` line, exit code 0.

- [ ] **Step 4: Manually run one of the hooks to confirm it still executes**

Run:

```bash
echo '{"tool_input":{"file_path":"test/fixtures/sample-tc-file.ts"}}' | node hooks/pre-tool-use.js
```

Expected: a JSON response on stdout (the shadow-file decision payload). If the script crashes or produces no output, something in our restructure broke the hook entry points — investigate before proceeding.

- [ ] **Step 5: Final commit (only if any verification artifact was generated and is uncommitted)**

```bash
git status --short
```

If results files refreshed, commit them:

```bash
git add test/results/token-savings.json test/results/token-savings.md
git diff --cached --stat
git commit -m "chore: refresh token-savings after plugin restructure (no schema change)"
```

If `git status` is clean, skip this step.

- [ ] **Step 6: Push branch and open PR**

```bash
git log --oneline -10
git push -u origin claude/jolly-knuth-23e844
```

Open a PR titled `Restructure as Claude Code plugin (PR 1 of 2)` with the body:

```markdown
## Summary

- Restructured the repo to follow the standard Claude Code plugin layout so users can `git clone` into `~/.claude/plugins/` and have everything auto-load.
- `SKILL.md` content is unchanged. PR 2 will introduce the symptoms-list / quick-reference edits, which require RED-GREEN-REFACTOR per superpowers:writing-skills.

## Breaking changes

- `.claude/settings.json.example` is removed. Existing users who hand-wired their `~/.claude/settings.json` to point at this repo's hooks should:
  - Either move the clone to `~/.claude/plugins/tc-token-optimizer` and remove their manual hook entries (the plugin auto-wires).
  - Or update their existing entries to point at `<repo>/hooks/*.js` (path unchanged).
- `SKILL.md` has moved from repo root to `skills/tc-token-optimizer/SKILL.md`. Personal-skill installs that copied the root file should re-copy from the new path.

## Test plan

- [ ] `npm run smoke` passes on a fresh clone
- [ ] Cloning into `~/.claude/plugins/tc-token-optimizer` and starting Claude Code shows `tc-token-optimizer` in the skills list
- [ ] Hooks fire on a TC-heavy `Read` (verify a shadow file appears under `os.tmpdir()/tc-shadow/`)
- [ ] `bash wrapper/install.sh` (Linux/macOS) and `pwsh wrapper/install.ps1` (Windows) both produce a working `claude` alias
```

---

## Self-Review Checklist (run after writing the plan)

- [x] **Spec coverage:** every bullet from the original PR-1 recommendation has a task. `.claude-plugin/plugin.json` → Task 2; `hooks/hooks.json` with `${CLAUDE_PLUGIN_ROOT}` → Task 3; SKILL.md move → Task 4; PDF colocation → Task 5; settings.json.example deletion → Task 6; README rewrite → Task 8; locale parity → Tasks 9 + 10; Windows install → Task 7; HANDOFF note → Task 11; regression test → Tasks 1 + 12.
- [x] **Placeholder scan:** no "TBD", "implement later", "fill in details", or "similar to Task N". Every code block is the actual content to write. Locale Task 10 lists the exact phrase substitutions rather than saying "translate appropriately".
- [x] **Type consistency:** the manifest field names (`name`, `description`, `version`, `keywords`, `homepage`, `repository`, `license`) match between `.claude-plugin/plugin.json` (Task 2) and `package.json`'s existing values (verified — `package.json` uses the same names). Hook event names (`PreToolUse`, `PostToolUse`, `PreCompact`) match between `hooks/hooks.json` (Task 3) and the existing `.claude/settings.json.example` schema. The `${CLAUDE_PLUGIN_ROOT}` token is spelled identically across all references.
- [x] **Frequent commits:** every task ends with a commit. 11 commits in total (Tasks 2–12), each scoped to a single concern, so any single one can be reverted without unwinding the others.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-10-pr1-plugin-restructure.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
