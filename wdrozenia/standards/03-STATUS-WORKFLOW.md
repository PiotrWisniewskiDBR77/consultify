# 📊 Status Workflow Standard (kanoniczny)

## Cel

Jeden, spójny workflow statusów inicjatyw widoczny i walidowany w całym systemie (backend + frontend), z bramkami decyzyjnymi (gate decisions) i przypisanymi rolami biznesowymi.

## Źródła

- Backend: `server/src/constants/initiativeStatuses.ts`
- Frontend: `src/types/initiative.ts` + `src/services/initiativeLifecycle.ts`
- Audyt: `wdrozenia/AUDYT_SYSTEM_INTEGRATION.md`

---

## Kanoniczne statusy INITIATIVE (13 statusów)

> **UWAGA:** Workflow został rozszerzony o etapy DRAFT i REVIEW na poziomie modułów źródłowych (Tools/Assessment), zanim inicjatywa trafi do modułu Initiatives.

---

## FAZA 1: Moduły źródłowe (Tools / Assessment)

### 1️⃣ DRAFT

| Aspekt | Opis |
|--------|------|
| **Co to znaczy** | Inicjatywa została wygenerowana przez narzędzie/assessment, autor pracuje nad nią |
| **Źródło** | Tools Output lub Assessment Report |
| **Co wolno** | Edycja wszystkiego, usuwanie, łączenie źródeł, uzupełnianie danych |
| **Kto edytuje** | **Consultant** (autor) |
| **Wymagane do przejścia** | Tytuł, Opis (min. 50 znaków), Oś strategiczna |
| **Gate wyjściowy** | `SUBMIT_FOR_REVIEW` |
| **Kto decyduje** | Consultant (autor) - sam wysyła do review |
| **Moduł UI** | Tools, Assessment |

---

### 2️⃣ PENDING_REVIEW

| Aspekt | Opis |
|--------|------|
| **Co to znaczy** | Inicjatywa wysłana do przeglądu przez osobę wyższą w projekcie |
| **Cel** | Weryfikacja jakości, kompletności i sensowności przez Project Manager/Lead |
| **Artefakty wymagane** | Tytuł, Opis, Oś, Wstępna hipoteza wartości |
| **Kto edytuje** | Consultant (poprawki), Reviewer (komentarze) |
| **Gate wyjściowy** | `APPROVE_TO_INITIATIVE` (→ REVIEW) lub `SEND_BACK` (→ DRAFT) |
| **Kto decyduje** | **Project Manager** lub **Project Lead** |
| **Moduł UI** | Tools, Assessment |

---

## FAZA 2: Moduł Initiatives (planowanie i zatwierdzanie)

### 3️⃣ REVIEW

| Aspekt | Opis |
|--------|------|
| **Co to znaczy** | Inicjatywa jest w przeglądzie biznesowym (Go/No-Go) |
| **Cel** | Sprawdzenie sensu, zakresu, zgodności strategicznej |
| **Artefakty wymagane** | Opis inicjatywy, Owner, Wstępny scope, Risk flags (min. 1) |
| **Kto edytuje** | Consultant, Initiative Owner |
| **Gate wyjściowy** | `ACCEPT` (→ PROMOTED) lub `REJECT` (→ DRAFT) |
| **Kto decyduje** | **Project Sponsor** lub **Steering Committee** (jeśli eskalowana) |
| **Moduł UI** | Initiatives |

---

### 5️⃣ PROMOTED

| Aspekt | Opis |
|--------|------|
| **Co to znaczy** | Inicjatywa uznana za wartą planowania (bez zobowiązania budżetowego) |
| **Artefakty** | Wstępna struktura tasków, wstępna ekonomika, potencjalny zespół |
| **Kto edytuje** | Consultant, Initiative Owner |
| **Gate wyjściowy** | `START_PLANNING` |
| **Kto decyduje** | **PMO** |
| **Moduł UI** | Initiatives |

---

### 6️⃣ PLANNING

| Aspekt | Opis |
|--------|------|
| **Co to znaczy** | Inicjatywa jest planowana operacyjnie |
| **Artefakty wymagane** | Taski, Timeline/roadmap, Economic Analysis (jeśli wymagane polityką), Decision: APPROVE (pending) |
| **Kto edytuje** | Consultant, Initiative Owner |
| **Gate wyjściowy** | `APPROVE` |
| **Kto decyduje** | **Steering Committee** |
| **Moduł UI** | Initiatives |

---

### 7️⃣ APPROVED

