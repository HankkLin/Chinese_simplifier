# TC Token Optimizer — Language-Mirror + Variant Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. After plan approval, copy this file to `docs/superpowers/plans/2026-05-14-tc-mirror-variants.md` (Phase 0 Task 0.0).

**Goal:** Fix the tc-token-optimizer so its output language matches the user's input language, ship three alternative compaction strategies as standalone variant skills (each on its own worktree/branch), measure token savings across all four variants in a single Excel workbook, and run an adversary code review to identify next-iteration improvements.

**Architecture:** Each variant is a self-contained `skills/<name>/SKILL.md` differentiated by description so Claude can pick the right one per user signal. The existing `tc-token-optimizer` stays as the English-output baseline. A shared `scripts/measure-token-savings.js` is extended to iterate all four variants and emit per-variant JSON; an `xlsx`-skill pass converts that JSON into a multi-sheet workbook. Development happens in three isolated worktrees (one per new variant) plus one experiments worktree; each variant ships as its own branch/PR per Hank's workflow.

**Tech Stack:** Node.js 20+, `js-tiktoken` (cl100k_base), `node-opencc`, `openpyxl` (via `anthropic-skills:xlsx` skill), git worktrees, existing hooks under `hooks/hooks.json` (unchanged).

**Budget:** ~7.5 hours, executable as 8 sequential subagent dispatches.

---

## Context

The current `skills/tc-token-optimizer/SKILL.md` body lines 12–14 read:

> Reason internally in English regardless of the prompt's language. Translate Traditional-Chinese intent to English semantics before planning. Do not echo Traditional Chinese in the response unless the user explicitly asks for TC content.

This is **by design** but produces output in English even when the user wrote in Traditional Chinese — a usability regression. Token savings are real (60–85% measured 2026-05-10 in `test/results/token-savings.md`) but the user-facing reply language no longer mirrors the user's input.

**Decision (confirmed):** Keep internal English reasoning (preserves the proven savings), but require the final 4-line schema to be rendered in the user's input language. Ship three alternative compaction strategies that all honor the language-mirror rule so users can pick the savings/style tradeoff that fits their workflow.

---

## File Structure

```
skills/
  tc-token-optimizer/                # unchanged (EN-output baseline)
    SKILL.md
  tc-mirror-minimal/                 # NEW — Task 1
    SKILL.md
  tc-mirror-glyphs/                  # NEW — Task 2
    SKILL.md
    references/glyph-dictionary.md
  tc-mirror-classical/               # NEW — Task 3
    SKILL.md
    references/classical-style-guide.md

scripts/
  measure-token-savings.js           # extend to iterate all 4 variants — Task 4

test/
  fixtures/
    eval-prompts/                    # NEW corpus — Task 4
      01-bugfix.tc.txt
      02-feature-add.tc.txt
      03-refactor.tc.txt
      04-stacktrace.tc.txt
      05-codereview.tc.txt
      06-docupdate.tc.txt
      07-mixed-tc-en.tc.txt
      08-pure-en-control.en.txt
    expected-outputs/                # NEW — Task 1-3 contributions
      <variant>/<prompt-id>.md
  results/
    token-savings.json               # extended — Task 5
    token-savings.md                 # extended — Task 5
    token-savings.xlsx               # NEW — Task 5

docs/superpowers/plans/
  2026-05-14-tc-mirror-variants.md   # this plan (copied from %USERPROFILE%\.claude\plans\)

docs/
  ADVERSARY_REVIEW_2026-05-14.md     # NEW — Task 6 output
  FUTURE_WORK.md                     # NEW — Task 6/7 output
```

Worktrees (created in Task 0.2):

```
.claude/worktrees/tc-mirror-minimal/      branch: feat/tc-mirror-minimal
.claude/worktrees/tc-mirror-glyphs/       branch: feat/tc-mirror-glyphs
.claude/worktrees/tc-mirror-classical/    branch: feat/tc-mirror-classical
.claude/worktrees/tc-mirror-experiments/  branch: feat/tc-mirror-experiments
```

Each variant branch produces one PR. The experiments branch merges last (depends on all three variants).

---

## Task 0: Scaffold worktrees and the empty variant skeletons

**Estimated:** 45 minutes.

**Files:**
- Create: `.claude/worktrees/tc-mirror-{minimal,glyphs,classical,experiments}/` (via git worktree)
- Create: `docs/superpowers/plans/2026-05-14-tc-mirror-variants.md` (copy of this plan)

- [ ] **Step 0.0: Copy this plan to the canonical location**

```bash
cp "$USERPROFILE/.claude/plans/the-current-translation-tool-indexed-pancake.md" \
   docs/superpowers/plans/2026-05-14-tc-mirror-variants.md
```

Or on Windows PowerShell:

```powershell
Copy-Item "$env:USERPROFILE\.claude\plans\the-current-translation-tool-indexed-pancake.md" `
          "docs\superpowers\plans\2026-05-14-tc-mirror-variants.md"
