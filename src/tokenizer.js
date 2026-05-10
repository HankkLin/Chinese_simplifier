import { CJK_GLOBAL_PATTERN } from './cjk.js';

let tokenizerPromise;

// Fair character-weighted proxy: ~1.8 tokens per Han character (matches
// cl100k_base for both Traditional and Simplified Chinese on average),
// ~0.27 tokens per Latin character. Does NOT inflate TC vs SC — Han is
// Han for tokenisation purposes.
function fairProxyCount(text) {
  const value = String(text ?? '');
  const cjk = Array.from(value.matchAll(CJK_GLOBAL_PATTERN)).length;
  const nonCjk = value.replace(CJK_GLOBAL_PATTERN, '');
  const latin = nonCjk.length;
  return Math.ceil(cjk * 1.8 + latin * 0.27);
}

async function loadTokenizer() {
  tokenizerPromise ??= import('js-tiktoken')
    .then(({ getEncoding }) => getEncoding('cl100k_base'))
    .catch(() => null);
  return tokenizerPromise;
}

export function countProxyTokens(text) {
  return fairProxyCount(text);
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

export async function countTokenizerTokensStrict(text) {
  const tokenizer = await loadTokenizer();
  if (!tokenizer) {
    throw new Error('js-tiktoken unavailable; install dependency or use countTokenizerTokens for proxy fallback.');
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
      method: 'fair-proxy'
    },
    tokenizer
  };
}
