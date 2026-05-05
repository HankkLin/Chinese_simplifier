import { compactTrace } from '../trace.js';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, normalize, resolve } from 'node:path';

function getOutput(payload) {
  return payload?.tool_response?.output
    ?? payload?.tool_response?.stdout
    ?? payload?.output
    ?? payload?.stdout
    ?? '';
}

function getFilePath(payload) {
  return payload?.tool_input?.file_path ?? payload?.input?.file_path ?? payload?.file_path ?? '';
}

function hashText(text) {
  return createHash('sha256').update(text).digest('hex');
}

function normalizePathForCompare(filePath) {
  return normalize(resolve(filePath)).toLowerCase();
}

function isShadowPath(filePath) {
  return normalize(filePath).replace(/\\/g, '/').split('/').includes('tc-shadow');
}

function getPayloadShadowMetadata(payload) {
  return payload?.metadata?.tcShadow
    ?? payload?.hook_metadata?.tcShadow
    ?? payload?.hookMetadata?.tcShadow
    ?? payload?.tcShadow
    ?? null;
}

function blockShadowRestore(reason, details = {}) {
  return {
    decision: 'block',
    reason,
    ...details
  };
}

async function readShadowMetadata(filePath, payload) {
  const payloadMetadata = getPayloadShadowMetadata(payload);
  if (payloadMetadata) return { ...payloadMetadata, source: 'payload' };

  const metadataPath = join(dirname(filePath), '.tc-shadow.metadata.json');
  try {
    return {
      ...JSON.parse(await readFile(metadataPath, 'utf8')),
      metadataPath,
      source: 'sidecar'
    };
  } catch {
    return null;
  }
}

function validateShadowMetadata(metadata, filePath) {
  if (!metadata) {
    return 'Shadow restore metadata is missing; refusing to overwrite the original TC file.';
  }

  if (metadata.version !== 1) {
    return 'Shadow restore metadata version is unsupported; refusing to overwrite the original TC file.';
  }

  if (!metadata.originalPath || !metadata.shadowPath || !metadata.originalSha256) {
    return 'Shadow restore metadata is incomplete; refusing to overwrite the original TC file.';
  }

  if (normalizePathForCompare(metadata.shadowPath) !== normalizePathForCompare(filePath)) {
    return 'Shadow restore metadata does not match the written shadow path; refusing to overwrite the original TC file.';
  }

  if (isShadowPath(metadata.originalPath)) {
    return 'Shadow restore metadata points the original path at another shadow file; refusing to overwrite.';
  }

  return '';
}

async function restoreShadowWrite(filePath, payload) {
  const metadata = await readShadowMetadata(filePath, payload);
  const metadataError = validateShadowMetadata(metadata, filePath);
  if (metadataError) return blockShadowRestore(metadataError);

  let originalContents;
  let shadowContents;
  try {
    originalContents = await readFile(metadata.originalPath, 'utf8');
    shadowContents = await readFile(filePath, 'utf8');
  } catch {
    return blockShadowRestore('Shadow restore could not read both original and shadow files; refusing to overwrite.', {
      metadata: { tcShadow: metadata }
    });
  }

  const currentOriginalSha256 = hashText(originalContents);
  if (currentOriginalSha256 !== metadata.originalSha256) {
    return blockShadowRestore('Original file content hash is stale; refusing to overwrite a file changed after shadow creation.', {
      metadata: { tcShadow: { ...metadata, currentOriginalSha256 } }
    });
  }

  const currentShadowSha256 = hashText(shadowContents);
  if (metadata.shadowSha256 && currentShadowSha256 === metadata.shadowSha256) {
    return {
      decision: 'allow',
      restored: false,
      reason: 'Shadow file is unchanged; original file left intact.',
      metadata: { tcShadow: { ...metadata, currentShadowSha256 } }
    };
  }

  await writeFile(metadata.originalPath, shadowContents, 'utf8');

  return {
    decision: 'allow',
    restored: true,
    updatedInput: { file_path: metadata.originalPath },
    metadata: { tcShadow: { ...metadata, currentShadowSha256 } }
  };
}

export async function handlePostToolUse(payload, options = {}) {
  const mode = options.mode ?? 'trace';
  if (mode === 'restore') {
    const filePath = getFilePath(payload);
    if (filePath && isShadowPath(filePath)) return restoreShadowWrite(filePath, payload);
    return {};
  }

  const output = getOutput(payload);
  const compacted = compactTrace(output);
  if (compacted === output) return {};
  return { output: compacted };
}
