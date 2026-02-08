# Assessment – API Create (Tworzenie Assessmentu)

## Status: ✅ ZAIMPLEMENTOWANE

**Ostatnia aktualizacja:** 2026-02-08

---

## Endpoint

`POST /api/assessment-workflow-v2/`

---

## Request

```json
{
  "name": "DRD Assessment Q1 2026",
  "assessment_type": "DRD",
  "project_id": "optional-uuid"
}
```

### Wymagane pola

| Pole | Typ | Opis |
|------|-----|------|
| `name` | string | Nazwa assessmentu |
| `assessment_type` | enum | Framework: `DRD`, `SIRI`, `ADMA`, `CMMI`, `LEAN` |

### Opcjonalne pola

| Pole | Typ | Opis |
|------|-----|------|
| `project_id` | string (UUID) | Powiązanie z projektem |

---

## Response (201)

```json
{
  "id": "uuid-v4",
  "name": "DRD Assessment Q1 2026",
  "assessment_type": "DRD",
  "status": "DRAFT",
  "organization_id": "org-uuid",
  "project_id": null,
  "completion_percent": 0,
  "confidence_avg": 1,
  "answers_json": "{}",
  "created_at": "2026-02-08T10:00:00.000Z",
  "created_by": "user-uuid",
  "updated_at": "2026-02-08T10:00:00.000Z"
}
```

---

## Permissions

- **Wymagana rola:** `USER` lub wyższa
- **Middleware:** `verifyToken` (JWT)
- **Walidacja:** Zod schema `CreateAssessmentSchema`

---

## Domyślne statusy

| Pole | Wartość domyślna |
|------|------------------|
| `status` | `DRAFT` |
| `completion_percent` | `0` |
| `confidence_avg` | `1` |
| `answers_json` | `"{}"` |

---

## Walidacja (Zod)

```typescript
const CreateAssessmentSchema = z.object({
  name: z.string().min(1).max(255),
  assessment_type: z.enum(['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN']),
  project_id: z.string().uuid().optional(),
});
```

---

## Side Effects

1. **Audit log:** Wpis `assessment_created` w tabeli logów
2. **Notyfikacja:** Powiadomienie dla PMO (jeśli skonfigurowane)
3. **Session:** Automatyczne otwarcie sesji edycji

---

## Error Responses

| Code | Opis |
|------|------|
| 400 | Brak wymaganych pól |
| 401 | Brak autoryzacji |
| 422 | Walidacja Zod (nieprawidłowy framework) |
| 500 | Błąd serwera |

---

## Powiązane

- `02-api-detail.md` — pełna lista kontraktów
- `01-api-list.md` — przegląd endpointów
- `../features/01-scoring.md` — scoring po utworzeniu