# Plan Uzupełnienia Testów L1-L5 do 95% Pokrycia

**Data:** 2026-01-26  
**Cel:** 95% pokrycia kodu, 100% przejść testów

## 📊 Obecny Stan

### Struktura Testów
- **L1 (Unit):** `tests/unit/` - testy jednostkowe
- **L2 (Integration):** `tests/integration/` - testy integracyjne
- **L3 (Component):** `tests/components/` - testy komponentów React
- **L4 (E2E):** `tests/e2e/` - testy end-to-end (Playwright)
- **L5 (Performance):** `tests/performance/` - testy wydajnościowe

### Statystyki
- **Pliki testów:** 1,096+
- **Serwisy backend:** ~500+ plików
- **Testy backend:** Sprawdzić ile istnieje

## 🎯 Plan Działania

### L1: Unit Tests (Priorytet 1)

#### Krytyczne Serwisy Bez Testów (lub z niskim pokryciem):
1. ✅ `decisionService.ts` - częściowo pokryte
2. ⚠️ `assessmentInitiativeService.ts` - istnieje test, sprawdzić pokrycie
3. ❌ `reportGenerationService.ts` - brak testów
4. ❌ `escalationService.ts` - brak testów
5. ❌ `aiOrchestrator.ts` - brak testów
6. ❌ `aiPolicyEngine.ts` - brak testów
7. ❌ `aiWorkloadIntelligence.ts` - brak testów
8. ❌ `backupService.ts` - brak testów
9. ❌ `auditService.ts` - brak testów
10. ❌ `emailService.ts` - brak testów

#### Plan Napisania Testów L1:
- [ ] `reportGenerationService.test.ts`
- [ ] `escalationService.test.ts`
- [ ] `aiOrchestrator.test.ts`
- [ ] `aiPolicyEngine.test.ts`
- [ ] `backupService.test.ts`
- [ ] `auditService.test.ts`
- [ ] `emailService.test.ts`
- [ ] Uzupełnić istniejące testy do 95% pokrycia

### L2: Integration Tests (Priorytet 2)

#### Brakujące Testy Integracyjne:
- [ ] API endpoints dla report generation
- [ ] API endpoints dla escalation
- [ ] API endpoints dla AI orchestration
- [ ] Database integration dla krytycznych operacji
- [ ] External service integration (email, backup)

### L3: Component Tests (Priorytet 3)

#### Komponenty Do Przetestowania:
- [ ] Komponenty związane z raportami
- [ ] Komponenty związane z eskalacją
- [ ] Komponenty AI
- [ ] Komponenty dashboard

### L4: E2E Tests (Priorytet 4)

#### Scenariusze E2E:
- [ ] Pełny flow generowania raportu
- [ ] Flow eskalacji decyzji
- [ ] Flow AI orchestration
- [ ] Flow backup/restore

### L5: Performance Tests (Priorytet 5)

#### Testy Wydajnościowe:
- [ ] Load test dla report generation
- [ ] Load test dla AI orchestration
- [ ] Memory leak testy
- [ ] Stress testy

## 📋 Checklist Implementacji

### Faza 1: L1 Unit Tests (Krytyczne)
- [ ] Napisać testy dla `reportGenerationService`
- [ ] Napisać testy dla `escalationService`
- [ ] Napisać testy dla `aiOrchestrator`
- [ ] Uzupełnić istniejące testy
- [ ] Uruchomić testy i naprawić błędy
- [ ] Sprawdzić coverage (cel: 95%)

### Faza 2: L2 Integration Tests
- [ ] Napisać testy integracyjne dla API
- [ ] Napisać testy integracyjne dla DB
- [ ] Uruchomić i naprawić

### Faza 3: L3 Component Tests
- [ ] Napisać testy komponentów
- [ ] Uruchomić i naprawić

### Faza 4: L4 E2E Tests
- [ ] Napisać scenariusze E2E
- [ ] Uruchomić i naprawić

### Faza 5: L5 Performance Tests
- [ ] Napisać testy wydajnościowe
- [ ] Uruchomić i zweryfikować

## 🎯 Metryki Sukcesu

- ✅ **Pokrycie kodu:** ≥95%
- ✅ **Pass rate:** 100%
- ✅ **Wszystkie poziomy:** L1-L5 działają
- ✅ **CI/CD ready:** Wszystkie testy przechodzą

## 📝 Notatki

- Używać Vitest dla L1-L3
- Używać Playwright dla L4
- Używać Vitest performance config dla L5
- Mockować zewnętrzne zależności
- Używać factories dla test data