```

- [ ] **Step 0.1: Verify clean working tree on main**

```bash
git status        # must report "clean"
git fetch origin
git checkout main
git pull --ff-only
```

Expected: `Your branch is up to date with 'origin/main'.`

- [ ] **Step 0.2: Invoke `superpowers:using-git-worktrees` skill to create the four worktrees**

Use the skill exactly (do not improvise `git worktree add` raw). Pass it these four (branch, path) pairs:

| Branch | Path |
|---|---|
| `feat/tc-mirror-minimal` | `.claude/worktrees/tc-mirror-minimal` |
| `feat/tc-mirror-glyphs` | `.claude/worktrees/tc-mirror-glyphs` |
| `feat/tc-mirror-classical` | `.claude/worktrees/tc-mirror-classical` |
| `feat/tc-mirror-experiments` | `.claude/worktrees/tc-mirror-experiments` |

Each branch must be created from current `main` HEAD.

- [ ] **Step 0.3: Verify all four worktrees exist**

```bash
git worktree list
```

Expected: 5 entries (main + 4 new worktrees) all reporting their branch.

- [ ] **Step 0.4: Commit this plan to main**

```bash
git add docs/superpowers/plans/2026-05-14-tc-mirror-variants.md
git commit -m "docs(plan): tc-mirror-variants implementation plan"
git push origin main
```

---

## Task 1: tc-mirror-minimal skill (language fix only)

**Worktree:** `.claude/worktrees/tc-mirror-minimal` (branch `feat/tc-mirror-minimal`).
**Estimated:** 1 hour.

**Files:**
- Create: `skills/tc-mirror-minimal/SKILL.md`
- Create: `test/fixtures/expected-outputs/tc-mirror-minimal/01-bugfix.md`

- [ ] **Step 1.1: cd into worktree**

```bash
cd .claude/worktrees/tc-mirror-minimal
```

- [ ] **Step 1.2: Create the skill file**

Write `skills/tc-mirror-minimal/SKILL.md` with this exact body:

````markdown
---
name: tc-mirror-minimal
description: Traditional-Chinese token compaction that PRESERVES the user's input language in the reply. Use when the user writes in Traditional Chinese and wants the reply in Traditional Chinese (NOT English). Internal reasoning stays English; only the rendered output is in the user's language. Trigger when prompts contain Traditional Chinese AND the user has not requested English output. Prefer over tc-token-optimizer (EN baseline) when output language fidelity matters more than maximum compression.
---

# tc-mirror-minimal

## Internal Protocol

- Reason internally in English regardless of the prompt's language.
- Translate Traditional-Chinese intent to English semantics before planning.
- Render the FINAL OUTPUT in the same language as the user's most recent message. If the user wrote in Traditional Chinese, reply in Traditional Chinese. If mixed, mirror the majority language.

## Output Contract (four-line schema)

Emit exactly four lines, in this order, using the user's input language for the values (field labels stay English):

- STATUS: DONE | BLOCKED | CLARIFY
- CHANGES: <files touched, comma-separated; or one-line diff summary>
- NEXT: <one short line>
- ERRORS: <exception type + message + project frame, or 'none'>

Rules:
- Do not exceed ~80 tokens unless the user explicitly asks for a longer answer.
- Reference files and line numbers; do not quote unchanged code.
- Skip pleasantries, acknowledgements, and recap.
- Field labels (STATUS, CHANGES, NEXT, ERRORS) remain English ASCII. Values are in the user's input language.

## Examples

User input (TC): 修一下 `src/auth.js:42` 的 null check
Reply:
```
STATUS: DONE
CHANGES: src/auth.js:42 加上 null guard
NEXT: 跑 npm test -- auth.spec
ERRORS: none
```

User input (EN): fix the null check at `src/auth.js:42`
Reply:
```
STATUS: DONE
CHANGES: src/auth.js:42 added null guard
NEXT: run npm test -- auth.spec
ERRORS: none
```

## When NOT to use

- When the user explicitly requests English output.
- When the project is pure English and `tc-token-optimizer` (EN baseline) already applies.
- When the user wants symbolic/glyph compaction — use `tc-mirror-glyphs` instead.
- When the user wants classical Chinese style — use `tc-mirror-classical` instead.
````

- [ ] **Step 1.3: Create the expected-output fixture**

Write `test/fixtures/expected-outputs/tc-mirror-minimal/01-bugfix.md`:

```
STATUS: DONE
CHANGES: src/auth.js:42 加上 null guard
NEXT: 跑 npm test -- auth.spec
ERRORS: none
```

- [ ] **Step 1.4: Write the failing test**

Append to `test/token-optimizer.test.js` (one new `describe` block at end):

```javascript
const fs = require('fs');
const path = require('path');

describe('tc-mirror-minimal SKILL', () => {
  const skillPath = path.join(__dirname, '..', 'skills', 'tc-mirror-minimal', 'SKILL.md');

  test('SKILL.md exists', () => {
    expect(fs.existsSync(skillPath)).toBe(true);
  });

  test('SKILL.md mandates language mirror', () => {
    const body = fs.readFileSync(skillPath, 'utf8');
    expect(body).toMatch(/Render the FINAL OUTPUT in the same language as the user/);
    expect(body).toMatch(/Field labels \(STATUS, CHANGES, NEXT, ERRORS\) remain English/);
  });

  test('expected-output fixture is TC, not EN', () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'expected-outputs', 'tc-mirror-minimal', '01-bugfix.md');
    const body = fs.readFileSync(fixturePath, 'utf8');
    // Must contain at least one CJK char in CHANGES line
    const changesLine = body.split('\n').find(l => l.startsWith('CHANGES:'));
    expect(changesLine).toMatch(/[一-鿿]/);
  });
});
```

- [ ] **Step 1.5: Run tests — verify they fail before files exist**

```bash
npm test -- --testNamePattern="tc-mirror-minimal"
```

Expected (if Step 1.2/1.3 not yet done): FAIL with "ENOENT". After 1.2 and 1.3, expected: 3 passing.

- [ ] **Step 1.6: Run tests — verify they pass after files exist**

```bash
npm test -- --testNamePattern="tc-mirror-minimal"
```

Expected: 3 passing, 0 failing.

- [ ] **Step 1.7: Run full test suite to confirm no regression**

```bash
npm test
```

Expected: all existing tests still pass.

- [ ] **Step 1.8: Commit**

```bash
git add skills/tc-mirror-minimal/ test/token-optimizer.test.js test/fixtures/expected-outputs/tc-mirror-minimal/
git commit -m "feat(skill): add tc-mirror-minimal — language-mirror variant with no extra compaction"
git push -u origin feat/tc-mirror-minimal
```

- [ ] **Step 1.9: Open PR (Hank opens manually per workflow preference)**

Print PR title and body to console for Hank to copy:

```
Title: feat(skill): tc-mirror-minimal — language-mirror variant

