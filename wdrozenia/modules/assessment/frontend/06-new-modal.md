# Assessment – New Assessment Modal

## Status: ✅ ZAIMPLEMENTOWANE

**Plik źródłowy:** `src/components/assessment/NewAssessmentModal.tsx`
**Ostatnia aktualizacja:** 2026-02-08

---

## Opis

Modal tworzenia nowego assessmentu. Umożliwia wybór frameworku, nadanie nazwy i opcjonalne powiązanie z projektem.

---

## UI

```
┌──────────────────────────────────────────────────┐
│ ✕               Create New Assessment            │
├──────────────────────────────────────────────────┤
│                                                   │
│  Assessment Name *                                │
│  ┌──────────────────────────────────────────┐    │
│  │ Digital Readiness Q1 2026                 │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  Framework *                                      │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌─────┐   │
│  │ DRD  │ │ SIRI │ │ ADMA │ │ CMMI │ │Lean │   │
│  │  ●   │ │  ○   │ │  ○   │ │  ○   │ │  ○  │   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └─────┘   │
│                                                   │
│  Project (optional)                               │
│  ┌──────────────────────────────────────────┐    │
│  │ Select project...                      ▼  │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  ℹ️ Assessment will be created in DRAFT status.   │
│     You can fill answers and submit for review.   │
│                                                   │
├──────────────────────────────────────────────────┤
│                     [Cancel]  [Create Assessment] │
└──────────────────────────────────────────────────┘
```

---

## Pola formularza

| Pole              | Typ               | Wymagane | Walidacja                   |
| ----------------- | ----------------- | -------- | --------------------------- |
| `name`            | text input        | ✅       | min 1, max 255 znaków       |
| `assessment_type` | radio/card select | ✅       | DRD, SIRI, ADMA, CMMI, LEAN |
| `project_id`      | select dropdown   | ❌       | UUID z listy projektów      |

---

## Zachowanie

1. **Walidacja:** Inline validation (nazwa wymagana, framework wymagany)
2. **Loading/Error:** Spinner podczas tworzenia, toast error jeśli API zawiedzie
3. **Po utworzeniu:** Automatyczne przekierowanie do `/assessment/:framework/:id`
4. **Domyślne statusy:** DRAFT, completion 0%, confidence 1

---

## API

```http
POST /api/assessment-workflow-v2/
Authorization: Bearer {token}

{
  "name": "Digital Readiness Q1 2026",
  "assessment_type": "DRD",
  "project_id": "optional-uuid"
}
```

---

## Standard

- Loading/error/empty + retry pattern
- Brak mock fallbacków (real API)
- Zgodne z `wdrozenia/standards/01-UI-UX-STANDARD.md`

---

## Powiązane

- `02-hub-filters.md` — filtry w hub (po utworzeniu assessment pojawia się na liście)
- `05-detail-view.md` — widok po utworzeniu
- `../backend/03-api-create.md` — specyfikacja API tworzenia
