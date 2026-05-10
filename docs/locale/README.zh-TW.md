# TC Token Optimizer

[English](../../README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

TC Token Optimizer 是一個可本機使用的 MVP，目標是降低繁體中文開發者在 coding agent 工作流程中的 token 開銷。它包含精簡輸出的 agent skill、Claude Code hooks、CLI wrapper，以及可重現的 token 節省實驗。

本專案的來源指南與 handoff 文件說明了為什麼需要 wrapper：Claude Code hooks 可以透過 `updatedInput` 修改工具輸入，但 `UserPromptSubmit` 目前不能在提示詞進入 context 前改寫使用者 prompt。因此，prompt 最佳化必須在 `claude` binary 收到 prompt 之前完成。

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

## 最新紀錄結果

測量日期：2026-05-01，使用本機 proxy token counting。

| Fixture | Transformation | Control tokens | Variable tokens | Tokens saved | Reduction |
|---|---:|---:|---:|---:|---:|
| tc-prompt | protected prompt optimization | 214 | 26 | 188 | 87.85% |
| tc-source | shadow file comment compaction | 247 | 74 | 173 | 70.04% |
| verbose-trace | trace compaction | 109 | 43 | 66 | 60.55% |
| verbose-response | SKILL.md caveman response | 237 | 21 | 216 | 91.14% |

產生的結果檔案：

- `test/results/token-savings.json`
- `test/results/token-savings.md`

## 相容性

| 功能 | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| `SKILL.md` | 原生 skill-style instruction | 可改寫進 `GEMINI.md` | 可改寫進 system/project prompt |
| Shadow file hook | `PreToolUse` | 需要對應 hook | 需要 wrapper/proxy 支援 |
| Trace compaction | `PostToolUse` | 需要對應 hook | 需要 wrapper/proxy 支援 |
| CLI wrapper | 完整支援 | 可調整 binary target | 可調整 binary target |

## 開發

```bash
npm test
npm run measure:tokens
npm run smoke
```

本專案是 JavaScript-only ESM。測試使用 Node 內建的 `node:test`，並為了 Windows sandbox 相容性依序執行測試檔。

## 限制

- wrapper 目前最佳化 prompt-like argv values；interactive stdin optimization 是後續工作。
- MVP 的 shadow restore 採 fail-closed，避免不安全地覆寫原始繁中註解。
- Ollama TC-to-English translation 與 MCP indexing 是未來擴充，不屬於目前 MVP。
- proxy tokenizer 是為了可重現實驗而建模繁中 token overhead；若需要帳單級驗證，請使用匯出的 Claude usage logs。
