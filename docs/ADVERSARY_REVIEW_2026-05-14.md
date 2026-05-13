# Adversary Review — tc-mirror-variants

**Reviewer:** anonymous adversary subagent
**Date:** 2026-05-14
**Scope:** `feat/tc-mirror-experiments` at `e33f635` (includes `tc-mirror-minimal`, `tc-mirror-glyphs`, `tc-mirror-classical` merges + measurement extension + xlsx report).

The goal of this review is to find failure modes, not bless the work. Findings are graded **Blocker / Major / Minor / Nit** by impact on (a) correctness of the reported results, (b) safety of selecting the right variant in production, and (c) clarity of the claims the branch is making.

## Findings

### Blockers

#### B1. Glyph dictionary's "1 token per glyph" claim is empirically FALSE

- **Location:** `skills/tc-mirror-glyphs/references/glyph-dictionary.md:4` ("Each glyph is exactly one token in cl100k_base (verified 2026-05-14).")
- **Description:** Empirical check with `js-tiktoken` cl100k_base (the same library the measurement uses) shows only 4 of 12 glyphs are 1 token. The rest are 2-3 tokens each:

  | Glyph | Claimed | Actual cl100k tokens |
  |---|---|---|
  | → | 1 | 1 ✓ |
  | ← | 1 | 1 ✓ |
  | ✓ | 1 | **2** |
  | ✗ | 1 | **2** |
  | ∵ | 1 | **2** |
  | ∴ | 1 | **2** |
  | ± | 1 | 1 ✓ |
  | Δ | 1 | **2** |
  | ⇒ | 1 | **3** |
  | ⊕ | 1 | **3** |
  | ⊖ | 1 | **3** |
  | @ | 1 | 1 ✓ |

  Eight of twelve glyphs are mis-stated, including the marquee `✓`/`⊕`/`⊖` that appear in nearly every example. This invalidates the dictionary's central design assumption.

- **Why this is a blocker:** The reasoning for the glyphs variant ("substitute multi-character TC words with single-token glyphs to save tokens") is wrong for the majority of the dictionary. For several common substitutions the swap is **net negative**:

  | Substitution | TC tokens | Glyph tokens | Net |
  |---|---|---|---|
  | 完成 → ✓ | 1 | 2 | **-1 (worse)** |
  | 新增 → ⊕ | 1 | 3 | **-2 (worse)** |
  | 移除 → ⊖ | 2 | 3 | **-1 (worse)** |
  | 所以 → ∴ | 2 | 2 | 0 (no win) |
  | 因為 → ∵ | 4 | 2 | +2 |
  | 在第42行 → @42 | 4 | 2 | +2 |

  The branch as merged is shipping a glyph variant that, on its own dictionary, sometimes increases token cost. This MUST be retested or the dictionary pruned to glyphs that empirically win before any savings claim is made.

- **Verification:** `node -e` against `js-tiktoken` cl100k_base encoding.
- **Suggested fix:** (a) Re-encode every glyph in cl100k and rewrite the table with actual token counts. (b) Remove or replace glyphs that are net-negative substitutes (`✓`, `⊕`, `⊖`, `∴`, `Δ`). (c) Strike the "verified 2026-05-14" line or replace with a CI step that fails if the claim drifts. (d) Re-run measure-token-savings after pruning and update the reported savings.

#### B2. 7 of 8 eval prompts have no expected-output fixtures — reported savings cover 1 prompt only

