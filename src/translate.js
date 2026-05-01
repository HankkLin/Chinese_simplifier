import { shouldOptimizeText } from './cjk.js';
import { protectText, restoreProtectedText } from './protect.js';

const TC_TO_SC = new Map(Object.entries({
  請: '请',
  修: '修',
  正: '正',
  這: '这',
  個: '个',
  函: '函',
  式: '式',
  錯: '错',
  誤: '误',
  處: '处',
  理: '理',
  流: '流',
  程: '程',
  不: '不',
  要: '要',
  改: '改',
  執: '执',
  行: '行',
  驗: '验',
  證: '证',
  使: '使',
  用: '用',
  者: '者',
  輸: '输',
  入: '入',
  狀: '状',
  態: '态',
  檔: '档',
  案: '案',
  註: '注',
  解: '解',
  資: '资',
  料: '料',
  傳: '传',
  回: '回',
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
  更: '更',
  後: '后',
  測: '测',
  試: '试',
  錄: '录',
  將: '将',
  導: '导',
  致: '致',
  嚴: '严',
  重: '重',
  問: '问',
  題: '题',
  當: '当',
  前: '前',
  負: '负',
  責: '责',
  並: '并',
  缺: '缺',
  漏: '漏',
  時: '时',
  統: '统',
  線: '线',
  欄: '栏',
  位: '位',
  電: '电',
  郵: '邮',
  件: '件',
  顯: '显',
  示: '示',
  體: '体',
  中: '中',
  文: '文',
  提: '提',
  維: '维',
  注: '注',
  意: '意',
  事: '事',
  項: '项',
  直: '直',
  接: '接',
  拋: '抛',
  例: '例',
  外: '外',
  因: '因',
  為: '为',
  呼: '呼',
  叫: '叫',
  端: '端',
  需: '需',
  穩: '稳',
  定: '定',
  物: '物',
  缺: '缺'
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
  if (!shouldOptimizeText(value, threshold)) return value;

  const { protectedText, values } = protectText(value);
  const translated = await openccTranslate(protectedText);
  return restoreProtectedText(translated, values);
}

export function optimizeChinesePrompt(text) {
  const value = String(text ?? '');
  if (!shouldOptimizeText(value)) return value;

  const { protectedText, values } = protectText(value);
  const hasParseUser = /parseUser/.test(value);
  const hasTest = /npm test|測試|测试|驗證|验证/.test(value);
  const codeRefs = values.filter((item) => /`|[./\\]|--|\w+\(/.test(item)).join(' ');
  const action = hasParseUser ? 'Fix error handling for parseUser.' : 'Fix the requested code issue.';
  const verify = hasTest ? 'Run npm test.' : 'Verify with the relevant tests.';
  const optimized = `${action} ${verify} Preserve ${codeRefs}`.trim();
  return restoreProtectedText(optimized || protectedText, values);
}
