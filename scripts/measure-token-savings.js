#!/usr/bin/env node
import { runTokenExperiment, resultsToMarkdown } from '../src/experiment.js';

const rows = await runTokenExperiment();
const failures = rows.filter((row) => row.percent_reduction < 30);

process.stdout.write(resultsToMarkdown(rows));

if (failures.length) {
  console.error(`Token savings threshold failed for: ${failures.map((row) => row.fixture_name).join(', ')}`);
  process.exit(1);
}
