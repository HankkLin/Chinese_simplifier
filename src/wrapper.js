import { optimizeChinesePrompt } from './translate.js';

export async function optimizePromptArgument(arg) {
  return optimizeChinesePrompt(arg);
}

export function buildClaudeInvocation(args, env = process.env) {
  const command = env.TC_CLAUDE_REAL_BIN || 'claude';
  return { command, args };
}

export async function optimizeArgs(args) {
  const optimized = [];
  for (const arg of args) {
    if (arg.startsWith('-')) {
      optimized.push(arg);
    } else {
      optimized.push(await optimizePromptArgument(arg));
    }
  }
  return optimized;
}
