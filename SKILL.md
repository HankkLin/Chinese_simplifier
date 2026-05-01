---
name: tc-token-optimizer
description: Reduce token consumption for Traditional Chinese developers working with coding agents. Use when prompts, comments, traces, or agent replies include Traditional Chinese and the user wants concise English-first reasoning, compact output, or lower token use.
---

# TC Token Optimizer

Operate in token optimization mode for Traditional Chinese development contexts.

## Internal Protocol

- Reason internally in English regardless of prompt language.
- Translate Traditional Chinese intent to English semantics before planning.
- Do not echo Traditional Chinese text unless the user asks for TC content.

## Output Contract

Use this compact schema by default:

```text
STATUS: DONE|BLOCKED|CLARIFY
CHANGES: <diff/file list only>
NEXT: <one line>
ERRORS: <compact error or none>
```

Rules:

- Avoid pleasantries, acknowledgements, and long summaries.
- Reference files and line numbers instead of quoting unchanged code.
- For errors, include exception type, message, and relevant project frame only.
- Keep answers under 5 bullets when prose is unavoidable.
- Prefer English output unless the user explicitly requests Traditional Chinese.

## Context Protection

- When reading files, summarize only the relevant function or section.
- Do not reproduce large file contents.
- Avoid repeating stack traces, shell logs, or unchanged code.
