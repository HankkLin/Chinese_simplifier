import { compactTrace } from '../trace.js';

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

export async function handlePostToolUse(payload, options = {}) {
  const mode = options.mode ?? 'trace';
  if (mode === 'restore') {
    const filePath = getFilePath(payload);
    if (filePath.includes('tc-shadow')) {
      return {
        decision: 'block',
        reason: 'Shadow write restore metadata is unavailable; refusing to overwrite the original TC file.'
      };
    }
    return {};
  }

  const output = getOutput(payload);
  const compacted = compactTrace(output);
  if (compacted === output) return {};
  return { output: compacted };
}
