#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHELL_RC="${HOME}/.zshrc"
if [ -n "${BASH_VERSION:-}" ]; then
  SHELL_RC="${HOME}/.bashrc"
fi

ALIAS_LINE="alias claude=\"node ${ROOT_DIR}/wrapper/tc-claude.js\""

if ! grep -Fq "$ALIAS_LINE" "$SHELL_RC" 2>/dev/null; then
  printf '\n%s\n' "$ALIAS_LINE" >> "$SHELL_RC"
fi

printf 'TC Token Optimizer installed. Restart your terminal or run: source %s\n' "$SHELL_RC"
