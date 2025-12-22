#!/bin/bash
# Skrypt pomocniczy do ustawienia OPENAI_API_KEY

echo "🔑 Konfiguracja OPENAI_API_KEY"
echo ""

# Sprawdź czy .env istnieje
if [ ! -f .env ]; then
    echo "📝 Tworzenie pliku .env..."
    touch .env
fi

# Sprawdź czy klucz już istnieje
if grep -q "OPENAI_API_KEY" .env 2>/dev/null; then
    echo "⚠️  OPENAI_API_KEY już istnieje w .env"
    read -p "Czy chcesz go nadpisać? (t/n): " overwrite
    if [ "$overwrite" != "t" ] && [ "$overwrite" != "T" ]; then
        echo "❌ Anulowano"
        exit 0
    fi
    # Usuń starą linię
    sed -i.bak '/^OPENAI_API_KEY=/d' .env
fi

# Pobierz klucz od użytkownika
echo ""
echo "Wklej swój klucz API OpenAI (zaczyna się od sk-):"
read -s api_key

if [ -z "$api_key" ]; then
    echo "❌ Klucz nie może być pusty!"
    exit 1
fi

# Dodaj do .env
echo "OPENAI_API_KEY=$api_key" >> .env
echo ""
echo "✅ Klucz został dodany do .env"
echo ""
echo "🔍 Sprawdzenie:"
grep OPENAI_API_KEY .env | sed 's/\(sk-.\{10\}\).*/\1.../'
echo ""
echo "💡 Możesz teraz uruchomić: ./scripts/setup-auto-fix.sh"
