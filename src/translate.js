import { shouldOptimizeText, shouldTranslateTraditional } from './cjk.js';
import { protectText, restoreProtectedText } from './protect.js';

const TC_TO_SC = new Map(Object.entries({
  請: '请',
  這: '这',
  個: '个',
  錯: '错',
  誤: '误',
  處: '处',
  執: '执',
  驗: '验',
  證: '证',
  輸: '输',
  狀: '状',
  態: '态',
  檔: '档',
  註: '注',
  資: '资',
  傳: '传',
  應: '应',
  預: '预',
  設: '设',
  無: '无',
  與: '与',
  開: '开',
  發: '发',
  維: '维',
  護: '护',
  確: '确',
  認: '认',
  變: '变',
  後: '后',
  測: '测',
  試: '试',
  錄: '录',
  將: '将',
  導: '导',
  嚴: '严',
  問: '问',
  題: '题',
  當: '当',
  負: '负',
  責: '责',
  並: '并',
  漏: '漏',
  時: '时',
  統: '统',
  線: '线',
  欄: '栏',
  電: '电',
  郵: '邮',
  顯: '显',
  體: '体',
  項: '项',
  拋: '抛',
  為: '为',
  穩: '稳'
}));

async function openccTranslate(text) {
  try {
    const mod = await import('node-opencc');
    const api = mod.default ?? mod;
    if (typeof api.traditionalToSimplified === 'function') {
      return await api.traditionalToSimplified(text);
    }
    if (typeof api.t2s === 'function') {
      return await api.t2s(text);
    }
  } catch {
    // Fall back to a deterministic minimal map when node-opencc is unavailable.
  }
  return Array.from(text).map((char) => TC_TO_SC.get(char) ?? char).join('');
}

export async function translateWithProtection(text, options = {}) {
  const value = String(text ?? '');
  const threshold = options.threshold ?? 0.15;
  if (!shouldTranslateTraditional(value, threshold)) return value;

  const { protectedText, values } = protectText(value);
  const translated = await openccTranslate(protectedText);
  return restoreProtectedText(translated, values);
}

export function optimizeChinesePrompt(text) {
  const value = String(text ?? '');
  if (!shouldOptimizeText(value)) return value;

  const { protectedText, values } = protectText(value);
  const references = collectPromptReferences(value, values);
  const tests = collectTestCommands(value);
  const intent = summarizePromptIntent(value, protectedText, values, references);

  if (!intent || (!references.length && !tests.length && intent.length < 12)) {
    return restoreProtectedText(protectedText, values);
  }

  const parts = [`Task: ${intent}`];
  if (references.length) parts.push(`Preserve refs: ${references.join(' ')}`);
  if (tests.length) parts.push(`Tests: ${tests.join(' | ')}`);

  const optimized = parts.join('. ') + '.';
  return optimized;
}

function collectPromptReferences(text, values) {
  const references = [];
  const seen = new Set();

  for (const match of String(text).matchAll(/\b[\w.-]+(?:[\/\\][\w.-]+)+(?:\.[A-Za-z0-9]+)?/g)) {
    addReference(references, seen, match[0]);
  }

  for (const item of values) {
    if (!/`|[./\\]|--|\b[A-Za-z_$][\w$]*\(/.test(item)) continue;
    addReference(references, seen, item);
  }

  return references;
}

function addReference(references, seen, item) {
  const compact = normalizeWhitespace(item);
  if (!compact || seen.has(compact)) return;
  if (references.some((reference) => reference.includes(compact))) return;

  for (let index = references.length - 1; index >= 0; index -= 1) {
    if (!compact.includes(references[index])) continue;
    seen.delete(references[index]);
    references.splice(index, 1);
  }

  seen.add(compact);
  references.push(compact);
}

function collectTestCommands(text) {
  const commands = [];
  const seen = new Set();
  const commandPattern = /\b(?:npm|pnpm|yarn|node|npx|vitest|jest|pytest|cargo|go|python|python3)\b(?:\s+(?:--?[A-Za-z0-9][\w-]*|[A-Za-z0-9_./\\:=+-]+))*/gi;

  for (const match of String(text).matchAll(commandPattern)) {
    const command = normalizeWhitespace(match[0].replace(/[。．.，,、；;]+$/u, ''));
    if (!/\b(?:test|spec|check|lint|build|run)\b|--/i.test(command)) continue;
    if (seen.has(command)) continue;
    seen.add(command);
    commands.push(command);
  }

  return commands;
}

function summarizePromptIntent(originalText, protectedText, values, references) {
  const hints = [];
  const value = String(originalText);
  const lower = value.toLowerCase();

  if (/修正|錯誤|錯誤處理|错误|错误处理|例外|異常|异常|bug|fix|error|exception/u.test(value)) {
    hints.push('fix error handling');
  } else if (/新增|加入|implement|add/u.test(value)) {
    hints.push('implement requested change');
  } else if (/更新|調整|change|update/u.test(value)) {
    hints.push('update requested behavior');
  } else if (/重構|refactor/u.test(value)) {
    hints.push('refactor requested code');
  }

  if (/驗證|验证|validation|validate|email|name|role|form|表單|表单|欄位|栏位/u.test(value)) {
    const fields = ['email', 'name', 'role'].filter((field) => lower.includes(field));
    hints.push(fields.length ? `validate ${fields.join('/')}` : 'preserve validation behavior');
  }

  if (/公開介面|public interface|api|介面/u.test(value)) hints.push('preserve public API');
  if (/最小必要|minimal|minimum/u.test(value)) hints.push('make minimal changes');

  const symbol = references.find((item) => /\w+\(/.test(item))?.replace(/`/g, '');
  if (symbol && hints.length) {
    return trimIntent(`${hints.join('; ')} for ${symbol}`, 180);
  }

  if (hints.length) return trimIntent(hints.join('; '), 180);
  return extractPromptIntent(protectedText, values);
}

function extractPromptIntent(protectedText, values) {
  const commandPattern = /\b(?:npm|pnpm|yarn|node|npx|vitest|jest|pytest|cargo|go|python|python3)\b[^\r\n]*/gi;
  const withoutReferences = protectedText.replace(/__TC_PROTECT_\d+__/g, '');
  const lines = restoreProtectedText(withoutReferences, values)
    .split(/\r?\n/u)
    .map((line) => line.replace(commandPattern, ''))
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .filter((line) => !/^```/.test(line))
    .filter((line) => !/^(?:npm|pnpm|yarn|node|npx|vitest|jest|pytest|cargo|go|python|python3)\b/i.test(line));

  const intentLines = lines.filter((line) => hasIntentSignal(line));
  const selected = intentLines.length ? intentLines : lines;
  const intent = selected.slice(0, 2).join(' ');
  return trimIntent(intent, 260);
}

function hasIntentSignal(line) {
  return /fix|repair|debug|change|update|add|implement|refactor|preserve|keep|test|verify|修|改|新增|加入|實作|实作|处理|處理|錯|错|錯誤|错误|測試|测试|驗證|验证|保留|確認|确认|完成|complete/u.test(line);
}

function trimIntent(text, maxLength) {
  const value = normalizeWhitespace(text);
  if (value.length <= maxLength) return value;

  const truncated = value.slice(0, maxLength);
  const boundary = truncated.search(/[。．.；;，,]\s*[^。．.；;，,]*$/u);
  if (boundary > 40) return truncated.slice(0, boundary).trim();
  return `${truncated.trim()}...`;
}

function normalizeWhitespace(text) {
  return String(text).replace(/\s+/gu, ' ').trim();
}
