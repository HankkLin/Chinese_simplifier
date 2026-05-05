import { hasCjk } from './cjk.js';
import { translateWithProtection } from './translate.js';

const COMMENT_SIGNALS = [
  { label: 'auth/security', pattern: /\b(auth|security|permission|credential|secret|token)\b|登入|登录|授權|授权|權限|权限|未授權|未授权/iu },
  { label: 'validation', pattern: /\b(validat(?:e|es|ion)|check)\b|驗證|验证|校驗|校验|檢查|检查/iu },
  { label: 'error handling', pattern: /\b(error|exception|fail(?:ed|ure)?|fallback)\b|錯誤|错误|例外|異常|异常|失敗|失败/iu },
  { label: 'tests', pattern: /\b(test|tests|spec|fixture)\b|測試|测试|規格|规格/iu },
  { label: 'performance', pattern: /\b(perf(?:ormance)?|latency|throughput|cache|query)\b|效能|性能|快取|缓存|查詢|查询|重複|重复/iu },
  { label: 'configuration', pattern: /\b(config|configuration|env|option|flag|setting)\b|設定|设定|配置|環境|环境/iu }
];

const DOMAIN_STOPWORDS = new Set([
  'TODO',
  'FIXME',
  'NOTE',
  'auth',
  'authorization',
  'security',
  'permission',
  'permissions',
  'credential',
  'credentials',
  'secret',
  'secrets',
  'validate',
  'validates',
  'validation',
  'check',
  'checks',
  'error',
  'errors',
  'exception',
  'exceptions',
  'failure',
  'fail',
  'failed',
  'fallback',
  'test',
  'tests',
  'spec',
  'fixture',
  'performance',
  'perf',
  'latency',
  'throughput',
  'cache',
  'query',
  'config',
  'configuration',
  'env',
  'option',
  'flag',
  'setting'
].map((word) => word.toLowerCase()));

function unique(values) {
  return Array.from(new Set(values));
}

function detectMarkers(comment) {
  const markers = [];
  if (/\bTODO\b|待辦|待办|待處理|待处理/iu.test(comment)) markers.push('TODO');
  if (/\bFIXME\b|\bBUG\b|修正|修復|修复/iu.test(comment)) markers.push('FIXME');
  return markers;
}

function detectSignals(comment) {
  return COMMENT_SIGNALS
    .filter(({ pattern }) => pattern.test(comment))
    .map(({ label }) => label);
}

function detectDomainTerms(comment) {
  const words = comment.match(/\b[A-Za-z][A-Za-z0-9_]*\b/gu) ?? [];
  return unique(words)
    .filter((word) => !DOMAIN_STOPWORDS.has(word.toLowerCase()))
    .slice(0, 3);
}

function compactComment(line) {
  const trimmed = line.trimStart();
  const indent = line.slice(0, line.length - trimmed.length);
  if (trimmed.startsWith('//') && hasCjk(trimmed)) {
    const comment = trimmed.slice(2).trim();
    const parts = [
      ...detectMarkers(comment),
      ...detectSignals(comment)
    ];
    const domainTerms = detectDomainTerms(comment);
    if (domainTerms.length) parts.push(`domain: ${domainTerms.join(', ')}`);
    return `${indent}// ${unique(parts).join('; ') || 'source note'}.`;
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
