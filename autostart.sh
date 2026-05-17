#!/usr/bin/env bash
# Workify autostart — idempotent.
# Starts the local server in a detached background process if it isn't already
# running. Safe to call from .bashrc / .zshrc / a desktop launcher / wherever.

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

# Port already responding -> server is up, nothing to do.
if (echo >/dev/tcp/localhost/13001) >/dev/null 2>&1; then
  exit 0
fi

# Resolve `node` from PATH; if not present, fall back to typical nvm path.
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
    NODE_BIN="$(command -v node || true)"
  fi
fi
if [ -z "$NODE_BIN" ]; then
  echo "workify autostart: node not found in PATH" >&2
  exit 1
fi

setsid -f "$NODE_BIN" "$DIR/server.js" >/tmp/workify.log 2>&1 < /dev/null
