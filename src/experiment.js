import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { compactTrace } from './trace.js';
import { optimizeChinesePrompt } from './translate.js';
import { countTokenMetrics } from './tokenizer.js';
import { optimizeSourceForShadow } from './source-shadow.js';

const inlineFixtures = [
  {
    fixture_name: 'tc-prompt',
    fixture_source: 'inline',
    minimum_proxy_reduction: 0,
    transformation_type: 'protected prompt optimization',
    control: '請修正 `parseUser()` 的錯誤處理流程。當輸入資料缺少 email、name 或 role 欄位時，目前函式會傳回不一致的錯誤訊息，導致前端表單無法正確顯示驗證結果。請保留 src/utils/user-parser.ts 的公開介面，不要改變測試檔案名稱，最後執行 npm test -- --runInBand 並回報最小必要變更。',
    variable: optimizeChinesePrompt('請修正 `parseUser()` 的錯誤處理流程。當輸入資料缺少 email、name 或 role 欄位時，目前函式會傳回不一致的錯誤訊息，導致前端表單無法正確顯示驗證結果。請保留 src/utils/user-parser.ts 的公開介面，不要改變測試檔案名稱，最後執行 npm test -- --runInBand 並回報最小必要變更。')
  },
  {
    fixture_name: 'tc-source',
    fixture_source: 'inline',
    minimum_proxy_reduction: 30,
    transformation_type: 'shadow file comment compaction',
    control: [
      '// 這個函式負責驗證使用者輸入，並且在資料缺漏時回傳一致的錯誤格式。',
      '// 維護注意事項：不要在這裡直接拋出未處理例外，因為呼叫端需要穩定的錯誤物件。',
      'export function parseUser(input) {',
      '  // 當 email 欄位不存在時，前端會顯示繁體中文提示。',
      '  if (!input.email) return { ok: false, error: "缺少電子郵件欄位" };',
      '  return { ok: true, value: input };',
      '}'
    ].join('\n'),
    variable: await optimizeSourceForShadow([
      '// 這個函式負責驗證使用者輸入，並且在資料缺漏時回傳一致的錯誤格式。',
      '// 維護注意事項：不要在這裡直接拋出未處理例外，因為呼叫端需要穩定的錯誤物件。',
      'export function parseUser(input) {',
      '  // 當 email 欄位不存在時，前端會顯示繁體中文提示。',
      '  if (!input.email) return { ok: false, error: "缺少電子郵件欄位" };',
      '  return { ok: true, value: input };',
      '}'
    ].join('\n'), { threshold: 0.01 })
  },
  {
    fixture_name: 'verbose-trace',
    fixture_source: 'inline',
    minimum_proxy_reduction: 30,
    transformation_type: 'trace compaction',
    control: [
      'TypeError: Cannot read properties of undefined (reading map)',
      '    at processItems (D:/repo/src/utils.ts:42:13)',
      '    at validatePayload (D:/repo/src/validate.ts:27:9)',
      '    at main (D:/repo/src/index.ts:18:5)',
      '    at Object.<anonymous> (D:/repo/node_modules/pkg/index.js:1:1)',
      '    at Module._compile (node:internal/modules/cjs/loader:1254:14)',
      '    at Module.load (node:internal/modules/cjs/loader:1117:32)',
      '    at Function._load (node:internal/modules/cjs/loader:958:12)'
    ].join('\n'),
    variable: compactTrace([
      'TypeError: Cannot read properties of undefined (reading map)',
      '    at processItems (D:/repo/src/utils.ts:42:13)',
      '    at validatePayload (D:/repo/src/validate.ts:27:9)',
      '    at main (D:/repo/src/index.ts:18:5)',
      '    at Object.<anonymous> (D:/repo/node_modules/pkg/index.js:1:1)',
      '    at Module._compile (node:internal/modules/cjs/loader:1254:14)',
      '    at Module.load (node:internal/modules/cjs/loader:1117:32)',
      '    at Function._load (node:internal/modules/cjs/loader:958:12)'
    ].join('\n'))
  },
  {
    fixture_name: 'verbose-response',
    fixture_source: 'inline',
    minimum_proxy_reduction: 30,
    transformation_type: 'SKILL.md caveman response',
    control: '我已經完成了你要求的修改。這次我先檢查了相關檔案，確認錯誤處理流程在缺少必要欄位時會回傳不一致的錯誤物件。接著我調整了 parseUser 的驗證順序，讓 email、name 和 role 都使用同一種錯誤格式。最後我執行了測試，確認所有案例都通過。以下是變更摘要與後續建議。',
    variable: 'STATUS: DONE\nCHANGES: src/utils/user-parser.ts\nNEXT: npm test passed\nERRORS: none'
  }
];

