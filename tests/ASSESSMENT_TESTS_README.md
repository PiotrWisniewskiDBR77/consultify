# Assessment Module Test Suite

Kompleksowy system testów dla modułu oceny Digital Readiness Diagnosis (DRD) z założeniem 90% pokrycia kodu.

## Struktura testów

### 📁 Testy jednostkowe (Unit Tests)

Lokalizacja: `tests/unit/backend/`

| Plik                                  | Opis                         | Pokrycie                                       |
| ------------------------------------- | ---------------------------- | ---------------------------------------------- |
| `assessmentService.test.js`           | Testy serwisu oceny          | Logika biznesowa, gap analysis                 |
| `assessmentWorkflowService.test.js`   | Testy serwisu workflow       | Inicjalizacja, przejścia stanów, wersjonowanie |
| `aiAssessmentPartnerService.test.js`  | Testy serwisu AI             | Guidance, walidacja, sugestie                  |
| `aiAssessmentFormHelper.test.js`      | Testy helpera formularzy AI  | Sugestie pól, walidacja, autocomplete          |
| `aiAssessmentReportGenerator.test.js` | Testy generatora raportów AI | Raporty pełne, stakeholder, benchmark          |
| `initiativeGeneratorService.test.js`  | Testy generatora inicjatyw   | Generowanie z luk, priorytetyzacja             |
| `drdAxisValidation.test.js`           | Testy walidacji osi DRD      | Struktura osi, zależności, spójność ocen       |
| `assessmentRBAC.test.js`              | Testy middleware RBAC        | Kontrola dostępu, role                         |
| `assessmentAuditLogger.test.js`       | Testy logowania audytowego   | Logowanie zdarzeń, historia                    |
| `assessmentReportService.test.js`     | Testy serwisu raportów       | Generowanie PDF, Excel                         |
| `assessmentOverviewService.test.js`   | Testy serwisu przeglądu      | Dashboard, statystyki                          |

### 📁 Testy komponentów (Component Tests)

Lokalizacja: `tests/components/`

| Plik                               | Opis                  | Pokrycie                       |
| ---------------------------------- | --------------------- | ------------------------------ |
| `AssessmentWizard.test.tsx`        | Kreator oceny         | Nawigacja, wprowadzanie danych |
| `AssessmentWorkflowPanel.test.tsx` | Panel workflow        | Status, akcje, modal           |
| `AxisCommentsPanel.test.tsx`       | Panel komentarzy      | CRUD komentarzy, wątki         |
| `GapAnalysisDashboard.test.tsx`    | Dashboard analizy luk | Wizualizacja, filtrowanie      |
| `AssessmentMatrixCard.test.tsx`    | Karta matrycy         | Wyświetlanie, edycja           |
| `AssessmentHubDashboard.test.tsx`  | Główny dashboard      | Przegląd, nawigacja            |

### 📁 Testy hooków (Hook Tests)

Lokalizacja: `tests/hooks/`

| Plik                                  | Opis            | Pokrycie                   |
| ------------------------------------- | --------------- | -------------------------- |
| `useAssessmentWorkflow.test.ts`       | Hook workflow   | Stan, API, computed        |
| `useAssessmentAI.test.ts`             | Hook AI         | Sugestie, walidacja, błędy |
| `useAssessmentCollaboration.test.tsx` | Hook współpracy | Obecność, aktywności       |

### 📁 Testy integracyjne (Integration Tests)

Lokalizacja: `tests/integration/`

| Plik                                      | Opis                      | Pokrycie                      |
| ----------------------------------------- | ------------------------- | ----------------------------- |
| `assessment-workflow.integration.test.js` | Integracja workflow       | End-to-end workflow           |
| `assessment-ai.integration.test.js`       | Integracja AI             | Wszystkie endpointy AI        |
| `assessment-rbac.integration.test.js`     | Integracja RBAC           | Autoryzacja, izolacja org     |
| `assessment-reports.integration.test.js`  | Integracja raportów       | Generowanie, eksport          |
| `assessment-api.integration.test.js`      | Integracja API Assessment | Wszystkie endpointy, CRUD, AI |