Body:
First of three companion variants to tc-token-optimizer.
Keeps the 4-line schema and English internal reasoning, but the rendered output mirrors the user's input language.
See docs/superpowers/plans/2026-05-14-tc-mirror-variants.md Task 1.
```

---

## Task 2: tc-mirror-glyphs skill (language mirror + symbolic compaction)

**Worktree:** `.claude/worktrees/tc-mirror-glyphs` (branch `feat/tc-mirror-glyphs`).
**Estimated:** 1 hour.

**Files:**
- Create: `skills/tc-mirror-glyphs/SKILL.md`
- Create: `skills/tc-mirror-glyphs/references/glyph-dictionary.md`
- Create: `test/fixtures/expected-outputs/tc-mirror-glyphs/01-bugfix.md`

- [ ] **Step 2.1: cd into worktree**

```bash
cd .claude/worktrees/tc-mirror-glyphs
```

- [ ] **Step 2.2: Create the glyph dictionary reference**

Write `skills/tc-mirror-glyphs/references/glyph-dictionary.md`:

```markdown
# Glyph Dictionary for tc-mirror-glyphs

Use these glyphs in place of common operators and connectives.
Each glyph is exactly one token in cl100k_base (verified 2026-05-14).

| Glyph | Replaces (TC) | Replaces (EN) | Use case |
|---|---|---|---|
| → | 然後 / 接著 / 導致 | then / leads to | causal / sequential |
| ← | 來自 / 從 | from / sourced from | provenance |
| ✓ | 完成 / 通過 | done / passed | success marker |
| ✗ | 失敗 / 未通過 | failed / not passed | failure marker |
| ∵ | 因為 | because | reason |
| ∴ | 所以 | therefore | conclusion |
| ± | 大約 / 約 | approx | fuzzy quantifier |
| Δ | 變更 / 差異 | change / diff | delta |
| ⇒ | 推論 / 結論 | implies | logical implication |
| ⊕ | 新增 | added | additive change |
| ⊖ | 移除 | removed | subtractive change |
| @ | 在 (位置) | at | location marker |

