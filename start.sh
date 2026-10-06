#!/usr/bin/env bash
# FralRater launcher (Linux/macOS) — opens the app in its own window via Electron.
# Falls back to a browser tab if Electron is not installed.
set -euo pipefail
cd "$(dirname "$0")"

command -v node >/dev/null 2>&1 || { echo "[FralRater] Node.js is required (https://nodejs.org)"; exit 1; }

# Electron: standalone window (default path)
if [ -d node_modules/electron ]; then
  exec ./node_modules/.bin/electron .
fi

echo "[FralRater] Electron not found — installing it (one-time download)..."
npm install
if [ -d node_modules/electron ]; then
  exec ./node_modules/.bin/electron .
fi

# Fallback: plain browser
PORT="${PORT:-4173}"
node server.js &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
sleep 0.7
URL="http://localhost:${PORT}"
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" || true
elif command -v open >/dev/null 2>&1; then
  open "$URL" || true
else
  echo "No browser launcher found; open $URL manually."
fi
wait $SERVER_PID
