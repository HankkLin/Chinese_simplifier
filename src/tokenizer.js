import { CJK_GLOBAL_PATTERN } from './cjk.js';

const TRADITIONAL_PATTERN = /[請這個錯誤處檔註資料傳應預設無與開發維護確認變後測試錄將導嚴問題當負責並時統線欄電郵顯體項拋為穩]/gu;
let tokenizerPromise;

function heuristicTokenCount(text) {
  const value = String(text ?? '');
  const cjk = Array.from(value.matchAll(CJK_GLOBAL_PATTERN)).length;
  const traditional = Array.from(value.matchAll(TRADITIONAL_PATTERN)).length;
  const nonCjk = value.replace(CJK_GLOBAL_PATTERN, ' ');
  const latin = nonCjk.trim() ? Math.ceil(nonCjk.trim().split(/\s+/).join(' ').length / 4) : 0;
  return traditional * 3 + (cjk - traditional) * 2 + latin;
}

async function loadTokenizer() {
  tokenizerPromise ??= import('js-tiktoken')
    .then(({ getEncoding }) => getEncoding('cl100k_base'))
    .catch(() => null);
  return tokenizerPromise;
}

export function countProxyTokens(text) {
  return heuristicTokenCount(text);
}

export async function countTokens(text) {
  return countProxyTokens(text);
}

export async function countTokenizerTokens(text) {
  const tokenizer = await loadTokenizer();
  if (!tokenizer) {
    return {
      tokens: countProxyTokens(text),
      method: 'proxy-fallback'
    };
  }

  return {
    tokens: tokenizer.encode(String(text ?? '')).length,
    method: 'js-tiktoken'
  };
}

export async function countTokenMetrics(text) {
  const tokenizer = await countTokenizerTokens(text);
  return {
    proxy: {
      tokens: countProxyTokens(text),
      method: 'deterministic-proxy'
    },
    tokenizer
  };
}
