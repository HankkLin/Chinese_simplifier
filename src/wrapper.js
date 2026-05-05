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
