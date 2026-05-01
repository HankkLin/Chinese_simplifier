// 這個函式負責驗證使用者輸入，並且在資料缺漏時回傳一致的錯誤格式。
// 維護注意事項：不要在這裡直接拋出未處理例外，因為呼叫端需要穩定的錯誤物件。
export function parseUser(input: { email?: string; name?: string; role?: string }) {
  // 當 email 欄位不存在時，前端會顯示繁體中文提示。
  if (!input.email) return { ok: false, error: '缺少電子郵件欄位' };
  return { ok: true, value: input };
}
