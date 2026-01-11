# [NAZWA PRZEPŁYWU] - Analiza przepływu biznesowego

> **ID przepływu:** FLOW-[DOMAIN]-[NUM]  
> **Data analizy:** [DATA]  
> **Autor:** [IMIĘ]  
> **Status:** 🔴 Draft | 🟡 In Review | 🟢 Approved  
> **Wersja:** 1.0

---

## 📋 Podsumowanie wykonawcze

| Metryka                          | Wartość    |
| -------------------------------- | ---------- |
| **Kompletność przepływu**        | [X]%       |
| **Liczba zidentyfikowanych luk** | [N]        |
| **Luki krytyczne (🔴)**          | [N]        |
| **Luki wysokie (🟠)**            | [N]        |
| **Luki średnie (🟡)**            | [N]        |
| **Szacowany effort naprawy**     | [S/M/L/XL] |

### Status komponentów

| Komponent     | Status   | Uwagi |
| ------------- | -------- | ----- |
| Frontend UI   | ✅/⚠️/❌ |       |
| Backend API   | ✅/⚠️/❌ |       |
| Database      | ✅/⚠️/❌ |       |
| Integrations  | ✅/⚠️/❌ |       |
| Documentation | ✅/⚠️/❌ |       |

---

## 1️⃣ Definicja przepływu

### 1.1 Cel biznesowy

> [Opisz co ten przepływ ma osiągnąć z perspektywy biznesowej]

**Przykład:** Partner zarabia prowizję za poleconych klientów, co motywuje go do aktywnej promocji platformy.

### 1.2 Trigger (co rozpoczyna przepływ)

> [Co inicjuje ten przepływ - akcja użytkownika, event systemowy, cron job?]

**Przykład:** Partner loguje się do Partner Portal i generuje unikalny kod rabatowy.

### 1.3 Outcome (oczekiwany rezultat)

> [Jaki jest końcowy rezultat pomyślnego przepływu?]

**Przykład:** Partner otrzymuje wypłatę prowizji na swoje konto bankowe.

### 1.4 Success Criteria

- [ ] [Kryterium sukcesu 1]
- [ ] [Kryterium sukcesu 2]
- [ ] [Kryterium sukcesu 3]

---

## 2️⃣ Aktorzy

### 2.1 Mapa aktorów

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRZEPŁYW: [NAZWA]                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   [AKTOR 1]  ──────►  [AKTOR 2]  ──────►  [AKTOR 3]            │
│   (trigger)           (action)            (verification)        │
│                                                                 │
│                           │                                     │
│                           ▼                                     │
│                      [SYSTEM]                                   │
│                   (automation)                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Szczegóły aktorów

#### Aktor: [NAZWA 1]

| Aspekt           | Opis                                      |
| ---------------- | ----------------------------------------- |
| **Rola**         | [np. Partner, Admin, SuperAdmin, System]  |
| **Moduł główny** | [np. Partner Portal, Admin Panel]         |
| **MOŻE**         | [akcje opcjonalne]                        |
| **MUSI**         | [akcje wymagane do kontynuacji przepływu] |
| **WIDZI**        | [jakie informacje są dostępne]            |
| **Nie może**     | [ograniczenia]                            |

#### Aktor: [NAZWA 2]

| Aspekt           | Opis |
| ---------------- | ---- |
| **Rola**         |      |
| **Moduł główny** |      |
| **MOŻE**         |      |
| **MUSI**         |      |
| **WIDZI**        |      |
| **Nie może**     |      |

<!-- Powtórz dla każdego aktora -->

---

## 3️⃣ Moduły zaangażowane

### 3.1 Mapa modułów

