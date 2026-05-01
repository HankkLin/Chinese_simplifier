// This function validates user input and returns stable errors for missing data.
export function parseUser(input) {
  if (!input.email) return { ok: false, error: 'missing email' };
  return { ok: true, value: input };
}
