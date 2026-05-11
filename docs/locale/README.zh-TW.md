# TC Token Optimizer

[English](../../README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

TC Token Optimizer 是一個可本機使用的 MVP，目標是降低繁體中文開發者在 coding agent 工作流程中的 token 開銷。它包含精簡輸出的 agent skill、Claude Code hooks、CLI wrapper，以及可重現的 token 節省實驗。

本專案的來源指南與 handoff 文件說明了為什麼需要 wrapper：Claude Code hooks 可以透過 `updatedInput` 修改工具輸入，但 `UserPromptSubmit` 目前不能在提示詞進入 context 前改寫使用者 prompt。因此，prompt 最佳化必須在 `claude` binary 收到 prompt 之前完成。

## 安裝

依照你想要的範圍選擇一條路徑：

| 路徑 | 取得內容 | 適合 |
|---|---|---|
| A. 只裝 skill | Tier 1（輸出契約） | 30 秒試用，不需 hooks/wrapper |
| B. Marketplace 安裝 plugin | Tier 1 + 2 | **推薦** — 可用 `/plugin update` 自動更新 |
| C. Git clone 安裝 plugin | Tier 1 + 2 | 離線使用 / 修改原始碼 |
| D. 額外加裝 CLI wrapper | 在 B 或 C 之上加 Tier 3 | 在 Claude Code 收到 prompt 前先最佳化 |

### A. 只裝 skill（最輕量）

只複製 skill 資料夾；不需要 Node、不需要 hooks。

```bash
# macOS / Linux
mkdir -p ~/.claude/skills
cp -r skills/tc-token-optimizer ~/.claude/skills/

# Windows (PowerShell)
New-Item -ItemType Directory -Force $HOME\.claude\skills | Out-Null
Copy-Item -Recurse skills\tc-token-optimizer $HOME\.claude\skills\
```

重啟 Claude Code，skill 會以 `tc-token-optimizer` 出現在 `/skills` 列表。

### B. Marketplace 安裝 plugin（推薦）

本 repo 內含 `.claude-plugin/marketplace.json`，Claude Code 可直接從 GitHub 把它當作 plugin marketplace 載入，一次取得 skill 與 hooks（skill+hooks 不需要 `git clone`、不需要跑 `npm install`）。

Claude Code 內：

```text
/plugin marketplace add HankkLin/Chinese_simplifier
/plugin install tc-token-optimizer@chinese-simplifier
```

或從終端機（非互動模式）：

```bash
claude plugin marketplace add HankkLin/Chinese_simplifier
claude plugin install tc-token-optimizer@chinese-simplifier
```

更新：`/plugin marketplace update chinese-simplifier` 重新整理目錄，然後 `/plugin update tc-token-optimizer@chinese-simplifier`。移除：`/plugin uninstall tc-token-optimizer@chinese-simplifier`。

> Marketplace 名稱是 `chinese-simplifier`（kebab-case），plugin 名稱是 `tc-token-optimizer`。安裝指令中的 `@` 是 `plugin@marketplace` 的分隔符。

### C. Git clone 安裝 plugin

```bash
git clone https://github.com/HankkLin/Chinese_simplifier.git ~/.claude/plugins/tc-token-optimizer
cd ~/.claude/plugins/tc-token-optimizer
npm install   # 只有 hooks + wrapper 需要
npm test      # 選用 — 驗證 hooks
```

Claude Code 會自動把 `skills/tc-token-optimizer/SKILL.md` 當作 skill 載入；`hooks/hooks.json` 透過 `${CLAUDE_PLUGIN_ROOT}` 串接 shadow-read、trace 壓縮與 pre-compact hooks（不需修改路徑）。

### D. 選用：安裝 CLI wrapper

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

測量日期：2026-05-07，使用 `js-tiktoken`（`cl100k_base`）。

| Fixture | Transformation | 分詞器控制組 | 分詞器變數組 | 分詞器降幅 | Proxy 降幅 | 落差 (pp) |
|---|---|---:|---:|---:|---:|---:|
| tc-prompt | protected prompt optimization | 151 | 50 | 66.89% | 67.24% | 0.35 |
| tc-source | shadow file comment compaction | 180 | 62 | 65.56% | 66.67% | 1.11 |
| verbose-trace | trace compaction | 134 | 51 | 61.94% | 61.60% | 0.34 |
| verbose-response | `SKILL.md` schema response | 153 | 23 | 84.97% | 88.66% | 3.69 |
| fixture-file-tc-prompt (audited) | protected prompt optimization | 151 | 59 | 60.93% | 57.14% | 3.79 |
| fixture-file-tc-source | shadow file comment compaction | 193 | 75 | 61.14% | 62.73% | 1.59 |

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