| Aspekt | Opis |
|--------|------|
| **Co to znaczy** | Inicjatywa zaakceptowana decyzyjnie (strategicznie i finansowo) |
| **Artefakty** | Zatwierdzona ekonomika, zatwierdzony scope, zatwierdzony owner |
| **Kto edytuje** | PMO |
| **Gate wyjściowy** | `SCHEDULE` |
| **Kto decyduje** | **PMO** |
| **Moduł UI** | Initiatives |

---

### 8️⃣ SCHEDULED

| Aspekt | Opis |
|--------|------|
| **Co to znaczy** | Inicjatywa przypisana do harmonogramu (ma daty start/koniec) |
| **Artefakty** | Timeline (baseline), Taski przypisane do dat |
| **Kto edytuje** | PMO |
| **Gate wyjściowy** | `START` |
| **Kto decyduje** | **PMO** (lub automatycznie na podstawie daty) |
| **Moduł UI** | Initiatives / Execution |

---

## FAZA 3: Moduł Execution (realizacja)

### 9️⃣ EXECUTING

| Aspekt | Opis |
|--------|------|
| **Co to znaczy** | Realizacja inicjatywy w toku |
| **Co się dzieje** | Taski w toku, decyzje CHANGE/UNBLOCK, monitoring progress |
| **Kto edytuje** | Initiative Owner, Team Member |
| **Gate wyjściowy** | `BLOCK` (→ BLOCKED) lub `COMPLETE` (→ DONE) |
| **Kto decyduje** | Initiative Owner, PMO |
| **Moduł UI** | Execution |

---

### 🔟 BLOCKED

| Aspekt | Opis |
|--------|------|
| **Co to znaczy** | Realizacja wstrzymana, wymagana decyzja odblokowująca |
| **Wymagane** | Decision z typem: UNBLOCK lub CHANGE (scope/budget/timeline) |
| **Kto edytuje** | Initiative Owner |
| **Gate wyjściowy** | `UNBLOCK` (→ EXECUTING) lub `CANCEL` (→ CANCELLED) |
| **Kto decyduje** | **Project Sponsor** lub **Steering Committee** (jeśli eskalacja) |
| **Moduł UI** | Execution |

---

### 1️⃣1️⃣ DONE

| Aspekt | Opis |
|--------|------|
| **Co to znaczy** | Delivery zakończone, zakres zrealizowany |
| **Artefakty wymagane** | Taski zamknięte, Delivery confirmation, Final scope |
| **Kto potwierdza** | Initiative Owner zgłasza, PMO potwierdza kompletność |
| **Gate wyjściowy** | `START_TRACKING` |
| **Kto decyduje** | **Business Owner** |
| **Moduł UI** | Execution |

---

## FAZA 4: Moduł Benefits (śledzenie korzyści)

### 1️⃣2️⃣ TRACKING

| Aspekt | Opis |
|--------|------|
| **Co to znaczy** | Śledzenie efektów / benefits |
| **Artefakty** | Benefits Records, KPI baseline + target, Owner trackingu |
| **Kto edytuje** | Business Owner |
| **Zakończenie** | Decyzja o zamknięciu trackingu lub upływ okresu |
| **Kto decyduje** | **Business Owner**, PMO |
| **Moduł UI** | Benefits |

---

## Status terminalny

### 1️⃣3️⃣ CANCELLED (terminalny)

| Aspekt | Opis |
|--------|------|
| **Co to znaczy** | Inicjatywa przerwana, nie wraca do lifecycle |
| **Zasada** | Brak "undo", audyt + reason obowiązkowe |
| **Kto decyduje** | **PMO** lub **Steering Committee** |
| **Moduł UI** | Wszystkie (historyczne) |

---

## Diagram przepływu