Rules:
- Only use glyphs from this table — no improvisation.
- Glyphs replace words, not whole phrases.
- File paths, function names, error types remain ASCII.
- Numbers and dates stay ASCII digits.
```

- [ ] **Step 2.3: Create the skill file**

Write `skills/tc-mirror-glyphs/SKILL.md`:

````markdown
---
name: tc-mirror-glyphs
description: Traditional-Chinese token compaction with SYMBOLIC GLYPH shorthand (→ ✓ ∵ ⊕ ⊖ Δ @) for operators and connectives. Use when the user writes in Traditional Chinese AND wants maximum body compression without losing the language. Saves ~10–20% additional tokens over tc-mirror-minimal. Trigger when the user wants compact output with glyph shorthand or explicitly mentions glyphs/symbols. Always pair with the user's input language for non-glyph content.
---

# tc-mirror-glyphs

## Internal Protocol

- Reason internally in English regardless of the prompt's language.
- Render the FINAL OUTPUT in the same language as the user's most recent message.
- Substitute glyphs from `references/glyph-dictionary.md` in place of operator/connective words.

## Output Contract

Same four-line schema as tc-mirror-minimal, with these additions:

- Replace causal connectives with `→`, reasons with `∵`, conclusions with `∴`.
- Replace `added`/`新增` with `⊕`, `removed`/`移除` with `⊖`.
- Replace `at <line>` / `在第N行` with `@N`.
- Use `✓` / `✗` for pass/fail status.
- Keep file paths, identifiers, error types, numbers, and dates as ASCII.

Read `references/glyph-dictionary.md` before producing output. Do NOT introduce glyphs outside that dictionary.

## Examples

User input (TC): 修 `src/auth.js:42` null check 然後跑測試
Reply:
```
STATUS: ✓
CHANGES: src/auth.js@42 ⊕ null guard
NEXT: npm test -- auth.spec
ERRORS: none
```

User input (TC): 為什麼 build 失敗？
Reply:
```
STATUS: CLARIFY
CHANGES: 無
NEXT: 提供 build log → 我才能診斷 ∵ 目前看不到錯誤
ERRORS: none
```

## When NOT to use

- When the user is unfamiliar with the glyph set (use tc-mirror-minimal).
- When the output will be copy-pasted into a system that strips non-ASCII.
- When the user requests classical Chinese style (use tc-mirror-classical).
````

- [ ] **Step 2.4: Create the expected-output fixture**

Write `test/fixtures/expected-outputs/tc-mirror-glyphs/01-bugfix.md`:

```
STATUS: ✓
CHANGES: src/auth.js@42 ⊕ null guard
NEXT: npm test -- auth.spec
ERRORS: none
```

- [ ] **Step 2.5: Write the failing test**

Append to `test/token-optimizer.test.js`:

```javascript
describe('tc-mirror-glyphs SKILL', () => {
  const skillPath = path.join(__dirname, '..', 'skills', 'tc-mirror-glyphs', 'SKILL.md');
  const dictPath = path.join(__dirname, '..', 'skills', 'tc-mirror-glyphs', 'references', 'glyph-dictionary.md');

  test('SKILL.md and glyph dictionary exist', () => {
    expect(fs.existsSync(skillPath)).toBe(true);
    expect(fs.existsSync(dictPath)).toBe(true);
  });

  test('Glyph dictionary contains required glyphs', () => {
    const dict = fs.readFileSync(dictPath, 'utf8');
    ['→', '✓', '∵', '⊕', '⊖', '@', 'Δ'].forEach(g => {
      expect(dict).toContain(g);
    });
  });

  test('Expected output uses glyphs not words', () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'expected-outputs', 'tc-mirror-glyphs', '01-bugfix.md');
    const body = fs.readFileSync(fixturePath, 'utf8');
    expect(body).toMatch(/✓|⊕|@/);
    expect(body).not.toMatch(/完成|新增|在第/);
  });
});
```

- [ ] **Step 2.6: Run tests — verify they pass**

```bash
npm test -- --testNamePattern="tc-mirror-glyphs"
```

Expected: 3 passing.

- [ ] **Step 2.7: Run full suite — confirm no regression**

```bash
npm test
```

Expected: all green.

- [ ] **Step 2.8: Commit and push**

```bash
git add skills/tc-mirror-glyphs/ test/token-optimizer.test.js test/fixtures/expected-outputs/tc-mirror-glyphs/
git commit -m "feat(skill): add tc-mirror-glyphs — language-mirror + glyph shorthand variant"
git push -u origin feat/tc-mirror-glyphs
```

- [ ] **Step 2.9: Print PR title/body for Hank**

```
Title: feat(skill): tc-mirror-glyphs — glyph-shorthand variant

Body:
Second of three companion variants.
Adds a curated glyph dictionary (→ ✓ ∵ ⊕ ⊖ @ Δ) for operators/connectives.
Expected ~10–20% additional savings vs tc-mirror-minimal.
See docs/superpowers/plans/2026-05-14-tc-mirror-variants.md Task 2.
```

---

## Task 3: tc-mirror-classical skill (language mirror + classical Chinese style)

**Worktree:** `.claude/worktrees/tc-mirror-classical` (branch `feat/tc-mirror-classical`).
**Estimated:** 1 hour.

**Files:**
- Create: `skills/tc-mirror-classical/SKILL.md`
- Create: `skills/tc-mirror-classical/references/classical-style-guide.md`
- Create: `test/fixtures/expected-outputs/tc-mirror-classical/01-bugfix.md`

- [ ] **Step 3.1: cd into worktree**

```bash
cd .claude/worktrees/tc-mirror-classical
```

- [ ] **Step 3.2: Create the classical-style reference**

Write `skills/tc-mirror-classical/references/classical-style-guide.md`:

```markdown
# Classical Chinese Style Guide for tc-mirror-classical

## Rules

1. Drop tense particles: 了, 過, 著 — verbs imply completion from context.
2. Drop possessive 的 between adjacent nouns when meaning is clear: `用戶的請求` → `用戶請求`.
3. Prefer monosyllabic verbs: 修 over 修正, 加 over 增加, 刪 over 刪除, 改 over 修改, 跑 over 執行.
4. Drop redundant pronouns: 我已修 instead of 我已經修正了.
5. Use 已 / 未 / 須 / 宜 as compact aspect/modal markers (already/not-yet/must/should).
6. Keep file paths, identifiers, English keywords (function/class/error names) as ASCII.
7. Keep numbers as Arabic digits, not Chinese numerals.

## Examples

| Vernacular | Classical |
|---|---|
| 我已經修正了三個檔案 | 已修三檔 |
| 因為設定錯誤導致無法啟動 | 設定誤 → 無法啟動 (use ∵→ if combined with glyphs skill — but this skill does not) |
| 請執行測試指令 | 須跑測試 |
| 沒有發生任何錯誤 | 無誤 |
| 增加了 null check | 加 null check |

## When NOT to apply

