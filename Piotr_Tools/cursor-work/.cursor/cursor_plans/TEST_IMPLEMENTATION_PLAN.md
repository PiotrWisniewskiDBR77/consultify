# Plan Wdrożenia Brakujących Testów Critical Path

## Status: 🚀 W TRAKCIE WDROŻENIA

---

## 📋 Przegląd

Plan wdrożenia brakujących testów dla krytycznych ścieżek aplikacji zgodnie z architekturą testów z `TEST_ARCHITECTURE.md`.

### Cele
- ✅ Utworzyć brakujące testy dla serwisów security/billing (95%+ coverage)
- ✅ Skonfigurować tiered coverage gates (95%/85%/75%)
- ✅ Dodać szybkie testy critical w pre-commit hook
- ✅ Rozbudować CI/CD quality gates

---

## 🎯 Faza 1: Utworzenie Brakujących Testów (Priorytet: 🔴 KRYTYCZNY)

### 1.1 permissionService.test.ts
**Status**: ⏳ W TRAKCIE  
**Lokalizacja**: `tests/unit/backend/permissionService.test.ts`  
**Coverage Target**: 95%+

**Test Cases**:
- ✅ Role-based permission checks (`can()`)
- ✅ Database-backed PBAC (`hasPermission()`)
- ✅ User permissions retrieval (`getUserPermissions()`)
- ✅ Permission granting/revoking (`grantPermission()`, `revokePermission()`)
- ✅ Content permissions (`hasContentPermission()`, `grantContentPermission()`)
- ✅ Multi-permission checks (`hasPermissions()`)
- ✅ SUPERADMIN bypass logic
- ✅ Multi-tenant isolation
- ✅ Error handling

**Szacowany czas**: 4-6 godzin

---

### 1.2 tokenBillingService.test.ts
**Status**: ⏳ OCZEKIWANIE  
**Lokalizacja**: `tests/unit/backend/tokenBillingService.test.ts`  
**Coverage Target**: 95%+

**Test Cases**:
- ✅ Margin management (`getMargins()`, `updateMargin()`)
- ✅ Token packages (`getPackages()`, `upsertPackage()`)
- ✅ User balance (`getBalance()`, `hasSufficientBalance()`)
- ✅ Token operations (`creditTokens()`, `deductTokens()`)
- ✅ Organization balance (`getOrgBalance()`, `hasOrgSufficientBalance()`)
- ✅ API key encryption/decryption
- ✅ Transaction logging
- ✅ Ledger operations (`getLedger()`, `creditOrganization()`)
- ✅ Multi-tenant isolation
- ✅ Error handling & edge cases

**Szacowany czas**: 6-8 godzin

---

### 1.3 regulatoryModeGuard.test.ts
**Status**: ⏳ OCZEKIWANIE  
**Lokalizacja**: `tests/unit/backend/regulatoryModeGuard.test.ts`  
**Coverage Target**: 95%+

**Test Cases**:
- ✅ Regulatory mode check (`isEnabled()`)
- ✅ Regulatory prompt retrieval (`getRegulatoryPrompt()`)
- ✅ Organization-level check (`checkRegulatoryMode()`)
- ✅ Edge cases (null/undefined inputs)

**Szacowany czas**: 1-2 godziny

---

### 1.4 settlementService.test.ts
**Status**: ⚠️ DO WERYFIKACJI  
**Lokalizacja**: `tests/unit/backend/settlementService.test.ts`  
**Coverage Target**: 95%+

**Uwaga**: Settlement functionality jest w `partnerCommissionService.ts`.  
**Opcje**:
- Opcja A: Utworzyć testy dla `partnerCommissionService` jako `settlementService.test.ts`
- Opcja B: Utworzyć dedykowany `partnerCommissionService.test.ts`

**Test Cases** (jeśli istnieje dedykowany serwis):
- ✅ Settlement calculations
- ✅ Commission tracking
- ✅ Payout management
- ✅ Multi-tenant isolation

**Szacowany czas**: 4-6 godzin

---

## 🔧 Faza 2: Konfiguracja Infrastructure (Priorytet: 🔴 KRYTYCZNY)

### 2.1 Script `test:unit:critical`
**Status**: ⏳ OCZEKIWANIE  
**Lokalizacja**: `package.json`

