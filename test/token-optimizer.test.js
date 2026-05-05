import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getCjkRatio, hasCjk, shouldOptimizeText } from '../src/cjk.js';
import { translateWithProtection } from '../src/translate.js';
import { compactTrace } from '../src/trace.js';
import { handlePreToolUse } from '../src/hooks/pre-tool-use.js';
import { handlePostToolUse } from '../src/hooks/post-tool-use.js';
import { runTokenExperiment } from '../src/experiment.js';

test('CJK detection separates English, TC-heavy, and mixed input', () => {
  assert.equal(hasCjk('plain English only'), false);
  assert.equal(hasCjk('請修正這個函式的錯誤處理'), true);
  assert.equal(shouldOptimizeText('請修正這個函式的錯誤處理'), true);
  assert.equal(shouldOptimizeText('fix parser // 修正'), false);
  assert.ok(getCjkRatio('請修正 parseUser()') > 0.15);
});

test('protected translation preserves code spans, paths, flags, and identifiers', async () => {
  const input = [
    '請修正 `parseUser()`，不要改 src/utils/user-parser.ts。',
    '```ts',
    'const 狀態 = parseUser(input);',
    '```',
    '執行 npm test -- --runInBand。'
  ].join('\n');

  const output = await translateWithProtection(input);

  assert.match(output, /`parseUser\(\)`/);
  assert.match(output, /src\/utils\/user-parser\.ts/);
  assert.match(output, /--runInBand/);
  assert.match(output, /const 狀態 = parseUser\(input\);/);
});

test('trace compaction reduces JS and Python traces while leaving normal output unchanged', () => {
  const jsTrace = [
    'TypeError: Cannot read properties of undefined (reading map)',
    '    at processItems (D:/repo/src/utils.ts:42:13)',
    '    at main (D:/repo/src/index.ts:18:5)',
    '    at Module._compile (node:internal/modules/cjs/loader:1254:14)',
    '    at Object.<anonymous> (D:/repo/node_modules/pkg/index.js:1:1)'
  ].join('\n');

  const compactJs = compactTrace(jsTrace);
  assert.match(compactJs, /<COMPACT_TRACEBACK>/);
  assert.match(compactJs, /TypeError/);
  assert.match(compactJs, /src\/utils.ts:42/);
  assert.doesNotMatch(compactJs, /node_modules/);
  assert.ok(compactJs.length < jsTrace.length);

  const pyTrace = [
    'Traceback (most recent call last):',
    '  File "D:/repo/app/main.py", line 12, in <module>',
    '    main()',
    '  File "D:/repo/app/service.py", line 34, in main',
    '    raise ValueError("bad input")',
    'ValueError: bad input'
  ].join('\n');

  const compactPy = compactTrace(pyTrace);
  assert.match(compactPy, /ValueError: bad input/);
  assert.match(compactPy, /app\/service.py:34/);

  assert.equal(compactTrace('tests passed\n'), 'tests passed\n');
});

test('PreToolUse Read redirects TC files to shadow copies and no-ops English files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tc-token-test-'));
  try {
    const tcFile = join(dir, 'sample-tc-file.ts');
    const enFile = join(dir, 'sample-en-file.ts');
    await writeFile(tcFile, '// 這裡會驗證使用者輸入\nexport const ok = true;\n', 'utf8');
    await writeFile(enFile, '// validates user input\nexport const ok = true;\n', 'utf8');

    const tcResult = await handlePreToolUse({ tool_name: 'Read', tool_input: { file_path: tcFile } });
    assert.ok(tcResult.updatedInput.file_path.includes('tc-shadow'));
    assert.notEqual(tcResult.updatedInput.file_path, tcFile);
    const shadow = await readFile(tcResult.updatedInput.file_path, 'utf8');
    assert.match(shadow, /export const ok/);

    const enResult = await handlePreToolUse({ tool_name: 'Read', tool_input: { file_path: enFile } });
    assert.deepEqual(enResult, {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('PostToolUse restore fails closed without reliable shadow metadata', async () => {
  const result = await handlePostToolUse({ tool_name: 'Write', tool_input: { file_path: '/tmp/tc-shadow/x.ts' } }, { mode: 'restore' });
  assert.equal(result.decision, 'block');
  assert.match(result.reason, /restore metadata/i);
});

test('token experiment records control and variable groups with 30 percent minimum reduction', async () => {
  const results = await runTokenExperiment({ writeResults: false });
  assert.equal(results.every((row) => row.proxy.percent_reduction >= row.minimum_proxy_reduction), true);
  assert.equal(results.some((row) => row.fixture_name === 'tc-prompt'), true);
  assert.equal(results.some((row) => row.fixture_name === 'verbose-response'), true);
});

test('token experiment separates proxy and tokenizer-backed measurements', async () => {
  const results = await runTokenExperiment({ writeResults: false });
  const fileFixture = results.find((row) => row.fixture_name === 'fixture-file-tc-prompt');

  assert.ok(fileFixture);
  assert.equal(fileFixture.fixture_source, 'test/fixtures/tc-prompt-control.txt');
  assert.equal(typeof fileFixture.proxy.control_tokens, 'number');
  assert.equal(typeof fileFixture.proxy.variable_tokens, 'number');
  assert.ok(['js-tiktoken', 'proxy-fallback'].includes(fileFixture.tokenizer.method));
  assert.equal(typeof fileFixture.tokenizer.control_tokens, 'number');
  assert.equal(typeof fileFixture.tokenizer.variable_tokens, 'number');
});