### 📁 Testy E2E (End-to-End Tests)

Lokalizacja: `tests/e2e/`

| Plik                               | Opis            | Pokrycie                          |
| ---------------------------------- | --------------- | --------------------------------- |
| `assessmentFlow.spec.ts`           | Podstawowy flow | Nawigacja, kreator                |
| `assessment-workflow-flow.spec.ts` | Flow workflow   | Submisja, recenzja, zatwierdzanie |
| `assessment-matrix.spec.ts`        | Flow matrycy    | Wszystkie osie, wyniki            |
| `assessment-ai-features.spec.ts`   | Flow AI         | Sugestie, korekty, insights       |

### 📁 Narzędzia testowe (Test Utilities)

Lokalizacja: `tests/utils/`

| Plik                 | Opis                      |
| -------------------- | ------------------------- |
| `testUtils.ts`       | Helpery, fabryki, asercje |

## Uruchamianie testów

### Wszystkie testy

```bash
npm test
```

### Testy jednostkowe

```bash
npm test -- --testPathPattern=unit
```

### Testy komponentów

```bash
npm test -- --testPathPattern=components
```

### Testy hooków

```bash
npm test -- --testPathPattern=hooks
```

### Testy integracyjne

```bash
npm test -- --testPathPattern=integration
```

### Testy E2E

```bash
npx playwright test tests/e2e/assessment
```

### Raport pokrycia

```bash
npm test -- --coverage
```

## Konwencje

### Nazewnictwo testów

- `describe('NazwaKomponentu/Serwisu')` - główna grupa
- `describe('Funkcjonalność')` - podgrupa
- `it('should...')` - konkretny przypadek testowy

### Struktura testu

```typescript
describe('Component', () => {
  beforeEach(() => {
    // Setup
  });

  describe('Feature', () => {
    it('should do something', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### Mocki

Używaj fabryk z `testUtils.ts`:

```typescript
import { createMockUser, createMockAssessment } from '../utils/testUtils';

const user = createMockUser({ role: 'ADMIN' });
const assessment = createMockAssessment({ status: 'APPROVED' });
```

## Pokrycie kodu

### Wymagane minimum: 90%

| Metryka    | Wymagane | Aktualny cel |
| ---------- | -------- | ------------ |
| Statements | 90%      | 90%+         |
| Branches   | 85%      | 90%+         |
| Functions  | 90%      | 90%+         |
| Lines      | 90%      | 90%+         |

### Obszary krytyczne

1. **AssessmentService** - logika biznesowa
2. **AssessmentWorkflowService** - przejścia stanów
3. **AIAssessmentPartnerService** - integracja AI
4. **assessmentRBAC** - bezpieczeństwo

## Dobre praktyki

1. **Izolacja testów** - każdy test jest niezależny
2. **Czyste mocki** - `vi.clearAllMocks()` w `beforeEach`
3. **Opisowe nazwy** - jasno opisują zachowanie
4. **AAA pattern** - Arrange, Act, Assert
5. **Nie testuj implementacji** - testuj zachowanie
6. **Testuj edge cases** - granice, błędy, null

## Maintenance

### Aktualizacja testów

Przy każdej zmianie w kodzie produkcyjnym:

1. Zaktualizuj odpowiednie testy
2. Dodaj nowe testy dla nowych funkcji
3. Sprawdź pokrycie kodu
4. Upewnij się, że wszystkie testy przechodzą

### Przegląd testów

- Regularny przegląd testów co miesiąc
- Usuwanie duplikatów
- Optymalizacja czasów wykonania
- Aktualizacja mocków

## Lista kontrolna przed PR

- [ ] Wszystkie testy przechodzą
- [ ] Pokrycie >= 90%
- [ ] Nowe funkcje mają testy
- [ ] Mocki są aktualne
- [ ] Brak testów zależnych od kolejności
