# 📝 Changelog - Workflows Documentation

## 2026-01-27 - Kompleksowa dokumentacja workflow

### Dodano

#### Nowe dokumenty

1. **`00-WORK-LIFECYCLE.md`** - Główny dokument opisujący pełny cykl życia pracy
   - 4 fazy: Discovery → Initiatives → Execution → Benefits
   - 13 statusów inicjatyw z pełnym przepływem
   - Matryca ról i uprawnień (Initiative + Task)
   - Widoczność w modułach UI
   - Powiadomienia per zdarzenie
   - Integracja Initiative ↔ Task

2. **`execution-flow/00-OVERVIEW.md`** - Szczegółowy przepływ realizacji
   - Relacja Initiative ↔ Task
   - Propagacja statusu (task → initiative)
   - Scenariusze użycia (normalny flow, blokada, odrzucenie)
   - Metryki i KPIs
   - Powiadomienia

3. **`README.md`** - Przewodnik po dokumentacji workflow

4. **`CHANGELOG.md`** - Ten plik

#### Rozszerzenia istniejących dokumentów

1. **`standards/entities/01-TASK.md`**
   - Dodano status `PENDING_APPROVAL`
   - Mechanizm zatwierdzania (Acceptance):
     - `requiresAcceptance` - czy wymaga zatwierdzenia
     - `acceptanceType` - kto zatwierdza (reporter, owner, PM, specific_user, role_based)
     - `acceptanceHistory` - pełna historia decyzji
   - Reguła: Assignee NIE MOŻE zatwierdzić własnego tasku
   - Nowe API endpoints: `/submit-for-approval`, `/approve`, `/reject`, `/request-changes`

2. **`workflows/initiative-lifecycle/00-OVERVIEW.md`**
   - Zaktualizowano o linki do nowych dokumentów
   - Dodano podsumowanie statusów per faza

3. **`workflows/decision-gates/00-OVERVIEW.md`**
   - Kompletna dokumentacja wszystkich bramek decyzyjnych
   - Matryca uprawnień RBAC
   - Decision Record structure
   - Implementacja w UI
   - Audit trail

### Zmiany w kodzie

1. **`server/src/constants/initiativeStatuses.ts`**
   - Zaktualizowano komentarz header - dodano PENDING_REVIEW do flow diagramu
   - Poprawiono liczbę statusów z 11 na 13
   - Dodano PENDING_REVIEW do enum InitiativeStatus

2. **`wdrozenia/01-PROGRESS-TRACKER.md`**
   - FAZA 3: Workflows zaktualizowana: 4/5 zadań ukończonych
   - Postęp całkowity: 23/27 (było 19/25)
   - Dodano wpisy w log zmian

### Kluczowe założenia systemu

1. **Dwuetapowy review** na poziomie źródłowym:
   - DRAFT (autor) → PENDING_REVIEW (PM/Lead) → REVIEW (biznes)

2. **Separation of duties**:
   - Wykonawca tasku ≠ zatwierdzający
   - Consultant nie może przesuwać inicjatywy przez gate decyzyjny

3. **Audit trail**:
   - Każda decyzja gate'a jest logowana
   - Pełna historia zatwierdzeń tasków

4. **Role-based access control**:
   - Jasne uprawnienia per rola
   - Walidacja w backendzie

5. **Acceptance workflow**:
   - Taski mogą wymagać zatwierdzenia
   - Konfigurowalne: kto zatwierdza (reporter, owner, PM, konkretna osoba, rola)
   - Historia decyzji w acceptanceHistory

---

## Status implementacji

| Komponent | Dokumentacja | Backend | Frontend |
|-----------|--------------|---------|----------|
| Initiative Workflow (13 statusów) | ✅ | ✅ | ✅ |
| Task Acceptance Workflow | ✅ | 🟡* | ⬜ |
| Decision Gates | ✅ | ✅ | ✅ |
| Execution Flow | ✅ | ✅ | ✅ |

*Backend ma podstawowe pola (`acceptance_criteria`), ale pełny workflow acceptance wymaga implementacji

---

## Następne kroki

1. Implementacja Task Acceptance Workflow w backendzie
2. Implementacja Task Acceptance Workflow w frontendzie
3. Testy E2E dla acceptance workflow
4. Dokumentacja interview-to-initiative workflow
