#!/bin/sh
export VITE_DOTENV_DISABLED=1
export VITE_API_TARGET=http://127.0.0.1:4100
export VITE_API_URL=
exec npx vite --port 3124 --strictPort --host 127.0.0.1
