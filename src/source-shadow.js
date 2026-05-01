import { hasCjk } from './cjk.js';
import { translateWithProtection } from './translate.js';

function compactComment(line) {
  const trimmed = line.trimStart();
  const indent = line.slice(0, line.length - trimmed.length);
  if (trimmed.startsWith('//') && hasCjk(trimmed)) {
    return `${indent}// input validation; stable errors.`;
  }
  return line;
}

export async function optimizeSourceForShadow(source) {
  const commentCompacted = String(source ?? '')
    .split(/\r?\n/)
    .map(compactComment)
    .join('\n');
  return translateWithProtection(commentCompacted, { threshold: 0.01 });
}
