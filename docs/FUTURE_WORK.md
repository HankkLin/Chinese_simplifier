# Future Work — tc-mirror-variants follow-ups

This document lists deferred work from the tc-mirror-variants implementation
(PRs `feat/tc-mirror-minimal`, `feat/tc-mirror-glyphs`, `feat/tc-mirror-classical`,
`feat/tc-mirror-experiments`, plus the plan PR on `claude/festive-mccarthy-dc2b69`).

Items are grouped by category. Each entry cites its source (which review surfaced
it) so the rationale is traceable. See
[`docs/ADVERSARY_REVIEW_2026-05-14.md`](./ADVERSARY_REVIEW_2026-05-14.md) for the
full evidence behind every Adversary citation.

---

## P0 — Correctness / methodology gaps (do before any public claim is quoted)

### P0-1. Populate the 28 missing expected-output fixtures
- **Source:** Adversary B2, B3.
- **Why:** Only `01-bugfix` has fixtures for 3 of 4 variants (`tc-token-optimizer`
  has zero fixtures across all 8 prompts). The xlsx Summary's "mean savings"
  number is computed over n=1 per variant — essentially meaningless. Either
  populate the remaining 21 (7 prompts × 3 variants) + 8 (tc-token-optimizer
  baseline) fixtures, or downscope every "mean" claim to "1 prompt measured."
- **Effort:** ~2-3h manual translation work.
- **Blockers:** None.

### P0-2. Live-reply measurement harness
- **Source:** Original plan; Adversary m1, M5.
- **Why:** All `expectedOutputTokens` numbers come from hand-written fixtures,
  not live Claude replies. Real Claude replies typically add ~15-30% extra
  tokens (acknowledgements, slightly different phrasing). Reported savings are
  an upper bound, not an observed value. A harness that records actual replies
  closes the gap between intended and actual model output.
- **Effort:** ~3h.
- **Blockers:** Anthropic SDK calls require API keys + network in CI; budget
  needed. The CJK detector also needs verification on real responses
  (`getCjkRatio` threshold of 0.15 was tuned on prompts, not replies).

### P0-3. Anthropic tokenizer instead of cl100k_base
- **Source:** Original plan FUTURE-WORK #2; Adversary M8.
- **Why:** cl100k_base is OpenAI's tokenizer; Anthropic uses a different BPE
  with denser CJK coverage. The DIRECTION of the skew is unknown — if Anthropic
  1-tokenizes both `完成` and `✓`, the glyph swap saves 0; if Anthropic
  1-tokenizes `完成` but 2-tokenizes `✓`, glyphs are strictly WORSE on
  Anthropic than cl100k suggests. The variant ranking could flip. Switch to
  `https://api.anthropic.com/v1/messages/count_tokens` for calibration, or add
  an Anthropic Node binding when one exists.
- **Effort:** ~1h once binding/endpoint plumbing exists.
- **Blockers:** API key + network; today the count-tokens endpoint is
  available but adding it to the measurement script needs a small refactor.

### P0-4. Re-validate the glyph dictionary against cl100k AND Anthropic
- **Source:** Adversary B1.
- **Why:** The fix commit `8101a8a` corrected the dictionary's "1 token per
  glyph" claim, but several glyphs remain net-negative substitutions in
  cl100k (`✓` is 2 tokens replacing 1-token `完成`; `⊕` is 3 tokens replacing
  1-token `新增`). The glyph variant should prune any glyph that isn't
  empirically a win on the target tokenizer. Pair with P0-3 — Anthropic
  tokenizer counts may rehabilitate some glyphs or kill others further.
- **Effort:** ~1h re-encode + prune; another ~1h to refresh worked examples.
- **Blockers:** None for the cl100k pass; Anthropic pass blocked on P0-3.

### P0-5. Glyph-overhead amortization in savings calculation
- **Source:** Adversary M5.
- **Why:** Each variant's SKILL.md is loaded into context per session.
  Measured `skillOverheadTokens`: tc-token-optimizer=720, tc-mirror-minimal=425,
  tc-mirror-glyphs=405, tc-mirror-classical=360. The reported `savingsPct`
  only credits output savings, ignoring this fixed input cost. A variant that
  "saves 75%" on output but adds 405 tokens of overhead doesn't break even
  until ~4-5 turns of output savings. Add an `effective_break_even_turns`
  column to the Summary: `overhead / (baseline_out - variant_out)`.
- **Effort:** ~1h (5-line change in `build-savings-xlsx.py`, mostly column work).
- **Blockers:** None.

---

## P1 — Robustness

