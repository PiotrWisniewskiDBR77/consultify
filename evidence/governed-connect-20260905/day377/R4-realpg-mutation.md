# Dyżur 377 — R4: RealPG, cross-org i mutacje

## Para HTTP przed/po

| Trasa | Przed | Po |
| --- | --- | --- |
| `POST /api/settings/integrations/google_drive/connect` | `500 {}` | `501 {"error":"Integracja nie jest dostępna w tej wersji","code":"GOVERNED_CONNECTOR_NOT_APPROVED"}` |
| `POST /api/integrations/connect/google_drive` | `500 {}` | `501 {"error":"Integracja nie jest dostępna w tej wersji","code":"GOVERNED_CONNECTOR_NOT_APPROVED"}` |

Przed: `/private/tmp/cx-day377-governed-connect-artefakty/day377-before.json`. Po: `/private/tmp/cx-day377-governed-connect-artefakty/day377-after.json`.

## Pełne nazwy i mianownik

Przed naprawą te same trzy przypadki były uruchomione i czerwone:

- `Day 377 — governed connector rejection is honest and tenant-safe returns structured 501 from the settings connect route`
- `Day 377 — governed connector rejection is honest and tenant-safe returns structured 501 from the canonical integrations connect route`
- `Day 377 — governed connector rejection is honest and tenant-safe rejects both organizations without writing integration rows`

Po naprawie wszystkie trzy pełne nazwy są zielone; żadna nie zniknęła. Test frontu jest zielony pod pełną nazwą:

- `ConnectedAppsSettings governed connect honesty shows the server rejection and does not start OAuth for Teams`

## Cross-org i brak zapisu

User A z organizacji A i user B z organizacji B, obaj uwierzytelnieni własnym podpisanym JWT i posiadający aktywne członkostwo, otrzymali identyczne `501/GOVERNED_CONNECTOR_NOT_APPROVED`. Zapytanie po obu wywołaniach:

```sql
SELECT organization_id, count(*)
FROM integrations
WHERE connector_id='google_drive'
GROUP BY organization_id;
```

Wynik: `(0 rows)`. Odrzucenie następuje przed pierwszym zapisem dla obu organizacji.

## Dowód mutacyjny dwóch plików

1. W `server/src/routes/settings.routes.ts` tymczasowo wyłączono gałąź wspólnej klasyfikacji wyłącznie wokół pierwszego wywołania. Przypadek `returns structured 501 from the settings connect route` stał się czerwony: `expected 500 to be 501`. Po przywróceniu pliku z kopii w scratch `git diff --exit-code -- server/src/routes/settings.routes.ts` zakończył się bez różnicy. Artefakt: `/private/tmp/cx-day377-governed-connect-artefakty/mutation-settings-red.json`.
2. W `server/src/routes/integrations/integrations.routes.ts` tymczasowo wyłączono gałąź klasyfikacji dla kanonicznej trasy. Przypadek `returns structured 501 from the canonical integrations connect route` stał się czerwony: `expected 500 to be 501`. Po przywróceniu `git diff --exit-code -- server/src/routes/integrations/integrations.routes.ts` zakończył się bez różnicy. Artefakt: `/private/tmp/cx-day377-governed-connect-artefakty/mutation-integrations-red.json`.

Mutacje dotknęły dwóch różnych plików i dwóch różnych wejść HTTP. Pozostałe miejsca są związane tym samym eksportowanym predykatem; ich komplet potwierdza statyczny mianownik sześciu wywołań.

## Pułapki dowodowe

Pakiet RealPG uruchomiono przez realny `ApiGateway` z pełnym env w tej samej linii, lokalnym `DATABASE_URL` do `127.0.0.1:6448/cx377`, `ENABLE_TEST_AUTH_BYPASS=false`, `ENABLE_V8_GLOBAL=true`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` i `--retry=0`. `DB_IDENTITY` potwierdził lokalny PostgreSQL. Pakiet frontu był jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`) i dowodzi wyłącznie zachowania DOM/fetch/toast, nie backendu.