```
═══════════════════════════════════════════════════════════════════════════════
                    FAZA 1: TOOLS / ASSESSMENT (Moduły źródłowe)
═══════════════════════════════════════════════════════════════════════════════

┌─────────────┐
│    DRAFT    │ ◀──────────────────────────────────────┐
│  (Autor)    │                                        │
└──────┬──────┘                                        │
       │ SUBMIT_FOR_REVIEW (Consultant)                │ SEND_BACK
       ▼                                               │
┌─────────────────┐                                    │
│ PENDING_REVIEW  │ ───────────────────────────────────┘
│ (PM/Lead)       │
└──────┬──────────┘
       │ APPROVE_TO_INITIATIVE (Project Manager / Lead)
       ▼
═══════════════════════════════════════════════════════════════════════════════
                    FAZA 2: INITIATIVES (Planowanie i zatwierdzanie)
═══════════════════════════════════════════════════════════════════════════════

┌─────────────┐
│   REVIEW    │ ◀──────────────────────────────────────┐
│ (Go/No-Go)  │                                        │
└──────┬──────┘                                        │
       │ ACCEPT (Project Sponsor / Steering)           │ REJECT
       ▼                                               │
┌─────────────┐                                        │
│  PROMOTED   │ ───────────────────────────────────────┘
└──────┬──────┘
       │ START_PLANNING (PMO)
       ▼
┌─────────────┐
│  PLANNING   │
└──────┬──────┘
       │ APPROVE (Steering Committee)
       ▼
┌─────────────┐
│  APPROVED   │
└──────┬──────┘
       │ SCHEDULE (PMO)
       ▼
┌─────────────┐
│  SCHEDULED  │
└──────┬──────┘
       │ START (PMO / auto)
       ▼
═══════════════════════════════════════════════════════════════════════════════
                    FAZA 3: EXECUTION (Realizacja)
═══════════════════════════════════════════════════════════════════════════════

┌─────────────┐         ┌─────────────┐
│  EXECUTING  │ ◀──────▶│   BLOCKED   │
└──────┬──────┘ UNBLOCK └──────┬──────┘
       │ COMPLETE                   │ CANCEL
       ▼                            ▼
┌─────────────┐              ┌─────────────┐
│    DONE     │              │  CANCELLED  │ (terminalny)
└──────┬──────┘              └─────────────┘
       │ START_TRACKING (Business Owner)
       ▼
═══════════════════════════════════════════════════════════════════════════════
                    FAZA 4: BENEFITS (Śledzenie korzyści)
═══════════════════════════════════════════════════════════════════════════════

┌─────────────┐
│  TRACKING   │
└─────────────┘

Uwaga: CANCEL możliwy z każdego statusu (poza CANCELLED i TRACKING)
```

---

## Widoczność per moduł

| Moduł | Widoczne statusy | Główne role |
|-------|------------------|-------------|
| **Tools** | DRAFT, PENDING_REVIEW (własne) | Consultant, Project Manager |
| **Assessment** | DRAFT, PENDING_REVIEW (własne) | Consultant, Project Manager |
| **Initiatives** | REVIEW, PROMOTED, PLANNING, APPROVED, SCHEDULED | PMO, Project Sponsor, Steering |
| **Execution** | SCHEDULED, EXECUTING, BLOCKED, DONE | Initiative Owner, PMO, Team |
| **Benefits** | TRACKING | Business Owner, PMO |
| **Reporting** | Wszystkie (read-only) | Wszystkie role |

### Kluczowa zmiana: Dwuetapowy review na poziomie źródłowym

