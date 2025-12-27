#!/bin/bash
# Sprawdza klucz API i uruchamia auto-fix

echo "🔍 Sprawdzam konfigurację klucza API..."
echo ""

# Sprawdź różne źródła
HAS_KEY=false

# 1. Sprawdź zmienną środowiskową
if [ -n "$OPENAI_API_KEY" ]; then
    echo "✅ Klucz znaleziony jako zmienna środowiskowa"
    HAS_KEY=true
fi

# 2. Sprawdź plik .env
if [ -f .env ] && grep -q "^OPENAI_API_KEY=" .env 2>/dev/null; then
    echo "✅ Klucz znaleziony w pliku .env"
    # Załaduj .env
    export $(grep -v '^#' .env | xargs)
    HAS_KEY=true
fi

# 3. Sprawdź przez Node.js
if node -e "require('dotenv').config(); if (process.env.OPENAI_API_KEY) { process.exit(0); } else { process.exit(1); }" 2>/dev/null; then
    echo "✅ Klucz dostępny przez dotenv"
    HAS_KEY=true
fi

if [ "$HAS_KEY" = false ]; then
    echo "❌ OPENAI_API_KEY nie jest ustawione!"
    echo ""
    echo "📝 Szybkie rozwiązanie:"
    echo "   1. Uruchom: ./scripts/quick-setup-api.sh"
    echo "   2. LUB: export OPENAI_API_KEY='sk-twoj-klucz'"
    echo "   3. LUB: echo 'OPENAI_API_KEY=sk-twoj-klucz' >> .env"
    exit 1
fi

echo ""
echo "🚀 Klucz API jest dostępny! Uruchamiam auto-fix..."
echo ""

# Załaduj zmienne z .env jeśli istnieje
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Uruchom auto-fix setup
./scripts/setup-auto-fix.sh






