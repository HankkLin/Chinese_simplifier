#!/usr/bin/env node
import { runTokenExperiment, resultsToMarkdown } from '../src/experiment.js';

const rows = await runTokenExperiment();
const failures = rows.filter((row) => row.proxy.percent_reduction < row.minimum_proxy_reduction);

process.stdout.write(resultsToMarkdown(rows));

if (failures.length) {
  console.error(`Proxy token savings threshold failed for: ${failures.map((row) => `${row.fixture_name} (<${row.minimum_proxy_reduction}%)`).join(', ')}`);
  process.exit(1);
}
