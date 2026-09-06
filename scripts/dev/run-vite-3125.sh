#!/bin/sh
# ZLECENIE 1.1-J — dev-render harness (mock data, no login, CLAUDE.md #7).
cd /private/tmp/wt-11j || exit 1
export VITE_DOTENV_DISABLED=1
export VITE_API_TARGET=http://127.0.0.1:4100
export VITE_API_URL=
exec npx vite --config dev-render/vite.config.ts --port 3125 --strictPort --host 127.0.0.1
