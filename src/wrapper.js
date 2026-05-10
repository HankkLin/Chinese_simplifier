import { optimizeChinesePrompt } from './translate.js';

const WINDOWS_COMMAND_FILE = /\.(?:cmd|bat)$/i;

export async function optimizePromptArgument(arg) {
  return optimizeChinesePrompt(arg);
}

function isWindowsCommandFile(command) {
  return WINDOWS_COMMAND_FILE.test(command.replace(/^"|"$/g, ''));
}

function quoteCmdArgument(value) {
  const text = String(value);
  if (text.length === 0) return '""';
  return `"${text.replace(/([()%!^"<>&|])/g, '^$1')}"`;
}

function buildWindowsCommandInvocation(command, args, env) {
  const shellCommand = [
    'call',
    quoteCmdArgument(command),
    ...args.map(quoteCmdArgument)
  ].join(' ');

  return {
    command: env.ComSpec || 'cmd.exe',
    args: ['/d', '/s', '/c', shellCommand],
    options: {
      shell: false,
      windowsVerbatimArguments: true
    }
  };
}

export function buildClaudeInvocation(args, env = process.env, platform = process.platform) {
  const command = env.TC_CLAUDE_REAL_BIN || 'claude';
  if (platform === 'win32' && isWindowsCommandFile(command)) {
    return buildWindowsCommandInvocation(command, args, env);
  }

  return {
    command,
    args,
    options: {
      shell: false
    }
  };
}

function looksLikeFileReference(value) {
  return /^[./\\]|[\\/]/.test(value) || /\.[A-Za-z0-9]{1,8}$/.test(value);
}

function lastPositionalIndex(args) {
  for (let i = args.length - 1; i >= 0; i -= 1) {
    if (args[i].startsWith('-')) continue;
    if (looksLikeFileReference(args[i])) continue;
    return i;
  }
  return -1;
}

export async function optimizeArgs(args) {
  const promptIndex = lastPositionalIndex(args);
  const optimized = args.slice();
  if (promptIndex >= 0) {
    optimized[promptIndex] = await optimizePromptArgument(args[promptIndex]);
  }
  return optimized;
}
