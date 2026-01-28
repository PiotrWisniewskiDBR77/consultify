# ⚠️ Error Handling Standard (kanoniczny)

## Cel
Spójna obsługa błędów w całej aplikacji (frontend + backend), bez ukrywania problemów i bez „mock fallbacków”.

## Źródła
- (Legacy) `wdrozenia/standards/ERROR-HANDLING 2.md` – **nie jest kanoniczny**, ale zawiera dobre wzorce do przeniesienia.

## Frontend – wymagany wzorzec
- Każde wywołanie API: `try/catch`
- W błędzie:
  - log techniczny (`console.error`)
  - komunikat użytkownika (toast)
  - stan komponentu (error) + możliwość retry
- Komponenty listowe: **loading/error/empty** jako osobne stany renderowania.

## Backend – wymagany wzorzec
- Kontrolery: `try/catch` + log (`Logger`) + spójny format odpowiedzi błędu.
- Nie zwracamy „surowych” stacktrace w produkcji.

## Spójny format błędów API (propozycja kanonu)
```json
{
  "error": "ValidationError",
  "message": "Field X is required",
  "details": { "field": "x" }
}
```

## Zakaz
- **Zakaz** „use mock data on error”.
- **Zakaz** cichego ignorowania błędów.

## Historia zmian
- 2026-01-26: utworzono kanoniczny standard error handling

