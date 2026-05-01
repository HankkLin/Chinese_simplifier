export async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

export async function readJsonFromStdin() {
  const input = await readStdin();
  if (!input.trim()) return {};
  return JSON.parse(input);
}

export function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}
