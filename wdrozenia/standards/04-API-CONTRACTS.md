# 🔌 API Contracts Standard (kanoniczny)

## Cel
Ujednolicić kontrakty API tak, żeby frontend był przewidywalny, testy E2E stabilne, a integracje modułów „nie rozjeżdżały się” w czasie.

## Zasady (minimum)
- **REST-ish**: zasoby, kolekcje, identyfikatory.
- **Spójne odpowiedzi**: ten sam kształt dla listy i detalu.
- **Błędy w jednym formacie**.
- **Filtry/paginacja/sortowanie** – przewidywalne parametry.

## Konwencje endpointów
- Kolekcja: `GET /api/<resource>`
- Detal: `GET /api/<resource>/:id`
- Create: `POST /api/<resource>`
- Update: `PUT /api/<resource>/:id` (pełny) lub `PATCH` (częściowy)
- Delete: `DELETE /api/<resource>/:id` (jeśli dozwolone)

## Lista (response)
Preferowany format:
```json
{
  "items": [],
  "meta": { "total": 0, "page": 1, "pageSize": 50 }
}
```

## Detal (response)
Preferowany format:
```json
{
  "item": {}
}
```

## Błędy (response)
```json
{
  "error": "ValidationError",
  "message": "Field X is required",
  "details": {}
}
```

## Query params (kanon)
- `q` – search
- `status` – status (single)
- `statuses` – status (multi, CSV lub repeated params)
- `page`, `pageSize`
- `sort` – np. `updatedAt:desc`

## Historia zmian
- 2026-01-26: utworzono kanoniczny standard kontraktów API

