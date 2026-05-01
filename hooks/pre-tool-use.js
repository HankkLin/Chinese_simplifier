#!/usr/bin/env node
import { readJsonFromStdin, writeJson } from '../src/io.js';
import { handlePreToolUse } from '../src/hooks/pre-tool-use.js';

try {
  writeJson(await handlePreToolUse(await readJsonFromStdin()));
} catch (error) {
  writeJson({ error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
}
