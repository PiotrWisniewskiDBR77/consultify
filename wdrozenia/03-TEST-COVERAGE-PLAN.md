# Plan Pokrycia Testami L1-L5 do 95%

**Data:** 2026-01-26  
**Cel:** 95% coverage, 100% pass rate dla wszystkich poziomów

## 📊 Obecne Pokrycie

| Poziom | Obecne | Docelowe | Gap |
|--------|--------|----------|-----|
| **L1 - Unit** | ~85% | 95% | +10% |
| **L2 - Integration** | ~70% | 95% | +25% |
| **L3 - Component** | ~75% | 95% | +20% |
| **L4 - E2E** | ~60% | 95% | +35% |
| **L5 - Performance** | ~50% | 95% | +45% |

## 🎯 Plan Działania

### L1: Unit Tests (Priorytet 1)

#### Krytyczne Serwisy - Status
- ✅ `reportGenerationService` - Test napisany
- ✅ `escalationService` - Test napisany
- ⚠️ `assessmentInitiativeService` - Test istnieje, wymaga uzupełnienia
- ⚠️ `decisionService` - Test istnieje, wymaga uzupełnienia
- ❌ `aiOrchestrator` - Brak testu
- ❌ `backupService` - Brak testu
- ❌ `auditService` - Brak testu
- ❌ `emailService` - Brak testu
- ❌ `aiPolicyEngine` - Brak testu
- ❌ `aiWorkloadIntelligence` - Brak testu

#### Plan Napisania Testów L1

**Tydzień 1:**
- [ ] `aiOrchestrator.test.ts` (3 dni)
- [ ] `backupService.test.ts` (2 dni)
- [ ] `auditService.test.ts` (2 dni)

**Tydzień 2:**
- [ ] `emailService.test.ts` (2 dni)
- [ ] `aiPolicyEngine.test.ts` (2 dni)
- [ ] `aiWorkloadIntelligence.test.ts` (2 dni)
- [ ] Uzupełnienie istniejących testów (1 dzień)

**Target Coverage:** 95%+

### L2: Integration Tests (Priorytet 2)

#### Brakujące Testy Integracyjne

**API Endpoints:**
- [ ] `/api/reports/generate` - Report generation
- [ ] `/api/escalations/*` - Escalation endpoints
- [ ] `/api/ai/orchestrate` - AI orchestration
- [ ] `/api/decisions/*` - Decision management
- [ ] `/api/assessments/*` - Assessment endpoints
- [ ] `/api/backup/*` - Backup/restore
- [ ] `/api/audit/*` - Audit logs

**Database Integration:**
- [ ] Transaction tests
- [ ] Connection pool tests
- [ ] Migration tests
- [ ] Query performance tests

**External Services:**
- [ ] Email service integration
- [ ] Backup service integration
- [ ] AI provider integration
- [ ] Storage service integration

**Target Coverage:** 95%+

### L3: Component Tests (Priorytet 3)

#### Komponenty Do Przetestowania

**Krytyczne Komponenty:**
- [ ] `ReportGenerationPanel` - Report generation UI
- [ ] `EscalationPanel` - Escalation management UI
- [ ] `DecisionHub` - Decision management UI
- [ ] `AssessmentHub` - Assessment management UI
- [ ] `AIChat` - AI chat interface
- [ ] `Dashboard` - Main dashboard

**Formularze:**
- [ ] Assessment forms
- [ ] Decision forms
- [ ] Initiative forms
- [ ] Project forms

**Accessibility:**
- [ ] Keyboard navigation
- [ ] Screen reader compatibility
- [ ] ARIA labels
- [ ] Focus management

**Target Coverage:** 95%+

### L4: E2E Tests (Priorytet 4)

#### Scenariusze E2E

**Krytyczne Flows:**
- [ ] **Flow 1:** Assessment → Initiatives → Decisions
  - Utworzenie assessment
  - Generowanie inicjatyw
  - Tworzenie decyzji
  - Eskalacja decyzji
