#!/bin/bash
# Szybki setup API key - bezpieczny sposób

echo "🔑 Szybki setup OPENAI_API_KEY"
echo ""
echo "⚠️  BEZPIECZEŃSTWO:"
echo "   - Klucz będzie zapisany tylko lokalnie w pliku .env"
echo "   - Plik .env jest w .gitignore (nie zostanie zacommitowany)"
echo "   - Klucz nie będzie widoczny w historii komend"
echo ""

# Sprawdź czy .env istnieje
if [ ! -f .env ]; then
    echo "📝 Tworzenie pliku .env..."
    touch .env
fi

# Sprawdź czy klucz już istnieje
if grep -q "^OPENAI_API_KEY=" .env 2>/dev/null; then
    current_key=$(grep "^OPENAI_API_KEY=" .env | cut -d'=' -f2 | head -c 15)
    echo "⚠️  OPENAI_API_KEY już istnieje w .env (${current_key}...)"
    echo ""
    read -p "Czy chcesz go nadpisać? (t/n): " overwrite
    if [ "$overwrite" != "t" ] && [ "$overwrite" != "T" ] && [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
        echo "✅ Zachowano istniejący klucz"
        exit 0
    fi
    # Usuń starą linię
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' '/^OPENAI_API_KEY=/d' .env
    else
        # Linux
        sed -i '/^OPENAI_API_KEY=/d' .env
    fi
fi

echo ""
echo "📋 Wklej swój klucz API OpenAI:"
echo "   (klucz zaczyna się od 'sk-' i będzie ukryty podczas wpisywania)"
echo ""
read -s -p "OPENAI_API_KEY: " api_key
echo ""

if [ -z "$api_key" ]; then
    echo "❌ Klucz nie może być pusty!"
    exit 1
fi

# Sprawdź format klucza
if [[ ! "$api_key" =~ ^sk- ]]; then
    echo "⚠️  Ostrzeżenie: Klucz nie zaczyna się od 'sk-'"
    read -p "Czy na pewno chcesz kontynuować? (t/n): " confirm
    if [ "$confirm" != "t" ] && [ "$confirm" != "T" ] && [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "❌ Anulowano"
        exit 1
    fi
fi

# Dodaj do .env
echo "OPENAI_API_KEY=$api_key" >> .env

echo ""
echo "✅ Klucz został bezpiecznie zapisany w pliku .env"
echo ""
echo "🔍 Weryfikacja (pierwsze 15 znaków):"
masked_key=$(echo "$api_key" | head -c 15)
echo "   ${masked_key}..."
echo ""
echo "🧪 Testowanie konfiguracji..."
if node -e "require('dotenv').config(); console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET (' + process.env.OPENAI_API_KEY.substring(0, 10) + '...)' : 'NOT SET');" 2>/dev/null; then
    echo ""
    echo "✅ Konfiguracja działa poprawnie!"
    echo ""
    echo "🚀 Możesz teraz uruchomić:"
    echo "   ./scripts/setup-auto-fix.sh"
    echo "   lub"
    echo "   node scripts/auto-fix.js --test-output='...' --test-failed=true"
else
    echo ""
    echo "⚠️  Nie udało się zweryfikować konfiguracji, ale klucz został zapisany"
    echo "   Spróbuj uruchomić skrypt ponownie"
fi








