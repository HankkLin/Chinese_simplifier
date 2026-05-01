import { CJK_GLOBAL_PATTERN } from './cjk.js';

const TRADITIONAL_PATTERN = /[請這個錯誤處檔註資料傳應預設無與開發維護確認變後測試錄將導嚴問題當負責並時統線欄電郵顯體項拋為穩]/gu;

function heuristicTokenCount(text) {
  const value = String(text ?? '');
  const cjk = Array.from(value.matchAll(CJK_GLOBAL_PATTERN)).length;
  const traditional = Array.from(value.matchAll(TRADITIONAL_PATTERN)).length;
  const nonCjk = value.replace(CJK_GLOBAL_PATTERN, ' ');
  const latin = nonCjk.trim() ? Math.ceil(nonCjk.trim().split(/\s+/).join(' ').length / 4) : 0;
  return traditional * 3 + (cjk - traditional) * 2 + latin;
}

export async function countTokens(text) {
  return heuristicTokenCount(text);
}
