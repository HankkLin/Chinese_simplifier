#!/usr/bin/env node
import { readJsonFromStdin, writeJson } from '../src/io.js';
import { handlePostToolUse } from '../src/hooks/post-tool-use.js';

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = modeArg ? modeArg.slice('--mode='.length) : 'trace';

try {
  writeJson(await handlePostToolUse(await readJsonFromStdin(), { mode }));
} catch (error) {
  writeJson({ error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
}
