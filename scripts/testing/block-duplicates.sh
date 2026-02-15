#!/bin/bash
# Blokuje commit z plikami zawierającymi " 2", " 3" w nazwie (duplikaty)
dupes=$(git diff --cached --name-only 2>/dev/null | grep -E '\s[2-9]\.[a-zA-Z]+$' || true)
if [ -n "$dupes" ]; then
  echo "❌ BLOCKED: Duplikaty w nazwach plików:"
  echo "$dupes"
  echo "Usuń te pliki lub odblokuj z staging."
  exit 1
fi
exit 0