```json
{
  "scripts": {
    "test:unit:critical": "vitest run tests/unit/backend/permissionService.test.ts tests/unit/backend/tokenBillingService.test.ts tests/unit/backend/regulatoryModeGuard.test.ts tests/unit/backend/accessPolicyService.test.js tests/unit/backend/services/billingService.test.ts tests/unit/backend/middleware/authMiddleware.test tests/unit/backend/middleware/permissionMiddleware.test.js --reporter=verbose"
  }
}
```

**Szacowany czas**: 15 minut

---

### 2.2 Tiered Coverage Gates w .codecov.yml
**Status**: ⏳ OCZEKIWANIE  
**Lokalizacja**: `.codecov.yml`

Dodać sekcję:
```yaml
coverage:
  status:
    project:
      critical:
        target: 95%
        threshold: 1%
        paths:
          - server/src/services/permissionService.*
          - server/src/services/tokenBillingService.*
          - server/src/services/accessPolicyService.*
          - server/src/services/aiCostControlService.*
          - server/src/services/billingService.*
          - server/src/services/regulatoryModeGuard.*
          - server/src/middleware/authMiddleware.*
          - server/src/middleware/permissionMiddleware.*
      high:
        target: 85%
        threshold: 1%
        paths:
          - server/src/services/ai*.*
      standard:
        target: 75%
        threshold: 1%
```

**Szacowany czas**: 30 minut

---

### 2.3 Pre-commit Hook z Testami Critical
**Status**: ⏳ OCZEKIWANIE  
**Lokalizacja**: `.husky/pre-commit`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Fast lint
npx lint-staged --no-stash

# Critical security tests (fast, ~10-15s)
npm run test:unit:critical -- --run --silent 2>/dev/null || {
  echo "❌ Critical tests failed! Fix before committing."
  exit 1
}
```

**Szacowany czas**: 15 minut

---

### 2.4 CI/CD Quality Gates
**Status**: ⏳ OCZEKIWANIE  
**Lokalizacja**: `.github/workflows/test-suite.yml`

Dodać job:
```yaml
  critical-path-coverage:
    name: 🔒 Critical Path Coverage Check
    runs-on: ubuntu-latest
    needs: [unit-tests]
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - name: Run critical tests with coverage
        run: |
          npm run test:unit:critical -- --coverage --reporter=json-summary
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          echo "Critical path coverage: $COVERAGE%"
          if (( $(echo "$COVERAGE < 95" | bc -l) )); then
            echo "::error::Critical path coverage ($COVERAGE%) below 95% threshold!"
            exit 1
          fi
```

**Szacowany czas**: 30 minut

---

## 📊 Harmonogram Wdrożenia

| Faza | Zadanie | Status | Szacowany czas |
|------|---------|--------|----------------|
| **Faza 1** | permissionService.test.ts | ⏳ W TRAKCIE | 4-6h |
| **Faza 1** | tokenBillingService.test.ts | ⏳ OCZEKIWANIE | 6-8h |
| **Faza 1** | regulatoryModeGuard.test.ts | ⏳ OCZEKIWANIE | 1-2h |
| **Faza 1** | settlementService.test.ts | ⚠️ DO WERYFIKACJI | 4-6h |
| **Faza 2** | Script test:unit:critical | ⏳ OCZEKIWANIE | 15min |
| **Faza 2** | Tiered coverage gates | ⏳ OCZEKIWANIE | 30min |
| **Faza 2** | Pre-commit hook | ⏳ OCZEKIWANIE | 15min |
| **Faza 2** | CI/CD quality gates | ⏳ OCZEKIWANIE | 30min |

**Całkowity szacowany czas**: 16-24 godziny

---

## ✅ Kryteria Sukcesu

- [ ] Wszystkie brakujące testy utworzone i przechodzące
- [ ] Coverage dla critical path ≥ 95%
- [ ] Script `test:unit:critical` działa poprawnie
- [ ] Pre-commit hook blokuje commity z błędnymi testami critical
- [ ] CI/CD quality gates działają poprawnie
- [ ] Wszystkie testy są deterministyczne (bez flakiness)

---

## 📝 Notatki

- Używać `tests/helpers/dependencyInjector.js` dla wszystkich testów
- Używać `tests/fixtures/testData.js` dla danych testowych
- Używać `tests/__mocks__/llmApi.js` dla mocków LLM
- Wszystkie testy muszą być deterministyczne (bez time/UUID races)
- Testy muszą sprawdzać multi-tenant isolation

---

**Ostatnia aktualizacja**: 2025-01-20  
**Status**: 🚀 W TRAKCIE WDROŻENIA
