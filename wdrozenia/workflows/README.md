# 🔄 Workflows - Dokumentacja przepływów pracy

## Cel

Ten katalog zawiera dokumentację wszystkich przepływów pracy (workflows) w aplikacji Consultinity - od odkrywania inicjatyw, przez ich planowanie i realizację, aż po śledzenie korzyści.

---

## 📚 Struktura dokumentacji

### Główny dokument

- **`00-WORK-LIFECYCLE.md`** - **START TUTAJ** - Pełny opis cyklu życia pracy w aplikacji
  - 4 fazy: Discovery → Initiatives → Execution → Benefits
  - Matryca ról i uprawnień
  - Widoczność w modułach UI
  - Powiadomienia
- **`01-ROLES-AND-ASSUMPTIONS.md`** - **KANON RÓL** - jedno rozumienie ról + delegacje w projektach „mniejszych”

### Szczegółowe workflow

| Dokument | Opis |
|----------|------|
| **`initiative-lifecycle/00-OVERVIEW.md`** | Przepływ inicjatywy przez wszystkie moduły (DRAFT → TRACKING) |
| **`execution-flow/00-OVERVIEW.md`** | Relacja Initiative ↔ Task, mechanizm realizacji |
| **`decision-gates/00-OVERVIEW.md`** | Bramki decyzyjne, uprawnienia, audit trail |
| **`interview-to-initiative/00-OVERVIEW.md`** | Przepływ od wywiadu do inicjatywy |

---

## 🎯 Szybki start

### Chcesz zrozumieć jak działa cały system?

1. Przeczytaj: **`00-WORK-LIFECYCLE.md`** - pełny obraz
2. Role i delegacje: **`01-ROLES-AND-ASSUMPTIONS.md`**
2. Szczegóły statusów: `../standards/03-STATUS-WORKFLOW.md`
3. Szczegóły tasków: `../standards/entities/01-TASK.md`

### Chcesz zaimplementować nowy gate?

1. Przeczytaj: **`decision-gates/00-OVERVIEW.md`**
2. Sprawdź: `server/src/constants/initiativeStatuses.ts`
3. Zaktualizuj: dokumentację w `standards/03-STATUS-WORKFLOW.md`

### Chcesz dodać nowy status?

1. Przeczytaj: `standards/03-STATUS-WORKFLOW.md`
2. Zaktualizuj: `server/src/constants/initiativeStatuses.ts`
3. Zaktualizuj: wszystkie powiązane dokumenty workflow

---

## 🔗 Powiązane dokumenty

### Standardy

- Status Workflow: `wdrozenia/standards/03-STATUS-WORKFLOW.md`
- Encja Task: `wdrozenia/standards/entities/01-TASK.md`
- Encja Decision: `wdrozenia/standards/entities/02-DECISION.md`
- RBAC: `wdrozenia/standards/07-ROLES-PERMISSIONS.md`

### Implementacja

- Backend: `server/src/constants/initiativeStatuses.ts`
- Frontend: `src/types/initiative.ts`
- Frontend: `src/services/initiativeLifecycle.ts`

---

## 📊 Diagram przepływu (high-level)

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   DISCOVERY  │───▶│  INITIATIVES │───▶│  EXECUTION   │───▶│   BENEFITS   │
│              │    │              │    │              │    │              │
│  Tools       │    │  Planning    │    │  Tasks       │    │  Tracking    │
│  Assessment  │    │  Approval    │    │  Delivery     │    │  KPIs        │
│  Interview   │    │  Scheduling  │    │  Monitoring   │    │  ROI         │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

---

## ✅ Status dokumentacji

| Dokument | Status | Ostatnia aktualizacja |
|----------|--------|----------------------|
| 00-WORK-LIFECYCLE.md | ✅ Kompletny | 2026-01-27 |
| initiative-lifecycle/ | ✅ Kompletny | 2026-01-27 |
| execution-flow/ | ✅ Kompletny | 2026-01-27 |
| decision-gates/ | ✅ Kompletny | 2026-01-27 |
| interview-to-initiative/ | 🟡 Częściowy | - |

---

## 📝 Historia zmian

| Data | Zmiana | Autor |
|------|--------|-------|
| 2026-01-27 | Utworzenie kompleksowej dokumentacji workflow | Agent |
| 2026-01-27 | Dodano mechanizm zatwierdzania tasków | Agent |
| 2026-01-27 | Rozszerzono workflow o PENDING_REVIEW | Agent |