```
┌─────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                │
├─────────────────────────────────────────────────────────────────┤
│  [Moduł 1]          [Moduł 2]          [Moduł 3]               │
│  └─ View.tsx        └─ View.tsx        └─ View.tsx             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                            API                                   │
├─────────────────────────────────────────────────────────────────┤
│  /api/[endpoint1]   /api/[endpoint2]   /api/[endpoint3]        │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                         SERVICES                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Service1].ts      [Service2].ts      [Service3].ts           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                         DATABASE                                 │
├─────────────────────────────────────────────────────────────────┤
│  [table1]           [table2]           [table3]                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Szczegóły modułów

| Warstwa      | Moduł         | Plik/Endpoint                   | Rola w przepływie | Status   |
| ------------ | ------------- | ------------------------------- | ----------------- | -------- |
| **Frontend** |               |                                 |                   |          |
|              | [Moduł 1]     | `src/views/[path]`              | [opis]            | ✅/⚠️/❌ |
|              | [Moduł 2]     | `src/views/[path]`              | [opis]            | ✅/⚠️/❌ |
| **API**      |               |                                 |                   |          |
|              | [Endpoint 1]  | `GET /api/[path]`               | [opis]            | ✅/⚠️/❌ |
|              | [Endpoint 2]  | `POST /api/[path]`              | [opis]            | ✅/⚠️/❌ |
| **Service**  |               |                                 |                   |          |
|              | [Service 1]   | `server/src/services/[name].ts` | [opis]            | ✅/⚠️/❌ |
| **Database** |               |                                 |                   |          |
|              | [Table 1]     | `[migration_file]`              | [opis]            | ✅/⚠️/❌ |
| **External** |               |                                 |                   |          |
|              | [Integration] | [provider]                      | [opis]            | ✅/⚠️/❌ |

---

## 4️⃣ Sekwencja przepływu

### 4.1 Diagram sekwencji

```
┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐     ┌────────┐
│Aktor 1 │     │Frontend│     │  API   │     │Service │     │Database│
└───┬────┘     └───┬────┘     └───┬────┘     └───┬────┘     └───┬────┘
    │              │              │              │              │
    │  1. Akcja    │              │              │              │
    │─────────────>│              │              │              │
    │              │  2. Request  │              │              │
    │              │─────────────>│              │              │
    │              │              │  3. Call     │              │
    │              │              │─────────────>│              │
    │              │              │              │  4. Query    │
    │              │              │              │─────────────>│
    │              │              │              │  5. Result   │
    │              │              │              │<─────────────│
    │              │              │  6. Response │              │
    │              │              │<─────────────│              │
    │              │  7. Update   │              │              │
    │              │<─────────────│              │              │
    │  8. Display  │              │              │              │
    │<─────────────│              │              │              │
    │              │              │              │              │