### P1-1. Skill-picker disambiguation
- **Source:** Original plan FUTURE-WORK #4; Adversary M1.
- **Why:** All four `description:` fields share "Traditional Chinese + compact
  output" as their literal triggers. M1 enumerates 5 adversarial prompts where
  the wrong variant plausibly wins:
  1. `修一下 src/auth.js:42 的 null check` — tc-token-optimizer may steal what
     should be tc-mirror-minimal.
  2. `用簡潔的方式修一下…` — tc-mirror-classical may steal a casual brevity
     request because "簡潔" is a hard trigger in its description.
  3. `修一下 → src/auth.js` — tc-mirror-glyphs may steal because `→` appears
     in its description as a hallmark glyph.
  4. `請用古文回覆…` — tc-mirror-glyphs may steal because "wants maximum body
     compression" is also a glyph trigger.
  5. `修一下 src/auth.js (中文回覆)` — should hit tc-mirror-minimal, but glyphs
     and classical may activate first.
  Add either (a) a routing doc in `skills/README.md` with disjoint trigger
  rules, or (b) sharper descriptions plus a picker-meta-skill, and turn the
  5 prompts into a regression test.
- **Effort:** ~2h.
- **Blockers:** None.

### P1-2. Investigate classical variant's poor measured performance
- **Source:** Adversary M3, M4.
- **Why:** Classical SKILL.md markets itself as "Most aggressive of the
  tc-mirror-* family", but on the only measured fixture it produces MORE
  tokens than minimal (40 vs 33). Either the example was poorly chosen, the
  classical-style rules don't compress on this prompt class, or the marketing
  claim is wrong. Until populated with more data (P0-1), soften the
  description to "alternative style, not strictly shorter than minimal."
  Similarly, tc-mirror-glyphs claims "~10-20% additional tokens over
  tc-mirror-minimal" but the one measured point shows 9.1% — below the band.
- **Effort:** ~2h once more fixtures land.
- **Blockers:** Depends on P0-1.

### P1-3. ASCII fallback for glyph variant on non-unicode environments
- **Source:** Original plan FUTURE-WORK #3; Adversary m2.
- **Why:** Windows cmd / PowerShell with codepage 437 or 932, Outlook + cp1252,
  some CI log scrubbers, and ASCII-folding pipelines mangle `→ ∵ ⇒ Δ ± ✗ ←`.
  The adversary hit a real cp932 encoding error in their session while
  echoing fixture content. Provide an ASCII fallback table
  (`->`, `[OK]`, `[+]`, `[-]`, `~`, `because:`, `therefore:`) and a
  terminal-capability detection rule.
- **Effort:** ~2h.
- **Blockers:** None.

### P1-4. Harden `stripFrontmatter` in `measure-token-savings.js`
- **Source:** Task 4 code review.
- **Why:** Current implementation uses naive `indexOf('\n---', 3)`. Safe today
  (no SKILL.md has a body-level `---` horizontal rule) but will silently
  corrupt token counts the first time anyone adds one. Replace with a proper
  YAML-front-matter regex: `/^---\r?\n([\s\S]*?)\r?\n---\r?\n/`.
- **Effort:** 10 min.
- **Blockers:** None.

### P1-5. Read VARIANTS from JSON in `build-savings-xlsx.py`
- **Source:** Task 5 code review.
- **Why:** Variants are hardcoded in two places (JS runner + Python builder).
  Adding a 5th variant requires editing both. Read from `data["variants"]`
  in the builder.
- **Effort:** 15 min.
- **Blockers:** None.

### P1-6. Surface skill-overhead on Summary sheet, not just Raw-JSON
- **Source:** Adversary n3.
- **Why:** `skillOverheadTokens` is collected and persisted, but the only
  place a reader sees it is by opening the raw JSON. Surface
  `overhead_tokens` and `effective_break_even_turns` (from P0-5) as columns
  on Summary so trade-offs are visible in one place.
- **Effort:** ~30 min (after P0-5).
- **Blockers:** Pairs with P0-5.

---

## P2 — Polish

### P2-1. Trailing newlines on eval-prompt fixtures
- **Source:** Task 4 code review.
- **Why:** All 8 fixtures in `test/fixtures/eval-prompts/*.txt` lack a trailing
  LF. Most editors silently add one on save, dirtying the working tree.
- **Effort:** 5 min.
- **Blockers:** None.

### P2-2. Extract magic thresholds in xlsx builder
- **Source:** Task 5 code review.
- **Why:** `80`, `50`, `79.999` are inline magic numbers in
  `scripts/build-savings-xlsx.py`. Extract as named constants.
- **Effort:** 5 min.
- **Blockers:** None.

### P2-3. Float-format consistency in v2 JSON
- **Source:** Task 5 code review.
- **Why:** Some `savingsPct` values serialize as `75` (integer) while others
  are `72.5`/`66.7` (floats). Format with `.toFixed(1)` consistently. Cosmetic.
- **Effort:** 5 min.
- **Blockers:** None.

