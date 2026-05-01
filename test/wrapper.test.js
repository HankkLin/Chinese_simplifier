import test from 'node:test';
import assert from 'node:assert/strict';

import { buildClaudeInvocation, optimizePromptArgument } from '../src/wrapper.js';

test('wrapper leaves English arguments unchanged', async () => {
  assert.equal(await optimizePromptArgument('fix the parser'), 'fix the parser');
});

test('wrapper optimizes TC arguments while preserving inline code', async () => {
  const output = await optimizePromptArgument('請修正 `parseUser()` 的錯誤處理流程');
  assert.match(output, /`parseUser\(\)`/);
  assert.notEqual(output, '請修正 `parseUser()` 的錯誤處理流程');
});

test('wrapper builds transparent invocation with env override', () => {
  const invocation = buildClaudeInvocation(['--print', 'hello'], {
    TC_CLAUDE_REAL_BIN: 'C:/bin/claude.cmd'
  });

  assert.equal(invocation.command, 'C:/bin/claude.cmd');
  assert.deepEqual(invocation.args, ['--print', 'hello']);
});
