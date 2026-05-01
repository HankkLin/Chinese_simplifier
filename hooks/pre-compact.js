#!/usr/bin/env node
import { readJsonFromStdin, writeJson } from '../src/io.js';
import { handlePreCompact } from '../src/hooks/pre-compact.js';

try {
  writeJson(await handlePreCompact(await readJsonFromStdin()));
} catch (error) {
  writeJson({ error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
}