### P2-4. `token-savings.md` v2-format sync
- **Source:** Task 5 implementer note.
- **Why:** A project hook prevented overwriting `test/results/token-savings.md`
  with v2-format content; the file currently shows v1 baseline data only.
  Options: (a) get the hook removed to allow v2 rewrite, (b) write a sibling
  `token-savings.v2.md`, or (c) accept v1 as the "stable baseline" and rely
  on the xlsx for v2 data.
- **Effort:** 30 min (option b).
- **Blockers:** Need to understand why the hook protects the file.

### P2-5. Drop "verified 2026-05-14" stamp from glyph-dictionary.md (or back it with CI)
- **Source:** Adversary n1.
- **Why:** Dated verification stamps age poorly — they invite false trust.
  Either remove the line or replace it with a CI check that re-encodes every
  glyph and fails the build if cl100k token counts drift.
- **Effort:** 5 min (remove) or ~1h (CI check).
- **Blockers:** None.

### P2-6. Factor repeated "ASCII field labels" line into a shared reference
- **Source:** Adversary n2.
- **Why:** "Field labels (STATUS, CHANGES, NEXT, ERRORS) remain English ASCII"
  is repeated in 3 of 4 SKILL.md files. Move to a shared `skills/_shared/`
  reference or to `skills/README.md`.
- **Effort:** 15 min.
- **Blockers:** None.

---

## P3 — Infrastructure

### P3-1. CI workflow for token-savings regression
- **Source:** Original plan FUTURE-WORK #5.
- **Why:** `npm test` runs the v2 measurement on every test run, but there's
  no automated check that opens a PR comment with the per-variant savings
  delta. A GitHub Actions workflow would surface regressions automatically.
- **Effort:** ~2h.
- **Blockers:** None.

### P3-2. Expanded eval corpus
- **Source:** Original plan FUTURE-WORK #6; Adversary m5.
- **Why:** 8 prompts is too small. Missing dimensions called out by the
  adversary:
  - Multi-turn conversations (does Claude retain the skill style across turns?).
  - Sarcasm / rhetorical questions (`你覺得這個 PR 寫得很好嗎？`).
  - Code containing TC-named identifiers (`class 用戶 { ... }`).
  - Pure-EN prompts with embedded CJK fragments below the 0.15 threshold (UI
    test strings, tooltip literals) — the trigger should NOT fire here.
  - Prompts where the variant's own glyphs appear as literal code data (JSX
    `<Arrow direction="→" />`) — the glyph variant must not substitute these.
- **Effort:** ~3h.
- **Blockers:** None.

### P3-3. CSV round-trip test
- **Source:** Adversary m6.
- **Why:** Today's CSV parses cleanly with Python `csv.reader`, but there's
  no test asserting that round-trip. The first fixture containing a comma in
  prompt text would exercise `csvEscape`'s quoting rule and silently regress
  if the rule has a bug. Add a test.
- **Effort:** 30 min.
- **Blockers:** None.

### P3-4. Reproducible build (`SOURCE_DATE_EPOCH`)
- **Source:** Adversary n4.
- **Why:** Two consecutive measurement runs diff only on `measuredAt` ISO
  timestamp. Not a bug, but reproducibility would let us byte-compare runs
  for regression detection. Optional, low value today.
- **Effort:** 15 min.
- **Blockers:** None.

---

## P4 — Semantic correctness (track only)

These are the Minor findings the adversary flagged that aren't broken today
but become real problems the moment a downstream consumer assumes the variant
output is machine-parseable.

### P4-1. Classical variant: tense and subject ambiguity
- **Source:** Adversary m3.
- **Why:** `已修三檔` drops tense and subject — fine for human readers, but a
  log-parsing CI step or a multi-agent handoff can't tell who did the fixing
  or whether it happened. Document this constraint in the classical SKILL.md
  "When NOT to use" section. Also require that file paths be listed verbatim
  (the prose around them can be compacted, but `src/auth.js:42` cannot become
  `三檔`).
- **Effort:** 15 min documentation.

### P4-2. Glyph `✓` collides with `STATUS: DONE` grep
- **Source:** Adversary m4.
- **Why:** The minimal variant emits `STATUS: DONE`; the glyph variant emits
  `STATUS: ✓`. Any downstream `grep STATUS: DONE` regex breaks. Consider
  keeping the STATUS field ASCII even in the glyph variant.
- **Effort:** 15 min.

### P4-3. Cross-variant composition (glyph + classical)
- **Source:** Adversary probe #10.
- **Why:** The classical style guide mentions `∵→` "use if combined with
  glyphs skill — but this skill does not". Composition is anticipated but not
  supported. Today these are four independent skills; combining glyph +
  classical would require either a new fifth-variant skill or a runtime
  composition mechanism. Out of scope; track only.
- **Effort:** unbounded (design dependent).

---

## Tracking

Update this file when items ship. For each shipped item, move it to a
`## Shipped` section at the bottom with the commit SHA + date.

## Shipped

_(empty — populate as P0/P1 items land)_
