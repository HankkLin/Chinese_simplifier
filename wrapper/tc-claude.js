#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { buildClaudeInvocation, optimizeArgs } from '../src/wrapper.js';

const originalArgs = process.argv.slice(2);
const args = await optimizeArgs(originalArgs);
const invocation = buildClaudeInvocation(args);

const child = spawn(invocation.command, invocation.args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    TC_CLAUDE_WRAPPED: '1'
  },
  ...invocation.options
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(`tc-claude: failed to launch Claude: ${error.message}`);
  process.exit(1);
});
