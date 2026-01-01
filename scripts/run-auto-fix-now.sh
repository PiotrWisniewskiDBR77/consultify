#!/bin/bash
# Uruchamia auto-fix z kluczem API z .env

set -e

echo "🚀 Auto-Fix z OpenAI API"
echo ""

# Załaduj zmienne z .env
if [ -f .env ]; then
    echo "📝 Ładuję zmienne z .env..."
    export $(grep -v '^#' .env | grep -v '^$' | xargs)
fi

# Sprawdź czy klucz jest dostępny
if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY nie jest ustawione!"
    echo ""
    echo "📝 Rozwiązanie:"
    echo "   1. Upewnij się że klucz jest w .env:"
    echo "      grep OPENAI_API_KEY .env"
    echo "   2. LUB ustaw jako zmienną:"
    echo "      export OPENAI_API_KEY='sk-...'"
    exit 1
fi

echo "✅ OPENAI_API_KEY jest dostępny (${OPENAI_API_KEY:0:15}...)"
echo ""

# Test połączenia z API
echo "🧪 Testuję połączenie z OpenAI API..."
TEST_RESULT=$(node -e "
require('dotenv').config();
const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.log('ERROR');
  process.exit(1);
}
fetch('https://api.openai.com/v1/models', {
  headers: { 'Authorization': \`Bearer \${key}\` }
})
.then(r => r.json())
.then(data => {
  if (data.error) {
    console.log('ERROR:', data.error.message);
    process.exit(1);
  } else {
    console.log('OK');
    process.exit(0);
  }
})
.catch(e => {
  console.log('ERROR:', e.message);
  process.exit(1);
});
" 2>&1)

if echo "$TEST_RESULT" | grep -q "OK"; then
    echo "✅ Połączenie z OpenAI API działa!"
else
    echo "⚠️  Problem z połączeniem:"
    echo "$TEST_RESULT" | grep -E "ERROR|error" | head -3
    echo ""
    read -p "Czy kontynuować mimo to? (t/n): " continue
    if [ "$continue" != "t" ] && [ "$continue" != "T" ] && [ "$continue" != "y" ] && [ "$continue" != "Y" ]; then
        exit 1
    fi
fi

echo ""
echo "🔍 Sprawdzam błędy w projekcie..."
echo ""

# Sprawdź typecheck
echo "1️⃣  TypeCheck..."
npm run type-check 2>&1 | tee /tmp/typecheck-output.log
TYPECHECK_EXIT=${PIPESTATUS[0]}

# Sprawdź lint (jeśli możliwe)
echo ""
echo "2️⃣  Lint..."
npm run lint 2>&1 | tee /tmp/lint-output.log || true
LINT_EXIT=${PIPESTATUS[0]}

# Sprawdź testy (opcjonalnie, może być długo)
echo ""
read -p "3️⃣  Czy uruchomić testy? (może zająć dużo czasu) (t/n): " run_tests
TEST_EXIT=0
if [ "$run_tests" = "t" ] || [ "$run_tests" = "T" ] || [ "$run_tests" = "y" ] || [ "$run_tests" = "Y" ]; then
    echo "Uruchamiam testy..."
    npm run test:all 2>&1 | tee /tmp/test-output.log || true
    TEST_EXIT=${PIPESTATUS[0]}
fi

echo ""
echo "📊 Podsumowanie:"
echo "   TypeCheck: $([ $TYPECHECK_EXIT -eq 0 ] && echo '✅ OK' || echo '❌ BŁĘDY')"
echo "   Lint: $([ $LINT_EXIT -eq 0 ] && echo '✅ OK' || echo '❌ BŁĘDY')"
echo "   Testy: $([ $TEST_EXIT -eq 0 ] && echo '✅ OK' || echo '❌ BŁĘDY')"
echo ""

# Sprawdź czy są błędy do naprawienia
if [ $TYPECHECK_EXIT -ne 0 ] || [ $LINT_EXIT -ne 0 ] || [ $TEST_EXIT -ne 0 ]; then
    echo "⚠️  Znaleziono błędy! Uruchamiam auto-fix..."
    echo ""
    
    # Przygotuj outputy
    TYPECHECK_OUT=""
    LINT_OUT=""
    TEST_OUT=""
    
    if [ $TYPECHECK_EXIT -ne 0 ] && [ -f /tmp/typecheck-output.log ]; then
        TYPECHECK_OUT=$(cat /tmp/typecheck-output.log | tail -c 100000)
    fi
    
    if [ $LINT_EXIT -ne 0 ] && [ -f /tmp/lint-output.log ]; then
        LINT_OUT=$(cat /tmp/lint-output.log | tail -c 100000)
    fi
    
    if [ $TEST_EXIT -ne 0 ] && [ -f /tmp/test-output.log ]; then
        TEST_OUT=$(cat /tmp/test-output.log | tail -c 100000)
    fi
    
    # Uruchom auto-fix
    node scripts/auto-fix.js \
        --test-output="$TEST_OUT" \
        --lint-output="$LINT_OUT" \
        --typecheck-output="$TYPECHECK_OUT" \
        --test-failed=$([ $TEST_EXIT -ne 0 ] && echo "true" || echo "false") \
        --lint-failed=$([ $LINT_EXIT -ne 0 ] && echo "true" || echo "false") \
        --typecheck-failed=$([ $TYPECHECK_EXIT -ne 0 ] && echo "true" || echo "false")
    
    echo ""
    echo "✅ Auto-fix zakończony!"
    echo ""
    echo "📝 Sprawdź zmiany:"
    echo "   git status"
    echo "   git diff"
else
    echo "✅ Brak błędów do naprawienia!"
    echo "🎉 Wszystko działa poprawnie!"
fi