```
┌─────────────────────────────────────────────────────────────────────────┐
│  TOOLS / ASSESSMENT                                                     │
│  ┌──────────┐    SUBMIT    ┌────────────────┐   APPROVE   ┌──────────┐ │
│  │  DRAFT   │ ──────────▶  │ PENDING_REVIEW │ ──────────▶ │ REVIEW   │ │
│  │ (Autor)  │              │   (PM/Lead)    │             │ (Biznes) │ │
│  └──────────┘    ◀─────────└────────────────┘             └──────────┘ │
│                  SEND_BACK                                     ↓       │
│                                                          Do modułu     │
│                                                          INITIATIVES   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Korzyści:**
1. Autor (Consultant) może pracować nad inicjatywą bez presji
2. Project Manager/Lead weryfikuje jakość przed przekazaniem do biznesu
3. Biznes (Project Sponsor) widzi tylko zweryfikowane inicjatywy
4. Jasny podział odpowiedzialności: autor → PM → biznes

---

## Gate Decisions (bramki)

### Faza 1: Tools / Assessment (nowe bramki)

| Gate | Przejście | Decydent | Typ decyzji | Moduł |
|------|-----------|----------|-------------|-------|
| `SUBMIT_FOR_REVIEW` | DRAFT → PENDING_REVIEW | Consultant (autor) | Techniczna | Tools/Assessment |
| `SEND_BACK` | PENDING_REVIEW → DRAFT | Project Manager / Lead | Techniczna | Tools/Assessment |
| `APPROVE_TO_INITIATIVE` | PENDING_REVIEW → REVIEW | Project Manager / Lead | Techniczna | Tools/Assessment |

### Faza 2-4: Initiatives / Execution / Benefits (istniejące bramki)

| Gate | Przejście | Decydent | Typ decyzji | Moduł |
|------|-----------|----------|-------------|-------|
| `ACCEPT` | REVIEW → PROMOTED | Project Sponsor / Steering | Biznesowa | Initiatives |
| `REJECT` | REVIEW → DRAFT | Project Sponsor / Steering | Biznesowa | Initiatives |
| `START_PLANNING` | PROMOTED → PLANNING | PMO | Wykonawcza | Initiatives |
| `APPROVE` | PLANNING → APPROVED | Steering Committee | Strategiczna | Initiatives |
| `SCHEDULE` | APPROVED → SCHEDULED | PMO | Wykonawcza | Initiatives |
| `START` | SCHEDULED → EXECUTING | PMO (lub auto) | Wykonawcza | Execution |
| `BLOCK` | EXECUTING → BLOCKED | Initiative Owner / PMO | Operacyjna | Execution |
| `UNBLOCK` | BLOCKED → EXECUTING | Project Sponsor / Steering | Biznesowa | Execution |
| `COMPLETE` | EXECUTING → DONE | Initiative Owner + PMO | Operacyjna | Execution |
| `START_TRACKING` | DONE → TRACKING | Business Owner | Biznesowa | Benefits |
| `CANCEL` | * → CANCELLED | PMO / Steering | Strategiczna | Wszystkie |

---

## Kluczowa zasada systemu

> **Consultant NIGDY nie może przesuwać inicjatywy przez gate decyzyjny.**
> 
> Każdy gate musi mieć przypisaną rolę biznesową, a nie techniczną.

### Implementacja w UI

- Przycisk gate'a → `disabled` jeśli `user.role` nie ma uprawnień
- Backend waliduje rolę przed wykonaniem akcji
- Audit log zapisuje: kto, kiedy, jaki gate, jaki wynik

---

## Walidacja przejść (dozwolone)

```typescript
const VALID_TRANSITIONS = {
  // Faza 1: Tools / Assessment
  DRAFT:          ['PENDING_REVIEW', 'CANCELLED'],
  PENDING_REVIEW: ['REVIEW', 'DRAFT', 'CANCELLED'],
  
  // Faza 2: Initiatives
  REVIEW:    ['PROMOTED', 'DRAFT', 'CANCELLED'],
  PROMOTED:  ['PLANNING', 'CANCELLED'],
  PLANNING:  ['APPROVED', 'CANCELLED'],
  APPROVED:  ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['EXECUTING', 'CANCELLED'],
  
  // Faza 3: Execution
  EXECUTING: ['BLOCKED', 'DONE', 'CANCELLED'],
  BLOCKED:   ['EXECUTING', 'CANCELLED'],
  DONE:      ['TRACKING'],
  
  // Faza 4: Benefits
  TRACKING:  [], // stan końcowy
  
  // Terminal
  CANCELLED: [], // stan terminalny
};
```

---

## Metadata statusów (UI)

| # | Status | Label | Label PL | Kolor | Ikona | Faza |
|---|--------|-------|----------|-------|-------|------|
| 1 | DRAFT | Draft | Szkic | slate | FileText | Tools/Assessment |
| 2 | PENDING_REVIEW | Pending Review | Oczekuje na przegląd | orange | Clock | Tools/Assessment |
| 3 | REVIEW | In Review | W przeglądzie biznesowym | amber | Eye | Initiatives |
| 4 | PROMOTED | Promoted | Promowana | blue | TrendingUp | Initiatives |
| 5 | PLANNING | Planning | Planowanie | indigo | ClipboardList | Initiatives |
| 6 | APPROVED | Approved | Zatwierdzona | emerald | CheckCircle | Initiatives |
| 7 | SCHEDULED | Scheduled | Zaplanowana | purple | Calendar | Initiatives |
| 8 | EXECUTING | Executing | W realizacji | cyan | Play | Execution |
| 9 | BLOCKED | Blocked | Zablokowana | red | AlertTriangle | Execution |
| 10 | DONE | Done | Ukończona | green | CheckCircle2 | Execution |
| 11 | TRACKING | Tracking | Śledzenie | teal | BarChart | Benefits |
| 12 | CANCELLED | Cancelled | Anulowana | gray | XCircle | Terminal |

---

## Historia zmian

| Data | Zmiana | Autor |
|------|--------|-------|
| 2026-01-27 | Rozszerzenie o PENDING_REVIEW - 13 statusów, dwuetapowy review na Tools/Assessment | Agent |
| 2026-01-26 | Pełna przebudowa - 11 statusów, role, gate decisions | Agent |
| 2026-01-26 | Poprzednia wersja (9 statusów) | - |

---

## Powiązane dokumenty

- Role i uprawnienia: `wdrozenia/standards/07-ROLES-PERMISSIONS.md`
- Encja Task: `wdrozenia/standards/entities/01-TASK.md`
- Encja Decision: `wdrozenia/standards/entities/02-DECISION.md`
- Audyt integracji: `wdrozenia/AUDYT_SYSTEM_INTEGRATION.md`
