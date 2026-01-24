# Matryca zależności międzymodułowych

> **Przepływ:** [NAZWA PRZEPŁYWU]  
> **ID:** FLOW-[DOMAIN]-[NUM]  
> **Data:** [DATA]

---

## 1. Macierz zależności (Dependency Matrix)

### 1.1 Legenda

| Symbol | Znaczenie                                     |
| ------ | --------------------------------------------- |
| ✅     | Zależność zaimplementowana i przetestowana    |
| ⚠️     | Zależność częściowo zaimplementowana lub mock |
| ❌     | Zależność brakująca                           |
| ➖     | Brak zależności (nie dotyczy)                 |
| 🔄     | Zależność dwukierunkowa                       |

### 1.2 Typy zależności

| Typ              | Kod | Opis                          |
| ---------------- | --- | ----------------------------- |
| **Data**         | D   | Moduł B potrzebuje danych z A |
| **Action**       | A   | Akcja w A wywołuje akcję w B  |
| **Validation**   | V   | A waliduje dane używając B    |
| **UI Reference** | U   | UI w A pokazuje dane z B      |
| **Event**        | E   | A emituje event, B nasłuchuje |

---

## 2. Matryca: Frontend ↔ Frontend

Zależności między komponentami/widokami frontend.

| Z \ Do        | [Moduł 1] | [Moduł 2] | [Moduł 3] | [Moduł 4] |
| ------------- | --------- | --------- | --------- | --------- |
| **[Moduł 1]** | ➖        |           |           |           |
| **[Moduł 2]** |           | ➖        |           |           |
| **[Moduł 3]** |           |           | ➖        |           |
| **[Moduł 4]** |           |           |           | ➖        |

### 2.1 Szczegóły zależności Frontend

| ID    | Z         | Do        | Typ | Opis                     | Status   |
| ----- | --------- | --------- | --- | ------------------------ | -------- |
| FE-01 | [Moduł A] | [Moduł B] | U   | [opis co jest potrzebne] | ✅/⚠️/❌ |
| FE-02 |           |           |     |                          |          |

---

## 3. Matryca: Frontend ↔ API

Zależności między frontend a endpointami API.

| Frontend \ API | `GET /api/[1]` | `POST /api/[2]` | `PUT /api/[3]` | `DELETE /api/[4]` |
| -------------- | -------------- | --------------- | -------------- | ----------------- |
| **[View 1]**   |                |                 |                |                   |
| **[View 2]**   |                |                 |                |                   |
| **[View 3]**   |                |                 |                |                   |
| **[View 4]**   |                |                 |                |                   |

### 3.1 Szczegóły zależności Frontend → API

| ID    | Frontend   | API Endpoint  | Metoda | Dane wysyłane | Dane otrzymywane | Status   |
| ----- | ---------- | ------------- | ------ | ------------- | ---------------- | -------- |
| FA-01 | [View.tsx] | `/api/[path]` | GET    | [params]      | [response]       | ✅/⚠️/❌ |
| FA-02 |            |               |        |               |                  |          |

---

## 4. Matryca: API ↔ Service

Zależności między endpointami API a serwisami backend.

| API \ Service  | [Service1] | [Service2] | [Service3] | [Service4] |
| -------------- | ---------- | ---------- | ---------- | ---------- |
| **`/api/[1]`** |            |            |            |            |
| **`/api/[2]`** |            |            |            |            |
| **`/api/[3]`** |            |            |            |            |
| **`/api/[4]`** |            |            |            |            |

### 4.1 Szczegóły zależności API → Service

| ID    | API Endpoint  | Service       | Metoda serwisu | Opis   | Status   |
| ----- | ------------- | ------------- | -------------- | ------ | -------- |
| AS-01 | `/api/[path]` | [name]Service | [method]()     | [opis] | ✅/⚠️/❌ |
| AS-02 |               |               |                |        |          |

---

## 5. Matryca: Service ↔ Service

Zależności między serwisami backend (cross-service calls).

| Service \ Service | [Service1] | [Service2] | [Service3] | [Service4] |
| ----------------- | ---------- | ---------- | ---------- | ---------- |
| **[Service1]**    | ➖         |            |            |            |
| **[Service2]**    |            | ➖         |            |            |
| **[Service3]**    |            |            | ➖         |            |
| **[Service4]**    |            |            |            | ➖         |

### 5.1 Szczegóły zależności Service → Service

| ID    | Service źródłowy | Service docelowy | Metoda     | Opis   | Status   |
| ----- | ---------------- | ---------------- | ---------- | ------ | -------- |
| SS-01 | [ServiceA]       | [ServiceB]       | [method]() | [opis] | ✅/⚠️/❌ |
| SS-02 |                  |                  |            |        |          |

---

## 6. Matryca: Service ↔ Database

Zależności między serwisami a tabelami w bazie danych.

| Service \ Table | [table_1] | [table_2] | [table_3] | [table_4] |
| --------------- | --------- | --------- | --------- | --------- |
| **[Service1]**  |           |           |           |           |
| **[Service2]**  |           |           |           |           |
| **[Service3]**  |           |           |           |           |
| **[Service4]**  |           |           |           |           |

### 6.1 Szczegóły zależności Service → Database

