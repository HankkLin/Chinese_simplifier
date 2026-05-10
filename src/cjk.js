export const CJK_PATTERN = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u;
export const CJK_GLOBAL_PATTERN = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/gu;

// Hiragana + katakana \u2014 present only in Japanese, never in Chinese.
const JAPANESE_KANA_PATTERN = /[\u3040-\u309F\u30A0-\u30FF\uFF66-\uFF9F]/u;

// Hand-curated set of Han characters that exist in Traditional Chinese
// but have a different glyph in Simplified Chinese. Presence of any one
// is a strong signal that the text is TC rather than SC or Japanese kanji.
const TRADITIONAL_DISTINCTIVE_PATTERN = /[\u8ACB\u9019\u500B\u932F\u8AA4\u8655\u57F7\u9A57\u8B49\u8F38\u72C0\u614B\u6A94\u8A3B\u8CC7\u50B3\u61C9\u9810\u8A2D\u7121\u8207\u958B\u767C\u7DAD\u8B77\u78BA\u8A8D\u8B8A\u5F8C\u6E2C\u8A66\u9304\u5C07\u5C0E\u56B4\u554F\u984C\u7576\u8CA0\u8CAC\u4E26\u6F0F\u6642\u7D71\u7DDA\u6B04\u96FB\u90F5\u986F\u9AD4\u9805\u62CB\u70BA\u7A69\u7063\u9EDE\u9EBC\u570B\u5B78\u9F8D\u5C0D\u91AB\u5F9E\u7D93\u9032\u908A\u9084\u4F86\u904E\u5011\u95DC\u6A23\u73FE\u5834\u89AA\u7FA9\u8B58\u89C0\u842C\u696D\u7522\u5340\u52D5\u7A2E\u6A02\u96A8\u6A19\u97FF\u8072\u5BEC\u5EE3\u8C50\u8A9E\u8B80\u66F8\u807D\u805E\u820A\u8B93\u908F\u8F2F\u5BE6\u969B\u969B\u5718\u54E1\u5716\u6A19\u984C\u7DB2\u7D61\u8207\u8655\u5247\u7E3D\u9EDE\u96E2\u958B\u982D]/u;

export function hasCjk(text = '') {
  return CJK_PATTERN.test(String(text));
}

export function hasJapaneseKana(text = '') {
  return JAPANESE_KANA_PATTERN.test(String(text));
}

export function hasTraditionalIndicators(text = '') {
  return TRADITIONAL_DISTINCTIVE_PATTERN.test(String(text));
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
  if (hasJapaneseKana(value)) return false;
  const cjkCount = Array.from(value.matchAll(CJK_GLOBAL_PATTERN)).length;
  return cjkCount >= 3 && getCjkRatio(value) > threshold;
}

export function shouldTranslateTraditional(text = '', threshold = 0.15) {
  return shouldOptimizeText(text, threshold) && hasTraditionalIndicators(text);
}
