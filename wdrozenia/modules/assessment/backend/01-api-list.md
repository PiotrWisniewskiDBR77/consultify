# Assessment – API list

## Cel

Lista endpointów assessment (CRUD + workflow + generate initiatives + attachments).

## Źródła

- Plan: `wdrozenia/plan-assessment-initiatives.md`
- Kod: `server/src/routes/assessment/` oraz `server/src/routes/assessment.routes.ts` (jeśli występuje)

**Ostatnia aktualizacja:** 2026-01-29

---

## 📋 Lista Endpointów

### Assessment Workflow v2 (Główny API)

**Base path:** `/api/assessment-workflow-v2`

| Method | Endpoint | Opis                                                |
| ------ | -------- | --------------------------------------------------- |
| GET    | `/:id`   | Pobranie assessmentu po ID                          |
| POST   | `/`      | Utworzenie nowego assessmentu                       |
| PUT    | `/:id`   | Aktualizacja assessmentu (odpowiedzi, completion %) |
| DELETE | `/:id`   | Usunięcie assessmentu                               |

**Szczegóły:** Zobacz `02-api-detail.md`

---

### Assessment Level Attachments (Nowy - 2026-01-29)

**Base path:** `/api/assessment-level-attachments`

| Method | Endpoint                                    | Opis                                    |
| ------ | ------------------------------------------- | --------------------------------------- |
| POST   | `/`                                         | Upload załącznika (multipart/form-data) |
| GET    | `/level/:assessmentId/:axisId/:levelNumber` | Lista załączników dla poziomu           |
| GET    | `/download/:attachmentId`                   | Pobranie pliku                          |
| PUT    | `/:attachmentId/description`                | Aktualizacja opisu załącznika           |
| DELETE | `/:attachmentId`                            | Usunięcie załącznika                    |

**Szczegóły:** Zobacz `08-level-attachments.md` w `frontend/`

**Query params (GET /level/...):**

- `areaId` (optional) - ID obszaru (dla DRD)

**Body (POST /):**

```json
{
  "file": File,
  "assessmentId": "string",
  "axisId": "string",
  "levelNumber": number,
  "areaId": "string (optional)",
  "attachmentType": "EVIDENCE | SCREENSHOT | DOCUMENT | REPORT | OTHER",
  "description": "string (optional)"
}
```

---

### Assessment Hub

**Base path:** `/api/assessment-hub`

| Method | Endpoint          | Opis                                       |
| ------ | ----------------- | ------------------------------------------ |
| GET    | `/my-assessments` | Lista assessmentów użytkownika             |
| GET    | `/`               | Lista wszystkich assessmentów (z filtrami) |
| GET    | `/:id`            | Szczegóły assessmentu                      |
| POST   | `/`               | Utworzenie nowego assessmentu              |
| PUT    | `/:id/status`     | Zmiana statusu assessmentu                 |
| DELETE | `/:id`            | Usunięcie assessmentu                      |

---

### Assessment Workflow (v1 - Legacy)

**Base path:** `/api/assessment-workflow`

| Method | Endpoint                           | Opis                      |
| ------ | ---------------------------------- | ------------------------- |
| GET    | `/:assessmentId/status`            | Status assessmentu        |
| POST   | `/:assessmentId/initialize`        | Inicjalizacja workflow    |
| POST   | `/:assessmentId/submit-for-review` | Wysłanie do review        |
| POST   | `/:assessmentId/approve`           | Zatwierdzenie assessmentu |
| POST   | `/:assessmentId/reject`            | Odrzucenie assessmentu    |
| GET    | `/:assessmentId/versions`          | Lista wersji assessmentu  |
| GET    | `/:assessmentId/history`           | Historia zmian            |
| POST   | `/:assessmentId/restore/:version`  | Przywrócenie wersji       |
| GET    | `/pending-reviews`                 | Lista oczekujących review |
| POST   | `/reviews/:reviewId/start`         | Rozpoczęcie review        |
| POST   | `/reviews/:reviewId/submit`        | Zakończenie review        |

---

### Assessment AI

**Base path:** `/api/assessment-ai`

