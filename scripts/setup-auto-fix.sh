#!/bin/bash
# Skrypt pomocniczy do konfiguracji i uruchomienia auto-fix

echo "🔧 Konfiguracja Auto-Fix Script"
echo ""

# Sprawdź czy .env istnieje
if [ ! -f .env ]; then
    echo "📝 Tworzenie pliku .env..."
    touch .env
fi

# Sprawdź czy OPENAI_API_KEY jest ustawione
if grep -q "OPENAI_API_KEY" .env 2>/dev/null; then
    echo "✅ OPENAI_API_KEY znaleziony w .env"
    source .env
    if [ -n "$OPENAI_API_KEY" ]; then
        echo "   Klucz: ${OPENAI_API_KEY:0:10}..."
    else
        echo "⚠️  Klucz jest pusty"
    fi
else
    echo "⚠️  OPENAI_API_KEY nie znaleziony w .env"
    echo ""
    echo "📝 Aby dodać klucz API:"
    echo "   1. Otwórz plik .env"
    echo "   2. Dodaj linię: OPENAI_API_KEY=sk-twoj-klucz-api"
    echo "   3. Lub uruchom: echo 'OPENAI_API_KEY=sk-...' >> .env"
    echo ""
    echo "🔗 Uzyskaj klucz na: https://platform.openai.com/api-keys"
fi

echo ""
echo "📋 Dostępne opcje:"
echo "   1. Uruchom testy i auto-fix"
echo "   2. Uruchom lint i auto-fix"
echo "   3. Uruchom typecheck i auto-fix"
echo "   4. Uruchom wszystko (testy + lint + typecheck)"
echo "   5. Tylko demo (bez faktycznego wywołania API)"
echo ""
read -p "Wybierz opcję (1-5): " option

case $option in
    1)
        echo "🧪 Uruchamianie testów..."
        npm run test:all 2>&1 | tee test-output.log
        TEST_FAILED=$?
        if [ $TEST_FAILED -ne 0 ]; then
            echo "⚠️  Testy nie przeszły, uruchamiam auto-fix..."
            node scripts/auto-fix.js \
                --test-output="$(cat test-output.log)" \
                --test-failed=true \
                --lint-failed=false \
                --typecheck-failed=false
        else
            echo "✅ Wszystkie testy przeszły!"
        fi
        ;;
    2)
        echo "🔍 Uruchamianie lint..."
        npm run lint 2>&1 | tee lint-output.log
        LINT_FAILED=$?
        if [ $LINT_FAILED -ne 0 ]; then
            echo "⚠️  Lint nie przeszedł, uruchamiam auto-fix..."
            node scripts/auto-fix.js \
                --lint-output="$(cat lint-output.log)" \
                --test-failed=false \
                --lint-failed=true \
                --typecheck-failed=false
        else
            echo "✅ Lint przeszedł!"
        fi
        ;;
    3)
        echo "📝 Uruchamianie typecheck..."
        npm run type-check 2>&1 | tee typecheck-output.log
        TYPECHECK_FAILED=$?
        if [ $TYPECHECK_FAILED -ne 0 ]; then
            echo "⚠️  Typecheck nie przeszedł, uruchamiam auto-fix..."
            node scripts/auto-fix.js \
                --typecheck-output="$(cat typecheck-output.log)" \
                --test-failed=false \
                --lint-failed=false \
                --typecheck-failed=true
        else
            echo "✅ Typecheck przeszedł!"
        fi
        ;;
    4)
        echo "🔄 Uruchamianie wszystkich testów..."
        npm run test:all 2>&1 | tee test-output.log
        TEST_FAILED=$?
        npm run lint 2>&1 | tee lint-output.log
        LINT_FAILED=$?
        npm run type-check 2>&1 | tee typecheck-output.log
        TYPECHECK_FAILED=$?
        
        if [ $TEST_FAILED -ne 0 ] || [ $LINT_FAILED -ne 0 ] || [ $TYPECHECK_FAILED -ne 0 ]; then
            echo "⚠️  Znaleziono błędy, uruchamiam auto-fix..."
            node scripts/auto-fix.js \
                --test-output="$(cat test-output.log)" \
                --lint-output="$(cat lint-output.log)" \
                --typecheck-output="$(cat typecheck-output.log)" \
                --test-failed=$([ $TEST_FAILED -ne 0 ] && echo "true" || echo "false") \
                --lint-failed=$([ $LINT_FAILED -ne 0 ] && echo "true" || echo "false") \
                --typecheck-failed=$([ $TYPECHECK_FAILED -ne 0 ] && echo "true" || echo "false")
        else
            echo "✅ Wszystko przeszło!"
        fi
        ;;
    5)
        echo "🎭 Uruchamianie demo..."
        node scripts/test-auto-fix-demo.js
        ;;
    *)
        echo "❌ Nieprawidłowa opcja"
        exit 1
        ;;
esac


