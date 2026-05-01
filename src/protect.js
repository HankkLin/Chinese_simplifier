const PROTECTED_PATTERNS = [
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  /(?:[A-Za-z]:)?(?:[./\\][\w.-]+)+(?:\.[A-Za-z0-9]+)?/g,
  /--[A-Za-z0-9][\w-]*/g,
  /\b[A-Za-z_$][\w$]*\([^)]*\)/g
];

export function protectText(text) {
  const values = [];
  let protectedText = String(text);

  for (const pattern of PROTECTED_PATTERNS) {
    protectedText = protectedText.replace(pattern, (match) => {
      const token = `__TC_PROTECT_${values.length}__`;
      values.push(match);
      return token;
    });
  }

  return { protectedText, values };
}

export function restoreProtectedText(text, values) {
  return String(text).replace(/__TC_PROTECT_(\d+)__/g, (_, index) => values[Number(index)] ?? _);
}
