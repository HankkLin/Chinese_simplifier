import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

import { getCjkRatio, hasCjk, shouldOptimizeText } from '../src/cjk.js';
import { translateWithProtection } from '../src/translate.js';
import { compactTrace } from '../src/trace.js';
import { optimizeSourceForShadow } from '../src/source-shadow.js';
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

test('shouldOptimizeText rejects Japanese kana so kanji files are not translated', () => {
  const japanese = 'ユーザーの入力を検証する関数 parseUser() のエラー処理を修正してください';
  assert.equal(shouldOptimizeText(japanese), false);
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

test('source shadow compacts CJK comments into concise semantic summaries', async () => {
  const input = [
    '// TODO: \u9a57\u8b49\u767b\u5165 token \u6b0a\u9650\uff0c\u907f\u514d\u672a\u6388\u6b0a\u5b58\u53d6',
    'const token = request.headers.authorization;',
    '  // FIXME: \u8655\u7406\u4ed8\u6b3e\u932f\u8aa4\uff0c\u4fdd\u6301 Order \u72c0\u614b',
    '  return processOrder(Order);',
    '// \u6548\u80fd: \u5feb\u53d6 productCatalog \u8a2d\u5b9a\uff0c\u907f\u514d\u91cd\u8907\u67e5\u8a62',
    'export const productCatalog = loadCatalog();'
  ].join('\n');

  const output = await optimizeSourceForShadow(input);

  assert.match(output, /^\/\/ TODO; auth\/security; validation; domain: token\.$/m);
  assert.match(output, /^  \/\/ FIXME; error handling; domain: Order\.$/m);
  assert.match(output, /^\/\/ performance; configuration; domain: productCatalog\.$/m);
  assert.match(output, /const token = request\.headers\.authorization;/);
  assert.match(output, /  return processOrder\(Order\);/);
  assert.match(output, /export const productCatalog = loadCatalog\(\);/);
});

test('PostToolUse restore fails closed without reliable shadow metadata', async () => {
  const result = await handlePostToolUse({ tool_name: 'Write', tool_input: { file_path: '/tmp/tc-shadow/x.ts' } }, { mode: 'restore' });
  assert.equal(result.decision, 'block');
  assert.match(result.reason, /restore metadata/i);
});

test('PostToolUse restore maps changed shadow back to original only when original hash matches', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tc-token-restore-test-'));
  try {
    const tcFile = join(dir, 'sample-tc-file.ts');
    const tcComment = JSON.parse('"\\u9019\\u88e1\\u6703\\u9a57\\u8b49\\u4f7f\\u7528\\u8005\\u8f38\\u5165"');
    await writeFile(tcFile, `// ${tcComment}\nexport const ok = true;\n`, 'utf8');

    const preResult = await handlePreToolUse({ tool_name: 'Read', tool_input: { file_path: tcFile } });
    const shadowPath = preResult.updatedInput.file_path;
    await writeFile(shadowPath, '// compact note\nexport const ok = false;\n', 'utf8');

    const restoreResult = await handlePostToolUse({
      tool_name: 'Write',
      tool_input: { file_path: shadowPath }
    }, { mode: 'restore' });

    assert.equal(restoreResult.decision, 'allow');
    assert.equal(restoreResult.restored, true);
    assert.equal(restoreResult.updatedInput.file_path, tcFile);
    assert.equal(await readFile(tcFile, 'utf8'), '// compact note\nexport const ok = false;\n');

    await rm(dirname(shadowPath), { recursive: true, force: true });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('PostToolUse restore blocks stale originals before overwriting', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tc-token-stale-restore-test-'));
  try {
    const tcFile = join(dir, 'sample-tc-file.ts');
    const staleContents = '// changed outside shadow flow\nexport const ok = true;\n';
    const tcComment = JSON.parse('"\\u9019\\u88e1\\u6703\\u9a57\\u8b49\\u4f7f\\u7528\\u8005\\u8f38\\u5165"');
    await writeFile(tcFile, `// ${tcComment}\nexport const ok = true;\n`, 'utf8');

    const preResult = await handlePreToolUse({ tool_name: 'Read', tool_input: { file_path: tcFile } });
    const shadowPath = preResult.updatedInput.file_path;
    await writeFile(shadowPath, '// compact note\nexport const ok = false;\n', 'utf8');
    await writeFile(tcFile, staleContents, 'utf8');

    const restoreResult = await handlePostToolUse({
      tool_name: 'Write',
      tool_input: { file_path: shadowPath }
    }, { mode: 'restore' });

    assert.equal(restoreResult.decision, 'block');
    assert.match(restoreResult.reason, /hash is stale/i);
    assert.equal(await readFile(tcFile, 'utf8'), staleContents);

    await rm(dirname(shadowPath), { recursive: true, force: true });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('token experiment meets tokenizer-measured reduction threshold for every fixture', async () => {
  const results = await runTokenExperiment({ writeResults: false });
  assert.equal(results.every((row) => row.tokenizer.percent_reduction >= row.minimum_reduction), true);
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

test('tc-mirror-minimal SKILL: SKILL.md exists', () => {
  const skillPath = join(__dirname, '..', 'skills', 'tc-mirror-minimal', 'SKILL.md');
  assert.equal(existsSync(skillPath), true);
});

test('tc-mirror-minimal SKILL: SKILL.md mandates language mirror', () => {
  const skillPath = join(__dirname, '..', 'skills', 'tc-mirror-minimal', 'SKILL.md');
  const body = readFileSync(skillPath, 'utf8');
  assert.match(body, /Render the FINAL OUTPUT in the same language as the user/);
  assert.match(body, /Field labels \(STATUS, CHANGES, NEXT, ERRORS\) remain English/);
});

test('tc-mirror-minimal SKILL: expected-output fixture is TC, not EN', () => {
  const fixturePath = join(__dirname, 'fixtures', 'expected-outputs', 'tc-mirror-minimal', '01-bugfix.md');
  const body = readFileSync(fixturePath, 'utf8');
  const changesLine = body.split('\n').find((l) => l.startsWith('CHANGES:'));
  assert.ok(changesLine, 'CHANGES: line missing from fixture');
  assert.match(changesLine, /[一-鿿]/);
});

test('tc-mirror-glyphs SKILL: SKILL.md and glyph dictionary exist', () => {
  const skillPath = new URL('../skills/tc-mirror-glyphs/SKILL.md', import.meta.url);
  const dictPath = new URL('../skills/tc-mirror-glyphs/references/glyph-dictionary.md', import.meta.url);
  assert.equal(existsSync(skillPath), true);
  assert.equal(existsSync(dictPath), true);
});

test('tc-mirror-glyphs SKILL: glyph dictionary contains required glyphs', () => {
  const dictPath = new URL('../skills/tc-mirror-glyphs/references/glyph-dictionary.md', import.meta.url);
  const dict = readFileSync(dictPath, 'utf8');
  for (const g of ['→', '✓', '∵', '⊕', '⊖', '@', 'Δ']) {
    assert.ok(dict.includes(g), `dictionary missing glyph ${g}`);
  }
});

test('tc-mirror-glyphs SKILL: expected output uses glyphs not words', () => {
  const fixturePath = new URL('../test/fixtures/expected-outputs/tc-mirror-glyphs/01-bugfix.md', import.meta.url);
  const body = readFileSync(fixturePath, 'utf8');
  assert.match(body, /✓|⊕|@/);
  assert.doesNotMatch(body, /完成|新增|在第/);
});