const fixtureFilePairs = [
  {
    fixture_name: 'fixture-file-tc-prompt',
    transformation_type: 'protected prompt optimization',
    controlPath: join('test', 'fixtures', 'tc-prompt-control.txt'),
    variablePath: join('test', 'fixtures', 'tc-prompt-variable.txt')
  },
  {
    fixture_name: 'fixture-file-tc-source',
    transformation_type: 'shadow file comment compaction',
    controlPath: join('test', 'fixtures', 'sample-tc-file.ts'),
    variableFromControl: async (control) => optimizeSourceForShadow(control, { threshold: 0.01 })
  }
];

async function loadFileFixture(pair) {
  const control = await readFile(pair.controlPath, 'utf8');
  const variable = pair.variablePath
    ? await readFile(pair.variablePath, 'utf8')
    : await pair.variableFromControl(control);

  return {
    fixture_name: pair.fixture_name,
    fixture_source: pair.controlPath.replaceAll('\\', '/'),
    transformation_type: pair.transformation_type,
    minimum_proxy_reduction: pair.minimum_proxy_reduction ?? 30,
    control,
    variable
  };
}

async function getFixtures() {
  const fileFixtures = await Promise.all(fixtureFilePairs.map(loadFileFixture));
  return [...inlineFixtures, ...fileFixtures];
}

function summarizePair(control, variable) {
  const tokensSaved = control.tokens - variable.tokens;
  return {
    method: control.method === variable.method ? control.method : `${control.method}/${variable.method}`,
    control_tokens: control.tokens,
    variable_tokens: variable.tokens,
    tokens_saved: tokensSaved,
    percent_reduction: control.tokens === 0 ? 0 : Number(((tokensSaved / control.tokens) * 100).toFixed(2))
  };
}

export async function runTokenExperiment(options = {}) {
  const rows = [];
  for (const fixture of await getFixtures()) {
    const control = await countTokenMetrics(fixture.control);
    const variable = await countTokenMetrics(fixture.variable);
    rows.push({
      fixture_name: fixture.fixture_name,
      fixture_source: fixture.fixture_source,
      transformation_type: fixture.transformation_type,
      minimum_proxy_reduction: fixture.minimum_proxy_reduction,
      proxy: summarizePair(control.proxy, variable.proxy),
      tokenizer: summarizePair(control.tokenizer, variable.tokenizer)
    });
  }

  if (options.writeResults !== false) {
    await writeExperimentResults(rows, options);
  }
  return rows;
}

export function resultsToMarkdown(rows, date = new Date().toISOString().slice(0, 10)) {
  const lines = [
    `Measured on ${date}. Proxy counts are deterministic local estimates; tokenizer counts use js-tiktoken when available and otherwise say proxy-fallback.`,
    '',
    '| Fixture | Source | Transformation | Proxy control | Proxy variable | Proxy saved | Proxy reduction | Proxy minimum | Tokenizer method | Tokenizer control | Tokenizer variable | Tokenizer saved | Tokenizer reduction |',
    '|---|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|'
  ];
  for (const row of rows) {
    lines.push(`| ${row.fixture_name} | ${row.fixture_source} | ${row.transformation_type} | ${row.proxy.control_tokens} | ${row.proxy.variable_tokens} | ${row.proxy.tokens_saved} | ${row.proxy.percent_reduction}% | ${row.minimum_proxy_reduction}% | ${row.tokenizer.method} | ${row.tokenizer.control_tokens} | ${row.tokenizer.variable_tokens} | ${row.tokenizer.tokens_saved} | ${row.tokenizer.percent_reduction}% |`);
  }
  return `${lines.join('\n')}\n`;
}

export async function writeExperimentResults(rows, options = {}) {
  const jsonPath = options.jsonPath ?? join('test', 'results', 'token-savings.json');
  const mdPath = options.mdPath ?? join('test', 'results', 'token-savings.md');
  await mkdir(dirname(jsonPath), { recursive: true });
  await mkdir(dirname(mdPath), { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  await writeFile(mdPath, resultsToMarkdown(rows), 'utf8');
}