| Method | Endpoint                                 | Opis                         |
| ------ | ---------------------------------------- | ---------------------------- |
| POST   | `/:projectId/ai/suggest-justification`   | Sugestia uzasadnienia        |
| POST   | `/:projectId/ai/suggest-evidence`        | Sugestia dowodu              |
| POST   | `/:projectId/ai/suggest-target`          | Sugestia poziomu docelowego  |
| POST   | `/:projectId/ai/correct-text`            | Korekta tekstu               |
| POST   | `/:projectId/ai/autocomplete`            | Autouzupełnianie             |
| POST   | `/:projectId/ai/validate-field`          | Walidacja pola               |
| POST   | `/:projectId/ai/validate`                | Walidacja całego assessmentu |
| POST   | `/:projectId/ai/guidance`                | Wskazówki AI                 |
| POST   | `/:projectId/ai/gap/:axisId`             | Analiza gap dla osi          |
| GET    | `/:projectId/ai/insights`                | Insights AI                  |
| POST   | `/:projectId/ai/clarify`                 | Wyjaśnienie                  |
| POST   | `/:projectId/ai/executive-summary`       | Executive summary            |
| POST   | `/:projectId/ai/stakeholder-view`        | Widok stakeholder            |
| POST   | `/:projectId/ai/benchmark-commentary`    | Komentarz benchmark          |
| POST   | `/:projectId/ai/generate-initiatives`    | Generowanie inicjatyw        |
| POST   | `/:projectId/ai/prioritize-initiatives`  | Priorytetyzacja inicjatyw    |
| POST   | `/:projectId/ai/estimate-roi`            | Szacowanie ROI               |
| POST   | `/:projectId/ai/quick-actions`           | Szybkie akcje                |
| POST   | `/:projectId/ai/contextual-help`         | Kontekstowa pomoc            |
| POST   | `/:projectId/ai/fill-missing`            | Wypełnienie brakujących      |
| POST   | `/:projectId/ai/review-justifications`   | Review uzasadnień            |
| POST   | `/:projectId/ai/reports/full`            | Pełny raport                 |
| POST   | `/:projectId/ai/reports/stakeholder`     | Raport stakeholder           |
| POST   | `/:projectId/ai/reports/benchmark`       | Raport benchmark             |
| POST   | `/:projectId/ai/reports/initiative-plan` | Plan inicjatywy              |
| GET    | `/:projectId/ai/reports/types`           | Lista typów raportów         |

---

### Assessments (Legacy)

**Base path:** `/api/assessments`

| Method | Endpoint                             | Opis                           |
| ------ | ------------------------------------ | ------------------------------ |
| GET    | `/my-assessments`                    | Lista assessmentów użytkownika |
| GET    | `/:id`                               | Szczegóły assessmentu          |
| POST   | `/`                                  | Utworzenie assessmentu         |
| PUT    | `/:id/status`                        | Zmiana statusu                 |
| DELETE | `/:id`                               | Usunięcie                      |
| POST   | `/:id/complete`                      | Oznaczenie jako ukończony      |
| POST   | `/:id/generate-initiatives`          | Generowanie inicjatyw          |
| POST   | `/:id/responses/:questionId`         | Dodanie odpowiedzi             |
| GET    | `/:id/responses`                     | Lista odpowiedzi               |
| GET    | `/frameworks/list`                   | Lista frameworków              |
| GET    | `/frameworks/:frameworkId/questions` | Pytania dla frameworku         |

---

## 🔐 Middleware

Wszystkie endpointy używają:

1. **authRateLimiter** - rate limiting
2. **verifyToken** - weryfikacja tokenu JWT
3. **demoContextMiddleware** - kontekst demo (jeśli dotyczy)

---

## 📊 Status Codes

| Code | Opis                  |
| ---- | --------------------- |
| 200  | Success               |
| 201  | Created               |
| 400  | Bad Request           |
| 401  | Unauthorized          |
| 403  | Forbidden             |
| 404  | Not Found             |
| 500  | Internal Server Error |

---

## 📚 Powiązane Dokumenty

- `02-api-detail.md` - szczegółowa dokumentacja API
- `03-api-create.md` - dokumentacja tworzenia assessmentu
- `../frontend/08-level-attachments.md` - dokumentacja systemu załączników
- `../00-OVERVIEW.md` - przegląd modułu Assessment