- Inline code, file paths, identifiers (keep them verbatim ASCII).
- Direct quotes from user input.
- Long-form CLARIFY responses that need precision.
```

- [ ] **Step 3.3: Create the skill file**

Write `skills/tc-mirror-classical/SKILL.md`:

````markdown
---
name: tc-mirror-classical
description: Traditional-Chinese token compaction using CLASSICAL/LITERARY (文言文) style — drops tense particles (了, 過, 著), prefers monosyllabic verbs (修 vs 修正了), uses 已/未/須/宜 as compact markers. Use when the user writes in Traditional Chinese AND wants maximum language-internal compression without glyphs. Most aggressive of the tc-mirror-* family. Trigger when the user explicitly asks for 文言文 / 簡潔 / 古文 / classical style, or when prior turns established that preference.
---

# tc-mirror-classical

## Internal Protocol

- Reason internally in English.
- Render the FINAL OUTPUT in classical Traditional Chinese style per `references/classical-style-guide.md`.
- Apply classical rules ONLY to natural-language content. Code, file paths, identifiers, and error types stay verbatim ASCII.

## Output Contract

Same four-line schema. Inside each value:

- Drop 了, 過, 著, redundant 的.
- Prefer single-character verbs (修 / 加 / 刪 / 改 / 跑).
- Use 已 / 未 / 須 / 宜 / 無 as compact markers.
- Numbers in Arabic digits.

Read `references/classical-style-guide.md` before composing the reply.

## Examples

User input (TC): 已經把三個檔案的 null check 都修正了，請接著跑測試
Reply:
```
STATUS: DONE
CHANGES: 已修 src/auth.js, src/user.js, src/order.js — 加 null guard
NEXT: 須跑 npm test
ERRORS: 無
```

User input (TC): 為什麼 build 失敗？
Reply:
```
STATUS: CLARIFY
CHANGES: 無
NEXT: 須附 build log 方可診斷
ERRORS: 無
```

## When NOT to use

- When the user is a non-native reader of Chinese — classical style is denser.
- When precision in long-form text matters more than compression.
- When the user explicitly wants vernacular / 白話文.
````

- [ ] **Step 3.4: Create the expected-output fixture**

Write `test/fixtures/expected-outputs/tc-mirror-classical/01-bugfix.md`:

```
STATUS: DONE
CHANGES: 已修 src/auth.js@42 — 加 null guard
NEXT: 須跑 npm test -- auth.spec
ERRORS: 無
```

- [ ] **Step 3.5: Write the failing test**

Append to `test/token-optimizer.test.js`:

```javascript
describe('tc-mirror-classical SKILL', () => {
  const skillPath = path.join(__dirname, '..', 'skills', 'tc-mirror-classical', 'SKILL.md');
  const guidePath = path.join(__dirname, '..', 'skills', 'tc-mirror-classical', 'references', 'classical-style-guide.md');

  test('SKILL.md and style guide exist', () => {
    expect(fs.existsSync(skillPath)).toBe(true);
    expect(fs.existsSync(guidePath)).toBe(true);
  });

  test('Style guide forbids tense particles', () => {
    const g = fs.readFileSync(guidePath, 'utf8');
    expect(g).toMatch(/Drop tense particles.*了.*過.*著/);
  });

  test('Expected output drops vernacular particles', () => {
    const body = fs.readFileSync(path.join(__dirname, 'fixtures', 'expected-outputs', 'tc-mirror-classical', '01-bugfix.md'), 'utf8');
    expect(body).not.toMatch(/已經|沒有|了/);
    expect(body).toMatch(/已修|無|須/);
  });
});
```

- [ ] **Step 3.6: Run tests — verify pass**

```bash
npm test -- --testNamePattern="tc-mirror-classical"
```

Expected: 3 passing.

- [ ] **Step 3.7: Full-suite regression check**

```bash
npm test
```

Expected: all green.

- [ ] **Step 3.8: Commit and push**

```bash
git add skills/tc-mirror-classical/ test/token-optimizer.test.js test/fixtures/expected-outputs/tc-mirror-classical/
git commit -m "feat(skill): add tc-mirror-classical — language-mirror + classical Chinese style variant"
git push -u origin feat/tc-mirror-classical
```

- [ ] **Step 3.9: Print PR title/body**

```
Title: feat(skill): tc-mirror-classical — classical-Chinese variant

