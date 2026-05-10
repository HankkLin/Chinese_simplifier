# TC Token Optimizer

[English](../../README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

TC Token Optimizer 是一個可本機使用的 MVP，目標是降低繁體中文開發者在 coding agent 工作流程中的 token 開銷。它包含精簡輸出的 agent skill、Claude Code hooks、CLI wrapper，以及可重現的 token 節省實驗。

本專案的來源指南與 handoff 文件說明了為什麼需要 wrapper：Claude Code hooks 可以透過 `updatedInput` 修改工具輸入，但 `UserPromptSubmit` 目前不能在提示詞進入 context 前改寫使用者 prompt。因此，prompt 最佳化必須在 `claude` binary 收到 prompt 之前完成。

## 快速開始

```bash
npm install
npm test
npm run measure:tokens
```

直接使用 wrapper：

```bash
npx tc-claude "請修正 `parseUser()` 的錯誤處理流程"
```

或安裝 shell alias：

```bash
bash wrapper/install.sh
```

如果 alias 造成遞迴呼叫，請指定真正的 Claude binary：

```bash
export TC_CLAUDE_REAL_BIN=/absolute/path/to/claude
```

## 安裝層級

| 層級 | 元件 | 設定方式 | 目的 |
|---|---|---:|---|
| 1 | `SKILL.md` | 複製到 agent skills | 強制精簡輸出、英文優先推理、降低回覆 token。 |
| 2 | `hooks/*.js` | 複製 `.claude/settings.json.example` 並更新路徑 | 對繁中重度檔案建立 shadow read、壓縮 trace、保留精簡 session state。 |
| 3 | `wrapper/tc-claude.js` | 使用 `tc-claude` 或 shell alias | 在 Claude Code 收到繁中 prompt 前先做最佳化。 |

## Claude Hook 設定

將 `.claude/settings.json.example` 複製到你的 Claude Code 設定，並把 `/path/to/tc-token-optimizer` 改成本專案路徑。

MVP 的 hook 行為刻意保守：

- `PreToolUse` 的 `Read` 會針對繁中重度檔案建立 OS temp shadow file。
- `PostToolUse --mode=trace` 會壓縮 JS、Python、Java 類型的 trace。
- `PostToolUse --mode=restore` 在沒有安全還原 metadata 時會 fail closed，避免覆寫原始繁中註解。
- `PreCompact` 只會根據 payload 中實際存在的欄位輸出精簡 `additionalContext`。

## Token 實驗

執行：

```bash
npm run measure:tokens
```

方法：

- 控制組使用原始繁中 prompt、繁中註解較多的 source、冗長 trace、冗長 assistant 回覆。
- 變因組使用 wrapper prompt optimizer、shadow-file comment compaction、trace compaction、`SKILL.md` caveman output。
- 實驗使用 `src/tokenizer.js` 中的本機 deterministic proxy tokenizer。
- 每個 fixture 都必須至少減少 30% measured tokens 才算通過。

這些是為了可重現性而設計的 proxy measurements。它們證明本專案測試 harness 中的相對壓縮效果，不代表精確的 Claude Code 帳單或 Anthropic tokenizer 計數。

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
