# TC Token Optimizer

[English](../../README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

TC Token Optimizer 是一个可本地使用的 MVP，目标是降低中文开发者在 coding agent 工作流中的 token 开销。它包含精简输出的 agent skill、Claude Code hooks、CLI wrapper，以及可复现的 token 节省实验。

本项目的来源指南与 handoff 文档说明了为什么需要 wrapper：Claude Code hooks 可以通过 `updatedInput` 修改工具输入，但 `UserPromptSubmit` 目前不能在提示词进入 context 前改写用户 prompt。因此，prompt 优化必须在 `claude` binary 收到 prompt 之前完成。

## 安装

本项目是 Claude Code plugin。把它 clone 到 `~/.claude/plugins/`（或建立 symlink），Claude Code 会自动加载 skill 与 hooks。

```bash
git clone https://github.com/HankkLin/Chinese_simplifier.git ~/.claude/plugins/tc-token-optimizer
cd ~/.claude/plugins/tc-token-optimizer
npm install
npm test
```

完成。`skills/tc-token-optimizer/SKILL.md` 会被当作 skill 加载；`hooks/hooks.json` 通过 `${CLAUDE_PLUGIN_ROOT}` 自动串接 shadow-read、trace 压缩与 pre-compact hooks（不需要修改任何路径）。

### 可选：安装 CLI wrapper

Wrapper 会在 `claude` binary 收到提示前，先改写繁体中文 prompt。它是**有损**的——若你的 prompt 必须逐字保留，请见下方"限制"。

```bash
# macOS / Linux
bash wrapper/install.sh

# Windows (PowerShell)
pwsh wrapper/install.ps1
```

或直接调用，不安装 alias：

```bash
node wrapper/tc-claude.js "请修正 `parseUser()` 的错误处理流程"
```

若 alias 造成递归调用，请指定真正的 Claude binary：

```bash
export TC_CLAUDE_REAL_BIN=/absolute/path/to/claude   # Bash
$env:TC_CLAUDE_REAL_BIN = "C:\path\to\claude.exe"    # PowerShell
```

## 工作原理（三个层级）

| 层级 | 组件 | 目的 |
|---|---|---|
| 1 | `skills/tc-token-optimizer/SKILL.md` | 强制精简输出、英文优先推理、四行输出 schema。 |
| 2 | `hooks/*.js`（通过 `hooks/hooks.json` 串接） | 对繁中重度文件建立 shadow read、压缩 trace、`PreCompact` 时保留精简 session state。 |
| 3 | `wrapper/tc-claude.js` | 在 Claude Code 收到繁中 prompt 前先做优化。 |

MVP hook 行为刻意保守：

- `PreToolUse` 的 `Read` 会针对繁中重度文件建立 OS temp shadow file。
- `PostToolUse --mode=trace` 会压缩 JS、Python、Java 类型的 trace。
- `PostToolUse --mode=restore` 在没有安全还原 metadata 时 fail closed，避免覆写原始繁中注释。
- `PreCompact` 只会根据 payload 中实际存在的字段输出精简 `additionalContext`。

## Token 实验

```bash
npm run measure:tokens
```

## 最新记录结果

测量日期：2026-05-07，使用 `js-tiktoken`（`cl100k_base`）。

| Fixture | Transformation | 分词器控制组 | 分词器变量组 | 分词器降幅 | Proxy 降幅 | 差距 (pp) |
|---|---|---:|---:|---:|---:|---:|
| tc-prompt | protected prompt optimization | 151 | 50 | 66.89% | 67.24% | 0.35 |
| tc-source | shadow file comment compaction | 180 | 62 | 65.56% | 66.67% | 1.11 |
| verbose-trace | trace compaction | 134 | 51 | 61.94% | 61.60% | 0.34 |
| verbose-response | `SKILL.md` schema response | 153 | 23 | 84.97% | 88.66% | 3.69 |
| fixture-file-tc-prompt (audited) | protected prompt optimization | 151 | 59 | 60.93% | 57.14% | 3.79 |
| fixture-file-tc-source | shadow file comment compaction | 193 | 75 | 61.14% | 62.73% | 1.59 |

生成的结果文件：

- `test/results/token-savings.json`
- `test/results/token-savings.md`

## 兼容性

| 功能 | Claude Code | Gemini CLI | Codex CLI |
|---|---|---|---|
| `SKILL.md` | 原生 skill-style instruction | 可改写进 `GEMINI.md` | 可改写进 system/project prompt |
| Shadow file hook | `PreToolUse` | 需要对应 hook | 需要 wrapper/proxy 支持 |
| Trace compaction | `PostToolUse` | 需要对应 hook | 需要 wrapper/proxy 支持 |
| CLI wrapper | 完整支持 | 可调整 binary target | 可调整 binary target |

## 开发

```bash
npm test
npm run measure:tokens
npm run smoke
```

本项目是 JavaScript-only ESM。测试使用 Node 内置的 `node:test`，并为了 Windows sandbox 兼容性依序执行测试文件。

## 限制

- wrapper 目前优化 prompt-like argv values；interactive stdin optimization 是后续工作。
- MVP 的 shadow restore 采用 fail-closed，避免不安全地覆盖原始中文注释。
- Ollama TC-to-English translation 与 MCP indexing 是未来扩展，不属于当前 MVP。
- proxy tokenizer 是为了可复现实验而建模中文 token overhead；如需账单级验证，请使用导出的 Claude usage logs。
