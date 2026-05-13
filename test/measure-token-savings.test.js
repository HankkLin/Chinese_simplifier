import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

test('measure-token-savings v2 runner produces JSON with all 4 variants per fixture', () => {
  execSync('node scripts/measure-token-savings.js', { cwd: repoRoot, stdio: 'pipe' });
  const out = JSON.parse(readFileSync(join(repoRoot, 'test/results/token-savings.v2.json'), 'utf8'));
  assert.ok(out.fixtures.length >= 8, `expected >=8 fixtures, got ${out.fixtures.length}`);
  for (const f of out.fixtures) {
    for (const v of ['tc-token-optimizer', 'tc-mirror-minimal', 'tc-mirror-glyphs', 'tc-mirror-classical']) {
      assert.ok(v in f.variants, `fixture ${f.id} missing variant ${v}`);
    }
  }
});

test('measure-token-savings v2 CSV exists and has header', () => {
  const csvPath = join(repoRoot, 'test/results/token-savings.v2.csv');
  assert.equal(existsSync(csvPath), true);
  const first = readFileSync(csvPath, 'utf8').split('\n')[0];
  assert.ok(first.includes('fixture_id'));
  assert.ok(first.includes('variant_tokens'));
  assert.ok(first.includes('savings_pct'));
});
