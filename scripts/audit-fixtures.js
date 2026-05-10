#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PAIRS = [
  {
    name: 'tc-prompt',
    controlPath: join('test', 'fixtures', 'tc-prompt-control.txt'),
    variablePath: join('test', 'fixtures', 'tc-prompt-variable.txt'),
    constraints: [
      { id: 'parseUser-fn', controlMatch: /parseUser\(\)/, variableMatch: /parseUser\(\)/ },
      { id: 'preserve-public-interface', controlMatch: /公開介面/, variableMatch: /public interface/i },
      { id: 'preserve-test-filenames', controlMatch: /不要改變測試檔案名稱/, variableMatch: /not rename test files|preserve test (file)?names/i },
      { id: 'run-test-command', controlMatch: /npm test -- --runInBand/, variableMatch: /npm test -- --runInBand/ },
      { id: 'minimum-necessary-changes', controlMatch: /最小必要變更/, variableMatch: /minimum[- ]necessary changes/i },
      { id: 'preserve-source-path', controlMatch: /src\/utils\/user-parser\.ts/, variableMatch: /src\/utils\/user-parser\.ts/ }
    ]
  }
];

const failures = [];

for (const pair of PAIRS) {
  const control = await readFile(pair.controlPath, 'utf8');
  const variable = await readFile(pair.variablePath, 'utf8');
  for (const constraint of pair.constraints) {
    if (!constraint.controlMatch.test(control)) {
      failures.push(`${pair.name}: control missing constraint "${constraint.id}"`);
    }
    if (!constraint.variableMatch.test(variable)) {
      failures.push(`${pair.name}: variable missing constraint "${constraint.id}"`);
    }
  }
}

if (failures.length) {
  for (const message of failures) {
    console.error(message);
  }
  process.exit(1);
}

console.log(`Audited ${PAIRS.length} fixture pair(s); every constraint present in both control and variable.`);