```

### 4.2 Kroki przepływu

#### Krok 1: [Nazwa kroku]

| Element        | Wartość                            |
| -------------- | ---------------------------------- |
| **Aktor**      | [kto wykonuje]                     |
| **Akcja**      | [co robi]                          |
| **Moduł**      | [gdzie]                            |
| **Input**      | [co jest potrzebne]                |
| **Output**     | [co jest rezultatem]               |
| **Zależności** | [od czego zależy]                  |
| **Status**     | ✅ Działa / ⚠️ Częściowo / ❌ Brak |

#### Krok 2: [Nazwa kroku]

| Element        | Wartość |
| -------------- | ------- |
| **Aktor**      |         |
| **Akcja**      |         |
| **Moduł**      |         |
| **Input**      |         |
| **Output**     |         |
| **Zależności** |         |
| **Status**     |         |

<!-- Powtórz dla każdego kroku -->

---

## 5️⃣ Matryca zależności

### 5.1 Zależności między modułami

| Moduł źródłowy | Moduł docelowy | Typ zależności             | Opis   | Status   |
| -------------- | -------------- | -------------------------- | ------ | -------- |
| [A]            | [B]            | Data / Action / Validation | [opis] | ✅/⚠️/❌ |
| [B]            | [C]            | Data / Action / Validation | [opis] | ✅/⚠️/❌ |

### 5.2 Diagram zależności

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Moduł A    │────>│   Moduł B    │────>│   Moduł C    │
│              │     │              │     │              │
│ • funkcja 1  │     │ • funkcja 2  │     │ • funkcja 3  │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                      DATABASE                           │
│  [table_a]        [table_b]        [table_c]           │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Reguły biznesowe

| ID    | Reguła         | Moduły | Implementacja |
| ----- | -------------- | ------ | ------------- |
| BR-01 | [Jeśli X to Y] | [A, B] | ✅/⚠️/❌      |
| BR-02 | [Walidacja Z]  | [B, C] | ✅/⚠️/❌      |

---

## 6️⃣ Analiza luk (Gap Analysis)

### 6.1 Checklist kompletności

#### Frontend

- [ ] Wszystkie wymagane widoki istnieją
- [ ] UI jest podłączone do API (nie mock data)
- [ ] Obsługa błędów w UI
- [ ] Loading states
- [ ] Empty states
- [ ] Responsywność
- [ ] Dostępność (a11y)

#### Backend API

- [ ] Wszystkie wymagane endpointy istnieją
- [ ] Walidacja inputów (Joi/Zod)
- [ ] Obsługa błędów
- [ ] Rate limiting gdzie potrzebne
- [ ] Autoryzacja (RBAC)
- [ ] Audit logging

#### Database

- [ ] Wszystkie tabele istnieją
- [ ] Relacje są poprawne
- [ ] Indeksy dla wydajności
- [ ] Dane demo/seed

#### Integracje

- [ ] Webhooks skonfigurowane
- [ ] Error handling dla zewnętrznych API
- [ ] Retry logic
- [ ] Fallback behavior

#### Dokumentacja

- [ ] API dokumentacja aktualna
- [ ] Help content w aplikacji
- [ ] User guide jeśli potrzebny

### 6.2 Zidentyfikowane luki

#### GAP-[FLOW]-001: [Krótki opis]

| Atrybut        | Wartość                                                                   |
| -------------- | ------------------------------------------------------------------------- |
| **Typ**        | Missing UI / Missing API / Missing Data / Missing Integration / Mock Data |
| **Severity**   | 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low                                |
| **Moduł**      | [gdzie jest luka]                                                         |
| **Opis**       | [szczegółowy opis problemu]                                               |
| **Wpływ**      | [jak wpływa na przepływ]                                                  |
| **Zależności** | [co musi być najpierw]                                                    |
| **Effort**     | S (1-2h) / M (2-4h) / L (4-8h) / XL (8h+)                                 |

#### GAP-[FLOW]-002: [Krótki opis]

| Atrybut        | Wartość |
| -------------- | ------- |
| **Typ**        |         |
| **Severity**   |         |
| **Moduł**      |         |
| **Opis**       |         |
| **Wpływ**      |         |
| **Zależności** |         |
| **Effort**     |         |

<!-- Powtórz dla każdej luki -->

---

## 7️⃣ Action Items

### 7.1 Priorytetyzacja

| Priorytet   | Liczba  | Effort   |
| ----------- | ------- | -------- |
| 🔴 Critical | [N]     | [Xh]     |
| 🟠 High     | [N]     | [Xh]     |
| 🟡 Medium   | [N]     | [Xh]     |
| 🟢 Low      | [N]     | [Xh]     |
| **TOTAL**   | **[N]** | **[Xh]** |

### 7.2 Lista action items

#### 🔴 Critical

| ID                | Opis   | Moduł   | Effort     | Assignee | Status  |
| ----------------- | ------ | ------- | ---------- | -------- | ------- |
| ACTION-[FLOW]-001 | [opis] | [moduł] | [S/M/L/XL] | [osoba]  | ⬜ Todo |

#### 🟠 High

| ID                | Opis   | Moduł   | Effort     | Assignee | Status  |
| ----------------- | ------ | ------- | ---------- | -------- | ------- |
| ACTION-[FLOW]-002 | [opis] | [moduł] | [S/M/L/XL] | [osoba]  | ⬜ Todo |

#### 🟡 Medium

| ID                | Opis   | Moduł   | Effort     | Assignee | Status  |
| ----------------- | ------ | ------- | ---------- | -------- | ------- |
| ACTION-[FLOW]-003 | [opis] | [moduł] | [S/M/L/XL] | [osoba]  | ⬜ Todo |

#### 🟢 Low

| ID                | Opis   | Moduł   | Effort     | Assignee | Status  |
| ----------------- | ------ | ------- | ---------- | -------- | ------- |
| ACTION-[FLOW]-004 | [opis] | [moduł] | [S/M/L/XL] | [osoba]  | ⬜ Todo |

---

## 8️⃣ Rekomendacje

### 8.1 Quick Wins (do zrobienia od razu)

1. [Rekomendacja 1]
2. [Rekomendacja 2]
3. [Rekomendacja 3]

### 8.2 Długoterminowe usprawnienia

1. [Rekomendacja 1]
2. [Rekomendacja 2]

### 8.3 Technical Debt do adresowania

1. [Item 1]
2. [Item 2]

---

## 9️⃣ Appendix

### A. Powiązane dokumenty

| Dokument         | Link                      |
| ---------------- | ------------------------- |
| Dokumentacja API | `docs/api/[...]`          |
| Migracje DB      | `server/migrations/[...]` |
| Audit modułu     | `docs/[...]_AUDIT.md`     |

### B. Historia zmian

| Data   | Autor   | Zmiany           |
| ------ | ------- | ---------------- |
| [DATA] | [AUTOR] | Initial analysis |

### C. Reviewerzy

| Osoba  | Rola   | Data review | Status                   |
| ------ | ------ | ----------- | ------------------------ |
| [Imię] | [Rola] | [Data]      | ✅ Approved / ⏳ Pending |

---

_Dokument wygenerowany zgodnie z metodologią BFCS (Business Flow Completeness System)_