- [ ] **Flow 2:** Report Generation
  - Wybór źródła danych
  - Generowanie raportu
  - Eksport raportu
  - Udostępnienie raportu
- [ ] **Flow 3:** AI Orchestration
  - Rozpoczęcie sesji AI
  - Interakcja z AI
  - Generowanie rekomendacji
  - Zapisanie wyników
- [ ] **Flow 4:** Backup/Restore
  - Utworzenie backupu
  - Weryfikacja backupu
  - Restore z backupu
  - Weryfikacja danych

**Cross-Browser:**
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

**Visual Regression:**
- [ ] Screenshot tests dla krytycznych stron
- [ ] Component visual tests

**Target Coverage:** 95%+

### L5: Performance Tests (Priorytet 5)

#### Testy Wydajnościowe

**Load Tests:**
- [ ] API endpoints - 1000 req/s
- [ ] Database queries - concurrent access
- [ ] File uploads - large files
- [ ] Report generation - concurrent reports

**Stress Tests:**
- [ ] Peak load scenarios
- [ ] Resource exhaustion
- [ ] Failure recovery

**Memory Tests:**
- [ ] Memory leak detection
- [ ] Garbage collection efficiency
- [ ] Long-running processes

**Bundle Optimization:**
- [ ] Code splitting
- [ ] Tree shaking
- [ ] Lazy loading
- [ ] Asset optimization

**Target Coverage:** 95%+

## 📋 Checklist Implementacji

### Faza 1: L1 Unit Tests (Tydzień 1-2)
- [ ] Napisać testy dla brakujących serwisów (6 serwisów)
- [ ] Uzupełnić istniejące testy do 95% coverage
- [ ] Uruchomić testy i naprawić błędy
- [ ] Sprawdzić coverage (cel: 95%)
- [ ] Code review i merge

### Faza 2: L2 Integration Tests (Tydzień 3-4)
- [ ] Napisać testy integracyjne dla API
- [ ] Napisać testy integracyjne dla DB
- [ ] Napisać testy dla external services
- [ ] Uruchomić i naprawić
- [ ] Sprawdzić coverage (cel: 95%)

### Faza 3: L3 Component Tests (Tydzień 3-4)
- [ ] Napisać testy komponentów
- [ ] Napisać accessibility tests
- [ ] Uruchomić i naprawić
- [ ] Sprawdzić coverage (cel: 95%)

### Faza 4: L4 E2E Tests (Tydzień 5-6)
- [ ] Napisać scenariusze E2E
- [ ] Cross-browser testing
- [ ] Visual regression
- [ ] Uruchomić i naprawić
- [ ] Sprawdzić coverage (cel: 95%)

### Faza 5: L5 Performance Tests (Tydzień 5-6)
- [ ] Napisać testy wydajnościowe
- [ ] Load tests
- [ ] Memory leak tests
- [ ] Bundle optimization
- [ ] Uruchomić i zweryfikować

## 🎯 Metryki Sukcesu

### Coverage Targets
- ✅ **L1:** ≥95%
- ✅ **L2:** ≥95%
- ✅ **L3:** ≥95%
- ✅ **L4:** ≥95%
- ✅ **L5:** ≥95%

### Pass Rate
- ✅ **Wszystkie poziomy:** 100%

### Performance Targets
- ✅ **API p95:** <500ms
- ✅ **Lighthouse:** ≥90
- ✅ **Bundle size:** <500KB
- ✅ **Memory leaks:** 0

## 📝 Notatki

- Używać Vitest dla L1-L3
- Używać Playwright dla L4
- Używać Vitest performance config dla L5
- Mockować zewnętrzne zależności
- Używać factories dla test data
- Continuous coverage monitoring

---

**Status:** Plan utworzony  
**Następny krok:** Rozpoczęcie Fazy 1 - L1 Unit Tests
