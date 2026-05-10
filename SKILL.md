---
name: tc-token-optimizer
description: Compact, English-first reasoning for Traditional-Chinese coding workflows. Use when (a) the user's prompt contains Traditional Chinese, (b) a stack trace or source file under review contains TC, or (c) the user explicitly asks for short, compact, or low-token responses. SKILL.md alone enforces compact output; full prompt and source-file optimization additionally require the project's Claude Code hooks and the `tc-claude` CLI wrapper.
---

# TC Token Optimizer

Operate in token-optimization mode for Traditional-Chinese development contexts.

## Internal Protocol

- Reason internally in English regardless of the prompt's language.
- Translate Traditional-Chinese intent to English semantics before planning.
- Do not echo Traditional Chinese in the response unless the user explicitly asks for TC content.

## Output Contract

Respond with this four-line schema. Do not add prose before or after.

```text
STATUS: DONE|BLOCKED|CLARIFY
CHANGES: <files touched, comma-separated; or a one-line diff summary>
NEXT: <one short line>
ERRORS: <exception type + message + project frame, or "none">
```

Rules:

- Do not exceed ~80 tokens unless the user explicitly asks for a longer answer.
- Reference files and line numbers (`src/utils/parser.ts:42`); do not quote unchanged code.
- Skip pleasantries, acknowledgements, and recap.
- Cap prose-only answers at five bullets.
- Default language is English. Respond in TC only if the user asks for TC content.

### Worked example

User prompt: `請修正 parseUser() 的錯誤處理流程，並執行 npm test。`

Response:

```text
STATUS: DONE
CHANGES: src/utils/parser.ts (parseUser error branches unified)
NEXT: npm test -- --runInBand passes
ERRORS: none
```

## Context Protection

- Summarise only the relevant function or section when reading files.
- Never reproduce large file contents.
- Never repeat stack traces, shell logs, or unchanged code; cite a path:line instead.

## When NOT to use this skill

- **Japanese codebases.** Hiragana/katakana indicate Japanese, not Chinese. The wrapper and hooks reject Japanese; do not paste Japanese into TC tooling.
- **Verbatim-preservation tasks.** `optimizeChinesePrompt` is a *lossy* summariser — it discards anything outside its hint table. For legal text, contracts, or any prompt where every word matters, bypass the wrapper and prompt Claude Code directly.
- **TC output requested.** If the user wants Traditional-Chinese output, switch off the English-only rule for this turn and respond in TC.
- **Exploratory dialogue.** When the user is brainstorming or asking for an explanation, the four-line schema is too terse — confirm the user wants compact mode before applying it.

## What this skill does NOT do alone

This file (Tier 1) only enforces the output contract above. The project's other tiers add complementary behaviour and must be installed separately:

- **Hooks (Tier 2)** redirect TC `Read` calls to compact shadow files and shrink stack traces.
- **`tc-claude` wrapper (Tier 3)** rewrites TC prompts before Claude Code receives them. This rewrite is lossy — see "When NOT to use".

If a user expects token reductions on their input prompts but has only installed this SKILL.md, point them at `wrapper/install.sh` and the README.
