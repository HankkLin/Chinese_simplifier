# PR 2 — SKILL.md Symptoms List + Quick Reference (RED-GREEN-REFACTOR)

> **For agentic workers:** This is a writing-skills (RED-GREEN-REFACTOR) workflow, NOT a regular implementation plan. Tasks are: design pressure scenarios → run baseline (RED) → write minimal additions (GREEN) → re-run scenarios → close loopholes (REFACTOR). Do not edit `skills/tc-token-optimizer/SKILL.md` body before RED is documented.

**Goal:** Improve `skills/tc-token-optimizer/SKILL.md` discoverability (description) and application correctness (Quick Reference table) without inflating the file beyond its <500-word target.

**Constraint (Iron Law):** No edit to SKILL.md body without first watching agents fail. Every addition must address a documented baseline failure.

---

## Proposed additions (subject to RED outcomes)

1. **Symptoms list in `description` field.** Add concrete keywords agents would search for: "Chinese token bloat", "context fills fast on Chinese files", "Claude verbose in Chinese responses", "TC stack trace eating context window". The current description lists structural triggers (a)/(b)/(c) but no symptom phrases.
2. **Quick Reference table for the output schema.** Map common task shapes (single-file fix, multi-file refactor, bug+stack-trace, fix+explain) to concrete `STATUS / CHANGES / NEXT / ERRORS` field examples, so agents don't have to synthesize the spec on every invocation.

If RED shows agents already handle the scenarios correctly, the addition is YAGNI and gets dropped.

---

## RED scenarios

Four scenarios, two per addition. Run each via a fresh subagent role-playing Claude. The subagent must NOT call tools — only produce the text response Claude would generate.

### R1 — Discovery: symptom-only trigger (description only)

**Tests:** Whether the current description matches a real symptom-driven request that doesn't literally satisfy (a)/(b)/(c).

**Subagent setup:** Provide ONLY the current description string (not the body). Frame as: "You are deciding which of your loaded skills to apply to this user message. Skill descriptions available are listed below. For each one, answer: would you load this skill for the message that follows? Justify in one sentence."

**Decoy descriptions to mix in:**
- `Use when implementing any feature or bugfix, before writing implementation code` (TDD)
- `Use when files contain dead code, unused imports, or commented-out blocks` (cleanup)
- `Use when starting a new TypeScript project from scratch` (scaffolding)

**Real description (current SKILL.md, unedited):**
> Compact, English-first reasoning for Traditional-Chinese coding workflows. Use when (a) the user's prompt contains Traditional Chinese, (b) a stack trace or source file under review contains TC, or (c) the user explicitly asks for short, compact, or low-token responses. SKILL.md alone enforces compact output; full prompt and source-file optimization additionally require the project's Claude Code hooks and the `tc-claude` CLI wrapper.

**User message:**
> I'm working on a backend service where all the API docstrings, error messages, and PR descriptions are in Traditional Chinese. Every time I ask Claude to read a file, my context fills up 3x faster than my teammates on the English-only services, and after a few turns Claude starts confusing two functions whose names happen to look similar in TC. My monthly Anthropic spend is also outpacing theirs by ~2.5x for similar feature throughput. Any ideas?

**Pass criterion:** subagent picks `tc-token-optimizer` and justifies by mapping the symptoms (token bloat, context degradation, function-name confusion) to triggers (b) — stack-trace/file content has TC.

**Likely failure mode:** subagent rejects because the current message body has no TC characters (literal trigger (a) fails) and the symptoms aren't named in the description.

### R2 — Discovery: false-positive risk (description only)

**Tests:** Whether the current description over-matches a "make it shorter" request that has no TC context.

**Subagent setup:** Same as R1 — current description only, decoys included.

**User message:**
> Hey Claude, your responses lately have been way too long. From now on, can you keep things much shorter and more compact? I want to save tokens. I'm working on a Python data pipeline.

**Pass criterion:** subagent does NOT load `tc-token-optimizer` (skill is TC-specific despite trigger (c) literally matching). Acceptable alternative: subagent flags ambiguity ("matches (c) but no TC context — confirm before loading").

**Likely failure mode:** subagent loads it because trigger (c) literally matches, then a downstream Claude session would apply the four-line schema and English-only rule to a Python data-pipeline conversation — wrong context entirely.

### R3 — Application: multi-action task (full SKILL.md)

**Tests:** Whether the current Output Contract is concrete enough for agents to format multi-action tasks correctly.

**Subagent setup:** Provide the FULL current SKILL.md as the authoritative system instruction. Frame as: "You are Claude Code with the SKILL.md below as your primary instruction set. The user just sent the following message. Produce only the response text — do not call any tools."

**User message:**
> 請修正 src/utils/parser.ts 的 parseUser() null check，並把測試從 jest 改成 vitest。修完跑 vitest --run 確認綠燈。

**Pass criteria:** response is exactly the four-line schema. Specifically:
- `STATUS:` is one of `DONE | BLOCKED | CLARIFY` (no other values).
- `CHANGES:` is a single line — comma-separated files OR a one-line diff summary, not a multi-line list.
- `NEXT:` is one short line — not two commands stacked.
- `ERRORS:` is `none` (no exception in the prompt) OR a single line of `<Type>: <msg> @ <file:line>`.
- No prose before or after.
- No echoed TC.

**Likely failure modes:** multi-line CHANGES; NEXT contains both "vitest --run" and "confirm green"; ERRORS phrased as a TODO ("ERRORS: jest refs must be migrated"); unsolicited explanation paragraph.

### R4 — Application: explicit "fix + explain" pressure (full SKILL.md)

**Tests:** Whether the current rules + "When NOT to use" guidance handle the "user wants prose explanation alongside the fix" case.

**Subagent setup:** Same as R3 — full SKILL.md loaded.

**User message:**
> 請修正 src/utils/parser.ts 的 null check 邏輯。順便詳細解釋你改了什麼，以及為什麼這樣改比目前的版本好。

**Pass criterion (judgment):** response either (a) applies the schema and adds a bounded prose block (≤5 bullets per the rule) clearly labelled, OR (b) confirms with the user before breaking the schema. Failing modes: dumps multi-paragraph TC explanation; ignores the user's explicit explanation request; switches entirely to verbose mode without justification.

---

## After RED runs

Synthesize a failure-pattern table from the four results:

| Scenario | Pass / Fail | Verbatim rationalization or failure |
|---|---|---|

If R1 or R2 fail → proposed description-symptoms addition is justified. Write the minimum keyword/symptom additions that fix those specific cases; re-run.

If R3 or R4 fail → proposed Quick Reference is justified. Write the minimum table that fixes those specific cases; re-run.

If a scenario passes baseline → the corresponding addition is YAGNI. Drop it.

---

## GREEN drafting rules (only after RED is documented)

- Stay under 500 words total in SKILL.md (currently ~360 words; budget ~140 words for additions).
- Description: max ~500 chars per writing-skills CSO; current is 482. Any symptom additions must replace or compress existing text.
- Quick Reference: a single table ≤6 rows. No second example block.
- Keep the Iron Law: every addition must trace to a specific failed scenario.

---

## REFACTOR

Re-run all four scenarios with edited SKILL.md. If any scenario regresses (R1/R2 fail differently, R3/R4 schema breaks elsewhere), add a `Common Mistakes` row addressing the new rationalization, re-run.

Stop when all four scenarios pass twice in a row.
