# TC Token Optimizer

[English](../../README.md) | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

TC Token Optimizer 是一个可本地使用的 MVP，目标是降低中文开发者在 coding agent 工作流中的 token 开销。它包含精简输出的 agent skill、Claude Code hooks、CLI wrapper，以及可复现的 token 节省实验。

本项目的来源指南与 handoff 文档说明了为什么需要 wrapper：Claude Code hooks 可以通过 `updatedInput` 修改工具输入，但 `UserPromptSubmit` 目前不能在提示词进入 context 前改写用户 prompt。因此，prompt 优化必须在 `claude` binary 收到 prompt 之前完成。

## 快速开始

```bash
npm install
npm test
npm run measure:tokens
```

直接使用 wrapper：

```bash
npx tc-claude "请修正 `parseUser()` 的错误处理流程"
```

或安装 shell alias：

```bash
bash wrapper/install.sh
```

如果 alias 造成递归调用，请指定真正的 Claude binary：

```bash
export TC_CLAUDE_REAL_BIN=/absolute/path/to/claude
```

## 安装层级

| 层级 | 组件 | 设置方式 | 目的 |
|---|---|---:|---|
| 1 | `SKILL.md` | 复制到 agent skills | 强制精简输出、英文优先推理、降低回复 token。 |
| 2 | `hooks/*.js` | 复制 `.claude/settings.json.example` 并更新路径 | 对中文重度文件建立 shadow read、压缩 trace、保留精简 session state。 |
| 3 | `wrapper/tc-claude.js` | 使用 `tc-claude` 或 shell alias | 在 Claude Code 收到中文 prompt 前先做优化。 |

## Claude Hook 设置

将 `.claude/settings.json.example` 复制到你的 Claude Code 设置，并把 `/path/to/tc-token-optimizer` 改成本项目路径。

MVP 的 hook 行为刻意保守：

- `PreToolUse` 的 `Read` 会针对中文重度文件建立 OS temp shadow file。
- `PostToolUse --mode=trace` 会压缩 JS、Python、Java 类型的 trace。
- `PostToolUse --mode=restore` 在没有安全还原 metadata 时会 fail closed，避免覆盖原始中文注释。
- `PreCompact` 只会根据 payload 中实际存在的字段输出精简 `additionalContext`。

## Token 实验

执行：

```bash
npm run measure:tokens
```

方法：

- 控制组使用原始繁中 prompt、繁中注释较多的 source、冗长 trace、冗长 assistant 回复。
- 变量组使用 wrapper prompt optimizer、shadow-file comment compaction、trace compaction、`SKILL.md` caveman output。
- 实验使用 `src/tokenizer.js` 中的本地 deterministic proxy tokenizer。
- 每个 fixture 都必须至少减少 30% measured tokens 才算通过。

这些是为了可复现性而设计的 proxy measurements。它们证明本项目测试 harness 中的相对压缩效果，不代表精确的 Claude Code 账单或 Anthropic tokenizer 计数。

## 最新记录结果

测量日期：2026-05-01，使用本地 proxy token counting。

| Fixture | Transformation | Control tokens | Variable tokens | Tokens saved | Reduction |
|---|---:|---:|---:|---:|---:|
| tc-prompt | protected prompt optimization | 214 | 26 | 188 | 87.85% |
| tc-source | shadow file comment compaction | 247 | 74 | 173 | 70.04% |
| verbose-trace | trace compaction | 109 | 43 | 66 | 60.55% |
| verbose-response | SKILL.md caveman response | 237 | 21 | 216 | 91.14% |

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
