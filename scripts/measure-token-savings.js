#!/usr/bin/env node
import { runTokenExperiment, resultsToMarkdown } from '../src/experiment.js';

const MAX_GAP_PERCENTAGE_POINTS = 8;

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
