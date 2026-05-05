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
  }, 'linux');

  assert.equal(invocation.command, 'C:/bin/claude.cmd');
  assert.deepEqual(invocation.args, ['--print', 'hello']);
  assert.deepEqual(invocation.options, { shell: false });
});

test('wrapper disables shell parsing for normal Windows executables', () => {
  const invocation = buildClaudeInvocation(['--print', 'hello & whoami'], {
    TC_CLAUDE_REAL_BIN: 'C:/Program Files/Claude/claude.exe'
  }, 'win32');

  assert.equal(invocation.command, 'C:/Program Files/Claude/claude.exe');
  assert.deepEqual(invocation.args, ['--print', 'hello & whoami']);
  assert.deepEqual(invocation.options, { shell: false });
});

test('wrapper launches Windows command shims through explicit cmd escaping', () => {
  const invocation = buildClaudeInvocation(['--print', 'hello & whoami'], {
    ComSpec: 'C:/Windows/System32/cmd.exe',
    TC_CLAUDE_REAL_BIN: 'C:/bin/claude.cmd'
  }, 'win32');

  assert.equal(invocation.command, 'C:/Windows/System32/cmd.exe');
  assert.deepEqual(invocation.args.slice(0, 3), ['/d', '/s', '/c']);
  assert.equal(invocation.options.shell, false);
  assert.equal(invocation.options.windowsVerbatimArguments, true);
  assert.match(invocation.args[3], /hello \^& whoami/);
});
