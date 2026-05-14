#!/usr/bin/env node
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runTokenExperiment, resultsToMarkdown } from '../src/experiment.js';
import { countTokenizerTokensStrict } from '../src/tokenizer.js';

const MAX_GAP_PERCENTAGE_POINTS = 8;

// === v1 path (preserved verbatim — feeds existing test #10) ===
const rows = await runTokenExperiment();
process.stdout.write(resultsToMarkdown(rows));

const proxyFallbackRows = rows.filter((row) => row.tokenizer.method !== 'js-tiktoken');
if (proxyFallbackRows.length) {
  console.error('js-tiktoken unavailable; refusing to report savings off the proxy alone. Run `npm install` and retry.');
  process.exit(1);
}

const thresholdFailures = rows.filter((row) => row.tokenizer.percent_reduction < row.minimum_reduction);
if (thresholdFailures.length) {
  console.error(`Tokenizer reduction below threshold for: ${thresholdFailures.map((row) => `${row.fixture_name} (${row.tokenizer.percent_reduction}% < ${row.minimum_reduction}%)`).join(', ')}`);
  process.exit(1);
}

const gapFailures = rows.filter((row) => row.gap_percentage_points > MAX_GAP_PERCENTAGE_POINTS);
if (gapFailures.length) {
  console.error(`Proxy/tokenizer gap > ${MAX_GAP_PERCENTAGE_POINTS}pp for: ${gapFailures.map((row) => `${row.fixture_name} (gap=${row.gap_percentage_points}pp)`).join(', ')}`);
  process.exit(1);
}

// === v2 path: per-variant, per-prompt eval corpus ===
//
// Baseline output tokens are a constant 120 — a placeholder representing a
// "typical verbose unconstrained reply" so the v2 JSON has SOMETHING to compute
// savings against today. Real Claude-reply measurements are deferred to a
// future task (see FUTURE_WORK.md). The tokenizer is js-tiktoken cl100k_base,
// NOT Anthropic's tokenizer, so absolute counts are directional only.
const BASELINE_OUTPUT_TOKENS = 120;
const VARIANT_NAMES = ['tc-token-optimizer', 'tc-mirror-minimal', 'tc-mirror-glyphs', 'tc-mirror-classical'];

const __filename = fileURLToPath(import.meta.url);
const repoRoot = join(dirname(__filename), '..');

function stripFrontmatter(md) {
  // Remove a leading YAML frontmatter block delimited by --- on its own lines.
  if (!md.startsWith('---')) return md;
  const end = md.indexOf('\n---', 3);
  if (end === -1) return md;
  // Skip past the closing "---" line (including its trailing newline if present).
  const after = md.slice(end + 4);
  return after.startsWith('\n') ? after.slice(1) : after;
}

async function discoverVariants() {
  // Discover all variant SKILL.md files under skills/. Filter to those we
  // know about (tc-token-optimizer and tc-mirror-*).
  const skillsDir = join(repoRoot, 'skills');
  const entries = await readdir(skillsDir, { withFileTypes: true });
  const variants = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (!VARIANT_NAMES.includes(e.name)) continue;
    const skillPath = join(skillsDir, e.name, 'SKILL.md');
    if (!existsSync(skillPath)) continue;
    variants.push({ name: e.name, skillPath });
  }
  // Sort to match VARIANT_NAMES ordering for stable output.
  variants.sort((a, b) => VARIANT_NAMES.indexOf(a.name) - VARIANT_NAMES.indexOf(b.name));
  return variants;
}

async function discoverPrompts() {
  // Discover all prompt files in test/fixtures/eval-prompts/. A prompt id is
  // the basename minus the language suffix and extension: "01-bugfix.tc.txt"
  // -> id "01-bugfix", language "tc".
  const promptsDir = join(repoRoot, 'test', 'fixtures', 'eval-prompts');
  if (!existsSync(promptsDir)) return [];
  const entries = await readdir(promptsDir);
  const prompts = new Map();
  for (const fname of entries) {
    if (!fname.endsWith('.txt')) continue;
    // Strip extension, then split on the final dot to get language.
    const stem = fname.slice(0, -'.txt'.length);
    const dot = stem.lastIndexOf('.');
    const id = dot === -1 ? stem : stem.slice(0, dot);
    const lang = dot === -1 ? null : stem.slice(dot + 1);
    const path = join(promptsDir, fname);
    if (!prompts.has(id)) prompts.set(id, { id, files: {} });
    prompts.get(id).files[lang ?? 'unknown'] = path;
  }
  // Sort by id (01-, 02-, ...) for stable output.
  return Array.from(prompts.values()).sort((a, b) => a.id.localeCompare(b.id));
}

