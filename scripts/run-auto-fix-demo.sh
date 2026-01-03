#!/bin/bash
# Demo uruchomienia auto-fix z przykładowymi błędami

echo "🚀 Uruchamiam auto-fix w trybie demo..."
echo ""

# Stwórz przykładowe błędy
cat > /tmp/demo-test-errors.txt << 'EOF'
FAIL tests/unit/example.test.js
  ✕ should calculate sum correctly
    Error: Expected 10 to be 15
      at Object.<anonymous> (tests/unit/example.test.js:15:25)
      at Test.run (node_modules/vitest/dist/index.js:1234:15)

FAIL tests/components/Button.test.tsx
  ✕ should handle click events
    TypeError: Cannot read property 'click' of undefined
      at tests/components/Button.test.tsx:42:10
EOF

cat > /tmp/demo-lint-errors.txt << 'EOF'
components/Button.tsx
  15:5  error  'unusedVar' is assigned a value but never used  @typescript-eslint/no-unused-vars
  42:10  error  Missing semicolon  semi

utils/helpers.ts
  8:3  warning  'any' type is not allowed  @typescript-eslint/no-explicit-any
EOF

cat > /tmp/demo-typecheck-errors.txt << 'EOF'
components/Button.tsx(15,5): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
utils/helpers.ts(8,3): error TS7006: Parameter 'x' implicitly has an 'any' type.
EOF

# Sprawdź czy OPENAI_API_KEY jest ustawione
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  OPENAI_API_KEY nie jest ustawione"
    echo "📝 Uruchamiam w trybie demo (bez faktycznego wywołania API)..."
    echo ""
    node scripts/test-auto-fix-demo.js
    exit 0
fi

echo "✅ OPENAI_API_KEY jest ustawione"
echo "🔧 Uruchamiam auto-fix z przykładowymi błędami..."
echo ""

# Uruchom skrypt z przykładowymi błędami
node scripts/auto-fix.js \
    --test-output="$(cat /tmp/demo-test-errors.txt)" \
    --lint-output="$(cat /tmp/demo-lint-errors.txt)" \
    --typecheck-output="$(cat /tmp/demo-typecheck-errors.txt)" \
    --test-failed=true \
    --lint-failed=true \
    --typecheck-failed=true

echo ""
echo "✅ Demo zakończone!"