| ID    | Service       | Tabela       | Operacje       | Opis   | Status   |
| ----- | ------------- | ------------ | -------------- | ------ | -------- |
| SD-01 | [name]Service | [table_name] | CRUD / R / CRU | [opis] | ✅/⚠️/❌ |
| SD-02 |               |              |                |        |          |

---

## 7. Matryca: External Integrations

Zależności od zewnętrznych systemów i API.

| Moduł wewnętrzny | External System | Typ integracji | Kierunek | Status   |
| ---------------- | --------------- | -------------- | -------- | -------- |
| [Service/Route]  | Stripe          | Webhook        | Inbound  | ✅/⚠️/❌ |
| [Service/Route]  | Stripe          | API Call       | Outbound | ✅/⚠️/❌ |
| [Service/Route]  | Email Provider  | API Call       | Outbound | ✅/⚠️/❌ |
| [Service/Route]  | [LLM Provider]  | API Call       | Outbound | ✅/⚠️/❌ |

### 7.1 Szczegóły integracji zewnętrznych

| ID    | Moduł  | External | Endpoint/Event | Trigger | Opis   | Status   |
| ----- | ------ | -------- | -------------- | ------- | ------ | -------- |
| EX-01 | [name] | Stripe   | `invoice.paid` | Webhook | [opis] | ✅/⚠️/❌ |
| EX-02 |        |          |                |         |        |          |

---

## 8. Graf zależności (Dependency Graph)

### 8.1 Widok wysokopoziomowy

```
                              ┌─────────────────┐
                              │   EXTERNAL      │
                              │ (Stripe, Email) │
                              └────────┬────────┘
                                       │
                                       ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  FRONTEND   │───>│    API      │───>│  SERVICES   │
│             │    │             │    │             │
│ • View 1    │    │ • /api/a    │    │ • ServiceA  │
│ • View 2    │    │ • /api/b    │    │ • ServiceB  │
│ • View 3    │    │ • /api/c    │    │ • ServiceC  │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                              │
                                              ▼
                                     ┌─────────────┐
                                     │  DATABASE   │
                                     │             │
                                     │ • table_1   │
                                     │ • table_2   │
                                     │ • table_3   │
                                     └─────────────┘
```

### 8.2 Widok szczegółowy przepływu

```
[Uzupełnij diagram specyficzny dla tego przepływu]

Przykład:
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Partner Portal  │     │  Admin Settings  │     │  SA Revenue      │
│                  │     │                  │     │                  │
│ ReferralTools    │────>│ PartnerCode      │────>│ Settlements      │
│ Section          │     │ Input            │     │ View             │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ /api/partners/   │     │ /api/org/        │     │ /api/superadmin/ │
│ referral-tools   │     │ partner-code     │     │ settlements      │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    partnerReferralService                           │
│                    partnerCommissionService                         │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  partner_organizations │ partner_attributions │ partner_commissions │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. Reguły biznesowe (Business Rules)

Reguły które muszą być spełnione w zależnościach:

| ID    | Reguła                                              | Moduły zaangażowane | Walidacja w        | Status   |
| ----- | --------------------------------------------------- | ------------------- | ------------------ | -------- |
| BR-01 | [Opis reguły - np. "Kod partnera musi być aktywny"] | [A, B, C]           | [gdzie sprawdzane] | ✅/⚠️/❌ |
| BR-02 | [Opis reguły]                                       |                     |                    |          |
| BR-03 | [Opis reguły]                                       |                     |                    |          |

---

## 10. Podsumowanie luk w zależnościach

### 10.1 Brakujące zależności

| ID         | Typ                 | Z        | Do    | Opis                         | Priority    |
| ---------- | ------------------- | -------- | ----- | ---------------------------- | ----------- |
| DEP-GAP-01 | [FE/API/Service/DB] | [źródło] | [cel] | [opis brakującej zależności] | 🔴/🟠/🟡/🟢 |
| DEP-GAP-02 |                     |          |       |                              |             |

### 10.2 Zależności z mock data

| ID      | Warstwa   | Moduł   | Opis           | Action needed      |
| ------- | --------- | ------- | -------------- | ------------------ |
| MOCK-01 | [warstwa] | [moduł] | [co jest mock] | [co trzeba zrobić] |
| MOCK-02 |           |         |                |                    |

### 10.3 Statystyki

| Metryka               | Wartość    |
| --------------------- | ---------- |
| Total zależności      | [N]        |
| Zaimplementowane (✅) | [N] ([X]%) |
| Częściowe (⚠️)        | [N] ([X]%) |
| Brakujące (❌)        | [N] ([X]%) |

---

## 11. Rekomendowane kolejność naprawy

Na podstawie analizy zależności, rekomendowana kolejność naprawy luk:

| Kolejność | Gap ID       | Opis   | Dlaczego najpierw                              |
| --------- | ------------ | ------ | ---------------------------------------------- |
| 1         | [DEP-GAP-XX] | [opis] | [uzasadnienie - np. "blokuje inne zależności"] |
| 2         | [DEP-GAP-XX] | [opis] | [uzasadnienie]                                 |
| 3         | [DEP-GAP-XX] | [opis] | [uzasadnienie]                                 |

---

_Matryca wygenerowana zgodnie z metodologią BFCS (Business Flow Completeness System)_