- **Location:** `test/fixtures/expected-outputs/` (only `01-bugfix.md` exists per variant; 02-08 are missing entirely) and `test/results/token-savings.v2.csv` (28 of 32 cells have null `variant_tokens`/`savings_pct`).
- **Description:** The branch advertises an "8-prompt corpus" extension (commit `37c0ed3`'s "8-prompt corpus"). In reality, only one prompt (`01-bugfix`) has measured outputs across three of four variants. The corpus is 12.5% populated. The other 7 prompts produce nothing but null cells in CSV, JSON, and xlsx.
- **Why this is a blocker:** Any "ranking" of variants drawn from this data is a single-sample comparison. The xlsx Summary sheet computes `mean_savings_pct` over a sample of size 1, which is essentially meaningless. A reader of the xlsx is invited to draw conclusions from a single observation.
- **Verification:** `find test/fixtures/expected-outputs -type f` returns exactly 3 files (one per variant for 01-bugfix); inspection of `token-savings.v2.json` confirms every other prompt has `expectedOutputTokens: null`.
- **Suggested fix:** Either (a) author the remaining 21 expected outputs (7 prompts × 3 variants — and 8 prompts × 1 variant for tc-token-optimizer, see B3), or (b) reduce the corpus claim in the README/methodology to "1 measured prompt, 7 placeholders" and label the xlsx Summary as "preview only — sample size 1".

#### B3. tc-token-optimizer (the EN baseline) has ZERO expected outputs — the comparison is not 4-way

- **Location:** `test/fixtures/expected-outputs/` lacks a `tc-token-optimizer/` directory entirely.
- **Description:** The whole point of the experiments branch is to compare the three new variants against the existing EN baseline. But the EN baseline has no expected output for ANY of the 8 prompts. Its savings columns are all null across the entire CSV/JSON. The "4-variant comparison" is in practice a 3-variant comparison with the baseline missing.
- **Why this is a blocker:** Without a fixture for the EN baseline, there is no measurement of the cost (or savings) of the new variants RELATIVE TO the existing skill. The constant-120 baseline is a placeholder, not a control. Any reader looking at the xlsx Summary will see "tc-token-optimizer: n/a, n/a" next to "tc-mirror-glyphs: mean 75%" and mistake n/a for "no savings" — when the truth is "not measured".
- **Suggested fix:** Author an expected output for tc-token-optimizer on at least 01-bugfix. The EN reply for that prompt is even given in the existing SKILL.md ("worked example"), so this is a small task.

### Major

#### M1. Skill-picker ambiguity — 4 skills all match "TC + compact"

- **Location:** All four `SKILL.md` frontmatter `description:` lines.
- **Description:** Reading the four descriptions:
  - `tc-token-optimizer`: "Compact, English-first reasoning for Traditional-Chinese coding workflows. Use when (a) the user's prompt contains Traditional Chinese..."
  - `tc-mirror-minimal`: "Traditional-Chinese token compaction that PRESERVES the user's input language in the reply. Use when the user writes in Traditional Chinese..."
  - `tc-mirror-glyphs`: "Traditional-Chinese token compaction with SYMBOLIC GLYPH shorthand..."
  - `tc-mirror-classical`: "Traditional-Chinese token compaction using CLASSICAL/LITERARY (文言文) style..."

  All four share the literal triggers "Traditional Chinese" + "compact"/"compaction". The only differentiators are: (1) minimal says "Prefer over tc-token-optimizer when language fidelity matters" — this is a soft preference encoded in natural language, not a deterministic gate. (2) glyphs requires "explicitly mentions glyphs/symbols". (3) classical requires "explicitly asks for 文言文 / 簡潔 / 古文 / classical style".

- **Adversarial prompts where the picker can go wrong:**
  1. `修一下 src/auth.js:42 的 null check` (plain TC bugfix request) — should hit `tc-mirror-minimal` (TC reply preserves language). High risk of `tc-token-optimizer` winning the picker because its description literally says "Use when the user's prompt contains Traditional Chinese" and is shorter/older. Result: EN reply when user wanted TC.
  2. `用簡潔的方式修一下 src/auth.js` — user said "簡潔" (concise). `tc-mirror-classical` description includes "簡潔" as a trigger. But user likely meant "be brief", not "use classical Chinese". Result: literary 文言文 reply for a casual request.
  3. `修一下 → src/auth.js` (user happens to type `→` in their prompt) — `tc-mirror-glyphs` description mentions `→` as a hallmark glyph. Picker may misread this as the user asking for the glyph variant. Result: cryptic glyph reply for a normal TC prompt.
  4. `請用古文回覆，修一下 src/auth.js` — should clearly hit `tc-mirror-classical`. But `tc-mirror-glyphs` ALSO says "wants maximum body compression" and could plausibly match a Chinese reader's notion of 古文 == "compact". Picker may pick glyphs by accident.
  5. `修一下 src/auth.js (中文回覆)` — explicit TC reply requested. Should hit `tc-mirror-minimal` (the most general TC-mirror variant). High risk of glyphs or classical activating instead because their descriptions are more specifically about "TC + compact".

- **Why major (not blocker):** The skills do not currently document an explicit precedence rule that a human user (or a downstream model) can read and follow. Pre-merge, this means in practice the user is responsible for naming the desired variant. If a future skill ranks descriptions by cosine similarity to the prompt embedding, the four overlapping descriptions are a footgun.
- **Suggested fix:** Add a top-level routing table in `skills/README.md` (or in a `skills/_routing.md`) that documents disjoint trigger conditions, e.g.:
  - Default = tc-token-optimizer (EN reply, max compression)
  - If user requests TC reply explicitly → tc-mirror-minimal
  - …and the existing classical/glyphs requirements ALSO require explicit user opt-in
  Also: tighten the descriptions to make "explicitly mentions X" a hard rule, not a soft hint.

#### M2. Classical example fixture leaks a glyph (`@`) from the wrong variant

- **Location:** `test/fixtures/expected-outputs/tc-mirror-classical/01-bugfix.md:2`
  ```
  CHANGES: 已修 src/auth.js@42 — 加 null guard
  ```
- **Description:** The classical-style guide (`references/classical-style-guide.md`) never authorizes `@` as a location marker; that's a glyph variant convention. The classical SKILL.md examples use Chinese phrasing like `已修三檔` without `@`. The hand-written fixture cross-contaminates the two variants.
- **Why major:** This is a hand-written fixture used as ground truth for token measurement AND for the test `tc-mirror-classical SKILL: expected output drops vernacular particles`. A reader copying the fixture as the canonical classical-style output will be misled.
- **Suggested fix:** Replace `src/auth.js@42` with `src/auth.js:42` in the classical fixture. Re-run measurement.

#### M3. Classical variant disproved by its own measurement — "most aggressive" but produces MORE tokens than minimal

- **Location:** `test/results/token-savings.v2.json:34-38` (01-bugfix data) and `skills/tc-mirror-classical/SKILL.md:3` ("Most aggressive of the tc-mirror-* family.").
- **Description:** Measured 01-bugfix tokens:
  - tc-mirror-minimal: 33 tokens (72.5% savings)
  - tc-mirror-glyphs: 30 tokens (75% savings)
  - tc-mirror-classical: 40 tokens (66.7% savings) ← worst
- The classical SKILL frontmatter explicitly markets itself as "Most aggressive of the tc-mirror-* family" and "maximum language-internal compression". The single data point we have contradicts this directly. (Note: the classical fixture is also 6 chars longer than minimal because it adds `已修`, `須`, `無` markers and an em-dash — those are extra characters, not savings.)
- **Why major:** The marketing claim in the description is a direct trigger for the skill picker. A user who reads "most aggressive" will route to classical and get the worst result of the three.
- **Suggested fix:** Either (a) author a classical fixture that is genuinely shorter than minimal — e.g. drop the em-dash and the explicit `已修` marker prefix; or (b) soften the description to "alternative style, not strictly shorter than minimal".

#### M4. Glyph variant savings claim "~10-20% additional tokens over tc-mirror-minimal" overstates the single data point

- **Location:** `skills/tc-mirror-glyphs/SKILL.md:3` ("Saves ~10–20% additional tokens over tc-mirror-minimal.")
- **Description:** The one fixture we have: minimal=33, glyphs=30. Marginal savings = (33-30)/33 = 9.1%, below the bottom of the claimed band. And per B1, several glyphs are net-negative in cl100k. The "10-20%" claim is unfounded.
- **Suggested fix:** Either measure additional fixtures or change wording to "may save a few tokens vs minimal for prompts dominated by location/causal markers; for others, neutral or slightly worse."

#### M5. tc-token-optimizer's `skillOverheadTokens` (720) nearly 2× the other variants

- **Location:** `test/results/token-savings.v2.json` — every fixture row shows `tc-token-optimizer.skillOverheadTokens: 720` vs `tc-mirror-minimal: 425`, `tc-mirror-glyphs: 405`, `tc-mirror-classical: 360`.
- **Description:** The SKILL.md body for the EN baseline is about 2× the size of the new variants. When a session loads tc-token-optimizer, you pay 720 tokens of system-prompt overhead REGARDLESS of how many turns. The variants pay 360-425. The reported `savingsPct` ignores this entirely — it only compares output tokens to baseline 120.
- **Why major:** A skill that "saves 75%" on output but adds 405 tokens of system overhead breaks even only after ~12 turns of saving (405 / (120-30) ≈ 4.5 turns). For one-shot prompts, the overhead dominates. This deserves at least a footnote in the Methodology sheet — it's mentioned in the "Limitations" row only obliquely.
- **Suggested fix:** Add an `effective_break_even_turns` column to the Summary: `overhead / (baseline_out - variant_out)`. Make the trade-off explicit. (This was probe #9 in the brief — the answer is "no, the comparison is not fair, and the overhead delta between variants is real and large.")

#### M6. Dangling references to `FUTURE_WORK.md` (file does not exist)

- **Location:** Referenced in `scripts/measure-token-savings.js:41`, `scripts/build-savings-xlsx.py:190`, and the JSON `methodology` field. The file does not exist in the repo.
- **Description:** All three call out "real Claude-reply measurements deferred to FUTURE_WORK.md" but no such file is committed. A reader who tries to look up the deferred work has nowhere to go.
- **Suggested fix:** Create `FUTURE_WORK.md` (in the worktree root, or under `docs/`) and seed it with: (a) live-reply measurement, (b) Anthropic tokenizer migration, (c) glyph dictionary re-validation per B1, (d) populate remaining 7 prompts per B2. OR remove the references and inline the deferral inside the methodology.

#### M7. Dangling reference to the variants implementation plan

- **Location:** `scripts/build-savings-xlsx.py:195` Methodology sheet writes "Plan reference: docs/superpowers/plans/2026-05-14-tc-mirror-variants.md".
- **Description:** `docs/superpowers/plans/` contains only `2026-05-10-pr1-plugin-restructure.md` and `2026-05-11-pr2-skill-symptoms-quickref.md`. The referenced plan is not committed.
- **Suggested fix:** Either commit the plan file or remove the reference.

#### M8. Tokenizer skew (cl100k vs Anthropic) is acknowledged but the direction of the bias is undisclosed

- **Location:** `scripts/measure-token-savings.js:41-42` and Methodology sheet "Tokenizer" row.
- **Description:** The branch correctly notes cl100k is OpenAI's, not Anthropic's. But it doesn't quantify or even direction-flag the skew. Anthropic's tokenizer (Claude's BPE) is known publicly to tokenize CJK somewhat differently — its CJK coverage is dense, with many 1-token assignments to common Chinese words. If Anthropic 1-tokenizes `完成` AND `✓`, then the glyph swap saves 0 (matching the cl100k story). But if Anthropic 1-tokenizes `完成` and 2-tokenizes `✓`, glyphs are STRICTLY worse on Anthropic than cl100k suggests. Without measurement, the direction is unknown.
- **Why major (not blocker):** The branch ships numbers and a ranking. If the tokenizer skew is reversed, the ranking flips. The risk is large and unmeasured.
- **Suggested fix:** Add a calibration step: feed the same fixtures through `https://api.anthropic.com/v1/messages/count_tokens` (Claude API has a tokenizer-count endpoint) and report deltas. Until that lands, brand the savings numbers as "cl100k-only, directional" everywhere they appear.

### Minor

#### m1. Hand-written fixtures != live Claude replies (probe #4)

The expected-output fixtures are aspirational, not observed. Real Claude (even with the skill loaded) typically adds a brief acknowledgement, or splits the changes line across two lines, or names tools slightly differently. Realistic delta between hand-written and live is ~15-30% extra tokens in the live case (based on prior tc-token-optimizer measurements in this repo's history). The reported savings should be marked as an upper bound. The Methodology sheet does flag this in the Limitations row — credit there — but the headline numbers on Summary and Per-Prompt don't carry the warning.

#### m2. Glyph rendering fragility on legacy environments (probe #5)

`✓ ∵ ∴ Δ ⊕ ⊖ ⇒` will mojibake or display as boxes on:
- Windows cmd / PowerShell with codepage 437 or 932 (we hit a cp932 encoding error on this very session when echoing fixture content)
- email clients using Outlook + cp1252
- Slack code blocks render correctly but `@N` may auto-link to a user
- CI log scrubbers that ASCII-fold

The SKILL.md "When NOT to use" section mentions "system that strips non-ASCII" but doesn't offer a fallback. Suggest: add an ASCII-fallback table (`->`, `[OK]`, `[+]`, `[-]`, `~`, `because:`, `therefore:`) so the skill can degrade gracefully when the user signals an ASCII-only environment.

#### m3. Compaction semantic loss in classical variant (probe #2)

- Tense: classical drops `了`. `已修三檔` reads "have fixed three files" but a reader from a tense-strict context (English speaker translating back) may read "fix three files (imperative)" or "fixed three files (descriptive)". Whether this is a real bug depends on whether the user reads the four-line reply or downstream tooling does. For human-only audiences: tolerable. For programmatic consumers: ambiguous.
- Subject: classical drops pronouns. `你修我審` (you fix, I review) is fine because both subjects are present; but `已修三檔` is silent about who fixed them — Claude or the user? In multi-agent contexts this matters.
- Number identifiability: `已修三檔` says "fixed three files" but doesn't say which three. The minimal variant's example lists explicit paths `src/auth.js, src/user.js, src/order.js`. Classical's example does too (the fixture lists three paths). But the SKILL guide's example `已修三檔` does not. The style guide should clarify that file paths MUST be listed verbatim and only the prose around them is compacted.

#### m4. Glyph `✓` collides with Markdown checkbox semantics (probe #2)

`STATUS: ✓` is visually distinct from Markdown `- [x]` but downstream log parsers/CI bots often treat `✓` interchangeably with "done"/"DONE"/"OK". A CI step that greps `STATUS: DONE` will not match `STATUS: ✓`. The minimal variant emits `STATUS: DONE`; the glyph variant breaks that grep. Consider whether the STATUS field should remain ASCII even in the glyph variant.

#### m5. Test coverage gaps (probe #6)

The 8-prompt corpus exercises bugfix / feature-add / refactor / stacktrace / codereview / docupdate / mixed-tc-en / pure-en. Not exercised:
- Multi-turn conversations (does Claude retain the skill style across turns?)
- Sarcasm / rhetorical questions (`你覺得這個 PR 寫得很好嗎？` — does the 4-line schema still apply?)
- TC-named identifiers in code (`class 用戶 { ... }`) — should the skill leave them verbatim?
- Pure-EN with embedded CJK (e.g. UI test that contains a tooltip string `"請輸入密碼"`) — does the trigger fire? The current CJK detector requires `getCjkRatio > 0.15`; a single 5-char tooltip in a 500-char EN prompt would not trip it. Worth a fixture.
- Prompts containing the skill's own glyphs in CODE (JSX flow `<Arrow direction="→" />`) — does the glyph variant accidentally replace the code character?

#### m6. CSV escape probe (probe #7) — clean, but tightly coupled

Examined `04-stacktrace` row in `token-savings.v2.csv`. Field 2 contains `TypeError: Cannot read properties of undefined (reading 'id') at src/cart.js:88` (colons, parens, apostrophe). Python's stdlib `csv.reader` parses it as 8 fields correctly — the row is unquoted because none of its characters trigger `csvEscape`'s quoting rule (`,`, `"`, `\n`). Excel and pandas also accept it. NOT a bug today. However: a future fixture containing a comma in prompt text would be quoted; one containing both a comma and an embedded `"` would also be quoted. Coverage gap: there is no test that asserts CSV round-trip correctness.

### Nits

#### n1. The "verified 2026-05-14" line in glyph-dictionary.md ages poorly

Suggest replacing with a CI check that fails the build if `js-tiktoken` cl100k token counts drift.

#### n2. "Field labels (STATUS, CHANGES, NEXT, ERRORS) remain English ASCII" is repeated in 3 of 4 SKILL.md files

This is fine but worth factoring into a shared reference.

#### n3. The Methodology sheet says "tc-token-optimizer: skillOverheadTokens: 720" but the user never sees that — it's in Raw-JSON only

Surface the overhead on the Summary sheet next to mean_savings_pct so a reader can weigh trade-offs in one place. The build script already collects it; it's a 5-line change.

#### n4. JSON `measuredAt` non-determinism (probe #8)

Verified: two consecutive runs produce JSON that differs ONLY in the `measuredAt` ISO timestamp. Documented expectation. No bug. Could be made deterministic by reading `SOURCE_DATE_EPOCH` env var if reproducibility ever matters.

## Probes Tried

1. **Skill-picker ambiguity:** Read all four `description:` fields. All share "TC + compact". Constructed 5 adversarial prompts (see M1) where the wrong variant is plausible. Verdict: real risk, deserves a routing doc.
2. **Compaction correctness:** Walked through classical drop-rules and glyph substitutions. Found tense ambiguity (`已修` doesn't distinguish past from imperative for downstream tools), subject elision risk, and the `✓ != DONE` semantic mismatch for log parsers. Verdict: documented as Minor — not a blocker for human readers, but a footgun for programmatic consumers.
3. **Tokenizer skew:** Confirmed measurement uses cl100k_base. Did not call Anthropic's count-tokens endpoint; flagged as an unmeasured risk in M8. Verdict: deserves a calibration pass before claims are quoted publicly.
4. **Measurement gap — fixtures vs live replies:** Inspected each `01-bugfix.md` fixture. They are short, idealized, four-line forms. Real Claude replies typically run 10-30% longer. Verdict: marked Minor (m1) because Methodology sheet does flag it, but headline numbers don't carry the warning.
5. **Glyph rendering fragility:** Hit cp932 encoding errors during my own session when echoing fixture content — concrete evidence the glyphs do break on legacy Windows shells. Verdict: needs an ASCII fallback table (m2).
6. **Test coverage gaps:** Enumerated 5 prompt patterns not covered (multi-turn, sarcasm, TC identifiers, embedded CJK, glyph-in-code). Verdict: Minor coverage gap (m5).
7. **CSV escaping:** Parsed the CSV with Python's stdlib `csv.reader`. The 04-stacktrace row parses cleanly into 8 fields because none of its characters require quoting under the script's rule. Verdict: clean today; coverage gap on round-trip noted in m6.
8. **Build determinism:** Ran `node scripts/measure-token-savings.js` twice. Diff = single line, `measuredAt`. As expected. Verdict: nit only.
9. **Skill-overhead double-counting:** Inspected `skillOverheadTokens` per variant. tc-token-optimizer is 720, others 360-425. Reported savings exclude overhead entirely. Verdict: Major (M5) — the comparison framing is incomplete.
10. **Cross-variant interaction:** The glyph SKILL.md mentions classical only in "When NOT to use"; the classical style guide says "use ∵→ if combined with glyphs skill — but this skill does not". So composition is *anticipated* but not supported. Today they're four independent skills; combining glyph+classical would require either a new fourth-variant skill or runtime composition. Verdict: out of scope for this branch; track as FUTURE_WORK.

## Recommended Defer-to-FUTURE_WORK Items

1. **Glyph dictionary re-validation against Anthropic's tokenizer** — once a count-tokens binding lands, re-encode every glyph and prune any net-negative ones from both cl100k AND Anthropic.
2. **Live-reply measurement** — replace hand-written expected-output fixtures with actual Claude replies (one shot per prompt × variant), so the savings numbers are calibrated to real behavior rather than aspirational behavior.
3. **Skill-picker routing doc + tightening descriptions** — make trigger conditions disjoint at the natural-language level, OR introduce a runtime hint (e.g. a manifest with `priority:` and explicit `requires_explicit_mention_of:` fields). Track adversarial picker test cases (the 5 prompts in M1).
4. **Populate the other 7 prompts × 4 variants = 28 expected-output fixtures** so the Summary mean is meaningful.
5. **Effective break-even analysis** — add a column to the Summary that reports `skillOverhead / (baseline - mean_output)` so readers see how many turns it takes for each variant to repay its prompt-injection cost.
6. **ASCII fallback set for tc-mirror-glyphs** for environments that strip unicode.
7. **Tests for adversarial picker cases** — once a routing mechanism exists, add tests that the right skill activates for each of the 5 prompts in M1.

---

**Summary verdict:** This branch should NOT be merged to main in its current form. B1 (glyph dictionary lies about its own token counts) and B2 (only 1 of 8 prompts is actually measured) together mean the headline "saves 75% on glyphs" claim is unfounded. The work shows good methodological hygiene around acknowledging limitations (the Methodology sheet is honest), but the data does not yet support the variant rankings the xlsx implies. Fix B1 and B2 first, then re-rank.
