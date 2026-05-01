function normalizePath(path) {
  return path.replaceAll('\\', '/').replace(/^[A-Za-z]:/, '');
}

function compactJsTrace(text) {
  const lines = text.split(/\r?\n/);
  const header = lines.find((line) => /^\w*(?:Error|Exception|TypeError|ReferenceError|SyntaxError):/.test(line.trim()));
  const frames = [];

  for (const line of lines) {
    if (!/^\s+at\s+/.test(line)) continue;
    if (/node_modules|node:internal|internal\//.test(line)) continue;
    const match = line.match(/\(?([A-Za-z]:)?([^():]+):(\d+):(\d+)\)?/);
    if (match) frames.push(`  ${normalizePath(`${match[2]}:${match[3]}`)}`);
  }

  if (!header || frames.length === 0) return text;
  return `<COMPACT_TRACEBACK>\n${header.trim()}\n${frames.slice(0, 5).join('\n')}\n</COMPACT_TRACEBACK>`;
}

function compactPythonTrace(text) {
  const lines = text.split(/\r?\n/);
  const frames = [];
  for (const line of lines) {
    const match = line.match(/File "([^"]+)", line (\d+), in (.+)/);
    if (!match) continue;
    if (/site-packages|lib\/python|\\Lib\\/.test(match[1])) continue;
    frames.push(`  ${normalizePath(match[1])}:${match[2]} in ${match[3].trim()}`);
  }
  const header = [...lines].reverse().find((line) => /^\w*(?:Error|Exception|Warning):/.test(line.trim()));
  if (!header || frames.length === 0) return text;
  return `<COMPACT_TRACEBACK>\n${header.trim()}\n${frames.slice(-5).join('\n')}\n</COMPACT_TRACEBACK>`;
}

function compactJavaTrace(text) {
  if (!/Exception in thread|^\w+(?:Exception|Error):/m.test(text)) return text;
  const lines = text.split(/\r?\n/);
  const header = lines.find((line) => /Exception|Error/.test(line))?.trim();
  const frames = lines
    .filter((line) => /^\s+at\s+/.test(line) && !/java\.base|jdk\.|org\.junit/.test(line))
    .slice(0, 5)
    .map((line) => `  ${line.trim().replace(/^at\s+/, '')}`);
  if (!header || frames.length === 0) return text;
  return `<COMPACT_TRACEBACK>\n${header}\n${frames.join('\n')}\n</COMPACT_TRACEBACK>`;
}

export function isTrace(text = '') {
  return /(^|\n)(Traceback \(most recent call last\)|\s+at\s+|Exception in thread|\w*(?:Error|Exception):)/.test(String(text));
}

export function compactTrace(text = '') {
  const value = String(text);
  if (!isTrace(value)) return value;
  const py = compactPythonTrace(value);
  if (py !== value) return py;
  const js = compactJsTrace(value);
  if (js !== value) return js;
  return compactJavaTrace(value);
}
