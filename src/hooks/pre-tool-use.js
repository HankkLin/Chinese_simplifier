import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';

import { shouldOptimizeText } from '../cjk.js';
import { optimizeSourceForShadow } from '../source-shadow.js';

function getReadPath(payload) {
  return payload?.tool_input?.file_path ?? payload?.input?.file_path ?? payload?.file_path;
}

export async function handlePreToolUse(payload) {
  const toolName = payload?.tool_name ?? payload?.toolName ?? payload?.name;
  if (toolName && toolName !== 'Read') return {};

  const filePath = getReadPath(payload);
  if (!filePath) return {};

  let contents;
  try {
    contents = await readFile(filePath, 'utf8');
  } catch {
    return {};
  }

  if (!shouldOptimizeText(contents, 0.05)) return {};

  const hash = createHash('sha256').update(filePath).digest('hex').slice(0, 12);
  const shadowDir = join(tmpdir(), 'tc-shadow', hash);
  await mkdir(shadowDir, { recursive: true });
  const shadowPath = join(shadowDir, basename(filePath));
  const shadowContents = await optimizeSourceForShadow(contents);
  const originalHash = createHash('sha256').update(contents).digest('hex');
  const shadowHash = createHash('sha256').update(shadowContents).digest('hex');
  const metadataPath = join(shadowDir, '.tc-shadow.metadata.json');
  const metadata = {
    version: 1,
    originalPath: filePath,
    shadowPath,
    originalSha256: originalHash,
    shadowSha256: shadowHash,
    createdAt: new Date().toISOString()
  };
  await writeFile(shadowPath, shadowContents, 'utf8');
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  return {
    updatedInput: { file_path: shadowPath },
    metadata: { tcShadow: { ...metadata, metadataPath } },
    additionalContext: [
      'TC shadow read metadata:',
      `shadowPath=${shadowPath}`,
      `originalPath=${filePath}`,
      `originalSha256=${originalHash}`
    ].join('\n')
  };
}
