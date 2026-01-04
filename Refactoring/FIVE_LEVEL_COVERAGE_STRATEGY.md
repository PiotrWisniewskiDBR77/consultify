# Strategia 5-Poziomowego Testowania dla 95% Pokrycia

**Cel:** Osiągnięcie 95% pokrycia kodu na wszystkich 5 poziomach testowania
**Data rozpoczęcia:** 2026-01-04
**Deadline:** Natychmiastowa realizacja

---

## 🎯 POZIOM 1: INFRASTRUKTURA I MOCKI (Foundation)
**Cel:** Stabilna baza testowa z niezawodnymi mockami
**Aktualny status:** 2401/2983 testów przechodzi (80.5%)
**Target:** 95%+ przejść na poziomie infrastruktury

### Zadania krytyczne:
1. **Naprawa StageGateService** - `_setDb is not a function`
2. **Standaryzacja mockDb** - spójne zachowanie we wszystkich testach
3. **ESM/CJS interop** - usunięcie wszystkich błędów importów
4. **Setup stabilność** - eliminacja problemów z inicjalizacją

### Metryki sukcesu:
- ✅ 0 błędów "is not a function"
- ✅ 0 błędów importów ESM/CJS
- ✅ Wszystkie testy z mockDb działają spójnie
- ✅ Setup time < 5s

---

## 🛡️ POZIOM 2: LOGIKA BIZNESOWA BACKEND (Business Logic)
**Cel:** Pełne pokrycie logiki biznesowej i middleware
**Aktualny status:** 472 błędy wymagają naprawy
**Target:** 95% pokrycia logiki biznesowej

### Komponenty do pokrycia:
1. **Middleware Stack** - auth, rbac, validation
2. **Business Services** - initiative, assessment, billing
3. **API Controllers** - wszystkie endpoints
4. **Data Validation** - input/output sanitization

### Strategia naprawy:
- Priority: middleware z największą ilością błędów
- Pattern: `createMockDb()` + `vi.hoisted()` dla wszystkich
- Parallel: równoległa naprawa przez niezależne agenty

---

## 🎨 POZIOM 3: STABILNOŚĆ FRONTEND (UI Stability)
**Cel:** Niezawodne testy komponentów React
**Aktualny status:** Częściowe pokrycie komponentów
**Target:** 95% pokrycia komponentów i hooków

### Komponenty krytyczne:
1. **TaskInbox** - 2/5 testów pada
2. **AISettings** - brak testów
3. **TaskDropdown** - brak testów
4. **Provider wrappers** - ThemeProvider, StoreProvider

### Techniki stabilizacji:
- Mockowanie hooków Zustand
- Poprawne selektory (getByRole vs klasy)
- Provider setup w test-utils.tsx
- Timing fixes dla async operacji

---

## ⚡ POZIOM 4: WYDAJNOŚĆ I BEZPIECZEŃSTWO (Performance & Security)
**Cel:** Testy wydajnościowe i bezpieczeństwa
**Aktualny status:** Częściowo zaimplementowane
**Target:** Pełne pokrycie P95 i security gates

### Wymagania:
1. **Performance baseline** - k6 thresholds dla wszystkich endpointów
2. **Security scanning** - npm audit + vulnerability checks
3. **Load testing** - symulacja 10k+ użytkowników
4. **Memory leak detection** - automated checks

### Implementation:
- k6 scripts dla load testing
- Performance thresholds w vitest config
- Security gates w CI/CD pipeline
- Memory profiling tools

---

## 🚀 POZIOM 5: ZAawansowane pokrycie (Advanced Coverage)
**Cel:** 95% pokrycia na wszystkich metrykach
**Aktualny status:** Coverage thresholds ustawione na 95%
**Target:** Osiągnięcie wszystkich progów pokrycia

### Metryki docelowe:
```
Coverage Thresholds (95%):
- Statements: 95%
- Branches: 95%
- Functions: 95%
- Lines: 95%
```

### Strategia osiągnięcia:
1. **Gap Analysis** - identyfikacja niepokrytego kodu
2. **Test Generation** - automatyczne generowanie testów dla braków
3. **Edge Cases** - testy dla rzadkich ścieżek wykonania
4. **Integration Gaps** - pokrycie interakcji między modułami

---

## 📊 PLAN REALIZACJI

### Faza 1A: Krytyczne naprawy (1-2 godziny)
- StageGateService._setDb fix
- 10 najbardziej krytycznych błędów testowych
- ESM import fixes dla AI services

### Faza 1B: Infrastructure hardening (2-3 godziny)
- MockDb standardization
- Setup optimization
- Parallel test execution tuning

### Faza 2A: Backend logic completion (3-4 godziny)
- Middleware fixes (planLimits, quota, etc.)
- Business service completion
- API controller coverage

### Faza 2B: Frontend stabilization (2-3 godziny)
- TaskInbox fixes
- Missing component tests
- Hook testing completion

### Faza 3: Performance & Security (1-2 godziny)
- k6 baseline establishment
- Security scan fixes
- Performance threshold setting

### Faza 4: Advanced Coverage (2-3 godziny)
- Gap analysis
- Test generation for uncovered code
- Edge case coverage
- Final 95% achievement

---

## 🎯 KRYTERIA SUKCESU

### Poziom 1 ✅
- [ ] 0 błędów infrastruktury
- [ ] Wszystkie mocki działają spójnie
- [ ] Setup time < 5s

### Poziom 2 ✅
- [ ] 95% pokrycia logiki biznesowej
- [ ] Wszystkie middleware testy przechodzą
- [ ] API validation kompletne

### Poziom 3 ✅
- [ ] 95% pokrycia komponentów
- [ ] Wszystkie hooki przetestowane
- [ ] UI interactions pokryte

### Poziom 4 ✅
- [ ] Performance baselines ustalone
- [ ] Security vulnerabilities naprawione
- [ ] Load testing thresholds osiągnięte

### Poziom 5 ✅
- [ ] 95% statements coverage
- [ ] 95% branches coverage
- [ ] 95% functions coverage
- [ ] 95% lines coverage

---

## 🚀 AKCJA: ROZPOCZYNAMY REALIZACJĘ

**Start:** Natychmiastowa naprawa krytycznych błędów
**Monitorowanie:** Real-time coverage reporting
**Deadline:** Osiągnięcie 95% w ciągu najbliższych godzin

