export const CJK_PATTERN = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u;
export const CJK_GLOBAL_PATTERN = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/gu;

export function hasCjk(text = '') {
  return CJK_PATTERN.test(String(text));
}

export function getCjkRatio(text = '') {
  const value = String(text);
  if (!value.length) return 0;
  const cjkCount = Array.from(value.matchAll(CJK_GLOBAL_PATTERN)).length;
  const meaningfulLength = Array.from(value).filter((char) => !/\s/u.test(char)).length || value.length;
  return cjkCount / meaningfulLength;
}

export function shouldOptimizeText(text = '', threshold = 0.15) {
  const value = String(text);
  const cjkCount = Array.from(value.matchAll(CJK_GLOBAL_PATTERN)).length;
  return cjkCount >= 3 && getCjkRatio(value) > threshold;
}