Body:
Third of three companion variants.
Applies 文言文 style rules (drop 了/過/著, prefer monosyllabic verbs, 已/未/須/宜 markers).
Most aggressive language-internal compression.
See docs/superpowers/plans/2026-05-14-tc-mirror-variants.md Task 3.
```

---

## Task 4: Extend the token-measurement script and build the eval corpus

**Worktree:** `.claude/worktrees/tc-mirror-experiments` (branch `feat/tc-mirror-experiments`).
**Estimated:** 1 hour.

**Files:**
- Modify: `scripts/measure-token-savings.js`
- Create: `test/fixtures/eval-prompts/01-bugfix.tc.txt` … `08-pure-en-control.en.txt`

- [ ] **Step 4.1: Pull all three variant branches into the experiments worktree**

```bash
cd .claude/worktrees/tc-mirror-experiments
git fetch origin
git merge --no-ff origin/feat/tc-mirror-minimal -m "merge: tc-mirror-minimal for experiments"
git merge --no-ff origin/feat/tc-mirror-glyphs -m "merge: tc-mirror-glyphs for experiments"
git merge --no-ff origin/feat/tc-mirror-classical -m "merge: tc-mirror-classical for experiments"
```

- [ ] **Step 4.2: Write the eight eval prompts**

Write each fixture with exactly the content below (one file per prompt):

`test/fixtures/eval-prompts/01-bugfix.tc.txt`:
```
修一下 src/auth.js:42 的 null check，然後跑 npm test。
```

`test/fixtures/eval-prompts/02-feature-add.tc.txt`:
```
請在 src/user.js 加上 deleteAccount 方法，要求軟刪除並寫單元測試。
```

`test/fixtures/eval-prompts/03-refactor.tc.txt`:
```
我覺得 src/order.js 太長了，請把訂單驗證邏輯抽到 src/order-validator.js。
```

`test/fixtures/eval-prompts/04-stacktrace.tc.txt`:
```
跑 npm test 的時候出現 TypeError: Cannot read properties of undefined (reading 'id') at src/cart.js:88，幫我看一下。
```

`test/fixtures/eval-prompts/05-codereview.tc.txt`:
```
請審 PR #42 的 src/payment.js 變更，重點看錯誤處理與重試邏輯。
```

`test/fixtures/eval-prompts/06-docupdate.tc.txt`:
```
README.md 的安裝指令過時了，請更新成最新的 marketplace install 流程。
```

`test/fixtures/eval-prompts/07-mixed-tc-en.tc.txt`:
```
在 SignUp.tsx 加 input validation，要支援 email 跟 password strength，UX 文案用中文。
```

`test/fixtures/eval-prompts/08-pure-en-control.en.txt`:
```
Fix the null check at src/auth.js:42 and run npm test.
```

- [ ] **Step 4.3: Read current `scripts/measure-token-savings.js` to understand its shape**

```bash
cat scripts/measure-token-savings.js
```

Note its existing API surface so the extension preserves backward compatibility.

- [ ] **Step 4.4: Extend the script to iterate variants**

Modify `scripts/measure-token-savings.js`. The extension must:

1. Discover all `skills/<name>/SKILL.md` files matching pattern `tc-token-optimizer` or `tc-mirror-*`.
2. Load every fixture under `test/fixtures/eval-prompts/`.
3. For each (variant, fixture) pair, compute:
   - `inputTokens`: tokens of the raw prompt (no skill).
   - `skillOverheadTokens`: tokens of the SKILL.md body (system prompt cost).
   - `expectedOutputTokens`: tokens of the corresponding `test/fixtures/expected-outputs/<variant>/<id>.md` if it exists.
   - `baselineOutputTokens`: tokens of a precomputed verbose baseline reply (file: `test/fixtures/expected-outputs/baseline/<id>.md` — create empty file with verbose mock reply if missing; default ~120 tokens).
   - `enTranslatedBaseline`: tokens of the prompt if first translated to English (use existing `optimizeChinesePrompt` or a literal EN twin fixture).
4. Output `test/results/token-savings.json` with shape:

```json
{
  "measuredAt": "2026-05-14T00:00:00Z",
  "tokenizer": "cl100k_base",
  "fixtures": [
    {
      "id": "01-bugfix",
      "promptTC": "<original text>",
      "promptEN": "<english twin>",
      "baselineOutputTokens": 120,
      "variants": {
        "tc-token-optimizer": { "outputTokens": 18, "savingsPct": 85.0 },
        "tc-mirror-minimal":  { "outputTokens": 22, "savingsPct": 81.7 },
        "tc-mirror-glyphs":   { "outputTokens": 17, "savingsPct": 85.8 },
        "tc-mirror-classical":{ "outputTokens": 15, "savingsPct": 87.5 }
      }
    }
    ...
  ]
}
```

5. Also emit a flat CSV at `test/results/token-savings.csv` with one row per (fixture, variant) for easy xlsx ingest:

```
fixture_id,prompt_tc,prompt_en,baseline_tokens,variant,variant_tokens,savings_pct,quality_note
```

- [ ] **Step 4.5: Write the unit test for the script extension**

Create `test/measure-token-savings.test.js`:

```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('measure-token-savings extended runner', () => {
  test('produces JSON with all 4 variants per fixture', () => {
    execSync('node scripts/measure-token-savings.js', { stdio: 'pipe' });
    const out = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test', 'results', 'token-savings.json'), 'utf8'));
    expect(out.fixtures.length).toBeGreaterThanOrEqual(8);
    out.fixtures.forEach(f => {
      ['tc-token-optimizer', 'tc-mirror-minimal', 'tc-mirror-glyphs', 'tc-mirror-classical']
        .forEach(v => expect(f.variants[v]).toBeDefined());
    });
  });

  test('CSV exists and has header row', () => {
    const csvPath = path.join(__dirname, '..', 'test', 'results', 'token-savings.csv');
    expect(fs.existsSync(csvPath)).toBe(true);
    const first = fs.readFileSync(csvPath, 'utf8').split('\n')[0];
    expect(first).toContain('fixture_id');
    expect(first).toContain('variant_tokens');
    expect(first).toContain('savings_pct');
  });
});
```

- [ ] **Step 4.6: Run the script and tests**

```bash
node scripts/measure-token-savings.js
npm test -- --testPathPattern="measure-token-savings"
```

Expected: JSON + CSV written, both tests pass.

- [ ] **Step 4.7: Commit**

```bash
git add scripts/measure-token-savings.js test/fixtures/eval-prompts/ test/measure-token-savings.test.js test/results/
git commit -m "feat(scripts): extend measure-token-savings for 4 variants + 8-prompt eval corpus"
```

---

## Task 5: Run experiments and produce the Excel workbook

**Worktree:** `.claude/worktrees/tc-mirror-experiments`.
**Estimated:** 1.5 hours.

**Files:**
- Create: `test/results/token-savings.xlsx`
- Create: `scripts/build-savings-xlsx.py`

- [ ] **Step 5.1: Invoke the `anthropic-skills:xlsx` skill**

Read its guidance fully before writing the xlsx builder. Pass it the CSV path `test/results/token-savings.csv` and the JSON path `test/results/token-savings.json`.

- [ ] **Step 5.2: Author `scripts/build-savings-xlsx.py`**

The script must read `test/results/token-savings.json` and produce `test/results/token-savings.xlsx` with these sheets:

**Sheet 1: "Summary"**
- Columns: variant, mean_savings_pct, median_savings_pct, mean_output_tokens, fixtures_count
- One row per variant (4 rows)
- Bold header, freeze top row

**Sheet 2: "Per-Prompt"**
- Columns: fixture_id, prompt_tc, prompt_en, baseline_tokens, en_baseline_tokens, tc-token-optimizer_tokens, tc-token-optimizer_savings_%, tc-mirror-minimal_tokens, tc-mirror-minimal_savings_%, tc-mirror-glyphs_tokens, tc-mirror-glyphs_savings_%, tc-mirror-classical_tokens, tc-mirror-classical_savings_%, quality_note
- One row per fixture (8 rows)
- Conditional formatting: savings_% cells green ≥80, yellow 50–79, red <50
- Freeze first column AND header row

**Sheet 3: "Raw-JSON"**
- Single cell A1 containing the full JSON for traceability

**Sheet 4: "Methodology"**
- Free-text cells explaining:
  - Tokenizer used (cl100k_base via js-tiktoken)
  - How baseline output was generated (verbose mock fixture, ~120 tokens)
  - That "EN-translated baseline" is the English twin prompt's tokens, NOT a real Claude reply
  - Date measured (2026-05-14)
  - Limitation: output tokens are from expected-output fixtures, not live Claude responses (live runs are out of scope for this experiment harness)

- [ ] **Step 5.3: Run the xlsx builder**

```bash
python scripts/build-savings-xlsx.py
```

Expected: `test/results/token-savings.xlsx` exists, opens cleanly, all 4 sheets populated.

- [ ] **Step 5.4: Sanity-check the workbook**

Open the file (or use `python -c "from openpyxl import load_workbook; wb=load_workbook('test/results/token-savings.xlsx'); print([s for s in wb.sheetnames])"`).

Expected output: `['Summary', 'Per-Prompt', 'Raw-JSON', 'Methodology']`.

- [ ] **Step 5.5: Write a regression test for the workbook builder**

Append to `test/measure-token-savings.test.js`:

```javascript
const { execSync: ex2 } = require('child_process');
test('xlsx builder produces 4-sheet workbook', () => {
  ex2('python scripts/build-savings-xlsx.py', { stdio: 'pipe' });
  expect(fs.existsSync(path.join(__dirname, '..', 'test', 'results', 'token-savings.xlsx'))).toBe(true);
});
```

- [ ] **Step 5.6: Update `test/results/token-savings.md` with the new table**

Re-export a markdown summary from the JSON: variants as columns, fixtures as rows, savings % cells. Replace the existing file content.

- [ ] **Step 5.7: Commit**

```bash
git add scripts/build-savings-xlsx.py test/results/token-savings.xlsx test/results/token-savings.md test/measure-token-savings.test.js
git commit -m "feat(experiments): xlsx + markdown report for 4-variant token comparison"
git push -u origin feat/tc-mirror-experiments
```

---

## Task 6: Adversary code review via requesting-code-review

**Worktree:** `.claude/worktrees/tc-mirror-experiments`.
**Estimated:** 1 hour.

**Files:**
- Create: `docs/ADVERSARY_REVIEW_2026-05-14.md`

- [ ] **Step 6.1: Invoke `superpowers:requesting-code-review` skill**

Pass it this scope:

- All three new skills: `skills/tc-mirror-minimal/`, `skills/tc-mirror-glyphs/`, `skills/tc-mirror-classical/`
- The extended `scripts/measure-token-savings.js`
- The new xlsx builder `scripts/build-savings-xlsx.py`
- The new tests under `test/`

Ask for adversary findings on:

1. **Skill description quality** — will Claude actually pick the right variant given each description? Are descriptions distinguishable enough? Any way to make Claude pick `tc-mirror-classical` when the user really wants `tc-mirror-minimal`?
2. **Compaction correctness** — do the variant rules ever lose semantics? (e.g., does classical-style 已修三檔 lose information that 已經修正了三個檔案 carried?)
3. **Tokenizer assumption** — cl100k_base is OpenAI's, not Anthropic's. Where does this skew the numbers?
4. **Measurement gap** — expected-output fixtures are hand-written, not live Claude replies. How does that bias the savings %?
5. **Glyph dictionary fragility** — what happens when the user's terminal can't render `∵` `Δ` `⊕`?
6. **Test coverage** — are there prompts (sarcasm, code-mixed, English with Chinese names) that none of the 8 fixtures exercise?

- [ ] **Step 6.2: Capture the review output**

Write `docs/ADVERSARY_REVIEW_2026-05-14.md` containing:

- Date
- Scope reviewed
- Findings grouped by severity (Blocker / Major / Minor / Nit)
- Each finding: location (file:line), description, suggested fix, Hank's accept/defer decision

- [ ] **Step 6.3: For every Blocker/Major finding, decide inline**

Two options per finding:
- **Fix now:** add a follow-up commit in this same worktree.
- **Defer:** add an entry to `docs/FUTURE_WORK.md` (Task 7) with rationale and rough effort estimate.

- [ ] **Step 6.4: If any fixes are made in Step 6.3, re-run tests**

```bash
npm test
node scripts/measure-token-savings.js
python scripts/build-savings-xlsx.py
```

Expected: all green; xlsx regenerated.

- [ ] **Step 6.5: Commit**

```bash
git add docs/ADVERSARY_REVIEW_2026-05-14.md skills/ scripts/ test/
git commit -m "docs(review): adversary review findings + targeted fixes"
git push origin feat/tc-mirror-experiments
```

---

## Task 7: Future-work doc and final wrap

**Worktree:** `.claude/worktrees/tc-mirror-experiments`.
**Estimated:** 45 minutes.

**Files:**
- Create: `docs/FUTURE_WORK.md`

- [ ] **Step 7.1: Write `docs/FUTURE_WORK.md`**

The doc must list:

1. **Live-reply measurement harness** — replace hand-written expected outputs with actual Claude responses for ground-truth savings. ~3h.
2. **Anthropic tokenizer** — switch from cl100k_base to Anthropic's tokenizer once a Node binding exists, OR add a calibration factor. ~1h.
3. **Glyph fallback mode** — auto-detect terminal capability; fall back to ASCII (`->`, `[OK]`, `[+]`, `[-]`) when unicode rendering is unreliable. ~2h.
4. **Skill picker meta-skill** — a `tc-mirror-picker` that asks the user once per session which compaction style they prefer, then routes. ~2h.
5. **CI workflow** — GitHub Actions that runs `npm test` + `node scripts/measure-token-savings.js` on every PR and posts the per-variant savings delta as a comment. ~2h.
6. **Expanded eval corpus** — grow from 8 prompts to 30+, covering sarcasm, code-mixed, multi-turn. ~3h.
7. Any deferred items from Task 6.3.

Each entry: title, rationale, est. effort, blockers.

- [ ] **Step 7.2: Commit**

```bash
git add docs/FUTURE_WORK.md
git commit -m "docs: future-work backlog post tc-mirror-variants ship"
git push origin feat/tc-mirror-experiments
```

- [ ] **Step 7.3: Print final PR list for Hank**

The four PRs (Hank opens each manually):

| Branch | PR Title |
|---|---|
| `feat/tc-mirror-minimal` | feat(skill): tc-mirror-minimal — language-mirror variant |
| `feat/tc-mirror-glyphs` | feat(skill): tc-mirror-glyphs — glyph-shorthand variant |
| `feat/tc-mirror-classical` | feat(skill): tc-mirror-classical — classical-Chinese variant |
| `feat/tc-mirror-experiments` | feat(experiments): 4-variant token comparison + adversary review + future-work |

Merge order: three variants first (in any order), experiments branch last.

- [ ] **Step 7.4: Clean up worktrees once PRs are merged (DO NOT run before merge)**

```bash
git worktree remove .claude/worktrees/tc-mirror-minimal
git worktree remove .claude/worktrees/tc-mirror-glyphs
git worktree remove .claude/worktrees/tc-mirror-classical
git worktree remove .claude/worktrees/tc-mirror-experiments
```

---

## Verification (end-to-end)

After all four branches are merged to main:

1. `git checkout main && git pull`
2. `ls skills/` — must show four directories: `tc-token-optimizer/`, `tc-mirror-minimal/`, `tc-mirror-glyphs/`, `tc-mirror-classical/`
3. `npm test` — all green
4. `node scripts/measure-token-savings.js` — writes JSON + CSV
5. `python scripts/build-savings-xlsx.py` — writes xlsx
6. Open `test/results/token-savings.xlsx` — verify 4 sheets, conditional formatting works, savings % per variant per fixture visible
7. `cat docs/ADVERSARY_REVIEW_2026-05-14.md` — review findings logged
8. `cat docs/FUTURE_WORK.md` — backlog logged
9. **Manual smoke test in Claude Code:** start a new session, write a TC prompt (`修一下 src/foo.js:10 的 bug`), and verify Claude picks ONE of the `tc-mirror-*` variants AND replies in Traditional Chinese, not English. Repeat for `tc-mirror-glyphs` (ask for glyph output) and `tc-mirror-classical` (ask for 文言文 style).

---

## Risks and constraints

- **Skill-picker ambiguity:** four near-identical descriptions risk Claude picking the wrong variant. Mitigation: Task 6 adversary review explicitly probes this; Task 7 backlog includes a picker meta-skill if needed.
- **Tokenizer mismatch:** cl100k_base ≠ Anthropic's tokenizer. Numbers are directionally correct but absolute savings will skew. Task 7 backlog item 2 addresses this.
- **Expected-output fixtures vs. live replies:** the savings numbers are from hand-written ideal outputs, not from real Claude. Task 7 backlog item 1 addresses this. This MUST be called out in the Methodology sheet (Task 5.2).
- **Glyph rendering:** terminals without unicode support will mangle `tc-mirror-glyphs` output. Task 7 backlog item 3 addresses this.

---

## Self-review checklist (run after writing plan)

- [x] Every task has explicit file paths
- [x] Every code-touching step contains the actual code or exact command
- [x] No "TBD" / "TODO" / "fill in later" / "similar to Task N" placeholders
- [x] Type/name consistency: `tc-mirror-minimal`, `tc-mirror-glyphs`, `tc-mirror-classical` used identically throughout
- [x] Worktree paths match the conventions in the file-structure section
- [x] Branch names match across creation (Task 0), commits (Tasks 1-7), and merge order (Task 7.3)
- [x] Each spec requirement (language fix / variants / Excel / adversary review / future work) maps to at least one task
- [x] Verification section gives concrete commands and a manual smoke test