async function tokenCount(text) {
  return (await countTokenizerTokensStrict(text)).tokens;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

async function buildV2() {
  const variants = await discoverVariants();
  const prompts = await discoverPrompts();

  // Pre-compute per-variant skill overhead and 01-bugfix expected output tokens.
  const variantStats = new Map();
  for (const v of variants) {
    const skillMd = await readFile(v.skillPath, 'utf8');
    const body = stripFrontmatter(skillMd);
    const skillOverheadTokens = await tokenCount(body);
    const expectedOutputs = new Map(); // promptId -> tokens or null
    // For 01-bugfix only, look at the per-variant expected output fixture.
    const expectedDir = join(repoRoot, 'test', 'fixtures', 'expected-outputs', v.name);
    if (existsSync(expectedDir)) {
      const expectedEntries = await readdir(expectedDir);
      for (const f of expectedEntries) {
        if (!f.endsWith('.md')) continue;
        const id = f.slice(0, -'.md'.length);
        const text = await readFile(join(expectedDir, f), 'utf8');
        expectedOutputs.set(id, await tokenCount(text));
      }
    }
    variantStats.set(v.name, { skillOverheadTokens, expectedOutputs });
  }

  const fixturesOut = [];
  for (const p of prompts) {
    // Pick the canonical "prompt text" — prefer .tc, fall back to .en, else any.
    const promptPath = p.files.tc ?? p.files.en ?? Object.values(p.files)[0];
    const promptText = await readFile(promptPath, 'utf8');
    const promptTokens = await tokenCount(promptText);

    // EN-translated prompt: only if a .en.txt sibling exists.
    let enTranslatedPromptTokens = null;
    if (p.files.en) {
      const enText = await readFile(p.files.en, 'utf8');
      enTranslatedPromptTokens = await tokenCount(enText);
    }

    const variantsOut = {};
    for (const v of variants) {
      const stats = variantStats.get(v.name);
      const expected = stats.expectedOutputs.get(p.id);
      const expectedOutputTokens = expected ?? null;
      const savingsPct = expectedOutputTokens === null
        ? null
        : Number((((BASELINE_OUTPUT_TOKENS - expectedOutputTokens) / BASELINE_OUTPUT_TOKENS) * 100).toFixed(1));
      variantsOut[v.name] = {
        skillOverheadTokens: stats.skillOverheadTokens,
        expectedOutputTokens,
        savingsPct
      };
    }

    fixturesOut.push({
      id: p.id,
      promptText,
      promptTokens,
      enTranslatedPromptTokens,
      baselineOutputTokens: BASELINE_OUTPUT_TOKENS,
      variants: variantsOut
    });
  }

  const out = {
    measuredAt: new Date().toISOString(),
    tokenizer: 'cl100k_base',
    methodology: 'Baseline output tokens are a constant 120 placeholder (typical verbose reply). Real Claude-reply measurements deferred to FUTURE_WORK.md. Tokenizer is js-tiktoken cl100k_base — NOT Anthropic\'s tokenizer, so absolute counts are directional only.',
    variants: VARIANT_NAMES,
    fixtures: fixturesOut
  };

  const resultsDir = join(repoRoot, 'test', 'results');
  await mkdir(resultsDir, { recursive: true });
  const jsonPath = join(resultsDir, 'token-savings.v2.json');
  await writeFile(jsonPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

  // Flat CSV: one row per (fixture, variant).
  const header = ['fixture_id', 'prompt_text', 'prompt_tokens', 'en_translated_prompt_tokens', 'baseline_tokens', 'variant', 'variant_tokens', 'savings_pct'];
  const lines = [header.join(',')];
  for (const f of fixturesOut) {
    for (const variantName of VARIANT_NAMES) {
      const v = f.variants[variantName] ?? { expectedOutputTokens: null, savingsPct: null };
      lines.push([
        csvEscape(f.id),
        csvEscape(f.promptText),
        csvEscape(f.promptTokens),
        csvEscape(f.enTranslatedPromptTokens),
        csvEscape(f.baselineOutputTokens),
        csvEscape(variantName),
        csvEscape(v.expectedOutputTokens),
        csvEscape(v.savingsPct)
      ].join(','));
    }
  }
  const csvPath = join(resultsDir, 'token-savings.v2.csv');
  await writeFile(csvPath, `${lines.join('\n')}\n`, 'utf8');
}

await buildV2();
